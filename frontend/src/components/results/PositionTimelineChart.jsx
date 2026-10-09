import { formatNumber } from '@/lib/format';
import { sliceColor } from '@/components/results/PositionPieChart';

const WIDTH = 640;
const HEIGHT = 220;
// Sem rótulo de eixo X de propósito: numerar "1º voto, 2º voto..." fica ilegível
// assim que a sessão passa de umas poucas dezenas de votos — a ordem já aparece na
// forma da linha (esquerda = primeiro voto, direita = último), sem precisar de texto.
const PADDING = { top: 12, right: 16, bottom: 12, left: 34 };
const INNER_WIDTH = WIDTH - PADDING.left - PADDING.right;
const INNER_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

// Acumula, voto a voto (na ordem em que foram gravados — ver backend/result.service.js
// `timeline`), quantos votos cada candidato já tinha em cada posição da fila. Um ponto
// por candidato a cada voto (inclusive os que não são dele, só repetindo o valor
// anterior) pra desenhar a "corrida" como um gráfico de linha em degraus.
function buildSeries(candidates, timeline) {
  const cumulative = new Map(candidates.map((c) => [c.id, 0]));
  const series = new Map(candidates.map((c) => [c.id, [{ order: 0, value: 0 }]]));

  timeline.forEach(({ order, candidateId }) => {
    if (cumulative.has(candidateId)) cumulative.set(candidateId, cumulative.get(candidateId) + 1);
    candidates.forEach((c) => {
      series.get(c.id).push({ order, value: cumulative.get(c.id) });
    });
  });

  return series;
}

// "Temporal" tab: evolução voto a voto do cargo, uma linha por candidato — mostra o
// andamento da apuração em vez de só o placar final. SVG puro, igual ao resto dos
// gráficos de resultado (ver PositionPieChart), sem trazer lib de gráfico pra isso.
export function PositionTimelineChart({ candidates, timeline }) {
  const withVotes = candidates.filter((c) => c.votes > 0);

  if (timeline.length === 0 || withVotes.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Nenhum voto válido registrado para este cargo.</p>;
  }

  const maxOrder = timeline.length;
  const maxValue = Math.max(...withVotes.map((c) => c.votes), 1);
  const series = buildSeries(candidates, timeline);

  const x = (order) => PADDING.left + (order / maxOrder) * INNER_WIDTH;
  const y = (value) => PADDING.top + INNER_HEIGHT - (value / maxValue) * INNER_HEIGHT;

  const yTicks = [0, Math.round(maxValue / 2), maxValue];

  return (
    <div className="flex flex-col gap-4 py-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Evolução dos votos voto a voto — ${withVotes.map((c) => `${c.name}: ${formatNumber(c.votes)} votos`).join(', ')}`}
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--color-border)"
              strokeWidth="1"
            />
            <text x={PADDING.left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[9px]">
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        {withVotes.map((candidate) => {
          const points = series.get(candidate.id);
          const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.order).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ');
          const color = sliceColor(candidates.indexOf(candidate));
          const last = points[points.length - 1];
          return (
            <g key={candidate.id}>
              <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(last.order)} cy={y(last.value)} r="3" fill={color} />
            </g>
          );
        })}
      </svg>

      <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
        {withVotes.map((candidate) => (
          <li key={candidate.id} className="flex items-center gap-1.5 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: sliceColor(candidates.indexOf(candidate)) }}
              aria-hidden="true"
            />
            <span className="font-medium">{candidate.name}</span>
            <span className="text-muted-foreground">{formatNumber(candidate.votes)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
