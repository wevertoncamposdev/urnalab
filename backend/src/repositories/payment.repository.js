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
};
