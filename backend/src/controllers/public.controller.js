import { publicVotingService } from '../services/public-voting.service.js';
import { sendSuccess } from '../utils/http.js';

export const publicController = {
  async getSession({ res, params }) {
    sendSuccess(res, await publicVotingService.getSession(params.token));
  },

  async getCandidates({ res, params }) {
    sendSuccess(res, await publicVotingService.getCandidates(params.token));
  },

  async lookup({ res, params, query }) {
    sendSuccess(res, await publicVotingService.lookup(params.token, query));
  },

  async createVote({ res, params, body }) {
    sendSuccess(res, await publicVotingService.createVote(params.token, body), 201);
  },

  async getResults({ res, params }) {
    sendSuccess(res, await publicVotingService.getResults(params.token));
  },
};
