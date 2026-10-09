import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { VoteChainTable } from '@/components/audit/VoteChainTable';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { useAsync } from '@/hooks/useAsync';
import { formatNumber } from '@/lib/format';
import { api } from '@/services/api';

// Reconfere a cadeia de hashes dos votos da sessão — migrado da antiga página
// /auditoria (removida), agora como seção de SessionDetails.jsx.
export function SessionAuditSection({ session, positions }) {
  const auditState = useAsync(() => api.audit.get(session.id), [session.id]);
  const positionLabels = Object.fromEntries(positions.map((p) => [p.code, p.label]));

  if (auditState.error) {
    return <ErrorState error={auditState.error} onRetry={auditState.reload} />;
  }
  if (!auditState.data) {
    return <Skeleton className="h-64" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          {auditState.data.valid ? (
            <ShieldCheck className="size-8 shrink-0 text-success" />
          ) : (
            <ShieldAlert className="size-8 shrink-0 text-danger" />
          )}
          <div>
            <p className="font-medium">
              {auditState.data.valid ? 'Cadeia de votos íntegra' : 'Violação detectada na cadeia de votos'}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatNumber(auditState.data.totalVotes)}{' '}
              {auditState.data.totalVotes === 1 ? 'voto verificado' : 'votos verificados'}
              {!auditState.data.valid &&
                ` — divergência a partir do voto #${auditState.data.brokenAtIndex + 1}`}
              .
            </p>
          </div>
        </CardContent>
      </Card>

      {auditState.data.votes.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhum voto registrado"
          description="Esta sessão foi finalizada sem votos."
        />
      ) : (
        <Card>
          <VoteChainTable votes={auditState.data.votes} positionLabels={positionLabels} />
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Cada voto guarda o hash do voto anterior da mesma sessão. Alterar, remover ou reordenar
        um registro depois de gravado quebra essa cadeia — é isso que esta seção reconfere.
      </p>
    </div>
  );
}
