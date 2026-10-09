import { candidateRepository } from '../repositories/candidate.repository.js';
import { partyRepository } from '../repositories/party.repository.js';
import { personRepository } from '../repositories/person.repository.js';
import { positionRepository } from '../repositories/position.repository.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { PERSON_LIMITS } from '../rules/person-rules.js';
import { SESSION_STATUS } from '../rules/session-rules.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { isPlainObject, normalizeText } from '../utils/object.js';
import { isStoredPhotoPath, parsePhotoDataUri, photoStorage } from '../storage/photo-storage.js';
import { resultService } from './result.service.js';

// Uma captura da webcam (480x480, JPEG, ver PhotoCaptureField.jsx) fica na casa de
// dezenas de KB — bem abaixo disso. O limite também precisa caber com folga no
// corpo da requisição JSON como um todo (MAX_BODY_BYTES em utils/http.js), já que
// o base64 inflaciona ~33%.
const PHOTO_MAX_BYTES = 300_000;

function normalizeName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw badRequest('PERSON_NAME_REQUIRED', 'Informe o nome.');
  if (name.length > PERSON_LIMITS.nameMaxLength) {
    throw badRequest('PERSON_NAME_TOO_LONG', `O nome pode ter no máximo ${PERSON_LIMITS.nameMaxLength} caracteres.`);
  }
  return name;
}

// Aceita três formatos de entrada: um endereço http(s) (link externo), um caminho
// já salvo por este serviço (edição sem trocar a foto), ou uma captura da webcam
// em data URI — que é decodificada e gravada em disco por photoStorage.save.
async function normalizePhoto(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw badRequest('PERSON_PHOTO_INVALID', 'A foto deve ser um endereço http(s) ou uma captura da câmera.');
  }

  if (isStoredPhotoPath(value)) return value;

  const dataUri = parsePhotoDataUri(value);
  if (dataUri) {
    if (!dataUri.extension) {
      throw badRequest('PERSON_PHOTO_INVALID', 'Formato de imagem não suportado.');
    }
    if (dataUri.buffer.length > PHOTO_MAX_BYTES) {
      throw badRequest('PERSON_PHOTO_TOO_LARGE', 'A foto capturada é grande demais.');
    }
    return photoStorage.save(dataUri.buffer, dataUri.extension);
  }

  const photo = value.trim();
  if (!/^https?:\/\/\S+$/i.test(photo) || photo.length > PERSON_LIMITS.photoMaxLength) {
    throw badRequest(
      'PERSON_PHOTO_INVALID',
      'A foto deve ser um endereço http(s) válido ou uma captura da câmera.',
    );
  }
  return photo;
}

async function findOrFail(id, userId) {
  const person = await personRepository.findById(id);
  if (!person || person.userId !== userId) throw notFound('PERSON_NOT_FOUND', 'Pessoa não encontrada.');
  return person;
}

async function withCandidaciesCount(person, countByPerson) {
  const count = countByPerson
    ? countByPerson.get(person.id) ?? 0
    : (await candidateRepository.findWhere((c) => c.personId === person.id)).length;
  return { ...person, candidaciesCount: count };
}

// Votos e "eleito" só existem depois da apuração (sessão finalizada) — monta um mapa
// candidateId -> {votes, elected} reaproveitando o tally que já existe em
// resultService (um tally por sessão finalizada, não um por candidato) pra servir
// tanto o ranking da listagem quanto a tela de detalhes de uma pessoa.
async function buildCandidateOutcomes(candidates) {
  const sessionIds = [...new Set(candidates.map((c) => c.sessionId))];
  const sessions = await Promise.all(sessionIds.map((id) => sessionRepository.findById(id)));
  const finishedSessions = sessions.filter((s) => s?.status === SESSION_STATUS.FINISHED);
  const results = await Promise.all(finishedSessions.map((s) => resultService.getForSession(s)));

  const outcomes = new Map();
  for (const { positions } of results) {
    for (const position of positions) {
      for (const candidate of position.candidates) {
        outcomes.set(candidate.id, { votes: candidate.votes, elected: position.winners.includes(candidate.id) });
      }
    }
  }
  return outcomes;
}

const emptyStats = () => ({ candidaciesCount: 0, proposalsCount: 0, totalVotes: 0, electionsWon: 0 });

