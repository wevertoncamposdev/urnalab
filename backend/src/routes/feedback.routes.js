import { feedbackController } from '../controllers/feedback.controller.js';

const ONE_HOUR = 60 * 60 * 1000;

// Versão autenticada: grava com o userId do JWT (ver feedback.controller.js). A versão
// pública (sempre anônima) fica em public.routes.js, ao lado das outras rotas sem login.
export function registerFeedbackRoutes(router) {
  router.post('/api/feedback', feedbackController.create, {
    rateLimit: { windowMs: ONE_HOUR, max: 20 },
  });
}
