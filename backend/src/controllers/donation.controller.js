import { donationService } from '../services/donation.service.js';
import { sendSuccess } from '../utils/http.js';

export const donationController = {
  async createCheckout({ res, body, userId }) {
    const amountCents = Math.round(Number(body.amountCents));
    const donorName = typeof body.donorName === 'string' ? body.donorName : null;
    sendSuccess(res, await donationService.createCheckout({ amountCents, userId, donorName }), 201);
  },
};
