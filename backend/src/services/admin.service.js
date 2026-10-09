import { randomInt, createHash } from 'node:crypto';
import { adminRepository } from '../repositories/admin.repository.js';
import { adminVerificationRepository } from '../repositories/admin-verification.repository.js';
import { analyticsRepository } from '../repositories/analytics.repository.js';
import { feedbackRepository } from '../repositories/feedback.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { ANALYTICS_EVENT_NAMES } from '../rules/analytics-rules.js';
import { ADMIN_VERIFICATION_RULES } from '../rules/admin-verification-rules.js';
import { FEEDBACK_STATUSES, FEEDBACK_TYPES } from '../rules/feedback-rules.js';
import { badRequest, notFound, tooManyRequests } from '../utils/errors.js';
import { signJwt } from '../utils/jwt.js';
import { emailService } from './email.service.js';
import { healthService } from './health.service.js';

// Autorização admin (Etapa 16): toda rota `/api/admin/*` tem `adminOnly: true` (ver
// admin.routes.js), checado em server.js antes de qualquer handler/controller/service
// rodar — comparando o e-mail do token com ADMIN_EMAIL, sem consulta ao banco. Não
// existe campo de role no banco de propósito (ver ROADMAP.md "Área de Gerenciamento").
// Métodos aqui não revalidam isso — só logam o acesso (`adminRepository.logAccess`,
// accountability LGPD).
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// `scope` isola este token de qualquer outro JWT do sistema (ver issueToken em
// auth.service.js) — mesmo que vazasse, não serve pra autenticar nada além de passar no
// gate de verificação (server.js), e só pra quem já é ADMIN_EMAIL (checado de novo lá).
const ADMIN_VERIFIED_SCOPE = 'admin-verified';

// Mesmo desenho de generateVerificationCode/hashCode em auth.service.js: código de 6
// dígitos (zero à esquerda), comparado só por hash sha256 — nunca guardado em texto puro.
function generateVerificationCode() {
  return String(randomInt(0, 10 ** ADMIN_VERIFICATION_RULES.codeLength)).padStart(
    ADMIN_VERIFICATION_RULES.codeLength,
    '0',
  );
}

const hashCode = (code) => createHash('sha256').update(code).digest('hex');

// Etapas do funil, na ordem em que acontecem numa eleição (ver ROADMAP.md "Validação e
// Feedback") — PAGE_VIEW fica de fora: é o total de navegação, não uma etapa do funil.
const FUNNEL_STEPS = ANALYTICS_EVENT_NAMES.filter((name) => name !== 'PAGE_VIEW');

function resolvePagination({ page, pageSize } = {}) {
  const take = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const currentPage = Math.max(Number(page) || 1, 1);
  return { take, currentPage, skip: (currentPage - 1) * take };
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

  // Aba Sistema da Área de Gerenciamento (Etapa 24): mesmo health check público de
  // /api/health (API + banco), mais o que só faz sentido pra quem administra —
  // memória/uptime do processo e totais cross-tenant (ver adminRepository, único
  // lugar do backend com query sem filtro de userId).
  async getSystem(userId) {
    const [health, totalUsers, totalInstitutions, totalSessions, totalVotes, totalPeople, totalCandidates] =
      await Promise.all([
        healthService.check(),
        adminRepository.countUsers(),
        adminRepository.countInstitutionProfiles(),
        adminRepository.countSessions(),
        adminRepository.countVotes(),
        adminRepository.countPeople(),
        adminRepository.countCandidates(),
      ]);

    const memory = process.memoryUsage();

    await adminRepository.logAccess(userId, 'VIEW_SYSTEM');

    return {
      health,
      process: {
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
        memory: {
          rssBytes: memory.rss,
          heapUsedBytes: memory.heapUsed,
          heapTotalBytes: memory.heapTotal,
        },
      },
      totals: { totalUsers, totalInstitutions, totalSessions, totalVotes, totalPeople, totalCandidates },
    };
  },

  async listUsers(userId, pagination) {
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
    if (!FEEDBACK_STATUSES.includes(status)) {
      throw badRequest('FEEDBACK_STATUS_INVALID', 'Status inválido.');
    }

    const result = await feedbackRepository.updateStatus(feedbackId, status);
    if (result.notFound) throw notFound('FEEDBACK_NOT_FOUND', 'Feedback não encontrado.');

    await adminRepository.logAccess(userId, `UPDATE_FEEDBACK_STATUS:${feedbackId}:${status}`);
    return result.record;
  },

  // Segunda camada de acesso à Área de Gerenciamento (Etapa 19) — estas duas rotas são
  // `adminOnly: true` mas NÃO `skipAdminVerification` (ver admin.routes.js): a conta já
  // precisa ser ADMIN_EMAIL pra sequer chegar aqui, isso só confirma posse do e-mail.
  async requestVerification(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw notFound('USER_NOT_FOUND', 'Usuário não encontrado.');

    const pending = await adminVerificationRepository.findByUserId(userId);
    if (pending) {
      const elapsedSeconds = (Date.now() - new Date(pending.createdAt).getTime()) / 1000;
      if (elapsedSeconds < ADMIN_VERIFICATION_RULES.resendCooldownSeconds) {
        throw tooManyRequests(
          'ADMIN_VERIFICATION_RESEND_TOO_SOON',
          'Aguarde um minuto antes de pedir um novo código.',
        );
      }
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + ADMIN_VERIFICATION_RULES.ttlMinutes * 60 * 1000);
    await adminVerificationRepository.upsertForUser(userId, { codeHash: hashCode(code), expiresAt });

    try {
      await emailService.sendAdminVerificationCode(user.email, code);
    } catch (error) {
      console.error('[email] falha ao enviar código de verificação da Área de Gerenciamento', error);
    }

    await adminRepository.logAccess(userId, 'VERIFY_REQUEST');
    return { sent: true };
  },

  async confirmVerification(userId, code) {
    const trimmedCode = typeof code === 'string' ? code.trim() : '';
    if (!trimmedCode) throw badRequest('VERIFICATION_CODE_REQUIRED', 'Informe o código recebido por e-mail.');

    const pending = await adminVerificationRepository.findByUserId(userId);
    if (!pending) {
      throw badRequest('VERIFICATION_CODE_NOT_FOUND', 'Nenhum código pendente. Peça um novo código.');
    }
    if (new Date(pending.expiresAt) < new Date()) {
      throw badRequest('VERIFICATION_CODE_EXPIRED', 'Esse código expirou. Peça um novo código.');
    }
    if (pending.attempts >= ADMIN_VERIFICATION_RULES.maxAttempts) {
      throw badRequest('VERIFICATION_CODE_LOCKED', 'Muitas tentativas. Peça um novo código.');
    }
    if (hashCode(trimmedCode) !== pending.codeHash) {
      await adminVerificationRepository.incrementAttempts(pending.id);
      throw badRequest('VERIFICATION_CODE_INVALID', 'Código incorreto.');
    }

    await adminVerificationRepository.deleteByUserId(userId);
    await adminRepository.logAccess(userId, 'VERIFY_CONFIRM');

    const expiresInSeconds = ADMIN_VERIFICATION_RULES.verifiedTtlMinutes * 60;
    const token = signJwt({ sub: userId, scope: ADMIN_VERIFIED_SCOPE }, { expiresInSeconds });
    return { token, expiresInSeconds };
  },
};
