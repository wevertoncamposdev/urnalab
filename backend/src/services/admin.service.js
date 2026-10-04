import { config } from '../config.js';
import { adminRepository } from '../repositories/admin.repository.js';
import { analyticsRepository } from '../repositories/analytics.repository.js';
import { feedbackRepository } from '../repositories/feedback.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { ANALYTICS_EVENT_NAMES } from '../rules/analytics-rules.js';
import { FEEDBACK_STATUSES, FEEDBACK_TYPES } from '../rules/feedback-rules.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Etapas do funil, na ordem em que acontecem numa eleição (ver ROADMAP.md "Validação e
// Feedback") — PAGE_VIEW fica de fora: é o total de navegação, não uma etapa do funil.
const FUNNEL_STEPS = ANALYTICS_EVENT_NAMES.filter((name) => name !== 'PAGE_VIEW');

function resolvePagination({ page, pageSize } = {}) {
  const take = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const currentPage = Math.max(Number(page) || 1, 1);
  return { take, currentPage, skip: (currentPage - 1) * take };
}

// Única autorização admin do sistema: o e-mail da conta logada precisa bater com
// ADMIN_EMAIL (ver config.js) — sem isso, nenhuma conta entra aqui. Não existe
// campo de role no banco de propósito (ver ROADMAP.md "Área de Gerenciamento").
async function requireAdmin(userId) {
  const user = await userRepository.findById(userId);
  if (!user || !config.adminEmail || user.email.toLowerCase() !== config.adminEmail) {
    throw forbidden('ADMIN_ONLY', 'Acesso restrito à administração do sistema.');
  }
  return user;
}

// Minimização de dados (LGPD): a listagem mostra o nome mas nunca o e-mail completo
// de outra conta — só o suficiente pra identificar/contar, não pra ter o contato.
function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(3, local.length));
  const maskedLength = Math.max(local.length - visible.length, 3);
  return `${visible}${'*'.repeat(maskedLength)}@${domain}`;
}

export const adminService = {
  async getOverview(userId) {
    await requireAdmin(userId);

    const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS);
    const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS);

    const [totalUsers, totalInstitutions, totalSessions, totalVotes, newUsersLast7Days, newUsersLast30Days] =
      await Promise.all([
        adminRepository.countUsers(),
        adminRepository.countInstitutionProfiles(),
        adminRepository.countSessions(),
        adminRepository.countVotes(),
        adminRepository.countUsersSince(sevenDaysAgo),
        adminRepository.countUsersSince(thirtyDaysAgo),
      ]);

    await adminRepository.logAccess(userId, 'VIEW_OVERVIEW');

    return { totalUsers, totalInstitutions, totalSessions, totalVotes, newUsersLast7Days, newUsersLast30Days };
  },

  async listUsers(userId, pagination) {
    await requireAdmin(userId);

    const { take, currentPage, skip } = resolvePagination(pagination);
    const { users, total } = await adminRepository.listUsers({ skip, take });
    await adminRepository.logAccess(userId, `LIST_USERS:page=${currentPage}`);

    return {
      page: currentPage,
      pageSize: take,
      total,
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: maskEmail(user.email),
        emailVerified: Boolean(user.emailVerifiedAt),
        // Nome da instituição é informação institucional (não pessoal) — diferente do
        // e-mail, não precisa de mascaramento (ver maskEmail acima).
        institutionName: user.institutionProfile?.name ?? null,
        sessionsCount: user._count.sessions,
        createdAt: user.createdAt,
      })),
    };
  },

  // Funil de uso (Etapa 10): visitantes únicos por etapa, sem nenhum dado pessoal — só o
  // visitorId anônimo (ver AnalyticsEvent). Abandono é calculado no frontend a partir da
  // diferença entre etapas consecutivas.
  async getFunnel(userId) {
    await requireAdmin(userId);

    const steps = await Promise.all(
      FUNNEL_STEPS.map(async (name) => ({
        name,
        visitors: await analyticsRepository.countDistinctVisitorsByName(name),
      })),
    );
    const [topPaths, topReferrers] = await Promise.all([
      analyticsRepository.topPaths(),
      analyticsRepository.topReferrers(),
    ]);

    await adminRepository.logAccess(userId, 'VIEW_FUNNEL');

    return { steps, topPaths, topReferrers };
  },

  async listFeedback(userId, { type, status, ...pagination } = {}) {
    await requireAdmin(userId);

    const { take, currentPage, skip } = resolvePagination(pagination);
    const { feedbacks, total } = await feedbackRepository.listPaged({
      skip,
      take,
      type: FEEDBACK_TYPES.includes(type) ? type : undefined,
      status: FEEDBACK_STATUSES.includes(status) ? status : undefined,
    });
    await adminRepository.logAccess(userId, `LIST_FEEDBACK:page=${currentPage}`);

    return {
      page: currentPage,
      pageSize: take,
      total,
      feedbacks: feedbacks.map((feedback) => ({
        id: feedback.id,
        type: feedback.type,
        rating: feedback.rating,
        message: feedback.message,
        page: feedback.page,
        status: feedback.status,
        createdAt: feedback.createdAt,
        authorName: feedback.user?.name ?? null,
      })),
    };
  },

  async updateFeedbackStatus(userId, feedbackId, status) {
    await requireAdmin(userId);
    if (!FEEDBACK_STATUSES.includes(status)) {
      throw badRequest('FEEDBACK_STATUS_INVALID', 'Status inválido.');
    }

    const result = await feedbackRepository.updateStatus(feedbackId, status);
    if (result.notFound) throw notFound('FEEDBACK_NOT_FOUND', 'Feedback não encontrado.');

    await adminRepository.logAccess(userId, `UPDATE_FEEDBACK_STATUS:${feedbackId}:${status}`);
    return result.record;
  },
};
