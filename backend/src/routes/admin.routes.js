import { adminController } from '../controllers/admin.controller.js';

// Autenticação exige login (nenhuma rota aqui é `public`); a autorização admin em
// si (ADMIN_EMAIL) é checada dentro de admin.service.js, não no roteador.
export function registerAdminRoutes(router) {
  router.get('/api/admin/overview', adminController.overview);
  router.get('/api/admin/users', adminController.listUsers);
  router.get('/api/admin/analytics/funnel', adminController.funnel);
  router.get('/api/admin/feedback', adminController.listFeedback);
  // PUT (não PATCH): o roteador do projeto não implementa PATCH, e o resto do backend já
  // usa PUT pra update parcial (ver institution-profile.routes.js, candidate.routes.js).
  router.put('/api/admin/feedback/:id', adminController.updateFeedbackStatus);
}
