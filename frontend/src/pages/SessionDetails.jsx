import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BarChart3, Copy, CopyPlus, ExternalLink, Pencil, Play, ShieldCheck, Square, Users, Vote } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { ConfirmAction } from '@/components/sessions/ConfirmAction';
import { DuplicateSessionDialog } from '@/components/sessions/DuplicateSessionDialog';
import { SessionStatusBadge } from '@/components/sessions/SessionStatusBadge';
import { useAsync } from '@/hooks/useAsync';
import { useCurrentSession } from '@/hooks/useCurrentSession';
import { formatDateTime, formatNumber } from '@/lib/format';
import { api } from '@/services/api';

const STATUS_HINT = {
  DRAFT:
    'Esta sessão é um rascunho. Depois de abrir a votação, nome, ano e cargos não podem mais ser alterados.',
  OPEN: 'A votação está aberta. Finalize a eleição para encerrar o recebimento de votos.',
  FINISHED: 'Eleição finalizada. Esta sessão não recebe mais votos.',
};

function Stat({ label, value }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}

async function copyPublicLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copiado.');
  } catch {
    toast.error('Não foi possível copiar. Copie o link manualmente.');
  }
}

// Link público: funciona enquanto a sessão estiver aberta, sem precisar de
// login — dá pra votar direto do celular. Para de funcionar sozinho ao finalizar.
function PublicLinkCard({ publicToken }) {
  const url = `${window.location.origin}/votar/${publicToken}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Link público de votação</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Qualquer pessoa com este link vota nesta sessão, sem precisar de conta — funciona bem
          pelo celular. Ele para de funcionar sozinho quando a eleição for finalizada.
        </p>
        <div className="flex flex-col items-center gap-1 rounded-lg border bg-muted/40 py-4">
          <span className="text-xs text-muted-foreground">Código de acesso</span>
          <button
            type="button"
            onClick={() => copyPublicLink(publicToken)}
            className="font-mono text-3xl font-bold tracking-widest tabular-nums"
            title="Copiar código"
          >
            {publicToken}
          </button>
        </div>
        <div className="flex gap-2">
          <Input readOnly value={url} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
          <Button type="button" variant="outline" size="icon" onClick={() => copyPublicLink(url)} aria-label="Copiar link" title="Copiar link">
            <Copy />
          </Button>
          <Button type="button" variant="outline" size="icon" asChild>
            <a href={url} target="_blank" rel="noreferrer" aria-label="Abrir em nova aba" title="Abrir em nova aba">
              <ExternalLink />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DateRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{formatDateTime(value)}</dd>
    </div>
  );
}

export default function SessionDetails() {
  const { id } = useParams();
  const { select } = useCurrentSession();
  const sessionState = useAsync(() => api.sessions.get(id), [id]);
  const positionsState = useAsync(() => api.positions.list(), []);
  const [working, setWorking] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const session = sessionState.data;

  // Mantém o header sincronizado com a sessão que está sendo vista.
  useEffect(() => {
    if (session) select(session);
  }, [session, select]);

  async function runAction(action, successMessage) {
    setWorking(true);
    try {
      sessionState.setData(await action(id));
      toast.success(successMessage);
    } catch (error) {
      toast.error(error.message);
      sessionState.reload();
    } finally {
      setWorking(false);
    }
  }

  const error = sessionState.error ?? positionsState.error;
  if (error?.status === 404) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={Vote}
          title="Sessão não encontrada"
          description="Ela pode ter sido removida ou o endereço está incorreto."
          action={<Button asChild variant="outline"><Link to="/sessoes">Ver todas as eleições</Link></Button>}
        />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState error={error} onRetry={() => { sessionState.reload(); positionsState.reload(); }} />
      </div>
    );
  }
  if (!session || !positionsState.data) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const rules = Object.fromEntries(positionsState.data.map((p) => [p.code, p]));
  const positionLabels = Object.fromEntries(positionsState.data.map((p) => [p.code, p.label]));

  const actions = (
    <>
      <Button asChild variant="outline">
        <Link to={`/candidatos?sessionId=${session.id}`}><Users /> Candidatos</Link>
      </Button>
      <Button type="button" variant="outline" onClick={() => setDuplicating(true)}>
        <CopyPlus /> Duplicar
      </Button>
      {session.status === 'DRAFT' && (
        <>
          <Button asChild variant="outline">
            <Link to={`/sessoes/${session.id}/editar`}><Pencil /> Editar</Link>
          </Button>
          <ConfirmAction
            trigger={<Button disabled={working}><Play /> Abrir votação</Button>}
            title="Abrir a votação?"
            description="A sessão passará a receber votos. Depois disso, nome, ano e cargos não poderão ser alterados."
            confirmLabel="Abrir votação"
            onConfirm={() => runAction(api.sessions.open, 'Votação aberta.')}
          />
        </>
      )}
      {session.status === 'OPEN' && (
        <>
          <Button asChild>
            <a href={`/votar/${session.publicToken}`} target="_blank" rel="noreferrer"><Vote /> Votar</a>
          </Button>
          <ConfirmAction
            trigger={<Button variant="outline" disabled={working}><Square /> Finalizar eleição</Button>}
            title="Finalizar a eleição?"
            description="A sessão deixará de receber votos. Esta ação não pode ser desfeita."
            confirmLabel="Finalizar eleição"
            onConfirm={() => runAction(api.sessions.finish, 'Eleição finalizada.')}
          />
        </>
      )}
      {session.status === 'FINISHED' && (
        <>
          <Button asChild variant="outline">
            <Link to={`/resultados?sessionId=${session.id}`}><BarChart3 /> Resultados</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={`/auditoria?sessionId=${session.id}`}><ShieldCheck /> Auditoria</Link>
          </Button>
        </>
      )}
    </>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={session.name}
        description={`Eleição de ${session.year}`}
        actions={actions}
      >
        <SessionStatusBadge status={session.status} />
      </PageHeader>

      <Alert>
        <AlertDescription>{STATUS_HINT[session.status]}</AlertDescription>
      </Alert>

      {session.status === 'OPEN' && <PublicLinkCard publicToken={session.publicToken} />}

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Cargos" value={formatNumber(session.positionsCount)} />
        <Stat label="Candidatos" value={formatNumber(session.candidatesCount)} />
        <Stat label="Votos" value={formatNumber(session.votesCount)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Cargos em disputa</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {session.positions.map((code) => (
                <li key={code} className="flex justify-between gap-4 py-2 text-sm">
                  <span>{rules[code]?.label ?? code}</span>
                  <span className="text-muted-foreground">{rules[code]?.digits} dígitos</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
          <CardContent>
            <dl className="divide-y">
              <DateRow label="Criada em" value={session.createdAt} />
              <DateRow label="Votação aberta em" value={session.startedAt} />
              <DateRow label="Finalizada em" value={session.finishedAt} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <DuplicateSessionDialog
        session={duplicating ? session : null}
        positionLabels={positionLabels}
        onOpenChange={setDuplicating}
      />
    </div>
  );
}
