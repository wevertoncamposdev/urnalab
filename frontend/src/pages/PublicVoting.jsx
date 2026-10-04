import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Hourglass, Vote } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PostVoteFeedback } from '@/components/feedback/PostVoteFeedback';
import { BallotCard } from '@/components/voting/BallotCard';
import { CandidatePreviewPanel } from '@/components/voting/CandidatePreviewPanel';
import { VoteKeypad } from '@/components/voting/VoteKeypad';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PositionResult } from '@/components/results/PositionResult';
import { Logo } from '@/components/branding/Logo';
import { useAsync } from '@/hooks/useAsync';
import { useBallotFlow } from '@/hooks/useBallotFlow';
import { trackEvent } from '@/lib/analytics';
import { api } from '@/services/api';

// Votação pelo link público: sem login, sem sidebar — só a cédula. Reaproveita
// o mesmo useBallotFlow da tela autenticada (Voting.jsx), trocando só como o
// candidato é consultado e o voto é gravado (pelo token, não pela sessão do usuário).
export default function PublicVoting() {
  const { token } = useParams();
  const sessionState = useAsync(() => api.public.getSession(token), [token]);
  const info = sessionState.data;
  const positions = info?.positions ?? [];

  const ballot = useBallotFlow({
    positions,
    enabled: info?.status === 'OPEN',
    lookupVote: (position, number) => api.public.lookup(token, { position, number }),
    submitVote: ({ position, type, number }) => api.public.createVote(token, { position, type, number, confirmed: true }),
    onBallotComplete: () => sessionState.reload(),
    sessionId: info?.id ?? token,
  });
  const { rule, digits, blank, lookup, submitting, votesCast, closed, ballotDone, ready, index } = ballot;

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
      <PublicShell title={info.name}>
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

  return (
    <PublicShell title={info.name} subtitle={`${info.year}`}>
      {positions.length === 0 ? (
        <EmptyState icon={Vote} title="Esta sessão não tem cargos habilitados" description="Nada a votar aqui." />
      ) : ballotDone ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <CheckCircle2 className="size-10 text-success" />
          <div>
            <p className="font-medium">Voto computado</p>
            <p className="text-sm text-muted-foreground">
              {votesCast === 1 ? '1 cédula registrada.' : `${votesCast} cédulas registradas.`}
            </p>
          </div>
          <Button onClick={ballot.resetBallot}>Próximo eleitor</Button>
          <PostVoteFeedback />
        </Card>
      ) : (
        <div className="flex flex-col gap-2 md:gap-4">
          <p className="text-center text-xs text-muted-foreground md:text-sm">
            Cargo {index + 1} de {positions.length}
          </p>
          <div className="grid gap-3 md:grid-cols-[1fr_280px] md:gap-6">
            <div className="order-2 flex flex-col gap-2 md:order-1 md:gap-4">
              <BallotCard
                positionCode={rule.code}
                positionLabel={rule.label}
                digits={digits}
                digitsRequired={rule.digits}
                blank={blank}
                showLearnMore={false}
              />
              <VoteKeypad onDigit={ballot.pressDigit} onClear={ballot.clearEntry} onBlank={ballot.pressBlank} disabled={submitting} />
              <p className="hidden text-center text-xs text-muted-foreground md:block">
                Também dá para digitar no teclado e confirmar com Enter.
              </p>
              <Button className="h-11 text-base md:h-12" disabled={!ready || submitting} onClick={ballot.confirmVote}>
                {submitting ? 'Confirmando...' : 'Confirma'}
              </Button>
            </div>
            <div className="order-1 md:order-2">
              <CandidatePreviewPanel blank={blank} lookup={lookup} />
            </div>
          </div>
        </div>
      )}
    </PublicShell>
  );
}

function PublicShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-muted/30 p-3 md:p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 md:gap-4">
        <div className="flex flex-col items-center gap-0.5 pt-1 text-center md:gap-1 md:pt-4">
          <Logo size={36} />
          {title && <h1 className="text-base font-semibold md:text-lg">{title}{subtitle ? ` (${subtitle})` : ''}</h1>}
          <p className="hidden text-xs text-muted-foreground md:block">Projeto educacional. Não é uma urna eletrônica oficial.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
