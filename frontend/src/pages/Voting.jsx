import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Maximize, Minimize, Vote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PostVoteFeedback } from '@/components/feedback/PostVoteFeedback';
import { BallotCard } from '@/components/voting/BallotCard';
import { CandidatePreviewPanel } from '@/components/voting/CandidatePreviewPanel';
import { VoteKeypad } from '@/components/voting/VoteKeypad';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAsync } from '@/hooks/useAsync';
import { useBallotFlow } from '@/hooks/useBallotFlow';
import { useCurrentSession } from '@/hooks/useCurrentSession';
import { useFullscreen } from '@/hooks/useFullscreen';
import { api } from '@/services/api';

// Tela de votação (autenticada, com seletor de sessão): a cédula em si é o
// useBallotFlow, reaproveitado também pelo link público (PublicVoting.jsx).
export default function Voting() {
  const [searchParams] = useSearchParams();
  const { session: currentSession, select } = useCurrentSession();
  const sessionsState = useAsync(() => api.sessions.list(), []);
  const positionsState = useAsync(() => api.positions.list(), []);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const [sessionId, setSessionId] = useState(searchParams.get('sessionId') ?? currentSession?.id ?? '');

  const openSessions = (sessionsState.data ?? []).filter((s) => s.status === 'OPEN');
  const session = openSessions.find((s) => s.id === sessionId) ?? openSessions[0] ?? null;
  const rules = Object.fromEntries((positionsState.data ?? []).map((p) => [p.code, p]));
  const positions = (session?.positions ?? []).map((code) => rules[code]).filter(Boolean);

  const ballot = useBallotFlow({
    positions,
    enabled: Boolean(session),
    lookupVote: (position, number) => api.votes.lookup({ sessionId: session.id, position, number }),
    submitVote: ({ position, type, number }) =>
      api.votes.create({ sessionId: session.id, position, type, number, confirmed: true }),
    onBallotComplete: () => sessionsState.reload(),
    sessionId: session?.id,
  });
  const { rule, digits, blank, lookup, submitting, votesCast, closed, ballotDone, ready, index } = ballot;

  const error = sessionsState.error ?? positionsState.error;
  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState error={error} onRetry={() => { sessionsState.reload(); positionsState.reload(); }} />
      </div>
    );
  }
  if (!sessionsState.data || !positionsState.data) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (!session) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          icon={Vote}
          title="Nenhuma votação aberta"
          description="Abra a votação de uma sessão para começar a registrar votos."
          action={<Button asChild><Link to="/sessoes">Ver eleições</Link></Button>}
        />
      </div>
    );
  }

  function changeSession(value) {
    setSessionId(value);
    const next = openSessions.find((s) => s.id === value);
    if (next) select(next);
    ballot.resetBallot();
  }

  const sessionPicker = openSessions.length > 1 && (
    <Select value={session.id} onValueChange={changeSession}>
      <SelectTrigger aria-label="Sessão" className="w-56"><SelectValue /></SelectTrigger>
      <SelectContent>
        {openSessions.map((s) => (
          <SelectItem key={s.id} value={s.id}>{s.name} ({s.year})</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const fullscreenButton = (
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
  );

  if (closed) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          icon={Vote}
          title="Votação encerrada"
          description="Esta sessão não está mais recebendo votos."
          action={<Button asChild variant="outline"><Link to={`/sessoes/${session.id}`}>Ver sessão</Link></Button>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Votação"
        description={`${session.name} (${session.year})`}
        actions={<>{sessionPicker}{fullscreenButton}</>}
      />

      {positions.length === 0 ? (
        <EmptyState
          icon={Vote}
          title="Esta sessão não tem cargos habilitados"
          description="Nada a votar aqui."
        />
      ) : ballotDone ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <CheckCircle2 className="size-10 text-success" />
          <div>
            <p className="font-medium">Voto computado</p>
            <p className="text-sm text-muted-foreground">
              {votesCast === 1 ? '1 cédula registrada nesta urna.' : `${votesCast} cédulas registradas nesta urna.`}
            </p>
          </div>
          <Button onClick={ballot.resetBallot}>Próximo eleitor</Button>
          <PostVoteFeedback />
        </Card>
      ) : (
        <>
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
              />
              <VoteKeypad onDigit={ballot.pressDigit} onClear={ballot.clearEntry} onBlank={ballot.pressBlank} disabled={submitting} />
              <p className="hidden text-center text-xs text-muted-foreground md:block">
                Também dá para digitar no teclado do computador e confirmar com Enter.
              </p>
              <Button className="h-11 text-base md:h-12" disabled={!ready || submitting} onClick={ballot.confirmVote}>
                {submitting ? 'Confirmando...' : 'Confirma'}
              </Button>
            </div>
            <div className="order-1 md:order-2">
              <CandidatePreviewPanel blank={blank} lookup={lookup} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
