import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAsync } from '@/hooks/useAsync';
import { formatDateTime, formatNumber } from '@/lib/format';
import { api } from '@/services/api';

const TYPE_LABELS = { SUGGESTION: 'Sugestão', PROBLEM: 'Problema/Erro', QUESTION: 'Dúvida', OTHER: 'Outro' };
const STATUS_LABELS = { NEW: 'Novo', IN_REVIEW: 'Em análise', RESOLVED: 'Resolvido', IGNORED: 'Ignorado' };
const PAGE_SIZE = 20;

export default function AdminFeedback() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const { data, error, loading, reload, setData } = useAsync(
    () => api.admin.feedback.list({
      page,
      pageSize: PAGE_SIZE,
      type: type === 'ALL' ? undefined : type,
      status: status === 'ALL' ? undefined : status,
    }),
    [page, type, status],
  );

  async function changeStatus(id, nextStatus) {
    const updated = await api.admin.feedback.updateStatus(id, nextStatus);
    setData({
      ...data,
      feedbacks: data.feedbacks.map((item) => (item.id === id ? { ...item, status: updated.status } : item)),
    });
  }

  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader title="Feedback" description="O que as pessoas estão dizendo sobre o UrnaLab." />

      <div className="flex flex-wrap gap-3">
        <Select value={type} onValueChange={(value) => changeFilter(setType, value)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os tipos</SelectItem>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => changeFilter(setStatus, value)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && !data ? (
        <Skeleton className="h-64" />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data.feedbacks.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Nenhum feedback com esse filtro" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Avaliação</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.feedbacks.map((item) => (
                <TableRow key={item.id}>
                  <TableCell><Badge>{TYPE_LABELS[item.type] ?? item.type}</Badge></TableCell>
                  <TableCell>{item.rating ? `${item.rating} ★` : '—'}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground" title={item.message ?? ''}>
                    {item.message ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.authorName ?? 'Anônimo'}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(item.createdAt)}</TableCell>
                  <TableCell>
                    <Select value={item.status} onValueChange={(value) => changeStatus(item.id, value)}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Página {data.page} de {totalPages} · {formatNumber(data.total)} registro(s)</span>
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
    </div>
  );
}
