import { cn } from '@/lib/utils';

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
// Fatia só ganha o rótulo de % escrito em cima dela a partir desse tamanho —
// abaixo disso a letra não cabe e fica ilegível (sobra pra legenda, que cobre
// cargos com muitos candidatos sem lotar o desenho).
const LABEL_MIN_FRACTION = 0.08;

// Gráfico de rosca com a proporção de votos válidos por candidato — complementa a
// barra de progresso de PositionResultsTable com uma visão consolidada do cargo
// inteiro, útil pra enxergar o resultado de relance numa apresentação pra turma.
// Construído em SVG puro (sem lib de gráfico) pra não trazer uma dependência só
// por isso.
export function PositionPieChart({ candidates, validVotes, size = 112, className, showLabels = false }) {
  if (validVotes <= 0) return null;

  const withVotes = candidates.filter((c) => c.votes > 0);
  if (withVotes.length === 0) return null;

  let cumulative = 0;
  const slices = withVotes.map((candidate) => {
    const fraction = candidate.votes / validVotes;
    const length = fraction * CIRCUMFERENCE;
    const offset = cumulative;
    cumulative += length;
    // -90 compensa o rotate(-90 50 50) do grupo das fatias abaixo: calculado fora
    // desse grupo, o rótulo precisa do mesmo giro já embutido na própria posição,
    // em vez de herdar a rotação (que deixaria o texto deitado).
    const midAngle = ((offset + length / 2) / CIRCUMFERENCE) * 360 - 90;
    const rad = (midAngle * Math.PI) / 180;
    return {
      id: candidate.id,
      length,
      offset,
      fraction,
      color: sliceColor(candidates.indexOf(candidate)),
      labelX: 50 + RADIUS * Math.cos(rad),
      labelY: 50 + RADIUS * Math.sin(rad),
    };
  });

  const summary = withVotes
    .map((c) => `${c.name}: ${c.percentValid.toFixed(1)}%`)
    .join(', ');

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('shrink-0', className)}
      style={{ width: size, height: size }}
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
      {showLabels &&
        slices
          .filter((slice) => slice.fraction >= LABEL_MIN_FRACTION)
          .map((slice) => (
            <text
              key={slice.id}
              x={slice.labelX}
              y={slice.labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-white text-[7px] font-bold"
              style={{ paintOrder: 'stroke', stroke: 'rgba(15,23,42,0.45)', strokeWidth: 2.5, strokeLinejoin: 'round' }}
            >
              {Math.round(slice.fraction * 100)}%
            </text>
          ))}
    </svg>
  );
}
