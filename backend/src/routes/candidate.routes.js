import { candidateController } from '../controllers/candidate.controller.js';

// Candidatura é criada só internamente, pelo link público de candidatura (ver
// public-candidacy.service.js) — por isso não há rota POST aqui.
export function registerCandidateRoutes(router) {
  router.get('/api/candidates', candidateController.list);
  router.get('/api/candidates/:id', candidateController.get);
  router.put('/api/candidates/:id', candidateController.update);
  router.delete('/api/candidates/:id', candidateController.deactivate);
}
