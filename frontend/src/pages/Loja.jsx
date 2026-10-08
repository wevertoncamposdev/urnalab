import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Download, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/layout/ConfirmDialog';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAsync } from '@/hooks/useAsync';
import { formatCents } from '@/lib/format';
import { saveBlobAsFile } from '@/lib/download';
import { api } from '@/services/api';

// Loja de materiais didáticos (Etapa 15.3) — produtos "por conta" (hoje só ebooks),
// comprados fora do contexto de uma sessão específica. A exportação de PDF por sessão
// continua só na tela de Resultados (mesmo motor de pagamento por dentro, ver
// backend/src/services/payment.service.js).
export default function Loja() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productsState = useAsync(() => api.products.list(), []);
  const ebooks = (productsState.data ?? []).filter((p) => p.kind === 'EBOOK');

  const statusState = useAsync(async () => {
    if (ebooks.length === 0) return {};
    const entries = await Promise.all(
      ebooks.map(async (product) => [product.id, await api.products.getStatus(product.id)]),
    );
    return Object.fromEntries(entries);
  }, [ebooks.map((p) => p.id).join(',')]);

  const [buying, setBuying] = useState(null);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    const payment = searchParams.get('payment');
    if (!payment) return;

    if (payment === 'success') toast.success('Pagamento aprovado! Liberando o material...');
    else if (payment === 'pending') toast.message('Pagamento em processamento. Assim que for aprovado, o material libera.');
    else if (payment === 'failure') toast.error('Pagamento não aprovado. Tente novamente.');

    statusState.reload();
    navigate('/loja', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCheckout() {
    setStartingCheckout(true);
    try {
      const { checkoutUrl } = await api.products.createCheckout(buying.id);
      window.location.href = checkoutUrl;
    } catch (err) {
      toast.error(err.message);
      setStartingCheckout(false);
    }
  }

  async function downloadProduct(product) {
    setDownloadingId(product.id);
    try {
      const { blob, fileName } = await api.products.download(product.id);
      saveBlobAsFile(blob, fileName);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloadingId(null);
    }
  }

  if (productsState.error) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState error={productsState.error} onRetry={productsState.reload} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Loja" description="Materiais didáticos pra usar em sala com o UrnaLab." />

      {!productsState.data ? (
        <Skeleton className="h-48" />
      ) : ebooks.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nenhum material disponível ainda" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {ebooks.map((product) => {
            const status = statusState.data?.[product.id];
            const paid = status?.paid;
            return (
              <Card key={product.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{formatCents(product.priceCents)}</span>
                    {paid ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadProduct(product)}
                        disabled={downloadingId === product.id}
                      >
                        <Download /> {downloadingId === product.id ? 'Baixando...' : 'Baixar'}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setBuying(product)} disabled={!status}>
                        <Lock /> Comprar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(buying)}
        onOpenChange={(open) => !open && setBuying(null)}
        title={buying ? buying.name : ''}
        description={
          buying
            ? `Ao confirmar, você será redirecionado ao Mercado Pago pra pagar ${formatCents(buying.priceCents)} — ` +
              `um pagamento único que libera o download desse material pra sempre, quantas vezes quiser.`
            : ''
        }
        confirmLabel={startingCheckout ? 'Abrindo pagamento...' : `Pagar ${buying ? formatCents(buying.priceCents) : ''}`}
        onConfirm={() => {
          setBuying(null);
          startCheckout();
        }}
      />
    </div>
  );
}
