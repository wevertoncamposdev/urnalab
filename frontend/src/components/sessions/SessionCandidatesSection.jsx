import { useState } from 'react';
import { Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CandidateFormDialog } from '@/components/candidates/CandidateFormDialog';
import { CandidateProposalDialog } from '@/components/candidates/CandidateProposalDialog';
import { CandidatesTable } from '@/components/candidates/CandidatesTable';
import { ConfirmDialog } from '@/components/layout/ConfirmDialog';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/services/api';

const ALL = 'ALL';

function FilterSelect({ label, value, onChange, allLabel, options }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Candidatos de uma sessão só — mesmos componentes reaproveitados por /candidatos
// (CandidatesTable/CandidateFormDialog), sem o filtro "todas as sessões" (aqui a
// sessão já é fixa, vinda de SessionDetails.jsx).
export function SessionCandidatesSection({ session, parties, positions, onCandidatesChanged }) {
  const [position, setPosition] = useState(ALL);
  const [partyId, setPartyId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

  const filter = (value) => (value === ALL ? '' : value);
  const candidatesState = useAsync(
    () =>
      api.candidates.list({
        sessionId: session.id,
        position: filter(position),
        partyId: filter(partyId),
        status: filter(status),
        search: debouncedSearch,
      }),
    [session.id, position, partyId, status, debouncedSearch],
  );

  const [form, setForm] = useState({ open: false, candidate: null });
  const [deactivating, setDeactivating] = useState(null);
  const [viewingProposal, setViewingProposal] = useState(null);

  const positionOptions = positions
    .filter((p) => session.positions.includes(p.code))
    .map((p) => ({ value: p.code, label: p.label }));
  const positionLabels = Object.fromEntries(positions.map((p) => [p.code, p.label]));

  const filtering = [position, partyId, status].some((v) => v !== ALL) || Boolean(debouncedSearch);
  const candidates = candidatesState.data;

  async function updateStatus(action, message) {
    try {
      await action();
      toast.success(message);
      candidatesState.reload();
      onCandidatesChanged?.();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <FilterSelect label="Filtrar por cargo" value={position} onChange={setPosition} allLabel="Todos os cargos" options={positionOptions} />
        <FilterSelect
          label="Filtrar por partido"
          value={partyId}
          onChange={setPartyId}
          allLabel="Todos os partidos"
          options={parties.map((p) => ({ value: p.id, label: `${p.acronym} (${p.number})` }))}
        />
        <FilterSelect
          label="Filtrar por status"
          value={status}
          onChange={setStatus}
          allLabel="Todos os status"
          options={[
            { value: 'PENDING', label: 'Pendentes' },
            { value: 'ACTIVE', label: 'Ativos' },
            { value: 'INACTIVE', label: 'Inativos' },
          ]}
        />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome, número ou partido" aria-label="Buscar candidatos" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {candidatesState.error ? (
        <ErrorState error={candidatesState.error} onRetry={candidatesState.reload} />
      ) : !candidates ? (
        <Skeleton className="h-48" />
      ) : candidates.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filtering ? 'Nenhum candidato encontrado' : 'Nenhuma candidatura recebida ainda'}
          description={
            filtering
              ? 'Ajuste os filtros ou a busca.'
              : 'Compartilhe o link de candidatura acima para receber candidaturas.'
          }
        />
      ) : (
        <Card className={candidatesState.loading ? 'opacity-60 transition-opacity' : undefined}>
          <CandidatesTable
            candidates={candidates}
            positionLabels={positionLabels}
            sessionsById={{ [session.id]: session }}
            onEdit={(candidate) => setForm({ open: true, candidate })}
            onViewProposal={setViewingProposal}
            onDeactivate={setDeactivating}
            onReactivate={(candidate) =>
              updateStatus(() => api.candidates.update(candidate.id, { status: 'ACTIVE' }), 'Candidato reativado.')
            }
            onApprove={(candidate) =>
              updateStatus(() => api.candidates.update(candidate.id, { status: 'ACTIVE' }), 'Candidatura aprovada.')
            }
            onReject={(candidate) =>
              updateStatus(() => api.candidates.update(candidate.id, { status: 'INACTIVE' }), 'Candidatura reprovada.')
            }
          />
        </Card>
      )}

      <CandidateFormDialog
        open={form.open}
        candidate={form.candidate}
        sessions={[session]}
        parties={parties}
        positions={positions}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        onSaved={() => { candidatesState.reload(); onCandidatesChanged?.(); }}
      />
      <CandidateProposalDialog
        candidate={viewingProposal}
        onOpenChange={(open) => !open && setViewingProposal(null)}
      />
      <ConfirmDialog
        open={Boolean(deactivating)}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title="Desativar candidato?"
        description={`${deactivating?.name ?? 'O candidato'} deixará de receber novos votos. O histórico é mantido e você pode reativá-lo depois.`}
        confirmLabel="Desativar"
        onConfirm={() =>
          updateStatus(() => api.candidates.deactivate(deactivating.id), 'Candidato desativado.')
        }
      />
    </div>
  );
}
