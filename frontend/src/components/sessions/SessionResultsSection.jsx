import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/layout/ConfirmDialog';
import { ErrorState } from '@/components/layout/ErrorState';
import { PositionResult } from '@/components/results/PositionResult';
import { useAsync } from '@/hooks/useAsync';
import { trackEvent } from '@/lib/analytics';
import { saveBlobAsFile } from '@/lib/download';
import { formatCents } from '@/lib/format';
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
      <div className="flex justify-end">
        {paymentState.data && !paymentState.data.paid ? (
          <Button type="button" variant="outline" onClick={() => setShowChargeDialog(true)} disabled={startingCheckout}>
            <Lock />
            {startingCheckout ? 'Abrindo pagamento...' : 'Exportar'}
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={downloadPdf} disabled={downloadingPdf || !paymentState.data}>
            <Download /> {downloadingPdf ? 'Gerando...' : 'Baixar PDF'}
          </Button>
        )}
      </div>

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

      <ConfirmDialog
        open={showChargeDialog}
        onOpenChange={setShowChargeDialog}
        title="Exportar resultado em PDF"
        description={
          paymentState.data ? (
            <>
              Essa sessão ainda não tem a exportação liberada.<br /><br />
              Pra gerar e baixar o relatório
              completo em PDF, é necessário um{' '}
              <strong className="text-foreground">
                pagamento único de {formatCents(paymentState.data.priceCents)}
              </strong>. <br /> <br />
              Depois da confirmação, o PDF fica{' '}
              <strong className="text-foreground">liberado para sempre</strong> nessa sessão e você pode
              baixe quantas vezes quiser. <br /> <br />
              Você será direcionado ao{' '}
              <strong className="text-foreground">Mercado Pago</strong> para concluir o pagamento
              com segurança.
            </>
          ) : ''
        }
        confirmLabel={paymentState.data ? `Pagar ${formatCents(paymentState.data.priceCents)}` : 'Pagar'}
        onConfirm={() => {
          setShowChargeDialog(false);
          startCheckout();
        }}
      />
    </div>
  );
}
