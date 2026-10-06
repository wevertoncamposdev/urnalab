import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { PageHeader } from '@/components/layout/PageHeader';
import { useAsync } from '@/hooks/useAsync';
import { useCurrentSession } from '@/hooks/useCurrentSession';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/services/api';

const ALL = 'ALL';

function FilterSelect({ label, value, onChange, allLabel, options, disabled }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
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

export default function Candidates() {
  const [searchParams] = useSearchParams();
  const { session: currentSession } = useCurrentSession();

  const [sessionId, setSessionId] = useState(searchParams.get('sessionId') ?? currentSession?.id ?? ALL);
  const [position, setPosition] = useState(ALL);
  const [partyId, setPartyId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

  const sessionsState = useAsync(() => api.sessions.list(), []);
  const partiesState = useAsync(() => api.parties.list(), []);
  const positionsState = useAsync(() => api.positions.list(), []);
  const peopleState = useAsync(() => api.people.list(), []);

  const filter = (value) => (value === ALL ? '' : value);
  const candidatesState = useAsync(
    () =>
      api.candidates.list({
        sessionId: filter(sessionId),
        position: filter(position),
        partyId: filter(partyId),
        status: filter(status),
        search: debouncedSearch,
      }),
    [sessionId, position, partyId, status, debouncedSearch],
  );

  const [form, setForm] = useState({ open: false, candidate: null });
  const [deactivating, setDeactivating] = useState(null);
  const [viewingProposal, setViewingProposal] = useState(null);

  const setupError = sessionsState.error ?? partiesState.error ?? positionsState.error ?? peopleState.error;
  const setupReady = sessionsState.data && partiesState.data && positionsState.data && peopleState.data;

  if (setupError) {
    return (
      <div className="mx-auto max-w-5xl">
        <ErrorState
          error={setupError}
          onRetry={() => { sessionsState.reload(); partiesState.reload(); positionsState.reload(); peopleState.reload(); }}
        />
      </div>
    );
  }
  if (!setupReady) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const sessions = sessionsState.data;
  const parties = partiesState.data;
  const positions = positionsState.data;
  const sessionsById = Object.fromEntries(sessions.map((s) => [s.id, s]));
  const positionLabels = Object.fromEntries(positions.map((p) => [p.code, p.label]));

  const selectedSession = sessionsById[sessionId];
  const positionOptions = (selectedSession ? positions.filter((p) => selectedSession.positions.includes(p.code)) : positions)
    .map((p) => ({ value: p.code, label: p.label }));

  const people = peopleState.data;
  const hasDraftSession = sessions.some((s) => s.status === 'DRAFT');
  const hasActiveParty = parties.some((p) => p.status === 'ACTIVE');
  const hasAnyPerson = people.length > 0;
  const canCreate = hasDraftSession && hasActiveParty && hasAnyPerson;
  // A sessão escolhida define o contexto da tela; só os demais filtros contam como "filtrando".
  const filtering = [position, partyId, status].some((v) => v !== ALL) || Boolean(debouncedSearch);

  const candidates = candidatesState.data;

  function changeSession(value) {
    setSessionId(value);
    setPosition(ALL);
  }

  async function updateStatus(action, message) {
    try {
      await action();
      toast.success(message);
      candidatesState.reload();
      sessionsState.reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (sessions.length === 0) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <PageHeader title="Candidatos" />
        <EmptyState
          icon={Users}
          title="Crie uma sessão primeiro"
          description="Todo candidato pertence a uma sessão eleitoral."
          action={<Button asChild><Link to="/sessoes/nova">Criar sessão</Link></Button>}
        />
      </div>
    );
  }

  const newButton = (
    <Button disabled={!canCreate} onClick={() => setForm({ open: true, candidate: null })}>
      <Plus /> Nova candidatura
    </Button>
  );

  return (
    <div className="mx-auto flex flex-col gap-6">
      <PageHeader title="Candidatos" description="Candidaturas por sessão, cargo e partido." actions={newButton} />

      {!canCreate && (
        <Alert>
          <AlertDescription>
            {!hasAnyPerson ? (
              <>Cadastre ao menos uma pessoa em <Link className="font-medium underline" to="/pessoas">Pessoas</Link> para registrar uma candidatura.</>
            ) : !hasActiveParty ? (
              <>Cadastre ao menos um partido ativo em <Link className="font-medium underline" to="/partidos">Partidos</Link> para registrar candidaturas.</>
            ) : (
              <>Candidaturas só podem ser registradas em sessões em rascunho. <Link className="font-medium underline" to="/sessoes/nova">Crie uma nova sessão</Link>.</>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          label="Filtrar por sessão"
          value={sessionId}
          onChange={changeSession}
          allLabel="Todas as sessões"
          options={sessions.map((s) => ({ value: s.id, label: `${s.name} (${s.year})` }))}
        />
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
          options={[{ value: 'ACTIVE', label: 'Ativos' }, { value: 'INACTIVE', label: 'Inativos' }]}
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
          title={filtering ? 'Nenhum candidato encontrado' : 'Nenhum candidato cadastrado'}
          description={filtering ? 'Ajuste os filtros ou a busca.' : 'Cadastre o primeiro candidato desta eleição.'}
          action={!filtering && canCreate && newButton}
        />
      ) : (
        <Card className={candidatesState.loading ? 'opacity-60 transition-opacity' : undefined}>
          <CandidatesTable
            candidates={candidates}
            positionLabels={positionLabels}
            sessionsById={sessionsById}
            onEdit={(candidate) => setForm({ open: true, candidate })}
            onViewProposal={setViewingProposal}
            onDeactivate={setDeactivating}
            onReactivate={(candidate) =>
              updateStatus(() => api.candidates.update(candidate.id, { status: 'ACTIVE' }), 'Candidato reativado.')
            }
          />
        </Card>
      )}

      <CandidateFormDialog
        open={form.open}
        candidate={form.candidate}
        sessions={sessions}
        parties={parties}
        positions={positions}
        people={people}
        defaultSessionId={sessionId === ALL ? undefined : sessionId}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        onSaved={() => { candidatesState.reload(); sessionsState.reload(); partiesState.reload(); peopleState.reload(); }}
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
