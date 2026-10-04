import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsync } from '@/hooks/useAsync';
import { formatNumber } from '@/lib/format';
import { api } from '@/services/api';

const STEP_LABELS = {
  SESSION_CREATED: 'Sessão criada',
  CANDIDATE_REGISTERED: 'Candidato cadastrado',
  VOTING_STARTED: 'Votação iniciada',
  VOTING_COMPLETED: 'Votação concluída',
  RESULTS_VIEWED: 'Resultado acessado',
};

// Queda = quantos visitantes da etapa anterior não chegaram nesta — nenhum evento
// de "abandono" próprio, só a diferença entre etapas consecutivas (ver admin.service.js).
function Funnel({ steps }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        {steps.map((step, index) => {
          const previous = steps[index - 1];
          const dropoff = previous && previous.visitors > 0
            ? Math.round(((previous.visitors - step.visitors) / previous.visitors) * 100)
            : null;
          return (
            <div key={step.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                {index > 0 && <ArrowRight className="size-3.5 text-muted-foreground" />}
                {STEP_LABELS[step.name] ?? step.name}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">{formatNumber(step.visitors)}</span>
                {dropoff !== null && dropoff > 0 && (
                  <span className="text-xs text-muted-foreground">(-{dropoff}%)</span>
                )}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RankingTable({ title, rows, labelKey }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
      ) : (
        <Card>
          <Table>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row[labelKey] ?? 'direto'}>
                  <TableCell className="font-medium">{row[labelKey] || '(direto)'}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(row.count)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

export default function AdminAnalytics() {
  const { data, error, loading, reload } = useAsync(() => api.admin.analytics.funnel(), []);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Analytics"
        description="Funil de uso, páginas mais acessadas e origem dos visitantes — sem nenhum dado pessoal."
      />

      {loading && !data ? (
        <Skeleton className="h-80" />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <Funnel steps={data.steps} />
          <div className="grid gap-6 md:grid-cols-2">
            <RankingTable title="Páginas mais acessadas" rows={data.topPaths} labelKey="path" />
            <RankingTable title="Origem dos visitantes" rows={data.topReferrers} labelKey="referrer" />
          </div>
        </>
      )}
    </div>
  );
}
