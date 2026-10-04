import { prisma } from '../database/index.js';

// Nunca filtra por userId de propósito: evento de analytics não pertence a uma conta,
// só a um visitorId anônimo (ver schema.prisma, AnalyticsEvent).
export const analyticsRepository = {
  async create(data) {
    await prisma.analyticsEvent.create({ data });
  },

  // Visitantes únicos que já geraram esse evento — base do funil (ver admin.service.js).
  async countDistinctVisitorsByName(name) {
    const rows = await prisma.analyticsEvent.findMany({
      where: { name },
      distinct: ['visitorId'],
      select: { visitorId: true },
    });
    return rows.length;
  },

  async topPaths(limit = 10) {
    const rows = await prisma.analyticsEvent.groupBy({
      by: ['path'],
      where: { name: 'PAGE_VIEW', path: { not: null } },
      _count: { path: true },
      orderBy: { _count: { path: 'desc' } },
      take: limit,
    });
    return rows.map((row) => ({ path: row.path, count: row._count.path }));
  },

  async topReferrers(limit = 10) {
    const rows = await prisma.analyticsEvent.groupBy({
      by: ['referrer'],
      where: { name: 'PAGE_VIEW', referrer: { not: null } },
      _count: { referrer: true },
      orderBy: { _count: { referrer: 'desc' } },
      take: limit,
    });
    return rows.map((row) => ({ referrer: row.referrer, count: row._count.referrer }));
  },
};
