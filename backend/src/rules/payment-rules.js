export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

// Mapeia o status que o Mercado Pago devolve (ver mercadopago.service.js) pro nosso
// enum interno. "in_process"/"authorized"/etc. caem em PENDING: ainda não é um "não"
// nem um "sim" definitivo.
export function mapMercadoPagoStatus(mpStatus) {
  if (mpStatus === 'approved') return PAYMENT_STATUS.APPROVED;
  if (mpStatus === 'rejected' || mpStatus === 'cancelled') return PAYMENT_STATUS.REJECTED;
  return PAYMENT_STATUS.PENDING;
}
