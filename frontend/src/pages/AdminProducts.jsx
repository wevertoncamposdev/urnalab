import { useState } from 'react';
import { Heart, Package, Pencil, Receipt, ShoppingCart, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProductFormDialog } from '@/components/admin/ProductFormDialog';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatTile } from '@/components/layout/StatTile';
import { useAsync } from '@/hooks/useAsync';
import { formatCents, formatDateTime, formatNumber } from '@/lib/format';
import { api } from '@/services/api';

const KIND_LABELS = { SESSION_EXPORT: 'Por sessão', EBOOK: 'Por conta' };
const STATUS_BADGE = {
  PENDING: { label: 'Pendente', variant: 'warning' },
  APPROVED: { label: 'Aprovado', variant: 'success' },
  REJECTED: { label: 'Rejeitado', variant: 'danger' },
  REFUNDED: { label: 'Reembolsado', variant: 'accent' },
  CHARGED_BACK: { label: 'Contestado', variant: 'danger' },
};

// Vendas de um produto (Etapa 16.3) — sem nenhum dado de quem comprou (ver
// backend/src/services/product.service.js salesFor), só os pagamentos em si.
function SalesDialog({ productId, onOpenChange }) {
  const salesState = useAsync(() => (productId ? api.admin.products.sales(productId) : Promise.resolve(null)), [productId]);

  return (
    <Dialog open={Boolean(productId)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{salesState.data ? `Vendas: ${salesState.data.product.name}` : 'Vendas'}</DialogTitle>
          <DialogDescription>Todas as cobranças deste produto, de qualquer conta.</DialogDescription>
        </DialogHeader>

        {!salesState.data ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex gap-6 text-sm">
              <span><strong className="font-semibold">{salesState.data.totalSales}</strong> venda(s)</span>
              <span>
                <strong className="font-semibold">{formatCents(salesState.data.totalRevenueCents)}</strong> em receita
              </span>
            </div>
            {salesState.data.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma cobrança ainda.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesState.data.payments.map((payment) => {
                      const badge = STATUS_BADGE[payment.status] ?? { label: payment.status, variant: 'default' };
                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="text-muted-foreground">{formatDateTime(payment.createdAt)}</TableCell>
                          <TableCell>{formatCents(payment.amountCents)}</TableCell>
                          <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Totais do painel financeiro (ver backend/src/services/admin.service.js
// getPaymentsSummary) — receita geral primeiro (produtos + doações somados), depois
// os dois números que a tabela de produtos abaixo não mostra sozinha: vendas de
// produto e doações são contadas separado porque doação não tem Product nenhum por
// trás (ver schema.prisma Donation).
function PaymentsTotals({ totals }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile icon={Wallet} label="Receita total" value={formatCents(totals.overallRevenueCents)} tone="primary" />
      <StatTile
        icon={ShoppingCart}
        label="Vendas de produtos"
        value={`${formatNumber(totals.productsSalesCount)} · ${formatCents(totals.productsRevenueCents)}`}
        tone="accent"
      />
      <StatTile
        icon={Heart}
        label="Doações recebidas"
        value={formatNumber(totals.donationsCount)}
        tone="coral"
      />
      <StatTile
        icon={Receipt}
        label="Receita de doações"
        value={formatCents(totals.donationsRevenueCents)}
        tone="success"
      />
    </div>
  );
}

export default function AdminProducts() {
  const summaryState = useAsync(() => api.admin.paymentsSummary(), []);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [viewingSalesId, setViewingSalesId] = useState(null);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Produtos"
        description="Catálogo de tudo que é vendido pelo sistema — preço, descrição, disponibilidade e vendas."
      >
        <Button type="button" onClick={() => setCreating(true)}>Novo produto</Button>
      </PageHeader>

      {summaryState.error ? (
        <ErrorState error={summaryState.error} onRetry={summaryState.reload} />
      ) : !summaryState.data ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </>
      ) : (
        <>
          <PaymentsTotals totals={summaryState.data.totals} />

          {summaryState.data.products.length === 0 ? (
            <EmptyState icon={Package} title="Nenhum produto cadastrado" />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Vendido</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryState.data.products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-muted-foreground">{KIND_LABELS[product.kind] ?? product.kind}</TableCell>
                      <TableCell>{formatCents(product.priceCents)}</TableCell>
                      <TableCell>
                        <Badge variant={product.active ? 'success' : 'default'}>
                          {product.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(product.totalSales)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCents(product.totalRevenueCents)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setViewingSalesId(product.id)}>
                            <Receipt /> Vendas
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditing(product)}>
                            <Pencil /> Editar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      <ProductFormDialog
        open={creating}
        product={null}
        onOpenChange={setCreating}
        onSaved={summaryState.reload}
      />
      <ProductFormDialog
        open={Boolean(editing)}
        product={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={summaryState.reload}
      />
      <SalesDialog productId={viewingSalesId} onOpenChange={(open) => !open && setViewingSalesId(null)} />
    </div>
  );
}
