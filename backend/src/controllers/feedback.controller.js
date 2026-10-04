import { feedbackService } from '../services/feedback.service.js';
import { sendSuccess } from '../utils/http.js';

export const feedbackController = {
  async create({ res, body, userId }) {
    sendSuccess(res, await feedbackService.create(body, userId), 201);
  },

  async createPublic({ res, body }) {
    sendSuccess(res, await feedbackService.create(body, null), 201);
  },
};
