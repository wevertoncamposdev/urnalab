import { analyticsRepository } from '../repositories/analytics.repository.js';
import { ANALYTICS_EVENT_NAMES, ANALYTICS_LIMITS } from '../rules/analytics-rules.js';
import { badRequest } from '../utils/errors.js';
import { isPlainObject } from '../utils/object.js';

function truncate(value, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, maxLength) : null;
}

export const analyticsService = {
  // Sem dado pessoal, de propósito: só visitorId (anônimo, gerado no navegador),
  // nome do evento, página/origem e, opcionalmente, a sessão (eleição) envolvida.
  async trackEvent(input) {
    const data = isPlainObject(input) ? input : {};
    const visitorId = typeof data.visitorId === 'string' ? data.visitorId.trim() : '';
    if (!visitorId) {
      throw badRequest('ANALYTICS_VISITOR_ID_REQUIRED', 'Identificador de visitante é obrigatório.');
    }
    if (!ANALYTICS_EVENT_NAMES.includes(data.name)) {
      throw badRequest('ANALYTICS_EVENT_INVALID', 'Evento de analytics desconhecido.');
    }

    await analyticsRepository.create({
      visitorId: visitorId.slice(0, ANALYTICS_LIMITS.visitorIdMaxLength),
      name: data.name,
      path: truncate(data.path, ANALYTICS_LIMITS.pathMaxLength),
      referrer: truncate(data.referrer, ANALYTICS_LIMITS.referrerMaxLength),
      sessionId: typeof data.sessionId === 'string' && data.sessionId ? data.sessionId.slice(0, 64) : null,
    });

    return { success: true };
  },
};
