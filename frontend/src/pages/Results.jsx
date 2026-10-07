import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Lock, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { PositionResult } from '@/components/results/PositionResult';
import { SessionStatusBadge } from '@/components/sessions/SessionStatusBadge';
import { useAsync } from '@/hooks/useAsync';
import { trackEvent } from '@/lib/analytics';
import { saveBlobAsFile } from '@/lib/download';
import { api } from '@/services/api';

const centsToBRL = (cents) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Apuração por sessão: só sessões finalizadas entram na lista, como numa eleição real.
export default function Results() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionsState = useAsync(() => api.sessions.list(), []);
  const [sessionId, setSessionId] = useState(searchParams.get('sessionId') ?? '');
  const [creatingRunoff, setCreatingRunoff] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);

  const finishedSessions = (sessionsState.data ?? []).filter((s) => s.status === 'FINISHED');
  const session = finishedSessions.find((s) => s.id === sessionId) ?? finishedSessions[0] ?? null;

  const resultsState = useAsync(
    () => (session ? api.results.get(session.id) : Promise.resolve(null)),
    [session?.id],
  );

  const paymentState = useAsync(
    () => (session ? api.payments.getStatus(session.id) : Promise.resolve(null)),
    [session?.id],
  );

  useEffect(() => {
    if (session) trackEvent('RESULTS_VIEWED', { sessionId: session.id });
  }, [session?.id]);

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
    navigate(`/resultados${sessionId ? `?sessionId=${sessionId}` : ''}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (sessionsState.error) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState error={sessionsState.error} onRetry={sessionsState.reload} />
      </div>
    );
  }
  if (!sessionsState.data) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!session) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={Trophy}
          title="Nenhuma eleição finalizada"
          description="Os resultados ficam disponíveis depois que uma sessão é finalizada."
          action={<Button asChild><Link to="/sessoes">Ver eleições</Link></Button>}
        />
      </div>
    );
  }

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

  // Redireciona pro Checkout Pro do Mercado Pago — a volta já cai em /resultados
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

  const sessionPicker = finishedSessions.length > 1 && (
    <Select value={session.id} onValueChange={setSessionId}>
      <SelectTrigger aria-label="Sessão" className="w-56"><SelectValue /></SelectTrigger>
      <SelectContent>
        {finishedSessions.map((s) => (
          <SelectItem key={s.id} value={s.id}>{s.name} ({s.year})</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const runoffPositions = resultsState.data?.positions.filter((p) => p.runoff) ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Resultados"
        description={`${session.name} (${session.year})`}
        actions={
          <>
            {sessionPicker}
            {paymentState.data && !paymentState.data.paid ? (
              <Button type="button" variant="outline" onClick={startCheckout} disabled={startingCheckout}>
                <Lock />
                {startingCheckout
                  ? 'Abrindo pagamento...'
                  : `Pagar ${centsToBRL(paymentState.data.priceCents)} e baixar PDF`}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={downloadPdf}
                disabled={downloadingPdf || !paymentState.data}
              >
                <Download /> {downloadingPdf ? 'Gerando...' : 'Baixar PDF'}
              </Button>
            )}
          </>
        }
      >
        <SessionStatusBadge status={session.status} />
      </PageHeader>

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
    </div>
  );
}
