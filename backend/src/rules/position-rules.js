// Limites de validação do cadastro de cargos (o cadastro em si vive no banco,
// via repositories/position.repository.js — ver position.service.js).
export const POSITION_LIMITS = Object.freeze({
  labelMaxLength: 60,
  minDigits: 1,
  maxDigits: 6,
  minOrder: 1,
  maxOrder: 999,
  descriptionMaxLength: 1000,
});
