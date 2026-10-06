export const CANDIDATE_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' });

// Campos que definem "quem é" o candidato na urna. Depois que a votação abre, ficam travados.
// Nome e foto não entram aqui: pertencem à pessoa (ver rules/person-rules.js) e continuam
// editáveis mesmo com a votação aberta.
export const CANDIDATE_IDENTITY_FIELDS = Object.freeze(['partyId', 'position', 'number']);

export const CANDIDATE_LIMITS = Object.freeze({
  governmentProposalMaxLength: 2000,
});
