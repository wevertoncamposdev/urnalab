import { donationController } from '../controllers/donation.controller.js';

const FIFTEEN_MIN = 15 * 60 * 1000;

export function registerDonationRoutes(router) {
  // Pública de propósito: a doação funciona tanto na landing (sem login) quanto no
  // botão do sidebar da área logada — o roteador (ver server.js) tenta decodificar o
  // token mesmo em rota pública, então `userId` chega preenchido quando a pessoa está
  // logada, sem precisar de duas rotas diferentes pra isso.
  router.post('/api/donations', donationController.createCheckout, {
    public: true,
    rateLimit: { windowMs: FIFTEEN_MIN, max: 10 },
  });
}
