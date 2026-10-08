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

// Chamada HTTP comum às três operações abaixo: autentica, chama, tenta ler o corpo como
// JSON mesmo em erro (a API do Mercado Pago manda detalhe do erro no corpo), e
// padroniza o log + o erro lançado quando a resposta não é 2xx.
async function callMercadoPago(path, { method = 'GET', body, errorMessage } = {}) {
  const accessToken = requireAccessToken();

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`[mercadopago] erro em ${method} ${path}`, response.status, payload);
    throw serviceUnavailable('PAYMENT_GATEWAY_ERROR', errorMessage);
  }

  return payload;
}

export const mercadoPagoService = {
  verifyWebhookSignature,

  // Cria uma "preference" (Checkout Pro) pra uma cobrança avulsa. `externalReference`
  // é o id do nosso Payment — é por ele que o webhook (ver payment.service.js) liga o
  // pagamento aprovado de volta ao produto/sessão certos. `returnPath` (Etapa 15) é pra
  // onde a volta do Checkout Pro cai — já com `?sessionId=...` ou `?productId=...`,
  // conforme o escopo do produto (ver payment.service.js createCheckoutFor) — só
  // acrescenta `&payment=success|pending|failure`.
  async createPreference({ paymentId, title, amountCents, payerEmail, returnPath }) {
    requireBackendUrl();

    const payload = await callMercadoPago('/checkout/preferences', {
      method: 'POST',
      body: {
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
        notification_url: `${config.backendUrl}/api/payments/webhook`,
        back_urls: {
          success: `${config.frontendUrl}${returnPath}&payment=success`,
          pending: `${config.frontendUrl}${returnPath}&payment=pending`,
          failure: `${config.frontendUrl}${returnPath}&payment=failure`,
        },
        ...(isLoopback(config.frontendUrl) ? {} : { auto_return: 'approved' }),
      },
      errorMessage: 'Não foi possível iniciar o pagamento. Tente de novo.',
    });

    return {
      preferenceId: payload.id,
      checkoutUrl: config.isProduction ? payload.init_point : (payload.sandbox_init_point ?? payload.init_point),
    };
  },

  // Reembolso total (Etapa 14) — sem corpo no POST já significa "devolver o valor
  // inteiro" na API do Mercado Pago (reembolso parcial exigiria um `amount` no corpo,
  // sem uso aqui: a trava de `payment.service.js refund` é tudo ou nada, antes do
  // primeiro download). O webhook também recebe a notificação dessa mudança de status
  // depois — esta chamada só confirma a resposta síncrona da API.
  async refundPayment(mpPaymentId) {
    return callMercadoPago(`/v1/payments/${mpPaymentId}/refunds`, {
      method: 'POST',
      errorMessage: 'Não foi possível processar o reembolso. Tente de novo.',
    });
  },

  // Reconsulta um pagamento pelo id que o Mercado Pago manda na notificação do
  // webhook — nunca confiamos no status que vem na própria notificação, só no que
  // a API devolve ao ser consultada de volta (evita falsificação do payload do webhook).
  async getPayment(mpPaymentId) {
    return callMercadoPago(`/v1/payments/${mpPaymentId}`, {
      errorMessage: 'Não foi possível confirmar o pagamento.',
    });
  },
};
