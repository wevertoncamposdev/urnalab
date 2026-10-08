import { MousePointerClick, Users } from 'lucide-react';
import { CandidateAvatar } from '@/components/candidates/CandidateAvatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { pluralize } from '@/lib/format';
import { cn } from '@/lib/utils';

// Lista dos candidatos do cargo sendo votado agora (atualiza sozinha quando o
// índice do cargo avança, ver PublicVoting.jsx) — faz o papel que antes era de
// dois elementos separados (painel de status do candidato digitado + select de
// consulta de proposta): aqui dá pra ver quem concorre e clicar pra ler a
// proposta, tudo num lugar só. O status do número digitado (achou/não achou/
// branco) já aparece direto na tela da urna (ver Urna.jsx), não precisa mais
// duplicar aqui.
export function CandidateList({ positionLabel, candidates, selectedId, onSelect }) {
  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className="flex flex-col gap-1.5 border-b p-4">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Candidatos a
        </span>
        <span className="font-heading text-lg font-semibold">{positionLabel}</span>
        <Badge variant="accent" className="w-fit">
          <MousePointerClick className="size-3" /> Clique no candidato para ver a proposta
        </Badge>
      </div>

      {candidates.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
          <Users className="size-8" />
          <p className="text-sm">Nenhum candidato cadastrado para este cargo</p>
        </div>
      ) : (
        <ul className="flex-1 divide-y overflow-y-auto">
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                onClick={() => onSelect(candidate.id === selectedId ? '' : candidate.id)}
                className={cn(
                  'flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/60',
                  selectedId === candidate.id && 'bg-primary/5',
                )}
              >
                <CandidateAvatar name={candidate.name} photo={candidate.photo} className="size-11 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{candidate.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    nº {candidate.number}
                    {candidate.party && ` • ${candidate.party.acronym} (${candidate.party.number})`}
                  </p>
                </div>
              </button>
              {selected?.id === candidate.id && (
                <div className="border-t bg-muted/40 p-3 text-sm">
                  {candidate.governmentProposal ? (
                    <p className="whitespace-pre-wrap">{candidate.governmentProposal}</p>
                  ) : (
                    <p className="text-muted-foreground">Este candidato não cadastrou uma proposta de governo.</p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="border-t p-3 text-center text-xs text-muted-foreground">
        {pluralize(candidates.length, 'candidato', 'candidatos')}
      </p>
    </Card>
  );
}
