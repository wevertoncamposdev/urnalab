const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'urna:authToken';
const ADMIN_VERIFICATION_KEY = 'urna:adminVerificationToken';

// Fotos capturadas pela câmera voltam da API como um caminho relativo (/photos/...),
// servido pelo próprio backend; links externos (https://...) já são absolutos.
export const resolvePhotoUrl = (photo) => (photo?.startsWith('/') ? `${API_URL}${photo}` : photo);

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function readStoredAdminVerificationToken() {
  try {
    return sessionStorage.getItem(ADMIN_VERIFICATION_KEY);
  } catch {
    return null;
  }
}

// Lido na carga do módulo (não num efeito do React), pra já estar disponível
// antes de qualquer provider montar e disparar a primeira requisição.
let authToken = readStoredToken();
let onUnauthorized = null;
// Segunda camada da Área de Gerenciamento (Etapa 19) — de propósito em sessionStorage, não
// localStorage: expira sozinho ao fechar a aba, sem precisar de lógica própria de logout
// (ver admin.service.js confirmVerification, AdminLayout.jsx).
let adminVerificationToken = readStoredAdminVerificationToken();
let onAdminVerificationRequired = null;

export function setAuthToken(token) {
  authToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Sem localStorage (modo privado, etc.): a sessão só não sobrevive ao reload.
  }
}

export function clearAuthToken() {
  authToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ok
  }
}

export function setAdminVerificationToken(token) {
  adminVerificationToken = token;
  try {
    sessionStorage.setItem(ADMIN_VERIFICATION_KEY, token);
  } catch {
    // Sem sessionStorage: só não sobrevive a um reload da aba.
  }
}

export function clearAdminVerificationToken() {
  adminVerificationToken = null;
  try {
    sessionStorage.removeItem(ADMIN_VERIFICATION_KEY);
  } catch {
    // ok
  }
}

export const hasAdminVerificationToken = () => Boolean(adminVerificationToken);

// AuthProvider registra aqui o que fazer quando qualquer requisição volta 401
// (token ausente/expirado) — evita checar isso em cada tela separadamente.
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// AdminLayout registra aqui o que fazer quando uma chamada a /api/admin/* volta
// ADMIN_VERIFICATION_REQUIRED (token de verificação ausente/expirado no meio do uso) —
// mesmo princípio do onUnauthorized acima, só que pra essa segunda camada.
export function setAdminVerificationRequiredHandler(handler) {
  onAdminVerificationRequired = handler;
}

export const hasAuthToken = () => Boolean(authToken);

function toQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(adminVerificationToken ? { 'X-Admin-Verification': adminVerificationToken } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Não foi possível conectar à API.', 0);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    const error = payload?.error;
    if (response.status === 401 && error?.code === 'ADMIN_VERIFICATION_REQUIRED') {
      clearAdminVerificationToken();
      onAdminVerificationRequired?.();
    } else if (response.status === 401) {
      onUnauthorized?.();
    }
    throw new ApiError(
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? 'Erro inesperado.',
      response.status,
    );
  }
  return payload.data;
}

function parseFileName(contentDisposition, fallback) {
  return /filename="([^"]+)"/.exec(contentDisposition ?? '')?.[1] ?? fallback;
}

