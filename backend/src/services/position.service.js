import { positionRepository } from '../repositories/position.repository.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { POSITION_LIMITS } from '../rules/position-rules.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { isPlainObject, normalizeText } from '../utils/object.js';

// Gera um identificador estável a partir do nome (ex.: "Diretor de Turma" ->
// "DIRETOR_DE_TURMA"), com sufixo numérico se já existir um cargo com o mesmo nome.
function slugifyCode(label, existingCodes) {
  const base =
    normalizeText(label)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'CARGO';
  if (!existingCodes.has(base)) return base;

  let suffix = 2;
  while (existingCodes.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

function normalizeFields(input) {
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  if (!label) throw badRequest('POSITION_LABEL_REQUIRED', 'Informe o nome do cargo.');
  if (label.length > POSITION_LIMITS.labelMaxLength) {
    throw badRequest(
      'POSITION_LABEL_TOO_LONG',
      `O nome pode ter no máximo ${POSITION_LIMITS.labelMaxLength} caracteres.`,
    );
  }

  const digits = Number(input.digits);
  if (!Number.isInteger(digits) || digits < POSITION_LIMITS.minDigits || digits > POSITION_LIMITS.maxDigits) {
    throw badRequest(
      'POSITION_DIGITS_INVALID',
      `A quantidade de dígitos deve estar entre ${POSITION_LIMITS.minDigits} e ${POSITION_LIMITS.maxDigits}.`,
    );
  }

  const order = Number(input.order);
  if (!Number.isInteger(order) || order < POSITION_LIMITS.minOrder || order > POSITION_LIMITS.maxOrder) {
    throw badRequest(
      'POSITION_ORDER_INVALID',
      `A ordem deve estar entre ${POSITION_LIMITS.minOrder} e ${POSITION_LIMITS.maxOrder}.`,
    );
  }

  // Cargo majoritário com 2º turno: sem maioria absoluta (mais de 50% dos votos
  // válidos) no 1º turno, a apuração aponta os dois mais votados para a disputa.
  const twoRoundEnabled = Boolean(input.twoRoundEnabled);

  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (description.length > POSITION_LIMITS.descriptionMaxLength) {
    throw badRequest(
      'POSITION_DESCRIPTION_TOO_LONG',
      `A descrição pode ter no máximo ${POSITION_LIMITS.descriptionMaxLength} caracteres.`,
    );
  }

  return { label, digits, order, twoRoundEnabled, description: description || null };
}

// Busca sempre dentro da conta de quem fez a requisição: um cargo de outra
// conta responde como se não existisse (404), nunca 403 — não revela que existe.
async function findOrFail(id, userId) {
  const position = await positionRepository.findById(id);
  if (!position || position.userId !== userId) throw notFound('POSITION_NOT_FOUND', 'Cargo não encontrado.');
  return position;
}

async function nextOrder(userId) {
  const positions = await positionRepository.findAllForUser(userId);
  return positions.reduce((max, p) => Math.max(max, p.order), 0) + 1;
}

export const positionService = {
  async list(userId) {
    const positions = await positionRepository.findAllForUser(userId);
    return positions.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'pt-BR'));
  },

  async getById(id, userId) {
    return findOrFail(id, userId);
  },

  async create(input, userId) {
    const data = isPlainObject(input) ? input : {};
    const fields = normalizeFields({ order: data.order ?? (await nextOrder(userId)), ...data });

    const existing = await positionRepository.findAllForUser(userId);
    const code = slugifyCode(fields.label, new Set(existing.map((p) => p.code)));

    const result = await positionRepository.create({
      ...fields,
      code,
      userId,
      createdAt: new Date().toISOString(),
    });
    if (result.conflict) throw conflict('POSITION_CODE_CONFLICT', 'Tente novamente.');
    return result.record;
  },

  async update(id, input, userId) {
    const current = await findOrFail(id, userId);
    const changes = isPlainObject(input) ? input : {};
    const fields = normalizeFields({
      label: current.label,
      digits: current.digits,
      order: current.order,
      twoRoundEnabled: current.twoRoundEnabled,
      description: current.description,
      ...changes,
    });

    const result = await positionRepository.update(id, fields);
    if (result.notFound) throw notFound('POSITION_NOT_FOUND', 'Cargo não encontrado.');
    return result.record;
  },

  // Não permite remover um cargo já usado por alguma sessão (passada ou atual),
  // já que candidatos e votos continuam referenciando o código dele.
  async remove(id, userId) {
    const position = await findOrFail(id, userId);
    const sessions = await sessionRepository.findAllForUser(userId);
    const inUse = sessions.some((session) => session.positions.includes(position.code));
    if (inUse) {
      throw conflict('POSITION_IN_USE', 'Este cargo está em uso em uma ou mais eleições e não pode ser removido.');
    }
    await positionRepository.delete(id);
  },
};
