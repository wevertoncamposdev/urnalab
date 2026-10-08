export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  // Pagamento que já esteve APPROVED e foi devolvido depois — estorno iniciado pelo
  // Mercado Pago/vendedor (REFUNDED) ou pelo banco emissor do cartão (CHARGED_BACK).
  // Nos dois casos o acesso ao PDF é revogado (findApprovedBySession só considera
  // APPROVED), mas o motivo fica registrado em vez de cair genericamente em PENDING.
  REFUNDED: 'REFUNDED',
  CHARGED_BACK: 'CHARGED_BACK',
});

// Mapeia o status que o Mercado Pago devolve (ver mercadopago.service.js) pro nosso
// enum interno. "in_process"/"authorized"/"in_mediation"/etc. caem em PENDING: ainda não
// é um "não" nem um "sim" definitivo.
export function mapMercadoPagoStatus(mpStatus) {
  if (mpStatus === 'approved') return PAYMENT_STATUS.APPROVED;
  if (mpStatus === 'rejected' || mpStatus === 'cancelled') return PAYMENT_STATUS.REJECTED;
  if (mpStatus === 'refunded') return PAYMENT_STATUS.REFUNDED;
  if (mpStatus === 'charged_back') return PAYMENT_STATUS.CHARGED_BACK;
  return PAYMENT_STATUS.PENDING;
}
