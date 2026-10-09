import { adminController } from '../controllers/admin.controller.js';
import { productController } from '../controllers/product.controller.js';
import { PRODUCT_FILE_LIMITS } from '../rules/product-rules.js';

const FIFTEEN_MIN = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// Autenticação exige login (nenhuma rota aqui é `public`); a autorização admin em si
// (ADMIN_EMAIL) é checada no roteador/server.js (`adminOnly: true`, Etapa 16) — antes de
// qualquer handler destas rotas rodar, sem consulta ao banco (ver utils/router.js).
export function registerAdminRoutes(router) {
  // Segunda camada de acesso (Etapa 19): código de verificação por e-mail. Únicas rotas
  // `adminOnly` com `skipAdminVerification: true` — são elas que resolvem esse desafio,
  // não podem exigir o próprio resultado dele pra rodar.
  router.post('/api/admin/verify/request', adminController.requestVerification, {
    adminOnly: true,
    skipAdminVerification: true,
    rateLimit: { windowMs: ONE_HOUR, max: 5 },
  });
  router.post('/api/admin/verify/confirm', adminController.confirmVerification, {
    adminOnly: true,
    skipAdminVerification: true,
    rateLimit: { windowMs: FIFTEEN_MIN, max: 10 },
  });

  router.get('/api/admin/overview', adminController.overview, { adminOnly: true });
  router.get('/api/admin/system', adminController.system, { adminOnly: true });
  router.get('/api/admin/users', adminController.listUsers, { adminOnly: true });
  router.get('/api/admin/analytics/funnel', adminController.funnel, { adminOnly: true });
  router.get('/api/admin/feedback', adminController.listFeedback, { adminOnly: true });
  // PUT (não PATCH): o roteador do projeto não implementa PATCH, e o resto do backend já
  // usa PUT pra update parcial (ver institution-profile.routes.js, candidate.routes.js).
  router.put('/api/admin/feedback/:id', adminController.updateFeedbackStatus, { adminOnly: true });

  // Gestão de produtos (Etapa 16.2/16.3) — catálogo completo (inclusive inativos) e
  // histórico de vendas; o catálogo público fica em product.routes.js (/api/products).
  // create/update aceitam a capa e o arquivo do ebook em base64 no corpo — teto bem
  // maior que o padrão de 1MB (ver PRODUCT_FILE_LIMITS, utils/http.js).
  router.get('/api/admin/products', productController.adminList, { adminOnly: true });
  router.post('/api/admin/products', productController.adminCreate, {
    adminOnly: true,
    maxBodyBytes: PRODUCT_FILE_LIMITS.requestBodyMaxBytes,
  });
  router.put('/api/admin/products/:id', productController.adminUpdate, {
    adminOnly: true,
    maxBodyBytes: PRODUCT_FILE_LIMITS.requestBodyMaxBytes,
  });
  router.get('/api/admin/products/:id/sales', productController.adminSales, { adminOnly: true });

  // Painel financeiro: mesma listagem de produtos acima, só que com total vendido e
  // receita por produto já embutidos, mais o total geral e de doações (sem Product
  // nenhum por trás — ver schema.prisma Donation).
  router.get('/api/admin/payments/summary', adminController.paymentsSummary, { adminOnly: true });
}
