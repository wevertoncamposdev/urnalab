import { config } from '../config.js';
import { adminRepository } from '../repositories/admin.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { forbidden } from '../utils/errors.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

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

  async listUsers(userId, { page, pageSize } = {}) {
    await requireAdmin(userId);

    const take = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const currentPage = Math.max(Number(page) || 1, 1);
    const skip = (currentPage - 1) * take;

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
};
