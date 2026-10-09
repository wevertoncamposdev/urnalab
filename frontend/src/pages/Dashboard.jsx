import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Play,
  Plus,
  Search,
  Users,
  Vote,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatTile } from '@/components/layout/StatTile';
import { SessionCard } from '@/components/sessions/SessionCard';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { formatNumber } from '@/lib/format';
import { api } from '@/services/api';

const PAGE_SIZE = 8;

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Todas as sessões' },
  { value: 'DRAFT', label: 'Candidatura' },
  { value: 'OPEN', label: 'Votação' },
  { value: 'FINISHED', label: 'Encerrada' },
];

function Stats({ sessions }) {
  const sum = (key) => sessions.reduce((total, session) => total + session[key], 0);
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile icon={ClipboardList} label="Sessões" value={formatNumber(sessions.length)} tone="primary" />
      <StatTile
        icon={Play}
        label="Em votação"
        value={formatNumber(sessions.filter((s) => s.status === 'OPEN').length)}
        tone="success"
      />
      <StatTile icon={Users} label="Candidatos" value={formatNumber(sum('candidatesCount'))} tone="accent" />
      <StatTile icon={Vote} label="Votos registrados" value={formatNumber(sum('votesCount'))} tone="coral" />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => <Skeleton key={i} className="h-40" />)}
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        Página {page} de {totalPages}
      </span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Página anterior"
          title="Página anterior"
        >
          <ChevronLeft />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Próxima página"
          title="Próxima página"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: sessions, error, loading, reload } = useAsync(() => api.sessions.list(), []);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);

  const filtered = useMemo(() => {
    if (!sessions) return [];
    const term = debouncedSearch.trim().toLowerCase();
    return sessions
      .filter((s) => status === 'ALL' || s.status === status)
      .filter((s) => !term || s.name.toLowerCase().includes(term) || String(s.year).includes(term))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [sessions, debouncedSearch, status]);

  const totalPages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const pageSessions = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateSearch(value) {
    setSearch(value);
    setPage(1);
  }

  function updateStatus(value) {
    setStatus(value);
    setPage(1);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Visão geral do simulador."
        actions={
          <Button asChild>
            <Link to="/sessoes/assistente"><Plus /> Criar sessão</Link>
          </Button>
        }
      />

      {loading && !sessions ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <Stats sessions={sessions} />

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 basis-56">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nome ou ano"
                  aria-label="Buscar sessões"
                  value={search}
                  onChange={(e) => updateSearch(e.target.value)}
                />
              </div>
              <Select value={status} onValueChange={updateStatus}>
                <SelectTrigger className="w-44" aria-label="Filtrar por status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sessions.length === 0 ? (
              <EmptyState
                icon={Vote}
                title="Nenhuma sessão eleitoral ainda"
                description="Criar sessão cadastra o nome, os cargos e os partidos em poucos passos."
                action={
                  <Button asChild>
                    <Link to="/sessoes/assistente"><Wand2 /> Criar sessão</Link>
                  </Button>
                }
              />
            ) : filtered.length === 0 ? (
              <EmptyState icon={Search} title="Nenhuma sessão encontrada" description="Ajuste a busca ou o filtro." />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {pageSessions.map((session) => (
                    <SessionCard key={session.id} session={session} />
                  ))}
                </div>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
