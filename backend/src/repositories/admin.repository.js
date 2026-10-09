import { prisma, serializeAll } from '../database/index.js';
import { PAYMENT_STATUS } from '../rules/payment-rules.js';

// Único ponto do backend com queries cross-tenant (todo outro repository filtra por
// userId) — de propósito restrito à Área de Gerenciamento (ver admin.service.js).
export const adminRepository = {
  async countUsers() {
    return prisma.user.count();
  },

  async countInstitutionProfiles() {
    return prisma.institutionProfile.count();
  },

  async countSessions() {
    return prisma.session.count();
  },

  async countVotes() {
    return prisma.vote.count();
  },

  async countPeople() {
    return prisma.person.count();
  },

  async countCandidates() {
    return prisma.candidate.count();
  },

  async countUsersSince(date) {
    return prisma.user.count({ where: { createdAt: { gte: date } } });
  },

  async listUsers({ skip, take }) {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          emailVerifiedAt: true,
          institutionProfile: { select: { name: true } },
          _count: { select: { sessions: true } },
        },
      }),
      prisma.user.count(),
    ]);
    return { users: serializeAll(users), total };
  },

  async logAccess(adminUserId, action) {
    await prisma.adminAccessLog.create({ data: { adminUserId, action } });
  },

  // Painel financeiro (Etapa 16.3 ampliada): quantidade e receita aprovadas por
  // produto, numa query só (groupBy) em vez de trazer todo pagamento aprovado do banco
  // pra somar em JS — cresce bem com o histórico de vendas.
  async paymentsGroupedByProduct() {
    return prisma.payment.groupBy({
      by: ['productId'],
      where: { status: PAYMENT_STATUS.APPROVED },
      _count: { _all: true },
      _sum: { amountCents: true },
    });
  },

  // Mesma ideia acima, só que pra doações (sem produto nenhum por trás — ver
  // schema.prisma Donation) — por isso é `aggregate` (um total só) em vez de `groupBy`.
  async donationsTotals() {
    const result = await prisma.donation.aggregate({
      where: { status: PAYMENT_STATUS.APPROVED },
      _count: { _all: true },
      _sum: { amountCents: true },
    });
    return { count: result._count._all, revenueCents: result._sum.amountCents ?? 0 };
  },
};
