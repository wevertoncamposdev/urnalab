import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Briefcase, CalendarPlus, Copy, CopyPlus, ExternalLink, Info, Pencil, Play, ShieldCheck, Square, Trophy, UserPlus, Users, Vote } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { ConfirmAction } from '@/components/sessions/ConfirmAction';
import { DuplicateSessionDialog } from '@/components/sessions/DuplicateSessionDialog';
import { SessionAuditSection } from '@/components/sessions/SessionAuditSection';
import { SessionCandidatesSection } from '@/components/sessions/SessionCandidatesSection';
import { SessionResultsSection } from '@/components/sessions/SessionResultsSection';
import { SessionStatusBadge } from '@/components/sessions/SessionStatusBadge';
import { useAsync } from '@/hooks/useAsync';
import { useCurrentSession } from '@/hooks/useCurrentSession';
import { formatDateTime, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

const DEFAULT_TAB = 'detalhes';

const STATUS_HINT = {
  DRAFT: 'Esta sessão é uma rascunho. Abra a votação para começar a receber votos.',
  OPEN: 'A votação está aberta. Finalize a eleição para encerrar o recebimento de votos.',
  FINISHED: 'Eleição finalizada. Esta sessão não recebe mais votos.',
};

function Stat({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-lg font-semibold leading-tight tabular-nums">{value}</span>
          <span className="truncate text-xs leading-tight text-muted-foreground">{label}</span>
        </div>
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

// Card compacto, tudo numa linha só: rótulo+ícone, código de acesso clicável (copia),
// campo com a URL completa, e os dois botões de ação — pra não tomar a tela toda só
// com o link (ver People/Candidates para o padrão equivalente de código grande, que
// aqui foi propositalmente encolhido).
function LinkCardRow({ icon: Icon, label, labelClassName, code, url, codeClassName }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn('flex shrink-0 items-center gap-1.5 text-sm font-medium', labelClassName)}>
        <Icon className="size-4" /> {label}
      </span>
      <button
        type="button"
        onClick={() => copyPublicLink(code)}
        className={cn(
          'shrink-0 rounded-md border px-2.5 py-1 font-mono text-base font-bold tracking-widest tabular-nums',
          codeClassName,
        )}
        title="Copiar código"
      >
        {code}
      </button>
      <Input readOnly value={url} onFocus={(e) => e.target.select()} className="h-8 min-w-40 flex-1 font-mono text-xs" />
      <Button type="button" variant="outline" size="icon" className="size-8" onClick={() => copyPublicLink(url)} aria-label="Copiar link" title="Copiar link">
        <Copy className="size-3.5" />
      </Button>
      <Button type="button" variant="outline" size="icon" className="size-8" asChild>
        <a href={url} target="_blank" rel="noreferrer" aria-label="Abrir em nova aba" title="Abrir em nova aba">
          <ExternalLink className="size-3.5" />
        </a>
      </Button>
    </div>
  );
}

// Link público: funciona enquanto a sessão estiver aberta, sem precisar de
// login — dá pra votar direto do celular. Para de funcionar sozinho ao finalizar.
function PublicLinkCard({ publicToken }) {
  const url = `${window.location.origin}/votar/${publicToken}`;
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 p-3">
        <LinkCardRow
          icon={Vote}
          label="Link de votação"
          code={publicToken}
          url={url}
          codeClassName="bg-muted/40"
        />
        <p className="pl-[1.625rem] text-xs text-muted-foreground">
          Sem login, funciona bem pelo celular — para sozinho ao finalizar a eleição.
        </p>
      </CardContent>
    </Card>
  );
}

// Link público de candidatura (Etapa 20): mesmo padrão do link de votação acima,
// mas só funciona enquanto a sessão é rascunho (depois que a votação abre, o
// backend não aceita mais candidatura nova — ver public-candidacy.service.js).
function PublicCandidacyLinkCard({ candidacyToken }) {
  const url = `${window.location.origin}/candidatar/${candidacyToken}`;
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 p-3">
        <LinkCardRow
          icon={UserPlus}
          label="Link de candidatura"
          labelClassName="text-accent"
          code={candidacyToken}
          url={url}
          codeClassName="bg-accent-soft/40 text-accent"
        />
        <p className="pl-[1.625rem] text-xs text-muted-foreground">
          Toda candidatura recebida entra como pendente — aprove ou reprove na aba Candidatos.
        </p>
      </CardContent>
    </Card>
  );
}

