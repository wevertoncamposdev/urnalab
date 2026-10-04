import { analyticsService } from '../services/analytics.service.js';
import { sendSuccess } from '../utils/http.js';

export const analyticsController = {
  async track({ res, body }) {
    sendSuccess(res, await analyticsService.trackEvent(body), 201);
  },
};
