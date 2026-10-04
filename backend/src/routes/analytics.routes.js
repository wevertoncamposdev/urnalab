import { analyticsController } from '../controllers/analytics.controller.js';

const ONE_HOUR = 60 * 60 * 1000;

// Público de propósito: dispara em toda navegação, inclusive antes de qualquer login
// (landing, votação pública). Nunca grava dado pessoal (ver analytics.service.js).
export function registerAnalyticsRoutes(router) {
  router.post('/api/analytics/events', analyticsController.track, {
    public: true,
    rateLimit: { windowMs: ONE_HOUR, max: 300 },
  });
}
