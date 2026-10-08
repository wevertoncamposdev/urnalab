import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, CheckCircle2, GraduationCap, Hourglass, Maximize, Minimize, Vote } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PostVoteFeedback } from '@/components/feedback/PostVoteFeedback';
import { CandidateList } from '@/components/voting/CandidateList';
import { Urna } from '@/components/voting/Urna';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PositionResult } from '@/components/results/PositionResult';
import { Logo } from '@/components/branding/Logo';
import { Wordmark } from '@/components/branding/Wordmark';
import { useAsync } from '@/hooks/useAsync';
import { useBallotFlow } from '@/hooks/useBallotFlow';
import { useFullscreen } from '@/hooks/useFullscreen';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

const PAGE_BG = 'flex min-h-screen flex-col bg-gradient-to-b from-primary/5 via-background to-background';
// Só a tela de votação em si (urna + colinha) trava o scroll no desktop — fica
// montada numa sala de aula/projetor, então a página inteira precisa caber na
// tela sem rolar; quem precisar de mais espaço (proposta longa, por exemplo)
// rola dentro do próprio cartão, não a página. As outras telas que usam
// PublicShell (resultado, erro, "ainda não abriu" etc.) continuam com scroll
// normal — o resultado de uma eleição com muitos cargos pode ser bem longo.
const VOTING_PAGE_BG = cn(PAGE_BG, 'md:h-screen md:overflow-hidden');
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

  // A lista de candidatos (coluna 1) troca de cargo junto com a urna — sem
  // isso, a proposta selecionada do cargo anterior ficaria "vazando" pro
  // próximo cargo depois de avançar.
  useEffect(() => {
    setSelectedCandidateId('');
  }, [index]);

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

  // Só os candidatos do cargo sendo votado agora — a lista (coluna 1) troca
  // sozinha a cada avanço de cargo, junto com a urna.
  const currentCandidates = (candidatesState.data ?? [])
    .filter((c) => c.position === rule.code)
    .sort((a, b) => a.number.localeCompare(b.number));

  return (
    <div className={VOTING_PAGE_BG}>
      <PublicHeader sessionName={info.name} sessionYear={info.year} />

      <main
        className={cn(
          'mx-auto flex w-full flex-1 flex-col gap-4 px-3 py-4 md:min-h-0 md:gap-4 md:overflow-hidden md:px-4 md:py-6',
          CONTAINER,
        )}
      >
        {/* Mesmas duas colunas da área de baixo (texto à esquerda, acompanhando a colinha;
            tabs à direita, acompanhando a urna) — `flex-col-reverse` + `md:grid` reaproveita o
            mesmo truque da área de baixo pra também inverter a ordem no celular (tabs antes do
            aviso, por DOM o aviso vem primeiro mas visualmente some por último). */}
        <div className="flex flex-col-reverse gap-2 md:grid md:grid-cols-[1fr_380px] md:items-center md:gap-6">
          <Badge
            variant="accent"
            className="w-fit items-start gap-1.5 rounded-xl px-3 py-1.5 text-left leading-snug"
          >
            <GraduationCap className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Projeto educacional feito para promover cidadania nas escolas. Não se trata de uma urna
              eletrônica oficial.
            </span>
          </Badge>

          <PositionStepper positions={positions} currentIndex={index} />
        </div>

        {/* Duas colunas (Etapa 17): lista dos candidatos do cargo atual de um lado, a urna
            simulada do outro — no celular, a urna vem primeiro (`flex-col-reverse`: é a
            interação principal), o select + detalhes do candidato depois. `items-stretch` pra
            coluna da esquerda acompanhar a altura da urna em vez de sobrar espaço vazio do lado
            dela. */}
        <div className="flex flex-1 flex-col-reverse gap-3 md:grid md:min-h-0 md:grid-cols-[1fr_380px] md:items-stretch md:gap-6">
          <CandidateList
            positionLabel={rule.label}
            candidates={currentCandidates}
            selectedId={selectedCandidateId}
            onSelect={setSelectedCandidateId}
          />

          <div className="md:min-h-0 md:overflow-y-auto">
            <Urna
              positionLabel={rule.label}
              digits={digits}
              digitsRequired={rule.digits}
              blank={blank}
              lookup={lookup}
              onDigit={ballot.pressDigit}
              onClear={ballot.clearEntry}
              onBlank={ballot.pressBlank}
              onConfirm={ballot.confirmVote}
              ready={ready}
              submitting={submitting}
            />
          </div>
        </div>
      </main>
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
    </div>
  );
}
