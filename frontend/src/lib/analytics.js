const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const VISITOR_ID_KEY = 'urna:visitorId';

function createVisitorId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

// UUID aleatório, nunca ligado a nome/e-mail/conta — só identifica o mesmo navegador
// entre eventos, pra dar um funil de verdade (ver backend/src/rules/analytics-rules.js).
function getVisitorId() {
  try {
    const stored = localStorage.getItem(VISITOR_ID_KEY);
    if (stored) return stored;
    const created = createVisitorId();
    localStorage.setItem(VISITOR_ID_KEY, created);
    return created;
  } catch {
    // Sem localStorage (modo privado, etc.): cada evento vira um visitante novo, só isso.
    return createVisitorId();
  }
}

// Fire-and-forget: analytics nunca deve travar a UI nem aparecer como erro pro usuário.
export function trackEvent(name, { path, referrer, sessionId } = {}) {
  try {
    fetch(`${API_URL}/api/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: getVisitorId(), name, path, referrer, sessionId }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ok
  }
}
