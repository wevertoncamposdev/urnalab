import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { PAYMENT_STATUS, mapMercadoPagoStatus } from '../rules/payment-rules.js';
import { SESSION_STATUS } from '../rules/session-rules.js';
import { conflict, notFound, serviceUnavailable } from '../utils/errors.js';
import { mercadoPagoService } from './mercadopago.service.js';

// Tentativa PENDING mais antiga que isso é considerada abandonada (ver
// paymentRepository.expireStalePending) — uma hora é bem mais que o tempo normal de um
// Checkout Pro (poucos minutos), mas ainda cobre um boleto/Pix gerado e pago com calma.
const PENDING_EXPIRY_MS = 60 * 60 * 1000;

async function findFinishedSessionOrFail(sessionId, userId) {
  const session = await sessionRepository.findById(sessionId);
  if (!session || session.userId !== userId) throw notFound('SESSION_NOT_FOUND', 'Sessão não encontrada.');
  if (session.status !== SESSION_STATUS.FINISHED) {
    throw conflict(
      'RESULTS_NOT_AVAILABLE',
      'Os resultados só ficam disponíveis depois que a eleição é finalizada.',
    );
  }
  return session;
}

export const paymentService = {
  // Usado pelo front (pra decidir entre mostrar "Baixar PDF" ou "Pagar e baixar") e
  // pelo gate do próprio download (ver result.controller.js downloadPdf).
  async getStatus(sessionId, userId) {
    await findFinishedSessionOrFail(sessionId, userId);
    const approved = await paymentRepository.findApprovedBySession(sessionId);
    return { paid: Boolean(approved), priceCents: config.sessionResultsPriceCents };
  },

  async isPaid(sessionId, userId) {
    const session = await sessionRepository.findById(sessionId);
    if (!session || session.userId !== userId) return false;
    const approved = await paymentRepository.findApprovedBySession(sessionId);
    return Boolean(approved);
  },

  // Abre uma nova cobrança (preference) pra sessão. Não impede múltiplas tentativas
  // pendentes/rejeitadas em paralelo — só a primeira aprovada importa.
  async createCheckout(sessionId, userId) {
    const session = await findFinishedSessionOrFail(sessionId, userId);

    const alreadyPaid = await paymentRepository.findApprovedBySession(sessionId);
    if (alreadyPaid) {
      throw conflict('ALREADY_PAID', 'O PDF desta sessão já está liberado.');
    }

    await paymentRepository.expireStalePending(sessionId, new Date(Date.now() - PENDING_EXPIRY_MS));

    const user = await userRepository.findById(userId);
    const amountCents = config.sessionResultsPriceCents;

    // Id gerado antes de chamar o Mercado Pago (pra virar external_reference da
    // preference) — o registro só é gravado depois que a preference é criada com
    // sucesso, pra não sobrar um Payment órfão em PENDING se a chamada falhar.
    const paymentId = randomUUID();
    const { preferenceId, checkoutUrl } = await mercadoPagoService.createPreference({
      paymentId,
      sessionId,
      title: `Exportação do resultado — ${session.name} (${session.year})`,
      amountCents,
      payerEmail: user?.email,
    });

    await paymentRepository.create({
      id: paymentId,
      userId,
      sessionId,
      amountCents,
      status: PAYMENT_STATUS.PENDING,
      mpPreferenceId: preferenceId,
    });

    return { checkoutUrl };
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
      // o preço é definido só pelo servidor ao criar a preference (ver createCheckout),
      // então isso não é explorável hoje, mas é a trava que evita problema se um desconto
      // ou produto com preço variável existir no futuro (ver ROADMAP.md, Etapa 15).
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
  // de qualquer sessão.
  async listForUser(userId) {
    return paymentRepository.findByUser(userId);
  },

  // Chamado por result.controller.js a cada download bem-sucedido do PDF — só grava a
  // primeira vez (ver paymentRepository.markDownloaded), é o que `refund` abaixo usa pra
  // travar reembolso de quem já baixou.
  async markDownloaded(sessionId, userId) {
    const approved = await paymentRepository.findApprovedBySession(sessionId);
    if (approved && approved.userId === userId) {
      await paymentRepository.markDownloaded(approved.id);
    }
  },

  // Reembolso pedido pelo próprio usuário (Etapa 14). Regra de negócio inegociável: só
  // antes do primeiro download — senão a conta fica com o PDF **e** o dinheiro de volta.
  // O status real some confirmado de novo pelo webhook (igual a qualquer outra mudança
  // de status), esta função só reflete a resposta síncrona do reembolso.
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
