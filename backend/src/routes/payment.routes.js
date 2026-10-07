import { paymentController } from '../controllers/payment.controller.js';

export function registerPaymentRoutes(router) {
  router.get('/api/sessions/:id/payment', paymentController.getStatus);
  router.post('/api/sessions/:id/payment', paymentController.createCheckout);
  // Único endpoint deste arquivo sem login: quem chama é o próprio Mercado Pago, não
  // o usuário (ver payment.service.js confirmPayment — o status real vem de uma
  // reconsulta à API deles, nunca do corpo desta notificação).
  router.post('/api/payments/webhook', paymentController.webhook, { public: true });
}
