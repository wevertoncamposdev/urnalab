// Paleta cíclica pra distinguir candidatos no gráfico — reaproveita as cores da
// identidade visual (ver globals.css) antes de cair em tons extras pra cargos com
// mais candidatos do que cores "oficiais".
const SLICE_COLORS = [
  'var(--color-primary)',
  'var(--color-accent)',
  'var(--color-brand-green)',
  'var(--color-coral)',
  'var(--color-danger)',
  '#7c3aed',
  '#0891b2',
  '#be185d',
];

export function sliceColor(index) {
  return SLICE_COLORS[index % SLICE_COLORS.length];
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Gráfico de rosca com a proporção de votos válidos por candidato — complementa a
// barra de progresso de cada CandidateRow com uma visão consolidada do cargo inteiro,
// útil pra enxergar o resultado de relance numa apresentação pra turma. Construído em
// SVG puro (sem lib de gráfico) pra não trazer uma dependência só por isso.
export function PositionPieChart({ candidates, validVotes }) {
  if (validVotes <= 0) return null;

  const withVotes = candidates.filter((c) => c.votes > 0);
  if (withVotes.length === 0) return null;

  let cumulative = 0;
  const slices = withVotes.map((candidate, index) => {
    const fraction = candidate.votes / validVotes;
    const length = fraction * CIRCUMFERENCE;
    const offset = cumulative;
    cumulative += length;
    return { id: candidate.id, length, offset, color: sliceColor(candidates.indexOf(candidate)) };
  });

  const summary = withVotes
    .map((c) => `${c.name}: ${c.percentValid.toFixed(1)}%`)
    .join(', ');

  return (
    <svg
      viewBox="0 0 100 100"
      className="size-28 shrink-0"
      role="img"
      aria-label={`Distribuição de votos válidos — ${summary}`}
    >
      <title>{summary}</title>
      <g transform="rotate(-90 50 50)">
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--color-muted)" strokeWidth="20" />
        {slices.map((slice) => (
          <circle
            key={slice.id}
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke={slice.color}
            strokeWidth="20"
            strokeDasharray={`${slice.length} ${CIRCUMFERENCE - slice.length}`}
            strokeDashoffset={-slice.offset}
          />
        ))}
      </g>
    </svg>
  );
}
