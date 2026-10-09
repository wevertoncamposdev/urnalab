import { randomBytes, randomUUID } from 'node:crypto';

export const generateId = () => randomUUID();

// Token de uso sensível (ex.: redefinição de senha): aleatório, longo e
// imprevisível — não pode virar um código curto, senão fica adivinhável.
export const generatePublicToken = () => randomBytes(18).toString('base64url');

// Código do link público de votação: 4 dígitos, fácil de digitar ou ditar em
// voz alta. Só 10 mil combinações possíveis, então quem usa isso precisa tratar
// colisão (ver generateSessionCode em session.service.js) — não serve pra nada
// que precise ser imprevisível de verdade.
export const generateSessionCode = () => String(Math.floor(Math.random() * 10000)).padStart(4, '0');

// Código do link público de candidatura: mesma ideia do código de votação acima
// (curto, fácil de digitar), mas em 4 letras maiúsculas — só pra diferenciar
// visualmente de cara os dois links (ex.: "7421" é pra votar, "QXRL" é pra se
// candidatar). Trata colisão do mesmo jeito (ver withUniqueCandidacyCode em
// session.service.js).
const CANDIDACY_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const generateCandidacyCode = () =>
  Array.from({ length: 4 }, () => CANDIDACY_CODE_ALPHABET[Math.floor(Math.random() * CANDIDACY_CODE_ALPHABET.length)]).join('');
