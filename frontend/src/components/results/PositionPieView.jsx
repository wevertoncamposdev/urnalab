import { formatNumber } from '@/lib/format';
import { PositionPieChart, sliceColor } from '@/components/results/PositionPieChart';

// "Pizza" tab: o mesmo gráfico de rosca de PositionResultsTable, só que grande,
// com % escrito nas fatias maiores (dá pra ler o resultado sem nem olhar a
// legenda) e a legenda embaixo numa grade que quebra em colunas e rola — pra
// cargos com muitos candidatos não esticarem a tela nem virar uma lista infinita.
export function PositionPieView({ candidates, validVotes }) {
  const withVotes = candidates.filter((c) => c.votes > 0);

  if (withVotes.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Nenhum voto válido registrado para este cargo.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      <PositionPieChart candidates={candidates} validVotes={validVotes} size={216} showLabels />
      <ul className="grid max-h-56 w-full grid-cols-1 gap-x-6 gap-y-2 overflow-y-auto px-1 sm:grid-cols-2 lg:grid-cols-3">
        {withVotes.map((candidate) => (
          <li key={candidate.id} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: sliceColor(candidates.indexOf(candidate)) }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate font-medium">{candidate.name}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{formatNumber(candidate.votes)}</span>
            <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
              {candidate.percentValid.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