export const personService = {
  // Lista pensada tanto pro seletor "reaproveitar candidato existente" (formulário
  // de candidatos) quanto pro ranking da tela Pessoas: candidaturas, propostas
  // registradas, votos somados e eleições vencidas (só contam sessões já apuradas).
  async list(filters = {}, userId) {
    const search = normalizeText(filters.search).trim();
    let people = await personRepository.findAllForUser(userId);
    if (search) people = people.filter((p) => normalizeText(p.name).includes(search));

    const candidates = await candidateRepository.findAllForUser(userId);
    const outcomes = await buildCandidateOutcomes(candidates);

    const statsByPerson = new Map();
    for (const c of candidates) {
      const stats = statsByPerson.get(c.personId) ?? emptyStats();
      stats.candidaciesCount += 1;
      if (c.governmentProposal) stats.proposalsCount += 1;
      const outcome = outcomes.get(c.id);
      if (outcome) {
        stats.totalVotes += outcome.votes;
        if (outcome.elected) stats.electionsWon += 1;
      }
      statsByPerson.set(c.personId, stats);
    }

    const withStats = people.map((p) => ({ ...p, ...(statsByPerson.get(p.id) ?? emptyStats()) }));
    return withStats.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  },

  // Tela de detalhes da pessoa: todas as candidaturas (sessão, cargo, partido,
  // número, proposta) com votos e resultado (eleito/não eleito) de quem já foi
  // apurado — sessões ainda não finalizadas entram sem esses dois dados.
  async getById(id, userId) {
    const person = await findOrFail(id, userId);
    const candidates = await candidateRepository.findWhere((c) => c.personId === id && c.userId === userId);

    const sessionIds = [...new Set(candidates.map((c) => c.sessionId))];
    const [sessions, parties, positions, outcomes] = await Promise.all([
      Promise.all(sessionIds.map((sid) => sessionRepository.findById(sid))),
      partyRepository.findAllForUser(userId),
      positionRepository.findAllForUser(userId),
      buildCandidateOutcomes(candidates),
    ]);
    const sessionsById = new Map(sessions.filter(Boolean).map((s) => [s.id, s]));
    const partiesById = new Map(parties.map((p) => [p.id, p]));
    const positionLabels = Object.fromEntries(positions.map((p) => [p.code, p.label]));

    const stats = emptyStats();
    const candidacies = candidates.map((c) => {
      const session = sessionsById.get(c.sessionId);
      const party = partiesById.get(c.partyId);
      const outcome = outcomes.get(c.id) ?? null;

      stats.candidaciesCount += 1;
      if (c.governmentProposal) stats.proposalsCount += 1;
      if (outcome) {
        stats.totalVotes += outcome.votes;
        if (outcome.elected) stats.electionsWon += 1;
      }

      return {
        id: c.id,
        sessionId: c.sessionId,
        sessionName: session?.name ?? null,
        sessionYear: session?.year ?? null,
        sessionStatus: session?.status ?? null,
        position: c.position,
        positionLabel: positionLabels[c.position] ?? c.position,
        number: c.number,
        status: c.status,
        party: party
          ? { id: party.id, name: party.name, acronym: party.acronym, number: party.number }
          : null,
        governmentProposal: c.governmentProposal,
        votes: outcome?.votes ?? null,
        elected: outcome?.elected ?? null,
      };
    });

    candidacies.sort((a, b) => (b.sessionYear ?? 0) - (a.sessionYear ?? 0));

    return { ...person, ...stats, candidacies };
  },

  async create(input, userId) {
    const data = isPlainObject(input) ? input : {};
    const name = normalizeName(data.name);
    const photo = await normalizePhoto(data.photo);
    const person = await personRepository.create({ name, photo, userId, createdAt: new Date().toISOString() });
    return withCandidaciesCount(person);
  },

  async update(id, input, userId) {
    const current = await findOrFail(id, userId);
    const changes = isPlainObject(input) ? input : {};
    const name = normalizeName(changes.name ?? current.name);
    const photo = await normalizePhoto(changes.photo ?? current.photo);

    const updated = await personRepository.update(id, { name, photo });
    // Só apaga o arquivo antigo depois que a atualização é confirmada, e só se
    // realmente era um arquivo nosso (link externo ou nulo não tem o que apagar).
    if (current.photo && current.photo !== photo) await photoStorage.remove(current.photo);
    return withCandidaciesCount(updated);
  },

  // Bloqueia a remoção se a pessoa já tem candidatura em alguma sessão — o
  // histórico de candidaturas/votos nunca pode ficar sem a pessoa que referencia.
  async remove(id, userId) {
    const person = await findOrFail(id, userId);
    const candidacies = await candidateRepository.findWhere((c) => c.personId === id);
    if (candidacies.length > 0) {
      throw conflict('PERSON_IN_USE', 'Esta pessoa está vinculada a candidaturas e não pode ser removida.');
    }
    await personRepository.delete(id);
    if (person.photo) await photoStorage.remove(person.photo);
  },
};
