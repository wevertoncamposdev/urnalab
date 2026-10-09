import { CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCents, formatNumber } from '@/lib/format';

const BENEFITS = [
  'Apuração completa de todos os cargos da sessão, já formatada',
  'Pronto pra imprimir, colar no mural ou enviar pra direção da escola',
  'Liberado pra sempre nesta sessão — baixe de novo quando quiser, sem pagar outra vez',
];

// Aproximação do nome que o PDF de verdade recebe (ver backend/results-report.service.js
// `apuracao-<slug>-<ano>.pdf`) — só pra dar uma prévia visual no diálogo, não precisa
// bater byte a byte com o slug real do backend.
function previewFileName(session) {
  const slug = session.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `apuracao-${slug}-${session.year}.pdf`;
}

// Diálogo de compra da exportação em PDF — além de confirmar a cobrança, mostra o
// que a sessão específica vai render (cargos/candidatos/votos) e reforça os pontos
// que tiram a objeção mais comum ("vou pagar de novo?"/"é seguro?") antes de mandar
// pro Checkout Pro do Mercado Pago.
export function ExportPdfDialog({ open, onOpenChange, results, priceCents, startingCheckout, onConfirm }) {
  const positionsCount = results?.positions.length ?? 0;
  const candidatesCount = results?.positions.reduce((sum, p) => sum + p.candidates.length, 0) ?? 0;
  const totalVotes = results?.positions.reduce((sum, p) => sum + p.totals.totalVotes, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-coral text-white shadow-sm">
              <FileText className="size-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle>Exportar resultado em PDF</DialogTitle>
              {results && (
                <DialogDescription className="truncate">{previewFileName(results.session)}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {results && (
          <div className="grid grid-cols-3 divide-x rounded-xl border bg-muted/30 py-3 text-center">
            <div>
              <p className="text-lg font-bold tabular-nums">{positionsCount}</p>
              <p className="text-[11px] text-muted-foreground">cargo{positionsCount === 1 ? '' : 's'}</p>
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums">{candidatesCount}</p>
              <p className="text-[11px] text-muted-foreground">candidatos</p>
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums">{formatNumber(totalVotes)}</p>
              <p className="text-[11px] text-muted-foreground">votos</p>
            </div>
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between rounded-xl border bg-card p-3">
          <div>
            <p className="text-xs text-muted-foreground">Pagamento único</p>
            <p className="text-2xl font-bold leading-tight">{priceCents != null ? formatCents(priceCents) : '—'}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0" /> Via Mercado Pago
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            type="button"
            size="lg"
            onClick={onConfirm}
            disabled={startingCheckout || priceCents == null}
            className="gap-2 bg-coral text-white shadow-lg shadow-coral/30 hover:bg-coral/90"
          >
            {startingCheckout ? 'Abrindo pagamento...' : `Pagar ${priceCents != null ? formatCents(priceCents) : ''} e gerar o PDF`}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
