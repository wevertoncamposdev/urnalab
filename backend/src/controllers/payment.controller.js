import { paymentService } from '../services/payment.service.js';
import { mercadoPagoService } from '../services/mercadopago.service.js';
import { sendSuccess } from '../utils/http.js';
import { unauthorized } from '../utils/errors.js';

export const paymentController = {
  async getStatus({ res, params, userId }) {
    sendSuccess(res, await paymentService.getStatus(params.id, userId));
  },

  async createCheckout({ res, params, userId }) {
    sendSuccess(res, await paymentService.createCheckout(params.id, userId), 201);
  },

  // Área financeira do usuário (Etapa 14).
  async listMine({ res, userId }) {
    sendSuccess(res, await paymentService.listForUser(userId));
  },

  async refund({ res, params, userId }) {
    sendSuccess(res, await paymentService.refund(params.id, userId));
  },

  // Mercado Pago manda notificação tanto por query string (IPN legado:
  // ?topic=payment&id=123) quanto no corpo (webhooks novos: { type, data: { id } }) —
  // aceita os dois formatos. Um erro aqui vira 5xx de propósito (ver error-handler.js):
  // é o sinal pro Mercado Pago reenviar a mesma notificação depois.
  async webhook({ req, res, query, body }) {
    // IPN legado manda topic/id na query string e nunca inclui o header x-signature
    // (esse formato não tem assinatura — só existe no webhook novo, por body). Exigir
    // assinatura dos dois formatos rejeitaria toda notificação legada legítima assim que
    // MERCADOPAGO_WEBHOOK_SECRET fosse configurado.
    const isLegacyIpn = Boolean(query.topic);
    const type = query.topic ?? body?.type;
    const mpPaymentId = query.id ?? body?.data?.id;

    if (type === 'payment' && mpPaymentId) {
      if (!isLegacyIpn) {
        // Assinatura inválida não é erro 5xx (ver comentário acima): não faz sentido o
        // Mercado Pago reenviar a mesma notificação forjada depois, então 401 encerra ali.
        const validSignature = mercadoPagoService.verifyWebhookSignature({
          signatureHeader: req.headers['x-signature'],
          requestId: req.headers['x-request-id'],
          mpPaymentId,
        });
        if (!validSignature) {
          throw unauthorized('INVALID_WEBHOOK_SIGNATURE', 'Assinatura do webhook inválida.');
        }
      }

      await paymentService.confirmPayment(mpPaymentId);
    }

    sendSuccess(res, { received: true });
  },
};
