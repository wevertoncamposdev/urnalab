import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { PAYMENT_STATUS, mapMercadoPagoStatus } from '../rules/payment-rules.js';
import { SESSION_STATUS } from '../rules/session-rules.js';
import { conflict, notFound } from '../utils/errors.js';
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

    // Confere que o valor pago é mesmo o que foi cobrado antes de liberar o acesso —
    // o preço é definido só pelo servidor ao criar a preference (ver createCheckout),
    // então isso não é explorável hoje, mas é a trava que evita problema se um desconto
    // ou produto com preço variável existir no futuro (ver ROADMAP.md, Etapa 15).
    if (status === PAYMENT_STATUS.APPROVED) {
      const paidAmountCents = Math.round((mpPayment.transaction_amount ?? 0) * 100);
      if (paidAmountCents !== payment.amountCents) {
        console.error(
          '[payment] valor pago diverge do esperado — pagamento não aprovado',
          { paymentId, expectedCents: payment.amountCents, paidCents: paidAmountCents },
        );
        return;
      }
    }

    // paidAt não é sobrescrito pra null num status que não seja APPROVED: um reembolso
    // (REFUNDED/CHARGED_BACK) deve manter registrado quando o pagamento foi aprovado
    // originalmente, pro histórico (ver ROADMAP.md, Etapa 14/16).
    const patch = { status, mpPaymentId: String(mpPayment.id) };
    if (status === PAYMENT_STATUS.APPROVED) patch.paidAt = new Date().toISOString();
    await paymentRepository.update(payment.id, patch);
  },
};
