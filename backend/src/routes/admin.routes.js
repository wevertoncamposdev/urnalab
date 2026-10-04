import { adminController } from '../controllers/admin.controller.js';

// Autenticação exige login (nenhuma rota aqui é `public`); a autorização admin em
// si (ADMIN_EMAIL) é checada dentro de admin.service.js, não no roteador.
export function registerAdminRoutes(router) {
  router.get('/api/admin/overview', adminController.overview);
  router.get('/api/admin/users', adminController.listUsers);
}
