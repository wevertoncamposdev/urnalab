import { prisma, serializeDates, serializeAll } from '../database/index.js';

export const productRepository = {
  // Catálogo pra storefront (Etapa 15.3) — só o que está à venda agora.
  async findActive() {
    return serializeAll(await prisma.product.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } }));
  },

  async findById(id) {
    return serializeDates(await prisma.product.findUnique({ where: { id } }));
  },

  // Usado hoje só pelo seed de desenvolvimento (scripts/seed.js) — pra criar o ebook de
  // demonstração. Idempotente por slug, pro seed poder rodar várias vezes sem duplicar.
  async upsertBySlug(slug, data) {
    return serializeDates(
      await prisma.product.upsert({ where: { slug }, create: { slug, ...data }, update: data }),
    );
  },

  // Catálogo completo pro admin (Etapa 16.2) — inclusive inativos, diferente de
  // findActive (storefront pública).
  async findAll() {
    return serializeAll(await prisma.product.findMany({ orderBy: { createdAt: 'asc' } }));
  },

  async create(data) {
    return serializeDates(await prisma.product.create({ data }));
  },

  async update(id, data) {
    return serializeDates(await prisma.product.update({ where: { id }, data }));
  },
};
