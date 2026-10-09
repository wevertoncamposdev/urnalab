import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { CandidateAvatar } from '@/components/candidates/CandidateAvatar';
import { formatNumber } from '@/lib/format';
import { sliceColor } from '@/components/results/PositionPieChart';

// Ranking do cargo com barra de proporção por candidato — a mesma leitura rápida
// que a tela já tinha antes de virar aba (ver histórico de PositionResult.jsx), só
// que com avatar maior, placar em destaque e cor da barra alinhada com as outras
// duas abas (Pizza/Temporal usam o mesmo sliceColor por índice).
export function PositionResultsTable({ candidates, winners, runoff }) {
  const maxVotes = candidates[0]?.votes ?? 0;

  return (
    <div className="flex flex-col divide-y">
      {candidates.map((candidate, index) => {
        const isWinner = winners.includes(candidate.id);
        const inRunoff = runoff ? runoff.candidateIds.includes(candidate.id) : false;
        const barWidth = maxVotes > 0 ? (candidate.votes / maxVotes) * 100 : 0;
        const color = sliceColor(index);

        return (
          <div key={candidate.id} className="flex items-center gap-3 py-3.5 first:pt-1 last:pb-1">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold tabular-nums text-muted-foreground">
              {index + 1}º
            </span>
            <CandidateAvatar name={candidate.name} photo={candidate.photo} className="size-10 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link to={`/pessoas/${candidate.personId}`} className="truncate text-sm font-semibold hover:underline">
                  {candidate.name}
                </Link>
                {isWinner && <Badge variant="success">Eleito</Badge>}
                {inRunoff && <Badge variant="dark">2º turno</Badge>}
                {candidate.status === 'INACTIVE' && <Badge>Inativo</Badge>}
              </div>
              <p className="mb-1.5 text-xs text-muted-foreground">
                {candidate.party?.acronym ?? '—'} · Nº {candidate.number}
              </p>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{ width: `${barWidth}%`, backgroundColor: color }}
                />
              </div>
            </div>
            <div className="shrink-0 text-right tabular-nums">
              <p className="text-base font-bold leading-tight">{formatNumber(candidate.votes)}</p>
              <p className="text-xs text-muted-foreground">{candidate.percentValid.toFixed(1)}%</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
