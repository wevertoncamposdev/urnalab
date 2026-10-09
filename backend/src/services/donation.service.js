import { randomUUID } from 'node:crypto';
import { donationRepository } from '../repositories/donation.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { DONATION_LIMITS } from '../rules/donation-rules.js';
import { PAYMENT_STATUS, mapMercadoPagoStatus } from '../rules/payment-rules.js';
import { badRequest } from '../utils/errors.js';
import { mercadoPagoService } from './mercadopago.service.js';

const formatBRL = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function assertValidAmount(amountCents) {
  if (
    !Number.isInteger(amountCents) ||
    amountCents < DONATION_LIMITS.minCents ||
    amountCents > DONATION_LIMITS.maxCents
  ) {
    throw badRequest(
      'INVALID_DONATION_AMOUNT',
      `Escolha um valor entre ${formatBRL(DONATION_LIMITS.minCents)} e ${formatBRL(DONATION_LIMITS.maxCents)}.`,
    );
  }
}

export const donationService = {
  // `userId` vem nulo quando a doação parte da landing sem login — a rota é pública,
  // mas o roteador (ver server.js) ainda tenta decodificar o token, se houver, então
  // dá pra doar logado ou anônimo pelo mesmo endpoint. `donorName` só é usado no caso
  // anônimo (texto livre, opcional); logado, usa sempre a conta.
  async createCheckout({ amountCents, userId, donorName }) {
    assertValidAmount(amountCents);

    const user = userId ? await userRepository.findById(userId) : null;
    const donationId = randomUUID();

    // Sem "unlock" nenhum do outro lado (ver schema.prisma Donation) — por isso, ao
    // contrário de payment.service.js createCheckoutFor, não há checagem de
    // "já pagou" nem expiração de tentativa pendente: cada doação é independente e
    // pode repetir à vontade.
    const { preferenceId, checkoutUrl } = await mercadoPagoService.createPreference({
      paymentId: donationId,
      title: 'Doação para o UrnaLab',
      amountCents,
      payerEmail: user?.email,
      returnPath: user ? '/painel' : '/',
    });

    await donationRepository.create({
      id: donationId,
      userId: user?.id ?? null,
      donorName: user ? null : (donorName?.trim() || null),
      amountCents,
      status: PAYMENT_STATUS.PENDING,
      mpPreferenceId: preferenceId,
    });

    return { checkoutUrl };
  },

  // Chamado pelo mesmo webhook público de payment.controller.js — sem saber de
  // antemão se a notificação é de uma doação ou de uma cobrança de produto, as duas
  // funções são chamadas em sequência; cada uma só age se achar a própria referência
  // (ver payment.service.js confirmPayment, mesmo princípio espelhado aqui).
  async confirmDonation(mpPaymentId) {
    const mpPayment = await mercadoPagoService.getPayment(mpPaymentId);
    const donationId = mpPayment.external_reference;
    if (!donationId) return;

    const donation = await donationRepository.findById(donationId);
    if (!donation) return;

    const status = mapMercadoPagoStatus(mpPayment.status);
    const patch = { status, mpPaymentId: String(mpPayment.id) };

    if (status === PAYMENT_STATUS.APPROVED) {
      const paidAmountCents = Math.round((mpPayment.transaction_amount ?? 0) * 100);
      if (paidAmountCents !== donation.amountCents) {
        console.error(
          '[donation] valor pago diverge do esperado — doação não confirmada',
          { donationId, expectedCents: donation.amountCents, paidCents: paidAmountCents },
        );
        return;
      }
      patch.paidAt = new Date().toISOString();
    }

    await donationRepository.update(donation.id, patch);
  },
};
