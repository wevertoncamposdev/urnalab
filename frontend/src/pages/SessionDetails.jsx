import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, CalendarPlus, Copy, CopyPlus, ExternalLink, Info, Pencil, Play, ShieldCheck, Square, Trophy, UserPlus, Users, Vote } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatTile } from '@/components/layout/StatTile';
import { DuplicateSessionDialog } from '@/components/sessions/DuplicateSessionDialog';
import { SessionAuditSection } from '@/components/sessions/SessionAuditSection';
import { SessionCandidatesSection } from '@/components/sessions/SessionCandidatesSection';
import { SessionResultsSection } from '@/components/sessions/SessionResultsSection';
import { SessionStageControl } from '@/components/sessions/SessionStageControl';
import { useAsync } from '@/hooks/useAsync';
import { useCurrentSession } from '@/hooks/useCurrentSession';
import { formatDateTime, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

const DEFAULT_TAB = 'detalhes';

// Ações disparadas pelo stepper de etapas (ver SessionStageControl.jsx) — o
// nome da transição vem de lá, só o `api.sessions.*` certo é resolvido aqui.
const STAGE_ACTIONS = {
  open: api.sessions.open,
  reopen: api.sessions.reopen,
  finish: api.sessions.finish,
  resume: api.sessions.resume,
};

async function copyPublicLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copiado.');
  } catch {
    toast.error('Não foi possível copiar. Copie o link manualmente.');
  }
}

// Código em destaque (fonte grande) numa linha própria, com o endereço completo e
// as ações de cópia/abrir logo abaixo — versão mais visual do que o card de uma
// linha só que existia antes (ver People/Candidates para o padrão equivalente).
function LinkCardRow({ icon: Icon, label, labelClassName, code, url, codeClassName }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={cn('flex items-center gap-2 text-sm font-semibold', labelClassName)}>
          <Icon className="size-4" /> {label}
        </span>
        <button
          type="button"
          onClick={() => copyPublicLink(code)}
          className={cn(
            'rounded-lg border px-4 py-1.5 font-mono text-xl font-bold tracking-[0.2em] tabular-nums',
            codeClassName,
          )}
          title="Copiar código"
        >
          {code}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Input readOnly value={url} onFocus={(e) => e.target.select()} className="h-9 flex-1 font-mono text-xs" />
        <Button type="button" variant="outline" size="icon" onClick={() => copyPublicLink(url)} aria-label="Copiar link" title="Copiar link">
          <Copy className="size-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" asChild>
          <a href={url} target="_blank" rel="noreferrer" aria-label="Abrir em nova aba" title="Abrir em nova aba">
            <ExternalLink className="size-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}

// Link público: funciona enquanto a sessão estiver aberta, sem precisar de
// login — dá pra votar direto do celular. Para de funcionar sozinho ao finalizar.
function PublicLinkCard({ publicToken }) {
  const url = `${window.location.origin}/votar/${publicToken}`;
  return (
    <Card>
      <CardContent className="p-5">
        <LinkCardRow
          icon={Vote}
          label="Link de votação"
          code={publicToken}
          url={url}
          codeClassName="bg-muted/40"
        />
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
      <CardContent className="flex flex-col gap-2 p-5">
        <LinkCardRow
          icon={UserPlus}
          label="Link de candidatura"
          labelClassName="text-accent"
          code={candidacyToken}
          url={url}
          codeClassName="bg-accent-soft/40 text-accent"
        />
        <p className="text-xs text-muted-foreground">
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
  const hasPublicLink = session.status === 'DRAFT' || session.status === 'OPEN';

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

  function handleStageAction(action, successMessage) {
    runAction(STAGE_ACTIONS[action], successMessage);
  }

  const actions = (
    <>
      <Button asChild variant="outline">
        <Link to="/sessoes"><ArrowLeft /> Voltar</Link>
      </Button>
      <Button type="button" variant="outline" onClick={() => setDuplicating(true)}>
        <CopyPlus /> Duplicar
      </Button>
      {session.status === 'DRAFT' && (
        <Button asChild variant="outline">
          <Link to={`/sessoes/${session.id}/editar`}><Pencil /> Editar</Link>
        </Button>
      )}
      {session.status === 'OPEN' && (
        <Button asChild>
          <a href={`/votar/${session.publicToken}`} target="_blank" rel="noreferrer"><Vote /> Votar</a>
        </Button>
      )}
    </>
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title={session.name}
        description={(
          <span className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5" title="Criada em">
              <CalendarPlus className="size-3.5" /> Criada em {formatDateTime(session.createdAt)}
            </span>
            {session.startedAt && (
              <span className="flex items-center gap-1.5" title="Votação iniciada em">
                <Play className="size-3.5" /> Votação iniciada em {formatDateTime(session.startedAt)}
              </span>
            )}
            {session.finishedAt && (
              <span className="flex items-center gap-1.5" title="Encerrada em">
                <Square className="size-3.5" /> Encerrada em {formatDateTime(session.finishedAt)}
              </span>
            )}
          </span>
        )}
        actions={actions}
      />

      <SessionStageControl session={session} working={working} onAction={handleStageAction} />

      <Tabs value={activeTab} onValueChange={changeTab} className="flex flex-col gap-6">
        <TabsList className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {tabs.map(({ value, label, icon, badge }) => (
            <TabsTrigger key={value} value={value} icon={icon} badge={badge}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="detalhes" className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            <StatTile icon={Briefcase} label="Cargos" value={formatNumber(session.positionsCount)} tone="primary" />
            <StatTile icon={Users} label="Candidatos" value={formatNumber(session.candidatesCount)} tone="accent" />
            <StatTile icon={Vote} label="Votos" value={formatNumber(session.votesCount)} tone="coral" />
          </div>
          <div className="grid gap-4 lg:grid-cols-5">
            {hasPublicLink && (
              <div className="lg:col-span-3">
                {session.status === 'DRAFT' && <PublicCandidacyLinkCard candidacyToken={session.candidacyToken} />}
                {session.status === 'OPEN' && <PublicLinkCard publicToken={session.publicToken} />}
              </div>
            )}

            <Card className={hasPublicLink ? 'lg:col-span-2' : 'lg:col-span-5'}>
              <CardContent className="p-0">
                <div className="flex items-center gap-1.5 border-b px-4 py-3 text-sm font-semibold">
                  <Briefcase className="size-4 text-muted-foreground" /> Cargos em disputa
                </div>
                <ul className="divide-y">
                  {session.positions.map((code) => (
                    <li key={code} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="font-medium">{rules[code]?.label ?? code}</span>
                      <span className="text-xs text-muted-foreground">{rules[code]?.digits} dígitos</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
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
