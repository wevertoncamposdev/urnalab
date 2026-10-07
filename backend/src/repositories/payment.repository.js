import { prisma, serializeDates, serializeAll } from '../database/index.js';

export const paymentRepository = {
  async create(data) {
    return serializeDates(await prisma.payment.create({ data }));
  },

  async findById(id) {
    return serializeDates(await prisma.payment.findUnique({ where: { id } }));
  },

  async findBySession(sessionId) {
    return serializeAll(
      await prisma.payment.findMany({ where: { sessionId }, orderBy: { createdAt: 'desc' } }),
    );
  },

  // Área financeira do usuário (Etapa 14) — histórico de todas as cobranças da conta,
  // com o nome/ano da sessão pra exibição (sem outros campos da sessão: só o que a tela
  // precisa mostrar).
  async findByUser(userId) {
    const payments = await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { session: { select: { id: true, name: true, year: true } } },
    });
    return payments.map((payment) => ({ ...serializeDates(payment), session: payment.session }));
  },

  // Qualquer cobrança aprovada já basta — uma sessão só precisa de uma aprovada
  // pra liberar o PDF pra sempre (ver payment.service.js).
  async findApprovedBySession(sessionId) {
    return serializeDates(
      await prisma.payment.findFirst({ where: { sessionId, status: 'APPROVED' } }),
    );
  },

  async update(id, data) {
    return serializeDates(await prisma.payment.update({ where: { id }, data }));
  },

  // Tentativas PENDING abandonadas (usuário saiu do Checkout Pro sem pagar) nunca mais
  // recebem webhook — sem isso elas ficariam PENDING pra sempre. Chamado de forma "lazy"
  // a cada novo checkout da mesma sessão (ver payment.service.js createCheckout), não por
  // um job periódico: não há infraestrutura de cron no projeto, e isso é barato o
  // suficiente pra rodar ali.
  async expireStalePending(sessionId, olderThan) {
    await prisma.payment.updateMany({
      where: { sessionId, status: 'PENDING', createdAt: { lt: olderThan } },
      data: { status: 'REJECTED' },
    });
  },

  // Só grava na primeira vez (where downloadedAt: null) — é o que `payment.service.js
  // refund` depois usa pra travar reembolso de quem já baixou o material.
  async markDownloaded(id) {
    await prisma.payment.updateMany({ where: { id, downloadedAt: null }, data: { downloadedAt: new Date() } });
  },
};
