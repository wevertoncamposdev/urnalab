import { adminService } from '../services/admin.service.js';
import { sendSuccess } from '../utils/http.js';

export const adminController = {
  async overview({ res, userId }) {
    sendSuccess(res, await adminService.getOverview(userId));
  },

  async system({ res, userId }) {
    sendSuccess(res, await adminService.getSystem(userId));
  },

  async listUsers({ res, userId, query }) {
    sendSuccess(res, await adminService.listUsers(userId, query));
  },

  async paymentsSummary({ res, userId }) {
    sendSuccess(res, await adminService.getPaymentsSummary(userId));
  },

  async funnel({ res, userId }) {
    sendSuccess(res, await adminService.getFunnel(userId));
  },

  async listFeedback({ res, userId, query }) {
    sendSuccess(res, await adminService.listFeedback(userId, query));
  },

  async updateFeedbackStatus({ res, userId, params, body }) {
    sendSuccess(res, await adminService.updateFeedbackStatus(userId, params.id, body?.status));
  },

  async requestVerification({ res, userId }) {
    sendSuccess(res, await adminService.requestVerification(userId));
  },

  async confirmVerification({ res, userId, body }) {
    sendSuccess(res, await adminService.confirmVerification(userId, body?.code));
  },
};