// Irmã de request(), mas devolve o arquivo em vez de JSON no sucesso (erro continua
// JSON normal). Usa fetch com header Authorization manual porque <a href>/window.open
// não carregam JWT, e as rotas de arquivo são autenticadas.
async function requestFile(path) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Não foi possível conectar à API.', 0);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    if (response.status === 401) onUnauthorized?.();
    const error = payload?.error;
    throw new ApiError(error?.code ?? 'UNKNOWN_ERROR', error?.message ?? 'Erro inesperado.', response.status);
  }

  const blob = await response.blob();
  return { blob, fileName: parseFileName(response.headers.get('Content-Disposition'), 'arquivo') };
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  health: () => request('/api/health'),

  auth: {
    register: (data) => request('/api/auth/register', { method: 'POST', body: data }),
    login: (data) => request('/api/auth/login', { method: 'POST', body: data }),
    verifyEmail: (data) => request('/api/auth/verify-email', { method: 'POST', body: data }),
    resendVerification: (data) => request('/api/auth/resend-verification', { method: 'POST', body: data }),
    forgotPassword: (data) => request('/api/auth/forgot-password', { method: 'POST', body: data }),
    resetPassword: (data) => request('/api/auth/reset-password', { method: 'POST', body: data }),
    me: () => request('/api/auth/me'),
    changePassword: (data) => request('/api/auth/change-password', { method: 'POST', body: data }),
  },

  institutionProfile: {
    get: () => request('/api/institution-profile'),
    save: (data) => request('/api/institution-profile', { method: 'PUT', body: data }),
  },

  // Feedback autenticado grava o userId (ver backend/src/controllers/feedback.controller.js).
  // A versão anônima da votação pública fica em `api.public.createFeedback`.
  feedback: {
    create: (data) => request('/api/feedback', { method: 'POST', body: data }),
  },

  positions: {
    list: () => request('/api/positions'),
    create: (data) => request('/api/positions', { method: 'POST', body: data }),
    update: (id, data) => request(`/api/positions/${id}`, { method: 'PUT', body: data }),
    remove: (id) => request(`/api/positions/${id}`, { method: 'DELETE' }),
  },

  parties: {
    list: (params) => request(`/api/parties${toQuery(params)}`),
    create: (data) => request('/api/parties', { method: 'POST', body: data }),
    update: (id, data) => request(`/api/parties/${id}`, { method: 'PUT', body: data }),
    deactivate: (id) => request(`/api/parties/${id}`, { method: 'DELETE' }),
  },

  candidates: {
    list: (params) => request(`/api/candidates${toQuery(params)}`),
    update: (id, data) => request(`/api/candidates/${id}`, { method: 'PUT', body: data }),
    deactivate: (id) => request(`/api/candidates/${id}`, { method: 'DELETE' }),
  },

  people: {
    list: (params) => request(`/api/people${toQuery(params)}`),
    get: (id) => request(`/api/people/${id}`),
    update: (id, data) => request(`/api/people/${id}`, { method: 'PUT', body: data }),
    remove: (id) => request(`/api/people/${id}`, { method: 'DELETE' }),
  },

  sessions: {
    list: () => request('/api/sessions'),
    get: (id) => request(`/api/sessions/${id}`),
    create: (data) => request('/api/sessions', { method: 'POST', body: data }),
    update: (id, data) => request(`/api/sessions/${id}`, { method: 'PUT', body: data }),
    open: (id) => request(`/api/sessions/${id}/open`, { method: 'POST' }),
    finish: (id) => request(`/api/sessions/${id}/finish`, { method: 'POST' }),
    reopen: (id) => request(`/api/sessions/${id}/reopen`, { method: 'POST' }),
    resume: (id) => request(`/api/sessions/${id}/resume`, { method: 'POST' }),
    duplicate: (id, data) => request(`/api/sessions/${id}/duplicate`, { method: 'POST', body: data }),
  },

  votes: {
    lookup: (params) => request(`/api/votes/lookup${toQuery(params)}`),
    create: (data) => request('/api/votes', { method: 'POST', body: data }),
  },

  results: {
    get: (sessionId) => request(`/api/sessions/${sessionId}/results`),
    downloadPdf: (sessionId) => requestFile(`/api/sessions/${sessionId}/results/pdf`),
    createRunoffSession: (sessionId) =>
      request(`/api/sessions/${sessionId}/results/runoff-session`, { method: 'POST' }),
  },

  // Cobrança pela exportação em PDF (Etapa 12) — uma cobrança aprovada libera o
  // download da sessão pra sempre (ver backend/src/services/payment.service.js).
  payments: {
    getStatus: (sessionId) => request(`/api/sessions/${sessionId}/payment`),
    createCheckout: (sessionId) => request(`/api/sessions/${sessionId}/payment`, { method: 'POST' }),
    // Área financeira (Etapa 14): histórico de todas as cobranças da conta e reembolso
    // (só antes do primeiro download — ver backend/src/services/payment.service.js refund).
    listMine: () => request('/api/payments'),
    refund: (id) => request(`/api/payments/${id}/refund`, { method: 'POST' }),
  },

  // Doação avulsa (landing sem login, ou botão do sidebar já logado) — rota pública,
  // mas o backend ainda lê o token se houver (ver server.js), então `userId` chega
  // preenchido sozinho quando a pessoa está logada; `donorName` só importa no caso
  // anônimo. Sem getStatus/isPaid: ao contrário de payments/products acima, não existe
  // "já pagou" — dá pra doar quantas vezes quiser.
  donations: {
    createCheckout: (data) => request('/api/donations', { method: 'POST', body: data }),
  },

  // Loja de produtos "por conta" (Etapa 15.3) — hoje só ebooks; a exportação de PDF por
  // sessão continua em api.payments acima.
  products: {
    list: () => request('/api/products'),
    getStatus: (id) => request(`/api/products/${id}/payment`),
    createCheckout: (id) => request(`/api/products/${id}/payment`, { method: 'POST' }),
    download: (id) => requestFile(`/api/products/${id}/download`),
  },

  audit: {
    get: (sessionId) => request(`/api/sessions/${sessionId}/audit`),
  },

  // Área de Gerenciamento: só a conta ADMIN_EMAIL (ver backend/src/config.js) recebe
  // respostas de sucesso aqui — qualquer outra conta recebe 403, verificado no roteador
  // (`adminOnly: true`, Etapa 16), antes de qualquer rota destas rodar.
  admin: {
    // Segunda camada de acesso (Etapa 19): código de 6 dígitos mandado pro e-mail da
    // conta admin — confirmar devolve o token guardado em sessionStorage (ver
    // setAdminVerificationToken) e enviado como header em toda chamada admin.* acima.
    verify: {
      request: () => request('/api/admin/verify/request', { method: 'POST' }),
      confirm: (code) => request('/api/admin/verify/confirm', { method: 'POST', body: { code } }),
    },
    overview: () => request('/api/admin/overview'),
    system: () => request('/api/admin/system'),
    users: (params) => request(`/api/admin/users${toQuery(params)}`),
    analytics: {
      funnel: () => request('/api/admin/analytics/funnel'),
    },
    feedback: {
      list: (params) => request(`/api/admin/feedback${toQuery(params)}`),
      updateStatus: (id, status) => request(`/api/admin/feedback/${id}`, { method: 'PUT', body: { status } }),
    },
    // CRUD de produtos (Etapa 16.2) e histórico de vendas (16.3) — catálogo completo
    // (inclusive inativos), diferente de api.products (storefront pública).
    products: {
      list: () => request('/api/admin/products'),
      create: (data) => request('/api/admin/products', { method: 'POST', body: data }),
      update: (id, data) => request(`/api/admin/products/${id}`, { method: 'PUT', body: data }),
      sales: (id) => request(`/api/admin/products/${id}/sales`),
    },
  },

  // Link público de votação: sem login, o token é a própria autorização.
  public: {
    getSession: (token) => request(`/api/public/sessions/${token}`),
    getCandidates: (token) => request(`/api/public/sessions/${token}/candidates`),
    lookup: (token, params) => request(`/api/public/sessions/${token}/votes/lookup${toQuery(params)}`),
    createVote: (token, data) => request(`/api/public/sessions/${token}/votes`, { method: 'POST', body: data }),
    getResults: (token) => request(`/api/public/sessions/${token}/results`),
    // Feedback sempre anônimo aqui (sem login) — ver backend/src/services/feedback.service.js.
    createFeedback: (data) => request('/api/public/feedback', { method: 'POST', body: data }),
  },

  // Link público de candidatura (Etapa 20): mesma ideia do link de votação acima,
  // mas com token em letras maiúsculas — quem acessa se cadastra como pessoa e
  // candidato numa submissão só, entrando como PENDING até o admin aprovar.
  publicCandidacy: {
    getSession: (token) => request(`/api/public/candidacy/${token}`),
    create: (token, data) => request(`/api/public/candidacy/${token}`, { method: 'POST', body: data }),
  },
};
