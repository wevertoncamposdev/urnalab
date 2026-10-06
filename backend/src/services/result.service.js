import { candidateRepository } from '../repositories/candidate.repository.js';
import { partyRepository } from '../repositories/party.repository.js';
import { personRepository } from '../repositories/person.repository.js';
import { positionRepository } from '../repositories/position.repository.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { voteRepository } from '../repositories/vote.repository.js';
import { CANDIDATE_STATUS } from '../rules/candidate-rules.js';
import { SESSION_STATUS } from '../rules/session-rules.js';
import { VOTE_TYPE } from '../rules/vote-rules.js';
import { conflict, notFound } from '../utils/errors.js';
import { sessionService, withUniqueSessionCode } from './session.service.js';

async function findSessionOrFail(id, userId) {
  const session = await sessionRepository.findById(id);
  if (!session || session.userId !== userId) throw notFound('SESSION_NOT_FOUND', 'Sessão não encontrada.');
  return session;
}

// Como numa eleição real, a apuração só é publicada depois que a votação fecha.
function requireFinished(session) {
  if (session.status !== SESSION_STATUS.FINISHED) {
    throw conflict(
      'RESULTS_NOT_AVAILABLE',
      'Os resultados só ficam disponíveis depois que a eleição é finalizada.',
    );
  }
}

const summarizeParty = (party) =>
  party ? { name: party.name, acronym: party.acronym, number: party.number } : null;

const percent = (count, base) => (base > 0 ? (count / base) * 100 : 0);

// Decide o resultado de um cargo a partir do ranking já ordenado por votos.
// Cargos sem 2º turno (ou sem gente suficiente pra disputar um) seguem a regra
// de sempre: o(s) mais votado(s) vence(m), com empate levando todos ao posto.
// Num cargo com 2º turno, só há vencedor direto se alguém passar de 50% dos
// votos válidos (maioria absoluta); senão, os dois mais votados vão à disputa
// e ninguém é declarado eleito ainda.
function resolveOutcome(ranked, validVotes, twoRoundEnabled) {
  const topVotes = ranked[0]?.votes ?? 0;
  if (topVotes === 0) return { winners: [], runoff: null };

  const majorityReached = topVotes > validVotes / 2;
  const candidatesWithVotes = ranked.filter((c) => c.votes > 0);

  if (!twoRoundEnabled || majorityReached || candidatesWithVotes.length < 2) {
    return { winners: ranked.filter((c) => c.votes === topVotes).map((c) => c.id), runoff: null };
  }

  return { winners: [], runoff: { candidateIds: [ranked[0].id, ranked[1].id] } };
}

// Apura um cargo: ranking de candidatos (só entre votos válidos) e totais de votos
// válidos/brancos/nulos. Empate no primeiro lugar faz todos os empatados vencerem
// (exceto em cargo com 2º turno sem maioria absoluta — ver resolveOutcome).
function tallyPosition(code, votes, candidates, partiesById, positionsByCode, peopleById) {
  const positionVotes = votes.filter((v) => v.position === code);
  const totalVotes = positionVotes.length;
  const blankVotes = positionVotes.filter((v) => v.type === VOTE_TYPE.BLANK).length;
  const nullVotes = positionVotes.filter((v) => v.type === VOTE_TYPE.NULL).length;
  const validVotes = totalVotes - blankVotes - nullVotes;

  const countByCandidate = new Map();
  positionVotes
    .filter((v) => v.type === VOTE_TYPE.VALID && v.candidateId)
    .forEach((v) => countByCandidate.set(v.candidateId, (countByCandidate.get(v.candidateId) ?? 0) + 1));

  const ranked = candidates
    .filter((c) => c.position === code)
    .map((c) => {
      const candidateVotes = countByCandidate.get(c.id) ?? 0;
      const person = peopleById.get(c.personId);
      return {
        id: c.id,
        name: person?.name ?? null,
        number: c.number,
        photo: person?.photo ?? null,
        status: c.status,
        party: summarizeParty(partiesById.get(c.partyId)),
        votes: candidateVotes,
        percentValid: percent(candidateVotes, validVotes),
      };
    })
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'pt-BR'));

  const position = positionsByCode.get(code);
  const { winners, runoff } = resolveOutcome(ranked, validVotes, position.twoRoundEnabled ?? false);

  return {
    code,
    label: position.label,
    digits: position.digits,
    twoRoundEnabled: Boolean(position.twoRoundEnabled),
    totals: {
      totalVotes,
      validVotes,
      blankVotes,
      nullVotes,
      blankPercent: percent(blankVotes, totalVotes),
      nullPercent: percent(nullVotes, totalVotes),
    },
    candidates: ranked,
    winners,
    runoff,
  };
}

