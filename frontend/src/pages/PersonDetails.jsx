import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, FileText, Trophy, Vote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatTile } from '@/components/layout/StatTile';
import { ActiveBadge } from '@/components/layout/StatusBadge';
import { CandidateAvatar } from '@/components/candidates/CandidateAvatar';
import { SessionStatusBadge } from '@/components/sessions/SessionStatusBadge';
import { useAsync } from '@/hooks/useAsync';
import { formatNumber } from '@/lib/format';
import { api } from '@/services/api';

function CandidacyCard({ candidacy }) {
  const finished = candidacy.sessionStatus === 'FINISHED';
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to={`/sessoes/${candidacy.sessionId}`} className="font-semibold hover:underline">
              {candidacy.sessionName ?? 'Sessão removida'}
            </Link>
            <p className="text-sm text-muted-foreground">
              {candidacy.sessionYear} • {candidacy.positionLabel}
              {candidacy.party && ` • ${candidacy.party.acronym} (${candidacy.party.number})`} • nº {candidacy.number}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {candidacy.sessionStatus && <SessionStatusBadge status={candidacy.sessionStatus} />}
            {candidacy.status !== 'ACTIVE' && <ActiveBadge status={candidacy.status} />}
          </div>
        </div>

        {finished ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium tabular-nums">{formatNumber(candidacy.votes)} votos</span>
            {candidacy.elected ? <Badge variant="success">Eleito</Badge> : <Badge>Não eleito</Badge>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aguardando apuração.</p>
        )}

        {candidacy.governmentProposal && (
          <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            {candidacy.governmentProposal}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function PersonDetails() {
  const { id } = useParams();
  const { data: person, error, loading, reload } = useAsync(() => api.people.get(id), [id]);

  if (error?.status === 404) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={Vote}
          title="Pessoa não encontrada"
          description="Ela pode ter sido removida ou o endereço está incorreto."
          action={<Button asChild variant="outline"><Link to="/pessoas">Ver todas as pessoas</Link></Button>}
        />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }
  if (!person) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={(
          <span className="flex items-center gap-3">
            <CandidateAvatar name={person.name} photo={person.photo} className="size-10" />
            {person.name}
          </span>
        )}
        description="Histórico de candidaturas e desempenho eleitoral."
        actions={
          <Button asChild variant="outline">
            <Link to="/pessoas"><ArrowLeft /> Voltar</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Briefcase} label="Candidaturas" value={formatNumber(person.candidaciesCount)} tone="primary" />
        <StatTile icon={FileText} label="Propostas" value={formatNumber(person.proposalsCount)} tone="accent" />
        <StatTile icon={Vote} label="Votos" value={formatNumber(person.totalVotes)} tone="coral" />
        <StatTile icon={Trophy} label="Eleições" value={formatNumber(person.electionsWon)} tone="success" />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Candidaturas</h2>
        {person.candidacies.length === 0 ? (
          <EmptyState icon={Briefcase} title="Nenhuma candidatura ainda" />
        ) : (
          <div className="flex flex-col gap-3">
            {person.candidacies.map((candidacy) => (
              <CandidacyCard key={candidacy.id} candidacy={candidacy} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
