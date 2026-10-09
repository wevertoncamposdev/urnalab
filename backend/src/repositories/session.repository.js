import { prisma, serializeDates, serializeAll, enqueueSessionTask } from '../database/index.js';

// Contrato do repository: se um dia virar outro banco, estes métodos continuam iguais.
export const sessionRepository = {
  async findAllForUser(userId) {
    return serializeAll(await prisma.session.findMany({ where: { userId } }));
  },

  async findById(id) {
    return serializeDates(await prisma.session.findUnique({ where: { id } }));
  },

  // Sem escopo por conta de propósito: o token em si já é a autorização (ver
  // public-voting.service) — quem o tem pode votar, não importa quem é o dono.
  async findByPublicToken(token) {
    return serializeDates(await prisma.session.findUnique({ where: { publicToken: token } }));
  },

  // Mesmo raciocínio do findByPublicToken acima, mas pro link público de
  // candidatura (Etapa 20) — ver public-candidacy.service.js.
  async findByCandidacyToken(token) {
    return serializeDates(await prisma.session.findUnique({ where: { candidacyToken: token } }));
  },

  async create(data) {
    return serializeDates(await prisma.session.create({ data }));
  },

  // Enfileirada na mesma fila que `withLock` usa (ver abaixo) — assim, uma
  // finalização de sessão (changeStatus) nunca executa ao mesmo tempo que uma
  // operação em andamento dentro de `withLock` (ex.: registrar um voto).
  update(id, data) {
    return enqueueSessionTask(async () => serializeDates(await prisma.session.update({ where: { id }, data })));
  },

  async remove(id) {
    await prisma.session.delete({ where: { id } });
  },

  async count() {
    return prisma.session.count();
  },

  // Usado por resultService.createRunoffSession pra impedir criar mais de uma sessão
  // de 2º turno pra mesma sessão origem — `null` se nenhuma ainda existir.
  async findRunoffOf(sourceSessionId) {
    return serializeDates(await prisma.session.findFirst({ where: { runoffOfSessionId: sourceSessionId } }));
  },

  // Dá exclusividade sobre sessões para quem precisa checar e agir atomicamente
  // em relação a um update/finish concorrente (ver vote.service). `read()` dá
  // uma leitura fresca de todas as sessões, igual ao contrato antigo do
  // JsonDatabase — a exclusão vem só de entrar na mesma fila que `update` usa,
  // não de uma transação do banco (equivalente ao #queue por coleção de antes).
  withLock(task) {
    return enqueueSessionTask(() => task({ read: async () => serializeAll(await prisma.session.findMany()) }));
  },
};