// Reaproveitada por getBySession (exibir) e createRunoffSession (decidir quem
// vai para a nova sessão): busca tudo que a apuração de uma sessão finalizada precisa.
async function tallySession(session) {
  const userId = session.userId;
  const [votes, candidates, parties, positions, people] = await Promise.all([
    voteRepository.findWhere((v) => v.sessionId === session.id),
    candidateRepository.findWhere((c) => c.sessionId === session.id),
    partyRepository.findAllForUser(userId),
    positionRepository.findAllForUser(userId),
    personRepository.findAllForUser(userId),
  ]);
  const partiesById = new Map(parties.map((p) => [p.id, p]));
  const positionsByCode = new Map(positions.map((p) => [p.code, p]));
  const peopleById = new Map(people.map((p) => [p.id, p]));

  return {
    candidates,
    positions: session.positions.map((code) =>
      tallyPosition(code, votes, candidates, partiesById, positionsByCode, peopleById),
    ),
  };
}

// Reaproveitada pela apuração autenticada (por id) e pelo link público (por
// token) — quem chama já resolveu a sessão, aqui só falta montar a apuração.
async function buildResultsPayload(session) {
  requireFinished(session);
  const { positions } = await tallySession(session);

  return {
    session: {
      id: session.id,
      name: session.name,
      year: session.year,
      status: session.status,
      finishedAt: session.finishedAt,
    },
    positions,
  };
}

export const resultService = {
  async getBySession(id, userId) {
    const session = await findSessionOrFail(id, userId);
    return buildResultsPayload(session);
  },

  async getForSession(session) {
    return buildResultsPayload(session);
  },

  // Monta a sessão do 2º turno: mesmo(s) cargo(s) que não tiveram maioria
  // absoluta no 1º turno, já com a candidatura dos dois mais votados de cada um
  // (reaproveitando pessoa, partido e número — só o vínculo com a sessão é novo).
  async createRunoffSession(id, userId) {
    const session = await findSessionOrFail(id, userId);
    requireFinished(session);

    const { candidates, positions } = await tallySession(session);
    const runoffPositions = positions.filter((p) => p.runoff);
    if (runoffPositions.length === 0) {
      throw conflict('RUNOFF_NOT_NEEDED', 'Nenhum cargo desta sessão precisa de 2º turno.');
    }

    const newSession = await withUniqueSessionCode((publicToken) =>
      sessionRepository.create({
        name: `${session.name} - 2º turno`,
        year: session.year,
        positions: runoffPositions.map((p) => p.code),
        userId,
        publicToken,
        status: SESSION_STATUS.DRAFT,
        createdAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
      }),
    );

    for (const position of runoffPositions) {
      for (const candidateId of position.runoff.candidateIds) {
        const original = candidates.find((c) => c.id === candidateId);
        await candidateRepository.create({
          sessionId: newSession.id,
          partyId: original.partyId,
          personId: original.personId,
          position: position.code,
          number: original.number,
          userId,
          status: CANDIDATE_STATUS.ACTIVE,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return sessionService.getById(newSession.id, userId);
  },
};
