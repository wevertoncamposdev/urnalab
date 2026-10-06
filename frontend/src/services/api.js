const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'urna:authToken';

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

// Lido na carga do módulo (não num efeito do React), pra já estar disponível
// antes de qualquer provider montar e disparar a primeira requisição.
let authToken = readStoredToken();
let onUnauthorized = null;

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

// AuthProvider registra aqui o que fazer quando qualquer requisição volta 401
// (token ausente/expirado) — evita checar isso em cada tela separadamente.
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
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
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Não foi possível conectar à API.', 0);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    const error = payload?.error;
    if (response.status === 401) onUnauthorized?.();
    throw new ApiError(
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? 'Erro inesperado.',
      response.status,
    );
  }
  return payload.data;
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
    create: (data) => request('/api/candidates', { method: 'POST', body: data }),
    update: (id, data) => request(`/api/candidates/${id}`, { method: 'PUT', body: data }),
    deactivate: (id) => request(`/api/candidates/${id}`, { method: 'DELETE' }),
  },

  people: {
    list: (params) => request(`/api/people${toQuery(params)}`),
    create: (data) => request('/api/people', { method: 'POST', body: data }),
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
    duplicate: (id, data) => request(`/api/sessions/${id}/duplicate`, { method: 'POST', body: data }),
  },

  votes: {
    lookup: (params) => request(`/api/votes/lookup${toQuery(params)}`),
    create: (data) => request('/api/votes', { method: 'POST', body: data }),
  },

  results: {
    get: (sessionId) => request(`/api/sessions/${sessionId}/results`),
    createRunoffSession: (sessionId) =>
      request(`/api/sessions/${sessionId}/results/runoff-session`, { method: 'POST' }),
  },

  audit: {
    get: (sessionId) => request(`/api/sessions/${sessionId}/audit`),
  },

  // Área de Gerenciamento: só a conta ADMIN_EMAIL (ver backend/src/config.js) recebe
  // respostas de sucesso aqui — qualquer outra conta recebe 403 (ver admin.service.js).
  admin: {
    overview: () => request('/api/admin/overview'),
    users: (params) => request(`/api/admin/users${toQuery(params)}`),
    analytics: {
      funnel: () => request('/api/admin/analytics/funnel'),
    },
    feedback: {
      list: (params) => request(`/api/admin/feedback${toQuery(params)}`),
      updateStatus: (id, status) => request(`/api/admin/feedback/${id}`, { method: 'PUT', body: { status } }),
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
};
