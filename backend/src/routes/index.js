import { Router } from '../utils/router.js';
import { registerAdminRoutes } from './admin.routes.js';
import { registerAnalyticsRoutes } from './analytics.routes.js';
import { registerAuditRoutes } from './audit.routes.js';
import { registerAuthRoutes } from './auth.routes.js';
import { registerCandidateRoutes } from './candidate.routes.js';
import { registerFeedbackRoutes } from './feedback.routes.js';
import { registerHealthRoutes } from './health.routes.js';
import { registerInstitutionProfileRoutes } from './institution-profile.routes.js';
import { registerPartyRoutes } from './party.routes.js';
import { registerPersonRoutes } from './person.routes.js';
import { registerPositionRoutes } from './position.routes.js';
import { registerPublicRoutes } from './public.routes.js';
import { registerResultRoutes } from './result.routes.js';
import { registerSessionRoutes } from './session.routes.js';
import { registerVoteRoutes } from './vote.routes.js';

export function createRouter() {
  const router = new Router();
  registerHealthRoutes(router);
  registerAuthRoutes(router);
  registerInstitutionProfileRoutes(router);
  registerPositionRoutes(router);
  registerSessionRoutes(router);
  registerPartyRoutes(router);
  registerPersonRoutes(router);
  registerCandidateRoutes(router);
  registerVoteRoutes(router);
  registerResultRoutes(router);
  registerAuditRoutes(router);
  registerPublicRoutes(router);
  registerAdminRoutes(router);
  registerAnalyticsRoutes(router);
  registerFeedbackRoutes(router);
  return router;
}
