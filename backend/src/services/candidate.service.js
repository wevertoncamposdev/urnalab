import { candidateRepository } from '../repositories/candidate.repository.js';
import { partyRepository } from '../repositories/party.repository.js';
import { personRepository } from '../repositories/person.repository.js';
import { positionRepository } from '../repositories/position.repository.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { CANDIDATE_IDENTITY_FIELDS, CANDIDATE_LIMITS, CANDIDATE_STATUS } from '../rules/candidate-rules.js';
import { PARTY_STATUS } from '../rules/party-rules.js';
import { SESSION_STATUS } from '../rules/session-rules.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { isPlainObject, normalizeText, pick } from '../utils/object.js';

// ---------- validações de campo ----------

// O número é guardado como texto para preservar zeros à esquerda ("05").
function normalizeNumber(value, positionRule) {
  const number = typeof value === 'number' ? String(value) : value;
  if (number === undefined || number === null || number === '') {
    throw badRequest('CANDIDATE_NUMBER_REQUIRED', 'Informe o número do candidato.');
  }
  if (typeof number !== 'string' || !/^\d+$/.test(number) || number.length !== positionRule.digits) {
    throw badRequest(
      'CANDIDATE_NUMBER_INVALID',
      `Para ${positionRule.label}, o número deve ter exatamente ${positionRule.digits} dígitos.`,
    );
  }
  return number;
}

// Não obrigatório: vazio/ausente vira null. Se preenchido, respeita o limite de tamanho.
function normalizeGovernmentProposal(value) {
  if (value === undefined || value === null) return null;
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  if (text.length > CANDIDATE_LIMITS.governmentProposalMaxLength) {
    throw badRequest(
      'CANDIDATE_GOVERNMENT_PROPOSAL_TOO_LONG',
      `A proposta de governo pode ter no máximo ${CANDIDATE_LIMITS.governmentProposalMaxLength} caracteres.`,
    );
  }
  return text;
}

function assertStatus(status) {
  if (!Object.values(CANDIDATE_STATUS).includes(status)) {
    throw badRequest('CANDIDATE_STATUS_INVALID', 'Status inválido. Use ACTIVE, INACTIVE ou PENDING.');
  }
}

// ---------- verificações que consultam outras entidades (sempre dentro da conta) ----------

async function requireSession(sessionId, userId) {
  if (!sessionId) throw badRequest('CANDIDATE_SESSION_REQUIRED', 'Informe a sessão do candidato.');
  const session = await sessionRepository.findById(sessionId);
  if (!session || session.userId !== userId) throw badRequest('CANDIDATE_SESSION_NOT_FOUND', 'Sessão não encontrada.');
  return session;
}

async function requireActiveParty(partyId, userId) {
  if (!partyId) throw badRequest('CANDIDATE_PARTY_REQUIRED', 'Informe o partido do candidato.');
  const party = await partyRepository.findById(partyId);
  if (!party || party.userId !== userId) throw badRequest('CANDIDATE_PARTY_NOT_FOUND', 'Partido não encontrado.');
  if (party.status !== PARTY_STATUS.ACTIVE) {
    throw conflict('CANDIDATE_PARTY_INACTIVE', 'Este partido está inativo e não aceita novos candidatos.');
  }
  return party;
}

async function requirePositionRule(session, code, userId) {
  if (!code) throw badRequest('CANDIDATE_POSITION_REQUIRED', 'Informe o cargo do candidato.');
  const rule = await positionRepository.findByCode(code, userId);
  if (!rule) throw badRequest('CANDIDATE_POSITION_INVALID', 'Cargo inválido.');
  if (!session.positions.includes(code)) {
    throw badRequest('CANDIDATE_POSITION_NOT_ENABLED', 'Este cargo não está habilitado nesta sessão.');
  }
  return rule;
}

// Erro com código de candidato (não de pessoa), pra aparecer no campo certo do formulário.
async function requirePerson(personId, userId) {
  if (!personId) throw badRequest('CANDIDATE_PERSON_REQUIRED', 'Informe a pessoa candidata.');
  const person = await personRepository.findById(personId);
  if (!person || person.userId !== userId) throw badRequest('CANDIDATE_PERSON_NOT_FOUND', 'Pessoa não encontrada.');
  return person;
}

const numberTaken = () =>
  conflict('CANDIDATE_NUMBER_ALREADY_EXISTS', 'Este número já está sendo utilizado para este cargo.');

const sessionLocked = (message) => conflict('CANDIDATE_SESSION_LOCKED', message);

async function findOrFail(id, userId) {
  const candidate = await candidateRepository.findById(id);
  if (!candidate || candidate.userId !== userId) throw notFound('CANDIDATE_NOT_FOUND', 'Candidato não encontrado.');
  return candidate;
}

// ---------- resposta enriquecida com partido e pessoa (nome/foto) ----------

const summarizeParty = (party) =>
  party
    ? { id: party.id, name: party.name, acronym: party.acronym, number: party.number, status: party.status }
    : null;

const withRelations = (candidate, partiesById, peopleById) => {
  const person = peopleById.get(candidate.personId);
  return {
    ...candidate,
    name: person?.name ?? null,
    photo: person?.photo ?? null,
    party: summarizeParty(partiesById.get(candidate.partyId)),
  };
};

async function loadWithRelations(candidate) {
  const [party, person] = await Promise.all([
    partyRepository.findById(candidate.partyId),
    personRepository.findById(candidate.personId),
  ]);
  return {
    ...candidate,
    name: person?.name ?? null,
    photo: person?.photo ?? null,
    party: summarizeParty(party),
  };
}

