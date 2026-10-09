import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Flag, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { PartyFormDialog } from '@/components/parties/PartyFormDialog';
import { PositionFormDialog } from '@/components/positions/PositionFormDialog';
import { useAsync } from '@/hooks/useAsync';
import { useCurrentSession } from '@/hooks/useCurrentSession';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

const STEPS = ['Sessão', 'Partidos'];

function Stepper({ current, maxReached, onSelect }) {
  return (
    <ol className="flex flex-wrap items-center justify-center gap-1.5">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        const clickable = index <= maxReached && index !== current;
        return (
          <li key={label} className="flex items-center gap-1.5">
            {index > 0 && <span className="h-px w-4 bg-border sm:w-6" aria-hidden="true" />}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onSelect(index)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:text-sm',
                active && 'border-primary bg-primary text-primary-foreground',
                !active && done && 'border-primary/40 text-primary',
                !active && !done && 'text-muted-foreground',
                clickable && 'cursor-pointer hover:bg-muted',
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]',
                  active && 'border-primary-foreground',
                )}
              >
                {done ? <Check className="size-3" /> : index + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// Criar sessão: fluxo guiado em 2 passos (sessão → partidos). Cada passo reaproveita
// os mesmos diálogos/componentes já usados nas telas normais (Cargos, Partidos) — só
// guia a ordem e o fluxo, sem duplicar a lógica de validação/criação, que continua nos
// services do backend. Ao concluir, cai direto na tela de gerenciamento da sessão —
// ela já reúne tudo que falta (link de candidatura, abrir votação etc.), então não
// precisa de uma etapa de revisão própria aqui. Candidaturas não têm passo aqui:
// chegam pelo link público depois (ver PublicCandidacyLinkCard em SessionDetails.jsx,
// mostrado enquanto a sessão está na etapa de candidatura).
export default function SessionWizard() {
  const navigate = useNavigate();
  const { select } = useCurrentSession();

  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [session, setSession] = useState(null);

  const positionsState = useAsync(() => api.positions.list(), []);
  const partiesState = useAsync(() => api.parties.list(), []);

  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [partyDialogOpen, setPartyDialogOpen] = useState(false);

  const [name, setName] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [sessionSubmitting, setSessionSubmitting] = useState(false);
  const [sessionError, setSessionError] = useState(null);

  function goTo(index) {
    setStep(index);
    setMaxReached((current) => Math.max(current, index));
  }

  function exitWizard() {
    navigate(session ? `/sessoes/${session.id}` : '/sessoes');
  }

  function finishWizard() {
    navigate(`/sessoes/${session.id}`);
  }

  async function submitSessionStep() {
    setSessionSubmitting(true);
    setSessionError(null);
    const payload = { name, year: year === '' ? null : Number(year), positions: selectedPositions };
    try {
      const isNew = !session;
      const saved = session ? await api.sessions.update(session.id, payload) : await api.sessions.create(payload);
      if (isNew) trackEvent('SESSION_CREATED', { sessionId: saved.id });
      setSession(saved);
      select(saved);
      goTo(1);
    } catch (err) {
      if (err.code === 'INSTITUTION_PROFILE_REQUIRED') {
        toast.error(err.message);
        navigate('/perfil');
        return;
      }
      setSessionError(err);
    } finally {
      setSessionSubmitting(false);
    }
  }

  const loadError = positionsState.error ?? partiesState.error;
  const loadReady = positionsState.data && partiesState.data;

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          error={loadError}
          onRetry={() => { positionsState.reload(); partiesState.reload(); }}
        />
      </div>
    );
  }
  if (!loadReady) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const positions = positionsState.data;
  const parties = partiesState.data;
  const activeParties = parties.filter((p) => p.status === 'ACTIVE');

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Criar sessão"
        description="Cadastre tudo que uma eleição precisa, passo a passo: sessão e partidos."
        actions={<Button variant="ghost" onClick={exitWizard}>Cancelar</Button>}
      />

      <Stepper current={step} maxReached={maxReached} onSelect={goTo} />

      {step === 0 && (
        <Card>
          <CardContent className="flex flex-col gap-6 p-6">
            <p className="text-sm text-muted-foreground">
              Comece definindo o nome, o ano e quais cargos estarão em disputa nesta eleição.
            </p>
            {sessionError && !sessionError.code?.includes('POSITION') && (
              <Alert variant="destructive"><AlertDescription>{sessionError.message}</AlertDescription></Alert>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="wizard-session-name">Nome da sessão</Label>
              <Input id="wizard-session-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Eleição Geral 2026" autoFocus />
            </div>
            <div className="flex max-w-40 flex-col gap-2">
              <Label htmlFor="wizard-session-year">Ano</Label>
              <Input id="wizard-session-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label>Cargos em disputa</Label>
                <Button type="button" variant="" size="sm" onClick={() => setPositionDialogOpen(true)}>
                  <Plus /> Novo cargo
                </Button>
              </div>
              {sessionError?.code?.includes('POSITION') && (
                <Alert variant="destructive"><AlertDescription>{sessionError.message}</AlertDescription></Alert>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {positions.map((position) => (
                  <Label
                    key={position.code}
                    htmlFor={`wizard-position-${position.code}`}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2.5 font-normal hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`wizard-position-${position.code}`}
                      checked={selectedPositions.includes(position.code)}
                      onCheckedChange={(checked) =>
                        setSelectedPositions((current) =>
                          checked ? [...current, position.code] : current.filter((c) => c !== position.code),
                        )
                      }
                    />
                    <span className="flex-1">{position.label}</span>
                    <span className="text-xs text-muted-foreground">{position.digits} dígitos</span>
                  </Label>
                ))}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={submitSessionStep} disabled={sessionSubmitting || !name || selectedPositions.length === 0}>
                {sessionSubmitting ? 'Salvando...' : 'Continuar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <p className="text-sm text-muted-foreground">
              Cada candidato precisa estar vinculado a um partido. Cadastre os partidos desta eleição (ou reaproveite os que já existem).
            </p>
            <div className="flex justify-end">
              <Button type="button" variant="" size="sm" onClick={() => setPartyDialogOpen(true)}>
                <Plus /> Novo partido
              </Button>
            </div>
            {parties.length === 0 ? (
              <EmptyState icon={Flag} title="Nenhum partido cadastrado" description="Cadastre ao menos um partido para continuar." />
            ) : (
              <div className="flex flex-col divide-y rounded-lg border">
                {parties.map((party) => (
                  <div key={party.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="font-medium">{party.acronym} — {party.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Nº {party.number}</span>
                      {party.status === 'INACTIVE' && <Badge>Inativo</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Alert>
              <AlertDescription>
                As candidaturas chegam pelo link público de candidatura — compartilhe-o na tela
                da sessão depois de criá-la.
              </AlertDescription>
            </Alert>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => goTo(0)}>Voltar</Button>
              <Button onClick={finishWizard} disabled={activeParties.length === 0}>
                <Check /> Concluir
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <PositionFormDialog
        open={positionDialogOpen}
        position={null}
        onOpenChange={setPositionDialogOpen}
        onSaved={() => positionsState.reload()}
      />
      <PartyFormDialog
        open={partyDialogOpen}
        party={null}
        onOpenChange={setPartyDialogOpen}
        onSaved={() => partiesState.reload()}
      />
    </div>
  );
}
