import { feedbackRepository } from '../repositories/feedback.repository.js';
import { FEEDBACK_LIMITS, FEEDBACK_TYPES } from '../rules/feedback-rules.js';
import { badRequest } from '../utils/errors.js';
import { isPlainObject } from '../utils/object.js';

function normalizeType(value) {
  const type = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!FEEDBACK_TYPES.includes(type)) {
    throw badRequest('FEEDBACK_TYPE_INVALID', 'Selecione um tipo de feedback válido.');
  }
  return type;
}

function normalizeRating(value) {
  if (value === undefined || value === null || value === '') return null;
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw badRequest('FEEDBACK_RATING_INVALID', 'A avaliação deve ser de 1 a 5 estrelas.');
  }
  return rating;
}

function normalizeMessage(value) {
  const message = typeof value === 'string' ? value.trim() : '';
  if (!message) return null;
  if (message.length > FEEDBACK_LIMITS.messageMaxLength) {
    throw badRequest(
      'FEEDBACK_MESSAGE_TOO_LONG',
      `A mensagem pode ter no máximo ${FEEDBACK_LIMITS.messageMaxLength} caracteres.`,
    );
  }
  return message;
}

function normalizePage(value) {
  const page = typeof value === 'string' ? value.trim() : '';
  return page ? page.slice(0, FEEDBACK_LIMITS.pageMaxLength) : null;
}

export const feedbackService = {
  // userId nulo = enviado sem login (votação pública) — sempre anônimo, de propósito
  // (ver ROADMAP.md "Validação e Feedback" e a decisão de autoria tomada com o usuário).
  async create(input, userId) {
    const data = isPlainObject(input) ? input : {};
    const type = normalizeType(data.type);
    const rating = normalizeRating(data.rating);
    const message = normalizeMessage(data.message);
    if (!message && !rating) {
      throw badRequest('FEEDBACK_EMPTY', 'Escreva uma mensagem ou dê uma avaliação.');
    }

    return feedbackRepository.create({
      userId: userId ?? null,
      type,
      rating,
      message,
      page: normalizePage(data.page),
    });
  },
};
