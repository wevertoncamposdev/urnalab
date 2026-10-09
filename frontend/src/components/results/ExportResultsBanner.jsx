import { CheckCircle2, Download, FileText, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCents } from '@/lib/format';

// Chamada pra exportação em PDF — fica no topo da aba Resultados, a primeira coisa
// que a pessoa vê ao abrir a apuração, em vez de um botão pequeno no canto fácil de
// passar batido. Muda de cara conforme o pagamento: antes de pagar, vende o
// benefício (o que ganha, preço, "pra sempre"); depois, só confirma que já está
// liberado e deixa baixar de novo.
export function ExportResultsBanner({ loading, paid, priceCents, onExport, onDownload, startingCheckout, downloadingPdf }) {
  if (loading) return <Skeleton className="h-[88px] rounded-2xl" />;

  if (paid) {
    return (
      <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-success/25 bg-success-soft p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success text-white">
            <CheckCircle2 className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">PDF liberado para esta sessão</p>
            <p className="text-xs text-muted-foreground">Baixe quantas vezes quiser, pra sempre.</p>
          </div>
        </div>
        <Button type="button" onClick={onDownload} disabled={downloadingPdf} className="gap-2">
          <Download className="size-4" /> {downloadingPdf ? 'Gerando...' : 'Baixar PDF'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4 overflow-hidden rounded-2xl border border-coral/25 bg-gradient-to-br from-coral-soft via-coral-soft to-accent-soft p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-coral text-white shadow-sm">
          <FileText className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold leading-tight">Leve esse resultado pra fora da tela</h3>
            <Badge variant="warning" className="gap-1">
              <Sparkles className="size-3" /> Mais pedido
            </Badge>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            Baixe um PDF completo da apuração — pronto pra imprimir, colar no mural da escola ou
            mandar pra direção.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
        <Button
          type="button"
          size="lg"
          onClick={onExport}
          disabled={startingCheckout}
          className="gap-2 whitespace-nowrap bg-coral text-white shadow-lg shadow-coral/30 hover:bg-coral/90"
        >
          {startingCheckout ? 'Abrindo pagamento...' : `Exportar em PDF · ${formatCents(priceCents)}`}
        </Button>
        <span className="text-xs text-muted-foreground">Pagamento único · liberado pra sempre</span>
      </div>
    </div>
  );
}
