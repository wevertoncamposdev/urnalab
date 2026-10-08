import { Users } from 'lucide-react';
import { CandidateAvatar } from '@/components/candidates/CandidateAvatar';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// A "colinha": consulta dos candidatos do cargo sendo votado agora (atualiza
// sozinha quando o índice do cargo avança, ver PublicVoting.jsx). Um `select`
// de altura fixa (Etapa 22) escolhe o candidato — o card nunca estica a tela,
// não importa quantos concorrem — e os detalhes aparecem logo abaixo,
// ocupando o espaço que sobraria vazio (Etapa 21): sem dialog, a foto, o
// número (bem grande, é o que mais importa na hora de votar) e a proposta já
// ficam visíveis ali mesmo.
export function CandidateList({ positionLabel, candidates, selectedId, onSelect }) {
  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  return (
    <Card className="flex h-full flex-col gap-3 p-4 md:overflow-y-auto">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Candidatos a
        </span>
        <span className="font-heading text-lg font-semibold">{positionLabel}</span>
      </div>

      {candidates.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <Users className="size-8" />
          <p className="text-sm">Nenhum candidato cadastrado para este cargo</p>
        </div>
      ) : (
        <>
          <Select value={selectedId || undefined} onValueChange={onSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um candidato para ver os detalhes" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  nº {candidate.number} — {candidate.name}
                  {candidate.party && ` (${candidate.party.acronym})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <CandidateDetails candidate={selected} />
        </>
      )}
    </Card>
  );
}

function CandidateDetails({ candidate }) {
  if (!candidate) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center text-muted-foreground">
        <Users className="size-8" />
        <p className="px-6 text-sm">Escolha um candidato acima para ver a foto, o número e a proposta</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-xl border bg-muted/30 p-4">
      <div className="flex items-center gap-4">
        <CandidateAvatar
          name={candidate.name}
          photo={candidate.photo}
          className="size-20 shrink-0 text-2xl md:size-24 md:text-3xl"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-heading text-4xl font-extrabold leading-none tabular-nums text-primary md:text-5xl">
            {candidate.number}
          </span>
          <p className="truncate text-base font-semibold">{candidate.name}</p>
          {candidate.party && (
            <p className="truncate text-sm text-muted-foreground">
              {candidate.party.acronym} ({candidate.party.number})
            </p>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-card p-3 text-sm leading-relaxed">
        {candidate.governmentProposal ? (
          <p className="whitespace-pre-wrap">{candidate.governmentProposal}</p>
        ) : (
          <p className="text-muted-foreground">Este candidato não cadastrou uma proposta de governo.</p>
        )}
      </div>
    </div>
  );
}
