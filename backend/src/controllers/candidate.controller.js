import { candidateService } from '../services/candidate.service.js';
import { sendSuccess } from '../utils/http.js';

export const candidateController = {
  async list({ res, query, userId }) {
    sendSuccess(res, await candidateService.list(query, userId));
  },

  async get({ res, params, userId }) {
    sendSuccess(res, await candidateService.getById(params.id, userId));
  },

  async update({ res, params, body, userId }) {
    sendSuccess(res, await candidateService.update(params.id, body, userId));
  },

  // DELETE desativa o registro (não apaga).
  async deactivate({ res, params, userId }) {
    sendSuccess(res, await candidateService.deactivate(params.id, userId));
  },
};
