import { productController } from '../controllers/product.controller.js';

const FIFTEEN_MIN = 15 * 60 * 1000;

// Loja de produtos "por conta" (Etapa 15.3) — a exportação de PDF por sessão continua
// em /api/sessions/:id/payment (ver payment.routes.js); essas rotas aqui são pro
// catálogo geral (hoje só ebook) comprado direto pela conta, sem sessão envolvida.
export function registerProductRoutes(router) {
  router.get('/api/products', productController.list);
  router.get('/api/products/:id/payment', productController.getStatus);
  router.post('/api/products/:id/payment', productController.createCheckout, {
    rateLimit: { windowMs: FIFTEEN_MIN, max: 10 },
  });
  router.get('/api/products/:id/download', productController.download);
}
