import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CopyPlus, Flag, Plus, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CandidateAvatar } from '@/components/candidates/CandidateAvatar';
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

// Primeiro passo é sempre "Origem" (escolher entre copiar ou criar do zero) — os passos
// seguintes dependem da escolha: copiar é um passo só (a sessão de origem já traz cargos
// e partidos prontos); criar do zero segue o fluxo guiado de sempre (sessão → partidos).
const STEPS_BY_MODE = {
  copy: ['Origem', 'Copiar'],
  new: ['Origem', 'Sessão', 'Partidos'],
};

function Stepper({ steps, current, maxReached, onSelect }) {
  return (
    <ol className="flex flex-wrap items-center justify-center gap-1.5">
      {steps.map((label, index) => {
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

// Criar sessão: primeiro escolhe a origem (copiar de uma eleição já existente ou criar
// do zero), depois segue um fluxo guiado — igual ao resto do app, cada passo reaproveita
// os mesmos diálogos/componentes já usados nas telas normais (Cargos, Partidos), só guia
// a ordem, sem duplicar validação/criação, que continua nos services do backend. Ao
// concluir, cai direto na tela de gerenciamento da sessão — ela já reúne tudo que falta
// (link de candidatura, abrir votação etc.), então não precisa de uma etapa de revisão
// própria aqui. Copiar reaproveita o mesmo endpoint que "Duplicar" usa de dentro de uma
// sessão (ver DuplicateSessionDialog.jsx) — cargos e partidos vêm prontos da origem, só
// as candidaturas marcadas são recriadas; pessoas e partidos nunca são duplicados, só
// referenciados. Quem cria do zero não tem passo de candidatos aqui: chegam pelo link
// público depois (ver PublicCandidacyLinkCard em SessionDetails.jsx).
export default function SessionWizard() {
  const navigate = useNavigate();
  const { select } = useCurrentSession();

  const [mode, setMode] = useState(null); // null | 'new' | 'copy'
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [session, setSession] = useState(null);

  const positionsState = useAsync(() => api.positions.list(), []);
  const partiesState = useAsync(() => api.parties.list(), []);
  const sessionsState = useAsync(() => api.sessions.list(), []);

  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [partyDialogOpen, setPartyDialogOpen] = useState(false);

  const [name, setName] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [sessionSubmitting, setSessionSubmitting] = useState(false);
  const [sessionError, setSessionError] = useState(null);

  const [sourceId, setSourceId] = useState('');
  const [copyName, setCopyName] = useState('');
  const [copyYear, setCopyYear] = useState(String(new Date().getFullYear()));
  const [copySelected, setCopySelected] = useState(new Set());
  const [copySubmitting, setCopySubmitting] = useState(false);
  const [copyError, setCopyError] = useState(null);

  const sourceCandidatesState = useAsync(
    () => (sourceId ? api.candidates.list({ sessionId: sourceId, status: 'ACTIVE' }) : Promise.resolve(null)),
    [sourceId],
  );

  // Ao escolher a sessão de origem, pré-preenche o nome (a professora ajusta se quiser)
  // e já marca todo mundo que está ativo — ela desmarca só quem não concorre de novo.
  useEffect(() => {
    if (!sourceId || !sessionsState.data) return;
    const source = sessionsState.data.find((s) => s.id === sourceId);
    if (source) setCopyName(source.name);
  }, [sourceId, sessionsState.data]);

  useEffect(() => {
    if (sourceCandidatesState.data) setCopySelected(new Set(sourceCandidatesState.data.map((c) => c.id)));
  }, [sourceCandidatesState.data]);

  const steps = STEPS_BY_MODE[mode ?? 'new'];

  function goTo(index) {
    setStep(index);
    setMaxReached((current) => Math.max(current, index));
  }

  function chooseMode(next) {
    setMode(next);
    setMaxReached(1);
    setStep(1);
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
      goTo(2);
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

  function toggleCopyCandidate(id) {
    setCopySelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submitCopyStep() {
    setCopySubmitting(true);
    setCopyError(null);
    try {
      const result = await api.sessions.duplicate(sourceId, {
        name: copyName,
        year: copyYear === '' ? null : Number(copyYear),
        candidateIds: [...copySelected],
      });
      trackEvent('SESSION_CREATED', { sessionId: result.session.id });
      select(result.session);
      if (result.skipped.length > 0) {
        toast.warning(
          `${result.copied} candidato(s) copiado(s), ${result.skipped.length} pulado(s): ` +
            result.skipped.map((s) => `${s.name} (${s.reason})`).join('; '),
        );
      } else {
        toast.success(
          result.copied === 0 ? 'Sessão criada.' : `Sessão criada com ${result.copied} candidato(s) copiado(s).`,
        );
      }
      navigate(`/sessoes/${result.session.id}`);
    } catch (err) {
      if (err.code === 'INSTITUTION_PROFILE_REQUIRED') {
        toast.error(err.message);
        navigate('/perfil');
        return;
      }
      setCopyError(err);
    } finally {
      setCopySubmitting(false);
    }
  }

  const loadError = positionsState.error ?? partiesState.error ?? sessionsState.error;
  const loadReady = positionsState.data && partiesState.data && sessionsState.data;

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          error={loadError}
          onRetry={() => { positionsState.reload(); partiesState.reload(); sessionsState.reload(); }}
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
  const positionLabels = Object.fromEntries(positions.map((p) => [p.code, p.label]));
  const sourceCandidates = sourceCandidatesState.data ?? [];

  const description =
    mode === 'copy'
      ? 'Escolha a eleição de origem e os candidatos que você quer reaproveitar.'
      : mode === 'new'
        ? 'Cadastre tudo que uma eleição precisa, passo a passo: sessão e partidos.'
        : 'Comece copiando os cargos, partidos e candidatos de uma eleição já criada, ou do zero.';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Criar sessão"
        description={description}
        actions={<Button variant="ghost" onClick={exitWizard}>Cancelar</Button>}
      />

      <Stepper steps={steps} current={step} maxReached={maxReached} onSelect={goTo} />

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => chooseMode('new')}
            className="flex flex-col items-start gap-3 rounded-lg border bg-card p-6 text-left transition-colors hover:border-primary hover:bg-primary/5"
          >
            <Wand2 className="size-6 text-primary" />
            <div>
              <p className="font-medium">Criar uma eleição nova</p>
              <p className="text-sm text-muted-foreground">
                Comece do zero: defina nome, ano, cargos e partidos.
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => chooseMode('copy')}
            className="flex flex-col items-start gap-3 rounded-lg border bg-card p-6 text-left transition-colors hover:border-primary hover:bg-primary/5"
          >
            <CopyPlus className="size-6 text-primary" />
            <div>
              <p className="font-medium">Copiar de uma eleição existente</p>
              <p className="text-sm text-muted-foreground">
                Reaproveite os cargos, partidos e candidatos de uma sessão já criada.
              </p>
            </div>
          </button>
        </div>
      )}

      {step === 1 && mode === 'copy' && (
        <Card>
          <CardContent className="flex flex-col gap-6 p-6">
            {copyError && (
              <Alert variant="destructive"><AlertDescription>{copyError.message}</AlertDescription></Alert>
            )}

            {sessionsState.data.length === 0 ? (
              <EmptyState
                icon={CopyPlus}
                title="Nenhuma eleição para copiar"
                description="Você ainda não tem nenhuma sessão criada — comece do zero."
                action={<Button onClick={() => chooseMode('new')}><Wand2 /> Criar do zero</Button>}
              />
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wizard-copy-source">Copiar de</Label>
                  <Select value={sourceId} onValueChange={setSourceId}>
                    <SelectTrigger id="wizard-copy-source">
                      <SelectValue placeholder="Selecione uma sessão" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessionsState.data.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.year})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {sourceId && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="wizard-copy-name">Nome da nova sessão</Label>
                        <Input id="wizard-copy-name" value={copyName} onChange={(e) => setCopyName(e.target.value)} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="wizard-copy-year">Ano</Label>
                        <Input id="wizard-copy-year" type="number" value={copyYear} onChange={(e) => setCopyYear(e.target.value)} />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <Label>Candidatos a reaproveitar</Label>
                        {sourceCandidates.length > 0 && (
                          <div className="flex gap-3 text-xs">
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={() => setCopySelected(new Set(sourceCandidates.map((c) => c.id)))}
                            >
                              Selecionar todos
                            </button>
                            <button type="button" className="text-primary hover:underline" onClick={() => setCopySelected(new Set())}>
                              Nenhum
                            </button>
                          </div>
                        )}
                      </div>

                      {sourceCandidatesState.loading ? (
                        <p className="text-sm text-muted-foreground">Carregando candidatos...</p>
                      ) : sourceCandidates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Esta sessão não tem candidatos ativos — a nova sessão nasce só com os cargos.
                        </p>
                      ) : (
                        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg border p-2">
                          {sourceCandidates.map((candidate) => (
                            <Label
                              key={candidate.id}
                              htmlFor={`wizard-copy-candidate-${candidate.id}`}
                              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 font-normal hover:bg-muted/50"
                            >
                              <Checkbox
                                id={`wizard-copy-candidate-${candidate.id}`}
                                checked={copySelected.has(candidate.id)}
                                onCheckedChange={() => toggleCopyCandidate(candidate.id)}
                              />
                              <CandidateAvatar name={candidate.name} photo={candidate.photo} className="size-7 text-xs" />
                              <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {positionLabels[candidate.position] ?? candidate.position} · nº {candidate.number}
                              </span>
                            </Label>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => goTo(0)}>Voltar</Button>
              <Button onClick={submitCopyStep} disabled={!sourceId || !copyName || copySubmitting}>
                {copySubmitting ? 'Copiando...' : 'Concluir'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && mode === 'new' && (
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
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => goTo(0)}>Voltar</Button>
              <Button onClick={submitSessionStep} disabled={sessionSubmitting || !name || selectedPositions.length === 0}>
                {sessionSubmitting ? 'Salvando...' : 'Continuar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && mode === 'new' && (
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
              <Button variant="outline" onClick={() => goTo(1)}>Voltar</Button>
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
