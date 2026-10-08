// Segunda camada de acesso à Área de Gerenciamento (Etapa 19) — além da conta já ser
// ADMIN_EMAIL, confirma posse do e-mail via código de 6 dígitos a cada "entrada" na área.
// `verifiedTtlMinutes` é quanto tempo o token emitido em admin.service.js confirmVerification
// continua valendo sem pedir um novo código — guardado só no sessionStorage do navegador
// (ver frontend/src/services/api.js), nunca persistido no servidor.
export const ADMIN_VERIFICATION_RULES = Object.freeze({
  codeLength: 6,
  ttlMinutes: 10,
  maxAttempts: 5,
  resendCooldownSeconds: 60,
  verifiedTtlMinutes: 60,
});
