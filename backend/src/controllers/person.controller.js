import { personService } from '../services/person.service.js';
import { sendSuccess } from '../utils/http.js';

export const personController = {
  async list({ res, query, userId }) {
    sendSuccess(res, await personService.list(query, userId));
  },

  async get({ res, params, userId }) {
    sendSuccess(res, await personService.getById(params.id, userId));
  },

  async update({ res, params, body, userId }) {
    sendSuccess(res, await personService.update(params.id, body, userId));
  },

  async remove({ res, params, userId }) {
    await personService.remove(params.id, userId);
    sendSuccess(res, { id: params.id });
  },
};
