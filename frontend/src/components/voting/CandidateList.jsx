import { useState } from 'react';
import { Eye, Users } from 'lucide-react';
import { CandidateAvatar } from '@/components/candidates/CandidateAvatar';
import { CandidateProposalDialog } from '@/components/candidates/CandidateProposalDialog';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pluralize } from '@/lib/format';

// A "colinha": consulta dos candidatos do cargo sendo votado agora (atualiza
// sozinha quando o índice do cargo avança, ver PublicVoting.jsx). Usa um
// `select` (Etapa 22) em vez de uma lista — assim o card tem altura fixa
// independente de quantos candidatos concorrem, sem esticar a tela da urna
// ao lado. Escolher um candidato aqui abre o dialog com foto grande e a
// proposta completa (Etapa 21).
export function CandidateList({ positionLabel, candidates, selectedId, onSelect }) {
  const [viewing, setViewing] = useState(null);
  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  function handleSelect(id) {
    onSelect(id);
    setViewing(candidates.find((c) => c.id === id) ?? null);
  }

  return (
    <Card className="flex h-full flex-col gap-4 p-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Candidatos a
        </span>
        <span className="font-heading text-lg font-semibold">{positionLabel}</span>
      </div>

      {candidates.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <Users className="size-8" />
          <p className="text-sm">Nenhum candidato cadastrado para este cargo</p>
        </div>
      ) : (
        <>
          <Select value={selectedId || undefined} onValueChange={handleSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um candidato para consultar a proposta" />
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

          {selected && (
            <button
              type="button"
              onClick={() => setViewing(selected)}
              className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60"
            >
              <CandidateAvatar name={selected.name} photo={selected.photo} className="size-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{selected.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  nº {selected.number}
                  {selected.party && ` • ${selected.party.acronym} (${selected.party.number})`}
                </p>
              </div>
              <Eye className="size-4 shrink-0 text-muted-foreground" />
            </button>
          )}
        </>
      )}

      <p className="mt-auto text-center text-xs text-muted-foreground">
        {pluralize(candidates.length, 'candidato', 'candidatos')}
      </p>

      <CandidateProposalDialog candidate={viewing} onOpenChange={(open) => !open && setViewing(null)} />
    </Card>
  );
}
