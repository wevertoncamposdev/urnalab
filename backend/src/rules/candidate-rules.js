// PENDING = candidatura recebida pelo link público de candidatura (Etapa 20), ainda
// não analisada por quem administra a sessão — não entra na cédula nem na lista
// pública de candidatos (ver candidateService.list/public-voting.service.js, que
// filtram por ACTIVE) até ser aprovada (status passa pra ACTIVE) ou reprovada
// (passa pra INACTIVE) via PUT /api/candidates/:id.
export const CANDIDATE_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', PENDING: 'PENDING' });

// Campos que definem "quem é" o candidato na urna. Depois que a votação abre, ficam travados.
// Nome e foto não entram aqui: pertencem à pessoa (ver rules/person-rules.js) e continuam
// editáveis mesmo com a votação aberta.
export const CANDIDATE_IDENTITY_FIELDS = Object.freeze(['partyId', 'position', 'number']);

export const CANDIDATE_LIMITS = Object.freeze({
  governmentProposalMaxLength: 2000,
});
