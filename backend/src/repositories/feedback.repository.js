import { prisma, serializeDates, serializeAll } from '../database/index.js';

export const feedbackRepository = {
  async create(data) {
    return serializeDates(await prisma.feedback.create({ data }));
  },

  async listPaged({ skip, take, type, status }) {
    const where = {
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
    };
    const [feedbacks, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } },
      }),
      prisma.feedback.count({ where }),
    ]);
    return { feedbacks: serializeAll(feedbacks), total };
  },

  async updateStatus(id, status) {
    try {
      return { record: serializeDates(await prisma.feedback.update({ where: { id }, data: { status } })) };
    } catch (error) {
      if (error?.code === 'P2025') return { notFound: true };
      throw error;
    }
  },
};
