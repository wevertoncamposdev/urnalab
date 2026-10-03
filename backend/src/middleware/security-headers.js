// Headers de baixo risco, sem trade-off (diferente de Content-Security-Policy, que
// precisa mapear todo recurso externo antes de ativar — fica pra uma etapa própria).
export function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}
