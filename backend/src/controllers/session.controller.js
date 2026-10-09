import { sessionService } from '../services/session.service.js';
import { sendSuccess } from '../utils/http.js';

export const sessionController = {
  async list({ res, userId }) {
    sendSuccess(res, await sessionService.list(userId));
  },

  async get({ res, params, userId }) {
    sendSuccess(res, await sessionService.getById(params.id, userId));
  },

  async create({ res, body, userId }) {
    sendSuccess(res, await sessionService.create(body, userId), 201);
  },

  async update({ res, params, body, userId }) {
    sendSuccess(res, await sessionService.update(params.id, body, userId));
  },

  async open({ res, params, userId }) {
    sendSuccess(res, await sessionService.open(params.id, userId));
  },

  async finish({ res, params, userId }) {
    sendSuccess(res, await sessionService.finish(params.id, userId));
  },

  async reopen({ res, params, userId }) {
    sendSuccess(res, await sessionService.reopen(params.id, userId));
  },

  async resume({ res, params, userId }) {
    sendSuccess(res, await sessionService.resume(params.id, userId));
  },

  async duplicate({ res, params, body, userId }) {
    sendSuccess(res, await sessionService.duplicate(params.id, body, userId), 201);
  },
};
