import { sessionRepository } from '../repositories/session.repository.js';
import { candidateRepository } from '../repositories/candidate.repository.js';
import { institutionProfileRepository } from '../repositories/institution-profile.repository.js';
import { personRepository } from '../repositories/person.repository.js';
import { positionRepository } from '../repositories/position.repository.js';
import { voteRepository } from '../repositories/vote.repository.js';
import { candidateService } from './candidate.service.js';
import { isUniqueViolation } from '../database/index.js';
import { CANDIDATE_STATUS } from '../rules/candidate-rules.js';
import { SESSION_LIMITS, SESSION_STATUS } from '../rules/session-rules.js';
import { AppError, badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { generateCandidacyCode, generateSessionCode } from '../utils/id.js';
import { isPlainObject } from '../utils/object.js';

// Só 10 mil códigos de 4 dígitos (ou 456 mil de 4 letras) existem, então colisão é
// esperada (não um bug) — tenta de novo com outro código sorteado até um ficar livre.
const MAX_CODE_ATTEMPTS = 20;

async function withUniqueCode(generator, createOrUpdate) {
  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt += 1) {
    try {
      return await createOrUpdate(generator());
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === MAX_CODE_ATTEMPTS) throw error;
    }
  }
}

export const withUniqueSessionCode = (createOrUpdate) => withUniqueCode(generateSessionCode, createOrUpdate);

// Link público de candidatura (Etapa 20) — mesmo mecanismo do link de votação acima.
export const withUniqueCandidacyCode = (createOrUpdate) => withUniqueCode(generateCandidacyCode, createOrUpdate);

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
// criadas antes de cada link público existir ganham o token faltante na
// primeira leitura (preenche sozinho, sem precisar de uma migração separada).
async function withStats(session) {
  let current = session;
  if (!current.publicToken) {
    current = await withUniqueSessionCode((publicToken) =>
      sessionRepository.update(current.id, { publicToken }),
    );
  }
  if (!current.candidacyToken) {
    current = await withUniqueCandidacyCode((candidacyToken) =>
      sessionRepository.update(current.id, { candidacyToken }),
    );
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
    const session = await withUniqueSessionCode((publicToken) =>
      withUniqueCandidacyCode((candidacyToken) =>
        sessionRepository.create({
          ...data,
          userId,
          publicToken,
          candidacyToken,
          status: SESSION_STATUS.DRAFT,
          createdAt: new Date().toISOString(),
          startedAt: null,
          finishedAt: null,
        }),
      ),
    );
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

  // Cria uma sessão nova (rascunho) com os mesmos cargos da sessão de origem, e
  // recria como candidatura nova cada candidato marcado em `candidateIds` (só
  // aceita os que estão ACTIVE na sessão de origem — pessoa e partido não são
  // duplicados, só referenciados, já que já são cadastros por conta). Se algum
  // candidato não puder ser recriado (ex.: partido ficou inativo desde então),
  // ele é pulado em vez de derrubar a operação inteira — a sessão de origem não
  // é tocada em nenhum momento.
  async duplicate(sourceId, input, userId) {
    const source = await findOrFail(sourceId, userId);
    const data = isPlainObject(input) ? input : {};

    const newSession = await sessionService.create(
      { name: data.name, year: data.year, positions: source.positions },
      userId,
    );

    const candidateIds = Array.isArray(data.candidateIds) ? data.candidateIds : [];
    const sourceCandidates = candidateIds.length
      ? await candidateRepository.findWhere(
          (c) =>
            c.sessionId === sourceId &&
            c.userId === userId &&
            c.status === CANDIDATE_STATUS.ACTIVE &&
            candidateIds.includes(c.id),
        )
      : [];

    const people = await personRepository.findAllForUser(userId);
    const nameByPersonId = new Map(people.map((p) => [p.id, p.name]));

    const copied = [];
    const skipped = [];
    for (const candidate of sourceCandidates) {
      try {
        copied.push(
          await candidateService.create(
            {
              sessionId: newSession.id,
              partyId: candidate.partyId,
              personId: candidate.personId,
              position: candidate.position,
              number: candidate.number,
              governmentProposal: candidate.governmentProposal,
            },
            userId,
          ),
        );
      } catch (err) {
        if (!(err instanceof AppError)) throw err;
        skipped.push({ name: nameByPersonId.get(candidate.personId) ?? candidate.personId, reason: err.message });
      }
    }

    return { session: await sessionService.getById(newSession.id, userId), copied: copied.length, skipped };
  },
};