async function saveChanges(id, changes) {
  const result = await candidateRepository.update(id, changes);
  if (result.notFound) throw notFound('CANDIDATE_NOT_FOUND', 'Candidato não encontrado.');
  if (result.conflict) throw numberTaken();
  return loadWithRelations(result.record);
}

// ---------- serviço ----------

export const candidateService = {
  async list(filters = {}, userId) {
    const search = normalizeText(filters.search).trim();

    let candidates = await candidateRepository.findWhere(
      (c) =>
        c.userId === userId &&
        (!filters.sessionId || c.sessionId === filters.sessionId) &&
        (!filters.position || c.position === filters.position) &&
        (!filters.partyId || c.partyId === filters.partyId) &&
        (!filters.status || c.status === filters.status),
    );

    const [parties, people] = await Promise.all([
      partyRepository.findAllForUser(userId),
      personRepository.findAllForUser(userId),
    ]);
    const partiesById = new Map(parties.map((p) => [p.id, p]));
    const peopleById = new Map(people.map((p) => [p.id, p]));
    candidates = candidates.map((c) => withRelations(c, partiesById, peopleById));

    if (search) {
      candidates = candidates.filter((c) =>
        [c.name, c.number, c.party?.acronym, c.party?.name].some((field) =>
          normalizeText(field).includes(search),
        ),
      );
    }

    const positions = await positionRepository.findAllForUser(userId);
    const orderByCode = new Map(positions.map((p) => [p.code, p.order]));
    const order = (code) => orderByCode.get(code) ?? 99;
    return candidates.sort(
      (a, b) =>
        order(a.position) - order(b.position) ||
        a.number.localeCompare(b.number) ||
        a.name.localeCompare(b.name, 'pt-BR'),
    );
  },

  async getById(id, userId) {
    return loadWithRelations(await findOrFail(id, userId));
  },

  // Candidatura = pessoa + sessão + cargo + partido + número. Nome e foto não entram
  // aqui: pertencem à pessoa. Chamado só internamente pelo link público de
  // candidatura (ver public-candidacy.service.js), que passa status PENDING pra
  // exigir aprovação antes de entrar na cédula; `status` default ACTIVE fica só
  // pro seed (scripts/seed.js), que chama este service direto sem passar por rota.
  async create(input, userId, { status = CANDIDATE_STATUS.ACTIVE } = {}) {
    const data = isPlainObject(input) ? input : {};

    const session = await requireSession(data.sessionId, userId);
    if (session.status !== SESSION_STATUS.DRAFT) {
      throw sessionLocked('Só é possível cadastrar candidatos em sessões em rascunho.');
    }
    const person = await requirePerson(data.personId, userId);
    const positionRule = await requirePositionRule(session, data.position, userId);
    const party = await requireActiveParty(data.partyId, userId);
    const number = normalizeNumber(data.number, positionRule);

    const result = await candidateRepository.create({
      sessionId: session.id,
      partyId: party.id,
      personId: person.id,
      position: data.position,
      number,
      governmentProposal: normalizeGovernmentProposal(data.governmentProposal),
      userId,
      status,
      createdAt: new Date().toISOString(),
    });
    if (result.conflict) throw numberTaken();
    return loadWithRelations(result.record);
  },

  async update(id, input, userId) {
    const current = await findOrFail(id, userId);
    const session = await sessionRepository.findById(current.sessionId);
    if (session.status === SESSION_STATUS.FINISHED) {
      throw sessionLocked('A eleição foi finalizada e não aceita alterações.');
    }

    const changes = isPlainObject(input) ? input : {};
    if (changes.sessionId !== undefined && changes.sessionId !== current.sessionId) {
      throw badRequest('CANDIDATE_SESSION_IMMUTABLE', 'Não é possível mover o candidato para outra sessão.');
    }
    if (changes.personId !== undefined && changes.personId !== current.personId) {
      throw badRequest('CANDIDATE_PERSON_IMMUTABLE', 'Não é possível trocar a pessoa vinculada à candidatura.');
    }

    const merged = { ...current, ...pick(changes, [...CANDIDATE_IDENTITY_FIELDS, 'status', 'governmentProposal']) };

    const identityChanged = CANDIDATE_IDENTITY_FIELDS.some(
      (field) => String(merged[field]) !== String(current[field]),
    );
    if (identityChanged && session.status !== SESSION_STATUS.DRAFT) {
      throw sessionLocked('Depois que a votação abre, só é possível alterar o status.');
    }

    if (merged.partyId !== current.partyId) await requireActiveParty(merged.partyId, userId);
    const positionRule = await requirePositionRule(session, merged.position, userId);
    assertStatus(merged.status);
    const number = normalizeNumber(merged.number, positionRule);

    return saveChanges(id, {
      partyId: merged.partyId,
      position: merged.position,
      number,
      status: merged.status,
      governmentProposal: normalizeGovernmentProposal(merged.governmentProposal),
    });
  },

  // DELETE desativa: o candidato deixa de receber votos, mas o histórico é preservado.
  async deactivate(id, userId) {
    const current = await findOrFail(id, userId);
    const session = await sessionRepository.findById(current.sessionId);
    if (session.status === SESSION_STATUS.FINISHED) {
      throw sessionLocked('A eleição foi finalizada e não aceita alterações.');
    }
    return saveChanges(id, { status: CANDIDATE_STATUS.INACTIVE });
  },
};
