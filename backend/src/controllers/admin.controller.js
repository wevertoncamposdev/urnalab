import { adminService } from '../services/admin.service.js';
import { sendSuccess } from '../utils/http.js';

export const adminController = {
  async overview({ res, userId }) {
    sendSuccess(res, await adminService.getOverview(userId));
  },

  async listUsers({ res, userId, query }) {
    sendSuccess(res, await adminService.listUsers(userId, query));
  },
};
