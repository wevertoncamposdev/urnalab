import { partyRepository } from '../repositories/party.repository.js';
import { positionRepository } from '../repositories/position.repository.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { CANDIDATE_STATUS } from '../rules/candidate-rules.js';
import { PARTY_STATUS } from '../rules/party-rules.js';
import { SESSION_STATUS } from '../rules/session-rules.js';
import { conflict, notFound } from '../utils/errors.js';
import { isPlainObject } from '../utils/object.js';
import { candidateService } from './candidate.service.js';
import { personService } from './person.service.js';

// O link público não tem login: o token (em letras maiúsculas, ver utils/id.js)
// é a própria autorização e resolve pra sessão (e pra conta dona dela) sem
// precisar de userId na requisição — mesmo desenho do link público de votação
// (ver public-voting.service.js), só que pelo campo candidacyToken.
async function requireSessionByToken(token) {
  const session = await sessionRepository.findByCandidacyToken(token);
  if (!session) throw notFound('SESSION_NOT_FOUND', 'Sessão não encontrada.');
  return session;
}

function assertOpenForCandidacy(session) {
  // Candidatura só é aceita em sessão ainda em rascunho — mesma regra que já vale
  // pro cadastro manual pelo admin (ver candidateService.create), senão um
  // candidato poderia entrar depois da votação já ter começado.
  if (session.status !== SESSION_STATUS.DRAFT) {
    throw conflict(
      'CANDIDACY_CLOSED',
      'O cadastro de candidaturas desta sessão está encerrado — a votação já foi aberta.',
    );
  }
}

export const publicCandidacyService = {
  // Só o necessário pra montar o formulário público: nome/ano/status da sessão,
  // os cargos habilitados (com a quantidade de dígitos do número) e os partidos
  // ativos disponíveis pra escolher.
  async getSession(token) {
    const session = await requireSessionByToken(token);
    const [positions, parties] = await Promise.all([
      positionRepository.findAllForUser(session.userId),
      partyRepository.findAllForUser(session.userId),
    ]);
    const positionByCode = new Map(positions.map((p) => [p.code, p]));

    return {
      name: session.name,
      year: session.year,
      status: session.status,
      positions: session.positions.map((code) => {
        const rule = positionByCode.get(code);
        return { code, label: rule?.label ?? code, digits: rule?.digits ?? 0 };
      }),
      parties: parties
        .filter((p) => p.status === PARTY_STATUS.ACTIVE)
        .map((p) => ({ id: p.id, name: p.name, acronym: p.acronym, number: p.number })),
    };
  },

  // Pessoa + candidatura numa submissão só, igual ao formulário combinado da
  // Etapa 20 — entra sempre como PENDING, quem administra a sessão aprova ou
  // reprova depois (ver candidateService.update/deactivate, reaproveitados sem
  // rota nova: GET/PUT /api/candidates já filtram e alteram por status).
  async create(token, body) {
    const session = await requireSessionByToken(token);
    assertOpenForCandidacy(session);

    const data = isPlainObject(body) ? body : {};
    const person = await personService.create({ name: data.name, photo: data.photo }, session.userId);
    try {
      return await candidateService.create(
        {
          sessionId: session.id,
          partyId: data.partyId,
          personId: person.id,
          position: data.position,
          number: data.number,
          governmentProposal: data.governmentProposal,
        },
        session.userId,
        { status: CANDIDATE_STATUS.PENDING },
      );
    } catch (error) {
      // A pessoa só existe pra sustentar esta candidatura — se ela não puder ser
      // criada (ex.: número já usado para o cargo), não faz sentido deixar a
      // pessoa órfã (e a foto gravada em disco) no cadastro de quem administra a
      // sessão. personService.remove não bloqueia aqui: a candidatura falhou, a
      // pessoa ainda não tem nenhuma.
      await personService.remove(person.id, session.userId).catch(() => {});
      throw error;
    }
  },
};
