import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatNumber, pluralize } from '@/lib/format';
import { SessionStatusBadge } from './SessionStatusBadge';

// Botão que vira link só quando `enabled`; senão fica desabilitado com uma dica do motivo.
function SessionLinkButton({ enabled, to, disabledTitle, children }) {
  return (
    <Button size="sm" variant="outline" asChild={enabled} disabled={!enabled} title={enabled ? undefined : disabledTitle}>
      {enabled ? <Link to={to}>{children}</Link> : children}
    </Button>
  );
}

// Votar é sempre pelo link público (/votar/:token, ver PublicVoting.jsx) — não existe
// mais uma tela de votação autenticada separada.
function VoteButton({ session }) {
  const url = `/votar/${session.publicToken}`;
  return (
    <Button size="sm" variant="outline" asChild={session.status === 'OPEN'} disabled={session.status !== 'OPEN'} title={session.status === 'OPEN' ? undefined : 'Abra a votação para registrar votos'}>
      {session.status === 'OPEN' ? <a href={url} target="_blank" rel="noreferrer">Votar</a> : 'Votar'}
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
            <p className="text-sm text-muted-foreground">
              {session.year} • {pluralize(session.positionsCount, 'cargo', 'cargos')}
            </p>
          </div>
          <SessionStatusBadge status={session.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {pluralize(session.candidatesCount, 'candidato', 'candidatos')} •{' '}
          {formatNumber(session.votesCount)} {session.votesCount === 1 ? 'voto' : 'votos'}
        </p>
        <div className="mt-auto flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to={`/sessoes/${session.id}`}>Gerenciar</Link>
          </Button>
          <VoteButton session={session} />
          <SessionLinkButton
            enabled={session.status === 'FINISHED'}
            to={`/resultados?sessionId=${session.id}`}
            disabledTitle="Finalize a eleição para ver os resultados"
          >
            Resultados
          </SessionLinkButton>
          <SessionLinkButton
            enabled={session.status === 'FINISHED'}
            to={`/auditoria?sessionId=${session.id}`}
            disabledTitle="Finalize a eleição para auditar os votos"
          >
            Auditoria
          </SessionLinkButton>
        </div>
      </CardContent>
    </Card>
  );
}
