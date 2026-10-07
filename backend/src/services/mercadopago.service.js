import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { serviceUnavailable } from '../utils/errors.js';

// Único ponto que conhece a API REST do Mercado Pago — services nunca chamam
// api.mercadopago.com direto, mesmo princípio já usado pro Resend (email.service.js).
// Sem SDK: a API é simples o bastante pra não justificar mais uma dependência, e
// `fetch` já vem embutido no Node 20.
const API_URL = 'https://api.mercadopago.com';

function requireAccessToken() {
  if (!config.mercadoPagoAccessToken) {
    throw serviceUnavailable(
      'PAYMENT_GATEWAY_NOT_CONFIGURED',
      'Cobrança indisponível no momento: integração com o Mercado Pago não configurada.',
    );
  }
  return config.mercadoPagoAccessToken;
}

function requireBackendUrl() {
  if (!config.backendUrl) {
    throw serviceUnavailable(
      'PAYMENT_GATEWAY_NOT_CONFIGURED',
      'Cobrança indisponível no momento: BACKEND_URL não configurada.',
    );
  }
  return config.backendUrl;
}

// O Mercado Pago aceita back_urls apontando pra localhost na requisição, mas
// silenciosamente ignora o campo (some da preference criada) — e com
// `auto_return` setado, isso vira erro 400 ("back_url.success must be defined").
// Em dev local (FRONTEND_URL de loopback) a gente só abre mão do auto-redirect
// de volta ao site depois do pagamento; em produção, com uma URL pública de
// verdade, funciona normalmente.
function isLoopback(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return true;
  }
}

// Header "x-signature: ts=<timestamp>,v1=<hash>" — formato chave=valor separado por
// vírgula, documentado em https://www.mercadopago.com.br/developers (Webhooks > Assinatura).
function parseSignatureHeader(header) {
  const parts = {};
  for (const pair of (header ?? '').split(',')) {
    const [key, value] = pair.split('=').map((part) => part?.trim());
    if (key && value) parts[key] = value;
  }
  return parts;
}

// Confere que a notificação do webhook veio mesmo do Mercado Pago, antes de gastar uma
// chamada à API deles pra reconsultar o pagamento (ver getPayment). Sem
// MERCADOPAGO_WEBHOOK_SECRET configurado, não dá pra validar — deixa passar (mesmo
// comportamento de antes desta checagem existir), só avisando no log; a segurança do
// status em si continua garantida pela reconsulta, que nunca confia no corpo da notificação.
function verifyWebhookSignature({ signatureHeader, requestId, mpPaymentId }) {
  const secret = config.mercadoPagoWebhookSecret;
  if (!secret) {
    console.warn('[mercadopago] MERCADOPAGO_WEBHOOK_SECRET não configurado — assinatura do webhook não verificada.');
    return true;
  }

  const { ts, v1 } = parseSignatureHeader(signatureHeader);
  if (!ts || !v1 || !mpPaymentId) return false;

  // Manifest exato exigido pelo Mercado Pago: "id:{data.id};request-id:{x-request-id};ts:{ts};".
  const manifest = `id:${String(mpPaymentId).toLowerCase()};request-id:${requestId ?? ''};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(v1);
  return (
    expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export const mercadoPagoService = {
  verifyWebhookSignature,

  // Cria uma "preference" (Checkout Pro) pra uma cobrança avulsa. `externalReference`
  // é o id do nosso Payment — é por ele que o webhook (ver payment.service.js) liga o
  // pagamento aprovado de volta à sessão certa.
  async createPreference({ paymentId, sessionId, title, amountCents, payerEmail }) {
    const accessToken = requireAccessToken();
    const backendUrl = requireBackendUrl();

    const response = await fetch(`${API_URL}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            title,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: amountCents / 100,
          },
        ],
        payer: payerEmail ? { email: payerEmail } : undefined,
        external_reference: paymentId,
        notification_url: `${backendUrl}/api/payments/webhook`,
        back_urls: {
          success: `${config.frontendUrl}/resultados?sessionId=${sessionId}&payment=success`,
          pending: `${config.frontendUrl}/resultados?sessionId=${sessionId}&payment=pending`,
          failure: `${config.frontendUrl}/resultados?sessionId=${sessionId}&payment=failure`,
        },
        ...(isLoopback(config.frontendUrl) ? {} : { auto_return: 'approved' }),
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('[mercadopago] erro ao criar preference', response.status, payload);
      throw serviceUnavailable('PAYMENT_GATEWAY_ERROR', 'Não foi possível iniciar o pagamento. Tente de novo.');
    }

    return {
      preferenceId: payload.id,
      checkoutUrl: config.isProduction ? payload.init_point : (payload.sandbox_init_point ?? payload.init_point),
    };
  },

  // Reconsulta um pagamento pelo id que o Mercado Pago manda na notificação do
  // webhook — nunca confiamos no status que vem na própria notificação, só no que
  // a API devolve ao ser consultada de volta (evita falsificação do payload do webhook).
  async getPayment(mpPaymentId) {
    const accessToken = requireAccessToken();

    const response = await fetch(`${API_URL}/v1/payments/${mpPaymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('[mercadopago] erro ao consultar pagamento', mpPaymentId, response.status, payload);
      throw serviceUnavailable('PAYMENT_GATEWAY_ERROR', 'Não foi possível confirmar o pagamento.');
    }

    return payload;
  },
};
