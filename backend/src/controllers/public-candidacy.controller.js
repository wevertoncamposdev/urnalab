import { publicCandidacyService } from '../services/public-candidacy.service.js';
import { sendSuccess } from '../utils/http.js';

export const publicCandidacyController = {
  async getSession({ res, params }) {
    sendSuccess(res, await publicCandidacyService.getSession(params.token));
  },

  async create({ res, params, body }) {
    sendSuccess(res, await publicCandidacyService.create(params.token, body), 201);
  },
};
