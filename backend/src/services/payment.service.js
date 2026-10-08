import { randomUUID } from 'node:crypto';
import { paymentRepository } from '../repositories/payment.repository.js';
import { productRepository } from '../repositories/product.repository.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { PAYMENT_STATUS, mapMercadoPagoStatus } from '../rules/payment-rules.js';
import { PRODUCT_KIND, SESSION_EXPORT_PRODUCT_ID } from '../rules/product-rules.js';
import { SESSION_STATUS } from '../rules/session-rules.js';
import { conflict, notFound, serviceUnavailable } from '../utils/errors.js';
import { mercadoPagoService } from './mercadopago.service.js';

// Tentativa PENDING mais antiga que isso é considerada abandonada (ver
// paymentRepository.expireStalePending) — uma hora é bem mais que o tempo normal de um
// Checkout Pro (poucos minutos), mas ainda cobre um boleto/Pix gerado e pago com calma.
const PENDING_EXPIRY_MS = 60 * 60 * 1000;

async function findFinishedSessionOrFail(sessionId, userId) {
  const session = sessionId ? await sessionRepository.findById(sessionId) : null;
  if (!session || session.userId !== userId) throw notFound('SESSION_NOT_FOUND', 'Sessão não encontrada.');
  if (session.status !== SESSION_STATUS.FINISHED) {
    throw conflict(
      'RESULTS_NOT_AVAILABLE',
      'Os resultados só ficam disponíveis depois que a eleição é finalizada.',
    );
  }
  return session;
}

async function findActiveProductOrFail(productId) {
  const product = await productRepository.findById(productId);
  if (!product || !product.active) throw notFound('PRODUCT_NOT_FOUND', 'Produto não encontrado.');
  return product;
}

// Decide como o acesso a um produto é concedido (Etapa 15, ver Product.kind):
// "SESSION_EXPORT" exige uma sessão finalizada de propriedade da conta — `where` fica
// restrito a essa sessão; "EBOOK" (e qualquer outro "por conta") libera direto pro
// userId, sem sessão nenhuma. `where` é o escopo usado no resto deste arquivo
// (findApproved/expireStalePending/create); `session`, quando presente, só serve pra
// compor um título melhor no checkout (ver createCheckoutFor).
async function scopeForProduct(product, { sessionId, userId }) {
  if (product.kind === PRODUCT_KIND.SESSION_EXPORT) {
    const session = await findFinishedSessionOrFail(sessionId, userId);
    return { where: { productId: product.id, sessionId, userId }, session };
  }
  return { where: { productId: product.id, userId }, session: null };
}

async function getStatusFor(product, scope) {
  const { where } = await scopeForProduct(product, scope);
  const approved = await paymentRepository.findApproved(where);
  return { paid: Boolean(approved), priceCents: product.priceCents };
}

async function isPaidFor(product, scope) {
  try {
    const { where } = await scopeForProduct(product, scope);
    const approved = await paymentRepository.findApproved(where);
    return Boolean(approved);
  } catch {
    return false;
  }
}

async function createCheckoutFor(product, scope) {
  const { userId } = scope;
  const { where, session } = await scopeForProduct(product, scope);

  const alreadyPaid = await paymentRepository.findApproved(where);
  if (alreadyPaid) {
    throw conflict(
      'ALREADY_PAID',
      session ? 'O PDF desta sessão já está liberado.' : 'Você já tem acesso a esse produto.',
    );
  }

  await paymentRepository.expireStalePending(where, new Date(Date.now() - PENDING_EXPIRY_MS));

  const user = await userRepository.findById(userId);
  const amountCents = product.priceCents;
  const title = session ? `${product.name} — ${session.name} (${session.year})` : product.name;
  const returnPath = session ? `/resultados?sessionId=${session.id}` : `/loja?productId=${product.id}`;

  // Id gerado antes de chamar o Mercado Pago (pra virar external_reference da
  // preference) — o registro só é gravado depois que a preference é criada com
  // sucesso, pra não sobrar um Payment órfão em PENDING se a chamada falhar.
  const paymentId = randomUUID();
  const { preferenceId, checkoutUrl } = await mercadoPagoService.createPreference({
    paymentId,
    title,
    amountCents,
    payerEmail: user?.email,
    returnPath,
  });

  await paymentRepository.create({
    id: paymentId,
    userId,
    productId: product.id,
    sessionId: session?.id ?? null,
    amountCents,
    status: PAYMENT_STATUS.PENDING,
    mpPreferenceId: preferenceId,
  });

  return { checkoutUrl };
}

async function markDownloadedFor(product, scope) {
  const { where } = await scopeForProduct(product, scope);
  const approved = await paymentRepository.findApproved(where);
  if (approved) await paymentRepository.markDownloaded(approved.id);
}

