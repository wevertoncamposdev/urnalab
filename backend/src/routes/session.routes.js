import { sessionController } from '../controllers/session.controller.js';

export function registerSessionRoutes(router) {
  router.get('/api/sessions', sessionController.list);
  router.get('/api/sessions/:id', sessionController.get);
  router.post('/api/sessions', sessionController.create);
  router.put('/api/sessions/:id', sessionController.update);
  router.post('/api/sessions/:id/open', sessionController.open);
  router.post('/api/sessions/:id/finish', sessionController.finish);
  router.post('/api/sessions/:id/reopen', sessionController.reopen);
  router.post('/api/sessions/:id/resume', sessionController.resume);
  router.post('/api/sessions/:id/duplicate', sessionController.duplicate);
}
