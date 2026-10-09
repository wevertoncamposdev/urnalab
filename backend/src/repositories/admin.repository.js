import { prisma, serializeAll } from '../database/index.js';

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
};
