import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, CheckCircle2, Hourglass, Maximize, Minimize, Users, Vote } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CandidateAvatar } from '@/components/candidates/CandidateAvatar';
import { PostVoteFeedback } from '@/components/feedback/PostVoteFeedback';
import { BallotCard } from '@/components/voting/BallotCard';
import { CandidatePreviewPanel } from '@/components/voting/CandidatePreviewPanel';
import { VoteKeypad } from '@/components/voting/VoteKeypad';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PositionResult } from '@/components/results/PositionResult';
import { Logo } from '@/components/branding/Logo';
import { Wordmark } from '@/components/branding/Wordmark';
import { useAsync } from '@/hooks/useAsync';
import { useBallotFlow } from '@/hooks/useBallotFlow';
import { useFullscreen } from '@/hooks/useFullscreen';
import { trackEvent } from '@/lib/analytics';
import { pluralize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

const PAGE_BG = 'min-h-screen bg-gradient-to-b from-primary/5 via-background to-background';
// Mais largo que o max-w-6xl padrão do resto do app de propósito: esta é a tela
// que fica aberta em tela cheia/projetor da sala, então aproveitar mais a
// largura (em vez de sobrar moldura vazia nas laterais) importa mais aqui.
const CONTAINER = 'max-w-[1440px]';

// Única tela de votação do projeto: só pelo link público (sem login, sem
// sidebar). Existia também uma tela autenticada (/votacao) que foi removida —
// votar, mesmo testando como administrador, é sempre por este link (ver o
// botão "Votar" em SessionDetails.jsx, que abre esta mesma rota).
export default function PublicVoting() {
  const { token } = useParams();
  const sessionState = useAsync(() => api.public.getSession(token), [token]);
  const info = sessionState.data;
  const positions = info?.positions ?? [];
  const [selectedCandidateId, setSelectedCandidateId] = useState('');

  const candidatesState = useAsync(
    () => (info?.status === 'OPEN' ? api.public.getCandidates(token) : Promise.resolve(null)),
    [token, info?.status],
  );

  const ballot = useBallotFlow({
    positions,
    enabled: info?.status === 'OPEN',
    lookupVote: (position, number) => api.public.lookup(token, { position, number }),
    submitVote: ({ position, type, number }) => api.public.createVote(token, { position, type, number, confirmed: true }),
    onBallotComplete: () => sessionState.reload(),
    sessionId: info?.id ?? token,
  });
  const { rule, digits, blank, lookup, submitting, votesCast, closed, ballotDone, ready, index } = ballot;

  function nextVoter() {
    setSelectedCandidateId('');
    ballot.resetBallot();
  }

  const showResults = info?.status === 'FINISHED' || closed;
  const resultsState = useAsync(
    () => (showResults ? api.public.getResults(token) : Promise.resolve(null)),
    [token, showResults],
  );

  useEffect(() => {
    if (showResults) trackEvent('RESULTS_VIEWED', { sessionId: info?.id ?? token });
  }, [showResults, info?.id, token]);

  if (sessionState.error?.status === 404) {
    return (
      <PublicShell>
        <EmptyState icon={Vote} title="Link inválido" description="Este link de votação não existe ou foi removido." />
      </PublicShell>
    );
  }
  if (sessionState.error) {
    return (
      <PublicShell>
        <EmptyState
          icon={Vote}
          title="Não foi possível carregar"
          description={sessionState.error.message}
          action={<Button variant="outline" onClick={sessionState.reload}>Tentar novamente</Button>}
        />
      </PublicShell>
    );
  }
  if (!info) {
    return (
      <PublicShell>
        <Skeleton className="h-80" />
      </PublicShell>
    );
  }
  if (info.status === 'DRAFT') {
    return (
      <PublicShell title={info.name} subtitle={`${info.year}`}>
        <EmptyState
          icon={Hourglass}
          title="Votação ainda não foi aberta"
          description="Volte mais tarde — assim que a votação abrir, este mesmo link já recebe votos."
          action={<Button variant="outline" onClick={sessionState.reload}>Atualizar</Button>}
        />
      </PublicShell>
    );
  }
  if (showResults) {
    return (
      <PublicShell title={info.name} subtitle={`${info.year}`}>
        <Alert>
          <AlertDescription>
            Votação encerrada — obrigado por participar! Confira o resultado abaixo.
          </AlertDescription>
        </Alert>
        {resultsState.error ? (
          resultsState.error.code !== 'RESULTS_NOT_AVAILABLE' && (
            <ErrorState error={resultsState.error} onRetry={resultsState.reload} />
          )
        ) : !resultsState.data ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="flex flex-col gap-3 md:gap-4">
            {resultsState.data.positions.map((position) => (
              <PositionResult key={position.code} result={position} />
            ))}
          </div>
        )}
      </PublicShell>
    );
  }

  if (positions.length === 0) {
    return (
      <PublicShell title={info.name} subtitle={`${info.year}`}>
        <EmptyState icon={Vote} title="Esta sessão não tem cargos habilitados" description="Nada a votar aqui." />
      </PublicShell>
    );
  }

  if (ballotDone) {
    return (
      <PublicShell title={info.name} subtitle={`${info.year}`}>
        <Card className="flex flex-col items-center gap-4 border-success/20 bg-success-soft/40 p-8 text-center md:p-10">
          <div className="flex size-16 items-center justify-center rounded-full bg-success text-white">
            <CheckCircle2 className="size-8" />
          </div>
          <div>
            <p className="font-heading text-lg font-semibold">Voto computado!</p>
            <p className="text-sm text-muted-foreground">
              {votesCast === 1 ? '1 cédula registrada.' : `${votesCast} cédulas registradas.`}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Participar é fortalecer a democracia — obrigado por exercer sua cidadania.
            </p>
          </div>
          <Button size="lg" onClick={nextVoter}>Próximo eleitor</Button>
          <PostVoteFeedback />
        </Card>
      </PublicShell>
    );
  }

  // Candidatos de todos os cargos, agrupados na ordem da sessão — alimenta o
  // seletor de consulta da coluna 1 (independente do cargo sendo votado agora).
  const candidatesByPosition = positions.flatMap((p) =>
    (candidatesState.data ?? [])
      .filter((c) => c.position === p.code)
      .sort((a, b) => a.number.localeCompare(b.number))
      .map((c) => ({ ...c, positionLabel: p.label })),
  );
  const selectedCandidate = candidatesByPosition.find((c) => c.id === selectedCandidateId) ?? null;

  return (
    <div className={PAGE_BG}>
      <PublicHeader sessionName={info.name} sessionYear={info.year} />

      <main className={cn('mx-auto flex flex-col gap-4 px-3 py-4 md:gap-6 md:px-4 md:py-6', CONTAINER)}>
        <PositionStepper positions={positions} currentIndex={index} />

        <div className="flex flex-col gap-3 md:grid md:grid-cols-[320px_1fr_300px] md:items-start md:gap-6">
          <div className="order-3 flex flex-col gap-3 md:order-1">
            <Card>
              <CardContent className="flex flex-col gap-4 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4 shrink-0" />
                  {pluralize(candidatesByPosition.length, 'candidato', 'candidatos')} nesta eleição
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="candidate-lookup" className="text-xs font-medium text-muted-foreground">
                    Consultar proposta de um candidato
                  </label>
                  <Select
                    value={selectedCandidateId}
                    onValueChange={setSelectedCandidateId}
                    disabled={candidatesByPosition.length === 0}
                  >
                    <SelectTrigger id="candidate-lookup">
                      <SelectValue placeholder={candidatesByPosition.length === 0 ? 'Nenhum candidato cadastrado' : 'Selecione um candidato'} />
                    </SelectTrigger>
                    <SelectContent>
                      {candidatesByPosition.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.positionLabel} — {c.number} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCandidate && (
                  <div className="flex flex-col gap-2 rounded-r-lg border-l-4 border-primary/50 bg-muted/50 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <CandidateAvatar name={selectedCandidate.name} photo={selectedCandidate.photo} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{selectedCandidate.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {selectedCandidate.party && `${selectedCandidate.party.acronym} (${selectedCandidate.party.number}) • `}
                          nº {selectedCandidate.number}
                        </div>
                      </div>
                    </div>
                    {selectedCandidate.governmentProposal ? (
                      <p className="whitespace-pre-wrap">{selectedCandidate.governmentProposal}</p>
                    ) : (
                      <p className="text-muted-foreground">Este candidato não cadastrou uma proposta de governo.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="order-2 flex flex-col gap-3 md:gap-4">
            <BallotCard positionLabel={rule.label} digits={digits} digitsRequired={rule.digits} blank={blank} />
            <VoteKeypad onDigit={ballot.pressDigit} onClear={ballot.clearEntry} onBlank={ballot.pressBlank} disabled={submitting} />
            <p className="hidden text-center text-xs text-muted-foreground md:block">
              Também dá para digitar no teclado e confirmar com Enter.
            </p>
            <Button className="h-11 text-base md:h-12" disabled={!ready || submitting} onClick={ballot.confirmVote}>
              {submitting ? 'Confirmando...' : 'Confirma'}
            </Button>
          </div>

          <div className="order-1 md:order-3">
            <CandidatePreviewPanel blank={blank} lookup={lookup} />
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

function PublicHeader({ sessionName, sessionYear }) {
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  return (
    <header className="border-b bg-card/80 backdrop-blur">
      <div className={cn('mx-auto flex flex-wrap items-center justify-between gap-2 px-3 py-3 md:px-4', CONTAINER)}>
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <Wordmark className="text-base" />
        </div>
        <div className="flex items-center gap-3">
          {sessionName && (
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">{sessionName}</p>
              {sessionYear && <p className="text-xs text-muted-foreground">{sessionYear}</p>}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {isFullscreen ? <Minimize /> : <Maximize />}
          </Button>
        </div>
      </div>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className={cn('mx-auto px-3 pb-6 pt-2 text-center md:px-4', CONTAINER)}>
      <p className="text-xs text-muted-foreground">
        Projeto educacional feito para promover cidadania nas escolas — não é uma urna eletrônica oficial.
      </p>
    </footer>
  );
}

// Progresso da cédula: um "pílula" por cargo, marcando o que já foi votado,
// o atual e o que falta — pra quem está votando saber exatamente onde está,
// sem precisar contar "cargo 2 de 4" de cabeça.
function PositionStepper({ positions, currentIndex }) {
  return (
    <ol className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-1.5 md:gap-2">
      {positions.map((p, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';
        return (
          <li key={p.code}>
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors md:px-3 md:text-sm',
                state === 'current' && 'border-primary bg-primary text-primary-foreground',
                state === 'done' && 'border-success/30 bg-success-soft text-success',
                state === 'upcoming' && 'border-border bg-card text-muted-foreground',
              )}
            >
              {state === 'done' ? (
                <Check className="size-3.5 shrink-0" />
              ) : (
                <span className="tabular-nums">{i + 1}</span>
              )}
              {p.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function PublicShell({ title, subtitle, children }) {
  return (
    <div className={PAGE_BG}>
      <PublicHeader sessionName={title} sessionYear={subtitle} />
      <main className="mx-auto flex max-w-2xl flex-col gap-3 px-3 py-8 md:gap-4 md:px-6">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
