import { sessionRepository } from '../repositories/session.repository.js';
import { candidateRepository } from '../repositories/candidate.repository.js';
import { institutionProfileRepository } from '../repositories/institution-profile.repository.js';
import { positionRepository } from '../repositories/position.repository.js';
import { voteRepository } from '../repositories/vote.repository.js';
import { CANDIDATE_STATUS } from '../rules/candidate-rules.js';
import { SESSION_LIMITS, SESSION_STATUS } from '../rules/session-rules.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { generatePublicToken } from '../utils/id.js';
import { isPlainObject } from '../utils/object.js';

// Valida e normaliza os dados vindos da requisição. Lança o primeiro erro encontrado.
async function normalizeInput(input, userId) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    throw badRequest('SESSION_NAME_REQUIRED', 'Informe o nome da sessão.');
  }
  if (name.length > SESSION_LIMITS.nameMaxLength) {
    throw badRequest(
      'SESSION_NAME_TOO_LONG',
      `O nome pode ter no máximo ${SESSION_LIMITS.nameMaxLength} caracteres.`,
    );
  }

  if (input.year === undefined || input.year === null || input.year === '') {
    throw badRequest('SESSION_YEAR_REQUIRED', 'Informe o ano da sessão.');
  }
  const year = Number(input.year);
  if (!Number.isInteger(year) || year < SESSION_LIMITS.minYear || year > SESSION_LIMITS.maxYear) {
    throw badRequest(
      'SESSION_YEAR_INVALID',
      `O ano deve estar entre ${SESSION_LIMITS.minYear} e ${SESSION_LIMITS.maxYear}.`,
    );
  }

  if (!Array.isArray(input.positions) || input.positions.length === 0) {
    throw badRequest('SESSION_POSITIONS_REQUIRED', 'Selecione ao menos um cargo.');
  }
  const allPositions = await positionRepository.findAllForUser(userId);
  const positionByCode = new Map(allPositions.map((p) => [p.code, p]));
  const invalid = input.positions.filter((code) => !positionByCode.has(code));
  if (invalid.length > 0) {
    throw badRequest('SESSION_POSITION_INVALID', `Cargo inválido: ${invalid.join(', ')}.`);
  }
  const positions = [...new Set(input.positions)].sort(
    (a, b) => positionByCode.get(a).order - positionByCode.get(b).order,
  );

  return { name, year, positions };
}

async function findOrFail(id, userId) {
  const session = await sessionRepository.findById(id);
  if (!session || session.userId !== userId) throw notFound('SESSION_NOT_FOUND', 'Sessão não encontrada.');
  return session;
}

// Acrescenta os totais que o dashboard e a tela de detalhes exibem. Sessões
// criadas antes do link público ganham um token na primeira leitura (preenche
// sozinho, sem precisar de uma migração separada).
async function withStats(session) {
  let current = session;
  if (!current.publicToken) {
    current = await sessionRepository.update(current.id, { publicToken: generatePublicToken() });
  }

  const [candidatesCount, votesCount] = await Promise.all([
    candidateRepository.countBySession(current.id),
    voteRepository.countBySession(current.id),
  ]);
  return { ...current, positionsCount: current.positions.length, candidatesCount, votesCount };
}

// Impede tirar um cargo da sessão enquanto ele ainda tiver candidato ativo —
// senão o candidato fica "órfão" (status ACTIVE, mas inalcançável: a votação só
// pergunta pelos cargos que sobraram em `positions`). A professora precisa
// desativar esses candidatos primeiro (possível enquanto a sessão é DRAFT).
async function assertNoCandidatesInRemovedPositions(session, nextPositions, userId) {
  const removed = session.positions.filter((code) => !nextPositions.includes(code));
  if (removed.length === 0) return;

  const affected = await candidateRepository.findWhere(
    (c) => c.sessionId === session.id && c.status === CANDIDATE_STATUS.ACTIVE && removed.includes(c.position),
  );
  if (affected.length === 0) return;

  const allPositions = await positionRepository.findAllForUser(userId);
  const labelByCode = new Map(allPositions.map((p) => [p.code, p.label]));
  const labels = [...new Set(affected.map((c) => labelByCode.get(c.position) ?? c.position))];
  throw conflict(
    'SESSION_POSITION_HAS_CANDIDATES',
    `Desative os candidatos de ${labels.join(', ')} antes de remover ${labels.length === 1 ? 'esse cargo' : 'esses cargos'} da sessão.`,
  );
}

async function changeStatus(id, userId, { from, to, timestampField, errorMessage }) {
  const session = await findOrFail(id, userId);
  if (session.status !== from) {
    throw conflict('INVALID_SESSION_STATUS', errorMessage);
  }
  const updated = await sessionRepository.update(id, {
    status: to,
    [timestampField]: new Date().toISOString(),
  });
  return withStats(updated);
}

export const sessionService = {
  async list(userId) {
    const sessions = await sessionRepository.findAllForUser(userId);
    sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Promise.all(sessions.map(withStats));
  },

  async getById(id, userId) {
    return withStats(await findOrFail(id, userId));
  },

  async create(input, userId) {
    const institutionProfile = await institutionProfileRepository.findByUserId(userId);
    if (!institutionProfile) {
      throw forbidden(
        'INSTITUTION_PROFILE_REQUIRED',
        'Cadastre os dados da instituição antes de criar uma sessão eleitoral.',
      );
    }

    const data = await normalizeInput(isPlainObject(input) ? input : {}, userId);
    const session = await sessionRepository.create({
      ...data,
      userId,
      publicToken: generatePublicToken(),
      status: SESSION_STATUS.DRAFT,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
    });
    return withStats(session);
  },

  async update(id, input, userId) {
    const current = await findOrFail(id, userId);
    if (current.status !== SESSION_STATUS.DRAFT) {
      throw conflict('SESSION_NOT_EDITABLE', 'Só é possível editar sessões em rascunho.');
    }
    const changes = isPlainObject(input) ? input : {};
    const data = await normalizeInput(
      { name: current.name, year: current.year, positions: current.positions, ...changes },
      userId,
    );
    await assertNoCandidatesInRemovedPositions(current, data.positions, userId);
    return withStats(await sessionRepository.update(id, data));
  },

  open(id, userId) {
    return changeStatus(id, userId, {
      from: SESSION_STATUS.DRAFT,
      to: SESSION_STATUS.OPEN,
      timestampField: 'startedAt',
      errorMessage: 'Só é possível abrir a votação de uma sessão em rascunho.',
    });
  },

  finish(id, userId) {
    return changeStatus(id, userId, {
      from: SESSION_STATUS.OPEN,
      to: SESSION_STATUS.FINISHED,
      timestampField: 'finishedAt',
      errorMessage: 'Só é possível finalizar uma sessão com votação aberta.',
    });
  },
};
