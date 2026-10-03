import { publicController } from '../controllers/public.controller.js';

const ONE_HOUR = 60 * 60 * 1000;

// Único grupo de rotas sem login: o token do link já é a autorização.
export function registerPublicRoutes(router) {
  router.get('/api/public/sessions/:token', publicController.getSession, { public: true });
  router.get('/api/public/sessions/:token/votes/lookup', publicController.lookup, { public: true });
  router.post('/api/public/sessions/:token/votes', publicController.createVote, {
    public: true,
    // Uso legítimo é uma turma inteira votando do celular pela mesma rede Wi-Fi (mesmo
    // IP público, NAT da escola) — limite alto o bastante pra cobrir isso, mas que
    // ainda barra um script disparando milhares de requisições.
    rateLimit: { windowMs: ONE_HOUR, max: 120 },
  });
  router.get('/api/public/sessions/:token/results', publicController.getResults, { public: true });
}
