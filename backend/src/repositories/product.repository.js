import { prisma, serializeDates, serializeAll } from '../database/index.js';

export const productRepository = {
  // Catálogo pra storefront (Etapa 15.3) — só o que está à venda agora.
  async findActive() {
    return serializeAll(await prisma.product.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } }));
  },

  async findById(id) {
    return serializeDates(await prisma.product.findUnique({ where: { id } }));
  },

  // Usado hoje só pelo seed de desenvolvimento (scripts/seed.js) — a Etapa 16 (CRUD de
  // produto pelo admin) vai chamar algo equivalente de um controller de verdade.
  // Idempotente por slug, pro seed poder rodar várias vezes sem duplicar.
  async upsertBySlug(slug, data) {
    return serializeDates(
      await prisma.product.upsert({ where: { slug }, create: { slug, ...data }, update: data }),
    );
  },
};
