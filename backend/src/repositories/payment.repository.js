import { prisma, serializeAll, serializeDates } from '../database/index.js';

export const paymentRepository = {
  async create(data) {
    return serializeDates(await prisma.payment.create({ data }));
  },

  async findById(id) {
    return serializeDates(await prisma.payment.findUnique({ where: { id } }));
  },

  // Área financeira do usuário (Etapa 14) — histórico de todas as cobranças da conta,
  // de qualquer produto (Etapa 15), com nome do produto e (se for "por sessão") o
  // nome/ano da sessão pra exibição — sem outros campos, só o que a tela precisa mostrar.
  async findByUser(userId) {
    const payments = await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, slug: true, name: true, kind: true } },
        session: { select: { id: true, name: true, year: true } },
      },
    });
    return payments.map((payment) => ({
      ...serializeDates(payment),
      product: payment.product,
      session: payment.session,
    }));
  },

  // `where` identifica o escopo do produto (Etapa 15, ver payment.service.js
  // scopeForProduct): `{ productId, sessionId }` pra produto "por sessão", ou
  // `{ productId, userId }` pra produto "por conta". Qualquer cobrança aprovada nesse
  // escopo já basta — libera o produto pra sempre.
  async findApproved(where) {
    return serializeDates(await prisma.payment.findFirst({ where: { ...where, status: 'APPROVED' } }));
  },

  async update(id, data) {
    return serializeDates(await prisma.payment.update({ where: { id }, data }));
  },

  // Tentativas PENDING abandonadas (usuário saiu do Checkout Pro sem pagar) nunca mais
  // recebem webhook — sem isso elas ficariam PENDING pra sempre. Chamado de forma "lazy"
  // a cada novo checkout do mesmo escopo (ver payment.service.js createCheckout), não por
  // um job periódico: não há infraestrutura de cron no projeto, e isso é barato o
  // suficiente pra rodar ali. Mesmo `where` de escopo de findApproved.
  async expireStalePending(where, olderThan) {
    await prisma.payment.updateMany({
      where: { ...where, status: 'PENDING', createdAt: { lt: olderThan } },
      data: { status: 'REJECTED' },
    });
  },

  // Só grava na primeira vez (where downloadedAt: null) — é o que `payment.service.js
  // refund` depois usa pra travar reembolso de quem já baixou o material.
  async markDownloaded(id) {
    await prisma.payment.updateMany({ where: { id, downloadedAt: null }, data: { downloadedAt: new Date() } });
  },

  // Histórico de vendas de um produto pro admin (Etapa 16.3) — todas as cobranças,
  // qualquer conta, sem nenhum dado de quem comprou (minimização de dados — ver
  // adminService.listUsers pro mesmo princípio aplicado a contas).
  async findAllByProduct(productId) {
    return serializeAll(
      await prisma.payment.findMany({ where: { productId }, orderBy: { createdAt: 'desc' } }),
    );
  },
};
