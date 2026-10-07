import { paymentService } from '../services/payment.service.js';
import { sendSuccess } from '../utils/http.js';

export const paymentController = {
  async getStatus({ res, params, userId }) {
    sendSuccess(res, await paymentService.getStatus(params.id, userId));
  },

  async createCheckout({ res, params, userId }) {
    sendSuccess(res, await paymentService.createCheckout(params.id, userId), 201);
  },

  // Mercado Pago manda notificação tanto por query string (IPN legado:
  // ?topic=payment&id=123) quanto no corpo (webhooks novos: { type, data: { id } }) —
  // aceita os dois formatos. Um erro aqui vira 5xx de propósito (ver error-handler.js):
  // é o sinal pro Mercado Pago reenviar a mesma notificação depois.
  async webhook({ res, query, body }) {
    const type = query.topic ?? body?.type;
    const mpPaymentId = query.id ?? body?.data?.id;

    if (type === 'payment' && mpPaymentId) {
      await paymentService.confirmPayment(mpPaymentId);
    }

    sendSuccess(res, { received: true });
  },
};
