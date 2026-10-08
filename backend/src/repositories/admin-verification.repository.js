import { prisma, serializeDates } from '../database/index.js';

export const adminVerificationRepository = {
  async findByUserId(userId) {
    return serializeDates(await prisma.adminVerificationCode.findUnique({ where: { userId } }));
  },

  // Pedir novo código sobrescreve o pendente (userId é @unique) — nunca acumula mais de
  // um código ativo por conta.
  async upsertForUser(userId, { codeHash, expiresAt }) {
    const record = await prisma.adminVerificationCode.upsert({
      where: { userId },
      create: { userId, codeHash, expiresAt },
      update: { codeHash, expiresAt, attempts: 0, createdAt: new Date() },
    });
    return serializeDates(record);
  },

  async incrementAttempts(id) {
    await prisma.adminVerificationCode.update({ where: { id }, data: { attempts: { increment: 1 } } });
  },

  async deleteByUserId(userId) {
    await prisma.adminVerificationCode.deleteMany({ where: { userId } });
  },
};
