import { paymentController } from '../controllers/payment.controller.js';

const FIFTEEN_MIN = 15 * 60 * 1000;

export function registerPaymentRoutes(router) {
  router.get('/api/sessions/:id/payment', paymentController.getStatus);
  // Limite por IP+rota (ver middleware/rate-limit.js) — evita repetir a criação de
  // preference sem parar (cada chamada é uma requisição de verdade à API do Mercado Pago).
  router.post('/api/sessions/:id/payment', paymentController.createCheckout, {
    rateLimit: { windowMs: FIFTEEN_MIN, max: 10 },
  });
  // Único endpoint deste arquivo sem login: quem chama é o próprio Mercado Pago, não
  // o usuário (ver payment.service.js confirmPayment — o status real vem de uma
  // reconsulta à API deles, nunca do corpo desta notificação).
  router.post('/api/payments/webhook', paymentController.webhook, { public: true });
}
