import { useState } from 'react';
import { Building2, ClipboardList, ShieldAlert, Users, Vote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAsync } from '@/hooks/useAsync';
import { formatDateTime, formatNumber } from '@/lib/format';
import { api } from '@/services/api';

const PAGE_SIZE = 20;

function Stat({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Icon className="size-5" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewSection() {
  const { data, error, loading, reload } = useAsync(() => api.admin.overview(), []);

  if (loading && !data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={Users} label="Usuários cadastrados" value={formatNumber(data.totalUsers)} />
        <Stat icon={Building2} label="Instituições com perfil" value={formatNumber(data.totalInstitutions)} />
        <Stat icon={ClipboardList} label="Sessões criadas" value={formatNumber(data.totalSessions)} />
        <Stat icon={Vote} label="Votos registrados" value={formatNumber(data.totalVotes)} />
      </div>
      <p className="text-sm text-muted-foreground">
        {formatNumber(data.newUsersLast7Days)} cadastro(s) novo(s) nos últimos 7 dias ·{' '}
        {formatNumber(data.newUsersLast30Days)} nos últimos 30 dias.
      </p>
    </div>
  );
}

// E-mail já chega mascarado do backend (ver admin.service.js, maskEmail) — minimização
// de dados: o suficiente pra identificar/contar uma conta, nunca o contato completo.
function UsersSection() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsync(
    () => api.admin.users({ page, pageSize: PAGE_SIZE }),
    [page],
  );
  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Usuários cadastrados</h2>

      {loading && !data ? (
        <Skeleton className="h-64" />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data.users.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum usuário cadastrado" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Instituição</TableHead>
                <TableHead>Sessões</TableHead>
                <TableHead>Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {user.institutionName ?? <Badge variant="warning">Pendente</Badge>}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatNumber(user.sessionsCount)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(user.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {data.page} de {totalPages} · {formatNumber(data.total)} usuário(s)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function Admin() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Área de Gerenciamento"
        description="Métricas de uso e contas cadastradas — visível só para a administração do sistema."
      >
        <Badge variant="dark"><ShieldAlert className="size-3" /> Restrito</Badge>
      </PageHeader>

      <OverviewSection />
      <UsersSection />
    </div>
  );
}
