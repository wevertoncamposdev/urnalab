import { personController } from '../controllers/person.controller.js';

// Pessoa é criada só internamente, pelo link público de candidatura (ver
// public-candidacy.service.js) — por isso não há rota POST aqui.
export function registerPersonRoutes(router) {
  router.get('/api/people', personController.list);
  router.get('/api/people/:id', personController.get);
  router.put('/api/people/:id', personController.update);
  router.delete('/api/people/:id', personController.remove);
}
