// Nomes de evento aceitos pelo funil (ver ROADMAP.md "Validação e Feedback") — qualquer
// outro nome é rejeitado em analytics.service.js, pra não deixar a tabela crescer com
// lixo de um cliente modificado.
export const ANALYTICS_EVENT_NAMES = Object.freeze([
  'PAGE_VIEW',
  'SESSION_CREATED',
  'CANDIDATE_REGISTERED',
  'VOTING_STARTED',
  'VOTING_COMPLETED',
  'RESULTS_VIEWED',
]);

export const ANALYTICS_LIMITS = Object.freeze({
  visitorIdMaxLength: 64,
  pathMaxLength: 300,
  referrerMaxLength: 300,
});