export const paymentService = {
  // Exportação de PDF por sessão (Etapa 12/14) — mesma assinatura de sempre; por dentro
  // só resolve o produto fixo "session-export" (ver rules/product-rules.js), sem exigir
  // mudança em result.controller.js/payment.controller.js/Results.jsx.
  async getStatus(sessionId, userId) {
    const product = await findActiveProductOrFail(SESSION_EXPORT_PRODUCT_ID);
    return getStatusFor(product, { sessionId, userId });
  },

  async isPaid(sessionId, userId) {
    const product = await productRepository.findById(SESSION_EXPORT_PRODUCT_ID);
    if (!product) return false;
    return isPaidFor(product, { sessionId, userId });
  },

  async createCheckout(sessionId, userId) {
    const product = await findActiveProductOrFail(SESSION_EXPORT_PRODUCT_ID);
    return createCheckoutFor(product, { sessionId, userId });
  },

  async markDownloaded(sessionId, userId) {
    const product = await productRepository.findById(SESSION_EXPORT_PRODUCT_ID);
    if (product) await markDownloadedFor(product, { sessionId, userId });
  },

  // Loja de produtos "por conta" (Etapa 15.3) — mesmo motor acima, parametrizado pelo
  // productId em vez do produto fixo da exportação (ver product.controller.js).
  async getProductStatus(productId, userId) {
    const product = await findActiveProductOrFail(productId);
    return getStatusFor(product, { userId });
  },

  async isProductPaid(productId, userId) {
    const product = await productRepository.findById(productId);
    if (!product) return false;
    return isPaidFor(product, { userId });
  },

  async createProductCheckout(productId, userId) {
    const product = await findActiveProductOrFail(productId);
    return createCheckoutFor(product, { userId });
  },

  async markProductDownloaded(productId, userId) {
    const product = await productRepository.findById(productId);
    if (product) await markDownloadedFor(product, { userId });
  },

  // Chamado pelo webhook público (ver payment.controller.js) — nunca confia no corpo
  // da notificação além do id do pagamento: o status de verdade vem sempre de uma
  // reconsulta à API do Mercado Pago (ver mercadopago.service.js).
  async confirmPayment(mpPaymentId) {
    const mpPayment = await mercadoPagoService.getPayment(mpPaymentId);
    const paymentId = mpPayment.external_reference;
    if (!paymentId) return;

    const payment = await paymentRepository.findById(paymentId);
    if (!payment) return;

    const status = mapMercadoPagoStatus(mpPayment.status);
    // paidAt não é sobrescrito pra null num status que não seja APPROVED: um reembolso
    // (REFUNDED/CHARGED_BACK) deve manter registrado quando o pagamento foi aprovado
    // originalmente, pro histórico (ver ROADMAP.md, Etapa 14/16).
    const patch = { status, mpPaymentId: String(mpPayment.id) };

    if (status === PAYMENT_STATUS.APPROVED) {
      // Confere que o valor pago é mesmo o que foi cobrado antes de liberar o acesso —
      // o preço é definido só pelo servidor ao criar a preference (ver createCheckoutFor),
      // então isso não é explorável hoje, mas é a trava que evita problema se um desconto
      // ou produto com preço variável existir no futuro.
      const paidAmountCents = Math.round((mpPayment.transaction_amount ?? 0) * 100);
      if (paidAmountCents !== payment.amountCents) {
        console.error(
          '[payment] valor pago diverge do esperado — pagamento não aprovado',
          { paymentId, expectedCents: payment.amountCents, paidCents: paidAmountCents },
        );
        return;
      }
      patch.paidAt = new Date().toISOString();
    }

    await paymentRepository.update(payment.id, patch);
  },

  // Área financeira do usuário (Etapa 14) — histórico de todas as cobranças da conta,
  // de qualquer produto.
  async listForUser(userId) {
    return paymentRepository.findByUser(userId);
  },

  // Reembolso pedido pelo próprio usuário (Etapa 14). Regra de negócio inegociável: só
  // antes do primeiro download — senão a conta fica com o produto **e** o dinheiro de
  // volta. O status real some confirmado de novo pelo webhook (igual a qualquer outra
  // mudança de status), esta função só reflete a resposta síncrona do reembolso.
  async refund(paymentId, userId) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment || payment.userId !== userId) {
      throw notFound('PAYMENT_NOT_FOUND', 'Pagamento não encontrado.');
    }
    if (payment.status !== PAYMENT_STATUS.APPROVED) {
      throw conflict('NOT_REFUNDABLE', 'Só é possível reembolsar um pagamento aprovado.');
    }
    if (payment.downloadedAt) {
      throw conflict(
        'ALREADY_DOWNLOADED',
        'O material desta cobrança já foi baixado — não é possível reembolsar depois de baixado.',
      );
    }
    if (!payment.mpPaymentId) {
      throw serviceUnavailable('PAYMENT_GATEWAY_ERROR', 'Pagamento sem referência no Mercado Pago — não é possível reembolsar.');
    }

    await mercadoPagoService.refundPayment(payment.mpPaymentId);
    return paymentRepository.update(payment.id, { status: PAYMENT_STATUS.REFUNDED });
  },
};
