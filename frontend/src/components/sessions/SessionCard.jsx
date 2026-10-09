import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Users, Vote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatNumber } from '@/lib/format';
import { SessionStatusBadge } from './SessionStatusBadge';

function CountBadge({ icon: Icon, value, label }) {
  return (
    <span
      className="flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground"
      title={label}
    >
      <Icon className="size-3.5" /> {formatNumber(value)}
    </span>
  );
}

// Votar é sempre pelo link público (/votar/:token, ver PublicVoting.jsx) — não existe
// mais uma tela de votação autenticada separada.
function VoteButton({ session }) {
  const url = `/votar/${session.publicToken}`;
  const disabled = session.status !== 'OPEN';
  return (
    <Button
      size="icon"
      variant="outline"
      asChild={!disabled}
      disabled={disabled}
      aria-label="Votar"
      title={disabled ? 'Abra a votação para registrar votos' : 'Votar'}
    >
      {disabled ? <Vote /> : <a href={url} target="_blank" rel="noreferrer"><Vote /></a>}
    </Button>
  );
}

export function SessionCard({ session }) {
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{session.name}</h3>
            <p className="text-sm text-muted-foreground">{session.year}</p>
          </div>
          <SessionStatusBadge status={session.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          <CountBadge icon={Briefcase} value={session.positionsCount} label="Cargos" />
          <CountBadge icon={Users} value={session.candidatesCount} label="Candidatos" />
          <CountBadge icon={Vote} value={session.votesCount} label="Votos" />
        </div>
        <div className="mt-auto flex items-center justify-end gap-2">
          <VoteButton session={session} />
          <Button asChild size="icon" aria-label="Gerenciar sessão" title="Gerenciar sessão">
            <Link to={`/sessoes/${session.id}`}>
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
