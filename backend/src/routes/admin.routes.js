import { adminController } from '../controllers/admin.controller.js';
import { productController } from '../controllers/product.controller.js';

// Autenticação exige login (nenhuma rota aqui é `public`); a autorização admin em si
// (ADMIN_EMAIL) é checada no roteador/server.js (`adminOnly: true`, Etapa 16) — antes de
// qualquer handler destas rotas rodar, sem consulta ao banco (ver utils/router.js).
export function registerAdminRoutes(router) {
  router.get('/api/admin/overview', adminController.overview, { adminOnly: true });
  router.get('/api/admin/users', adminController.listUsers, { adminOnly: true });
  router.get('/api/admin/analytics/funnel', adminController.funnel, { adminOnly: true });
  router.get('/api/admin/feedback', adminController.listFeedback, { adminOnly: true });
  // PUT (não PATCH): o roteador do projeto não implementa PATCH, e o resto do backend já
  // usa PUT pra update parcial (ver institution-profile.routes.js, candidate.routes.js).
  router.put('/api/admin/feedback/:id', adminController.updateFeedbackStatus, { adminOnly: true });

  // Gestão de produtos (Etapa 16.2/16.3) — catálogo completo (inclusive inativos) e
  // histórico de vendas; o catálogo público fica em product.routes.js (/api/products).
  router.get('/api/admin/products', productController.adminList, { adminOnly: true });
  router.post('/api/admin/products', productController.adminCreate, { adminOnly: true });
  router.put('/api/admin/products/:id', productController.adminUpdate, { adminOnly: true });
  router.get('/api/admin/products/:id/sales', productController.adminSales, { adminOnly: true });
}
