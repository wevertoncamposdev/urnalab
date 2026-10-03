// Limiter em memória — processo único no Railway hoje, mesma categoria de simplicidade
// do mutex de sessão já usado em enqueueSessionTask (database/index.js). Se algum dia
// virar múltiplas instâncias, isso precisa de um store compartilhado (ex.: Redis); não
// é o caso agora.
const buckets = new Map();

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim(); // Railway injeta isso no proxy
  return req.socket.remoteAddress ?? 'unknown';
}

// Sem limpeza periódica (setInterval): buckets expirados são baratos (um objeto
// pequeno) e são sobrescritos sozinhos na próxima tentativa depois de expirar.
export function checkRateLimit(key, { windowMs, max }) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (bucket.count >= max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { allowed: true };
}