export default function SessionDetails() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { select } = useCurrentSession();
  const sessionState = useAsync(() => api.sessions.get(id), [id]);
  const positionsState = useAsync(() => api.positions.list(), []);
  const partiesState = useAsync(() => api.parties.list(), []);
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

  const error = sessionState.error ?? positionsState.error ?? partiesState.error;
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
        <ErrorState error={error} onRetry={() => { sessionState.reload(); positionsState.reload(); partiesState.reload(); }} />
      </div>
    );
  }
  if (!session || !positionsState.data || !partiesState.data) {
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
  const finished = session.status === 'FINISHED';

  const tabs = [
    { value: 'detalhes', label: 'Detalhes', icon: Info },
    { value: 'candidatos', label: 'Candidatos', icon: Users, badge: session.candidatesCount || undefined },
    ...(finished
      ? [
        { value: 'resultados', label: 'Resultados', icon: Trophy },
        { value: 'auditoria', label: 'Auditoria', icon: ShieldCheck },
      ]
      : []),
  ];
  const requestedTab = searchParams.get('tab');
  const activeTab = tabs.some((t) => t.value === requestedTab) ? requestedTab : DEFAULT_TAB;

  function changeTab(value) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === DEFAULT_TAB) next.delete('tab');
        else next.set('tab', value);
        return next;
      },
      { replace: true },
    );
  }

  const actions = (
    <>
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
    </>
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title={session.name}
        description={(
          <>

            <span className="flex items-center gap-1.5 text-sm font-medium text-yellow-700 bg-yellow-50 rounded-full p-2" title={STATUS_HINT[session.status]}
            >
              <Info /> {STATUS_HINT[session.status]}
            </span>
          </>
        )}
        actions={actions}
      >
        <SessionStatusBadge status={session.status} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg px-3.5 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5" title="Criada em">
            <CalendarPlus className="size-3.5" /> Criada em {formatDateTime(session.createdAt)}
          </span>
          {session.startedAt && (
            <span className="flex items-center gap-1.5" title="Votação aberta em">
              <Play className="size-3.5" /> Aberta em {formatDateTime(session.startedAt)}
            </span>
          )}
          {session.finishedAt && (
            <span className="flex items-center gap-1.5" title="Finalizada em">
              <Square className="size-3.5" /> Finalizada em {formatDateTime(session.finishedAt)}
            </span>
          )}
        </div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={changeTab} className="flex flex-col gap-6">
        <TabsList className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {tabs.map(({ value, label, icon, badge }) => (
            <TabsTrigger key={value} value={value} icon={icon} badge={badge}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="detalhes" className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={Briefcase} label="Cargos" value={formatNumber(session.positionsCount)} />
            <Stat icon={Users} label="Candidatos" value={formatNumber(session.candidatesCount)} />
            <Stat icon={Vote} label="Votos" value={formatNumber(session.votesCount)} />
          </div>

          {session.status === 'DRAFT' && <PublicCandidacyLinkCard candidacyToken={session.candidacyToken} />}
          {session.status === 'OPEN' && <PublicLinkCard publicToken={session.publicToken} />}

          <Card>
            <CardContent className="flex flex-wrap items-center gap-2 p-3">
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium">
                <Briefcase className="size-4 text-muted-foreground" /> Cargos em disputa
              </span>
              {session.positions.map((code) => (
                <span key={code} className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium">
                  {rules[code]?.label ?? code}
                  <span className="text-muted-foreground"> · {rules[code]?.digits} díg.</span>
                </span>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="candidatos">
          <SessionCandidatesSection
            session={session}
            parties={partiesState.data}
            positions={positionsState.data}
            onCandidatesChanged={sessionState.reload}
          />
        </TabsContent>

        {finished && (
          <TabsContent value="resultados">
            <SessionResultsSection session={session} />
          </TabsContent>
        )}

        {finished && (
          <TabsContent value="auditoria">
            <SessionAuditSection session={session} positions={positionsState.data} />
          </TabsContent>
        )}
      </Tabs>

      <DuplicateSessionDialog
        session={duplicating ? session : null}
        positionLabels={positionLabels}
        onOpenChange={setDuplicating}
      />
    </div >
  );
}
