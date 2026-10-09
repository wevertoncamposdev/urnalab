import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/layout/ErrorState';
import { ExportPdfDialog } from '@/components/results/ExportPdfDialog';
import { ExportResultsBanner } from '@/components/results/ExportResultsBanner';
import { PositionResult } from '@/components/results/PositionResult';
import { useAsync } from '@/hooks/useAsync';
import { trackEvent } from '@/lib/analytics';
import { saveBlobAsFile } from '@/lib/download';
import { api } from '@/services/api';

// Apuração da sessão — migrado da antiga página /resultados (removida), agora como
// seção de SessionDetails.jsx; a sessão já é conhecida pela rota, sem seletor próprio.
export function SessionResultsSection({ session }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [creatingRunoff, setCreatingRunoff] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [showChargeDialog, setShowChargeDialog] = useState(false);

  const resultsState = useAsync(() => api.results.get(session.id), [session.id]);
  const paymentState = useAsync(() => api.payments.getStatus(session.id), [session.id]);

  useEffect(() => {
    trackEvent('RESULTS_VIEWED', { sessionId: session.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // Volta do Checkout Pro do Mercado Pago (ver back_urls em mercadopago.service.js).
  // "success" já costuma vir com o pagamento aprovado, mas o webhook pode demorar
  // alguns instantes — recarregar o status cobre os dois casos.
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (!payment) return;

    if (payment === 'success') toast.success('Pagamento aprovado! Liberando o PDF...');
    else if (payment === 'pending') toast.message('Pagamento em processamento. Assim que for aprovado, o PDF libera.');
    else if (payment === 'failure') toast.error('Pagamento não aprovado. Tente novamente.');

    paymentState.reload();
    navigate(`/sessoes/${session.id}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createRunoffSession() {
    setCreatingRunoff(true);
    try {
      const runoffSession = await api.results.createRunoffSession(session.id);
      toast.success('Sessão de 2º turno criada.');
      navigate(`/sessoes/${runoffSession.id}`);
    } catch (err) {
      toast.error(err.message);
      setCreatingRunoff(false);
    }
  }

  async function downloadPdf() {
    setDownloadingPdf(true);
    try {
      const { blob, fileName } = await api.results.downloadPdf(session.id);
      saveBlobAsFile(blob, fileName);
      trackEvent('RESULTS_PDF_DOWNLOADED', { sessionId: session.id });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloadingPdf(false);
    }
  }

  // Redireciona pro Checkout Pro do Mercado Pago — a volta já cai em /sessoes/:id
  // com ?payment=success|pending|failure (ver mercadopago.service.js back_urls).
  async function startCheckout() {
    setStartingCheckout(true);
    try {
      const { checkoutUrl } = await api.payments.createCheckout(session.id);
      window.location.href = checkoutUrl;
    } catch (err) {
      toast.error(err.message);
      setStartingCheckout(false);
    }
  }

  const runoffPositions = resultsState.data?.positions.filter((p) => p.runoff) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <ExportResultsBanner
        loading={paymentState.loading}
        paid={Boolean(paymentState.data?.paid)}
        priceCents={paymentState.data?.priceCents}
        onExport={() => setShowChargeDialog(true)}
        onDownload={downloadPdf}
        startingCheckout={startingCheckout}
        downloadingPdf={downloadingPdf}
      />

      {resultsState.error ? (
        <ErrorState error={resultsState.error} onRetry={resultsState.reload} />
      ) : !resultsState.data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          {runoffPositions.length > 0 && (
            <Alert>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {runoffPositions.length === 1
                    ? `${runoffPositions[0].label} vai para o 2º turno.`
                    : `${runoffPositions.length} cargos vão para o 2º turno.`}
                </span>
                <Button size="sm" onClick={createRunoffSession} disabled={creatingRunoff}>
                  {creatingRunoff ? 'Criando...' : 'Criar sessão de 2º turno'}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {resultsState.data.positions.map((position) => (
            <PositionResult key={position.code} result={position} />
          ))}
        </>
      )}

      <ExportPdfDialog
        open={showChargeDialog}
        onOpenChange={setShowChargeDialog}
        results={resultsState.data}
        priceCents={paymentState.data?.priceCents}
        startingCheckout={startingCheckout}
        onConfirm={startCheckout}
      />
    </div>
  );
}
