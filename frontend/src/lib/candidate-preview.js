// Deriva o "veredito" de uma consulta de voto (branco, carregando, encontrado, nulo por não
// achar/candidato inativo, ou ainda sem número completo) — usado tanto por
// CandidatePreviewPanel (painel lateral) quanto pela tela da Urna, pra não duplicar os mesmos
// cinco `if`s em dois lugares com visuais diferentes.
export function getCandidatePreviewState({ blank, lookup }) {
  if (blank) return { kind: 'blank' };
  if (lookup?.loading) return { kind: 'loading' };
  if (lookup?.result?.status === 'FOUND') return { kind: 'found', candidate: lookup.result.candidate };
  if (lookup?.result?.status === 'NOT_FOUND') return { kind: 'not-found' };
  if (lookup?.result?.status === 'INACTIVE') return { kind: 'inactive' };
  return { kind: 'empty' };
}
