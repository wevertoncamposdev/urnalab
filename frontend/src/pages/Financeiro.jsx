import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/layout/ConfirmDialog';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAsync } from '@/hooks/useAsync';
import { formatCents, formatDateTime } from '@/lib/format';
import { api } from '@/services/api';

const STATUS_BADGE = {
  PENDING: { label: 'Pendente', variant: 'warning' },
  APPROVED: { label: 'Aprovado', variant: 'success' },
  REJECTED: { label: 'Rejeitado', variant: 'danger' },
  REFUNDED: { label: 'Reembolsado', variant: 'accent' },
  CHARGED_BACK: { label: 'Contestado', variant: 'danger' },
};

// Histórico de cobranças da conta (Etapa 14) — qualquer sessão, qualquer status.
// Reembolso só fica disponível pra uma cobrança aprovada que ainda não foi baixada
// (ver backend/src/services/payment.service.js refund): depois do primeiro download, a
// trava é do próprio backend, aqui é só UX (o botão nem aparece).
export default function Financeiro() {
  const paymentsState = useAsync(() => api.payments.listMine(), []);
  const [refunding, setRefunding] = useState(null);
  const [submittingRefund, setSubmittingRefund] = useState(false);

  async function confirmRefund() {
    setSubmittingRefund(true);
    try {
      await api.payments.refund(refunding.id);
      toast.success('Reembolso solicitado. O valor volta pela mesma forma de pagamento.');
      setRefunding(null);
      paymentsState.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingRefund(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title="Financeiro" description="Histórico de cobranças da sua conta." />

      {paymentsState.error ? (
        <ErrorState error={paymentsState.error} onRetry={paymentsState.reload} />
      ) : !paymentsState.data ? (
        <Skeleton className="h-64" />
      ) : paymentsState.data.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhuma cobrança ainda"
          description="Cobranças pela exportação de resultados aparecem aqui."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sessão</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Baixado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentsState.data.map((payment) => {
                const badge = STATUS_BADGE[payment.status] ?? { label: payment.status, variant: 'default' };
                const canRefund = payment.status === 'APPROVED' && !payment.downloadedAt;
                return (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {payment.session ? `${payment.session.name} (${payment.session.year})` : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(payment.createdAt)}</TableCell>
                    <TableCell>{formatCents(payment.amountCents)}</TableCell>
                    <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.downloadedAt ? formatDateTime(payment.downloadedAt) : '—'}
                    </TableCell>
                    <TableCell>
                      {canRefund && (
                        <Button size="sm" variant="outline" onClick={() => setRefunding(payment)}>
                          Solicitar reembolso
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(refunding)}
        onOpenChange={(open) => !open && setRefunding(null)}
        title="Solicitar reembolso?"
        description={
          refunding
            ? `O valor de ${formatCents(refunding.amountCents)} volta pela mesma forma de pagamento usada ` +
              `no Mercado Pago, e o PDF dessa sessão deixa de ficar liberado. Só é possível reembolsar antes ` +
              `do primeiro download.`
            : ''
        }
        confirmLabel={submittingRefund ? 'Enviando...' : 'Reembolsar'}
        onConfirm={confirmRefund}
      />
    </div>
  );
}
