import { Activity, Briefcase, ClipboardList, Cpu, Database, HardDrive, RefreshCw, Server, Users, Vote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatTile } from '@/components/layout/StatTile';
import { useAsync } from '@/hooks/useAsync';
import { formatBytes, formatDuration, formatNumber } from '@/lib/format';
import { api } from '@/services/api';

function StatusRow({ icon: Icon, label, ok, detail }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-3">
        <Icon className="size-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      <Badge variant={ok ? 'success' : 'danger'}>{ok ? 'Funcionando' : 'Indisponível'}</Badge>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-3">
        <Icon className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium">{label}</p>
      </div>
      <span className="text-sm text-muted-foreground tabular-nums">{value}</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

// Aba Sistema da Área de Gerenciamento (Etapa 24) — o que antes era <SystemStatus />
// solto no painel comum (sem sentido pra quem só usa o simulador) virou aqui, ao
// lado de métricas que só fazem sentido pra quem administra: memória/uptime do
// processo e totais cross-tenant (ver GET /api/admin/system, admin.service.js).
export default function AdminSystem() {
  const { data, error, loading, reload } = useAsync(() => api.admin.system(), []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Sistema"
        description="Estado da aplicação e números gerais da base."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} /> Atualizar
          </Button>
        }
      />

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile icon={Users} label="Usuários" value={formatNumber(data.totals.totalUsers)} tone="primary" />
            <StatTile icon={ClipboardList} label="Sessões" value={formatNumber(data.totals.totalSessions)} tone="accent" />
            <StatTile icon={Vote} label="Votos" value={formatNumber(data.totals.totalVotes)} tone="coral" />
            <StatTile icon={Briefcase} label="Candidaturas" value={formatNumber(data.totals.totalCandidates)} tone="success" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Estado do sistema</CardTitle>
                <CardDescription>Verificação da API e do banco de dados.</CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                <StatusRow
                  icon={Server}
                  label="API (backend)"
                  ok={data.health.status === 'ok'}
                  detail={`No ar há ${formatDuration(data.health.uptimeSeconds)}`}
                />
                <StatusRow
                  icon={Database}
                  label="Banco de dados (PostgreSQL)"
                  ok={data.health.storage.ok}
                  detail={data.health.storage.ok ? 'Leitura e gravação pelo repository' : data.health.storage.message}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Processo</CardTitle>
                <CardDescription>Node.js {data.process.nodeVersion}</CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                <InfoRow icon={Activity} label="Tempo ativo" value={formatDuration(data.process.uptimeSeconds)} />
                <InfoRow icon={Cpu} label="Memória em uso (heap)" value={formatBytes(data.process.memory.heapUsedBytes)} />
                <InfoRow icon={HardDrive} label="Memória total (RSS)" value={formatBytes(data.process.memory.rssBytes)} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
