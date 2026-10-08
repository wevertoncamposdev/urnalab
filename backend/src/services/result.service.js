import { candidateRepository } from '../repositories/candidate.repository.js';
import { partyRepository } from '../repositories/party.repository.js';
import { personRepository } from '../repositories/person.repository.js';
import { positionRepository } from '../repositories/position.repository.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { voteRepository } from '../repositories/vote.repository.js';
import { CANDIDATE_STATUS } from '../rules/candidate-rules.js';
import { PARTY_STATUS } from '../rules/party-rules.js';
import { SESSION_STATUS } from '../rules/session-rules.js';
import { VOTE_TYPE } from '../rules/vote-rules.js';
import { conflict, notFound } from '../utils/errors.js';
import { sessionService, withUniqueSessionCode } from './session.service.js';

// "<nome> - 2º turno" vira "<nome> - 3º turno" num eventual 3º turno (se o 2º turno
// também empatar), em vez de empilhar "- 2º turno - 2º turno" — troca o sufixo de
// turno em vez de só concatenar mais um.
const ROUND_SUFFIX_PATTERN = /\s*-\s*(\d+)º turno$/i;

function nextRoundName(name) {
  const match = ROUND_SUFFIX_PATTERN.exec(name);
  if (!match) return `${name} - 2º turno`;
  const nextRound = Number(match[1]) + 1;
  return `${name.slice(0, match.index)} - ${nextRound}º turno`;
}

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

  // Corte normal é o 2º lugar — mas se o número de votos do 2º lugar empatar com
  // o 3º (ou mais), `tallyPosition` já tinha resolvido isso só por ordem
  // alfabética do nome, escondendo o empate. Aqui, todo mundo empatado no ponto
  // de corte avança junto (podendo passar de 2 candidatos pro 2º turno), e
  // `tied` sinaliza que houve empate de verdade — ver PositionResult.jsx.
  const cutoffVotes = ranked[1].votes;
  const candidateIds = ranked.filter((c) => c.votes >= cutoffVotes && c.votes > 0).map((c) => c.id);

  return { winners: [], runoff: { candidateIds, tied: candidateIds.length > 2 } };
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
  // absoluta no 1º turno, já com a candidatura dos classificados de cada um
  // (reaproveitando pessoa, partido e número — só o vínculo com a sessão é novo;
  // em caso de empate no ponto de corte, mais de dois candidatos podem entrar —
  // ver resolveOutcome). Uma sessão só pode gerar um 2º turno; se o 2º turno
  // também empatar, essa mesma função cria um "3º turno" a partir dele.
  async createRunoffSession(id, userId) {
    const session = await findSessionOrFail(id, userId);
    requireFinished(session);

    const existingRunoff = await sessionRepository.findRunoffOf(session.id);
    if (existingRunoff) {
      throw conflict(
        'RUNOFF_ALREADY_EXISTS',
        `Esta sessão já tem uma sessão de 2º turno criada: "${existingRunoff.name}".`,
      );
    }

    const { candidates, positions } = await tallySession(session);
    const runoffPositions = positions.filter((p) => p.runoff);
    if (runoffPositions.length === 0) {
      throw conflict('RUNOFF_NOT_NEEDED', 'Nenhum cargo desta sessão precisa de 2º turno.');
    }

    // Confere os partidos de todos os classificados ANTES de criar a sessão nova —
    // se algum foi desativado depois do 1º turno, falha aqui (sessão nenhuma fica
    // pela metade) em vez de copiar o candidato sem essa checagem, como acontecia
    // antes (candidateRepository.create direto pulava a validação que
    // candidateService.create sempre aplica).
    const originalsById = new Map(candidates.map((c) => [c.id, c]));
    const partyIds = new Set(
      runoffPositions.flatMap((p) => p.runoff.candidateIds.map((cid) => originalsById.get(cid).partyId)),
    );
    for (const partyId of partyIds) {
      const party = await partyRepository.findById(partyId);
      if (!party || party.status !== PARTY_STATUS.ACTIVE) {
        throw conflict(
          'RUNOFF_PARTY_INACTIVE',
          'O partido de um dos classificados ao 2º turno está inativo — reative-o antes de criar a sessão.',
        );
      }
    }

    const newSession = await withUniqueSessionCode((publicToken) =>
      sessionRepository.create({
        name: nextRoundName(session.name),
        year: session.year,
        positions: runoffPositions.map((p) => p.code),
        userId,
        publicToken,
        status: SESSION_STATUS.DRAFT,
        runoffOfSessionId: session.id,
        createdAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
      }),
    );

    for (const position of runoffPositions) {
      for (const candidateId of position.runoff.candidateIds) {
        const original = originalsById.get(candidateId);
        await candidateRepository.create({
          sessionId: newSession.id,
          partyId: original.partyId,
          personId: original.personId,
          position: position.code,
          number: original.number,
          governmentProposal: original.governmentProposal ?? null,
          userId,
          status: CANDIDATE_STATUS.ACTIVE,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return sessionService.getById(newSession.id, userId);
  },
};
