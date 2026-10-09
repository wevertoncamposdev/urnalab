import { prisma, serializeDates } from '../database/index.js';

export const donationRepository = {
  async create(data) {
    return serializeDates(await prisma.donation.create({ data }));
  },

  async findById(id) {
    return serializeDates(await prisma.donation.findUnique({ where: { id } }));
  },

  async update(id, data) {
    return serializeDates(await prisma.donation.update({ where: { id }, data }));
  },
};
