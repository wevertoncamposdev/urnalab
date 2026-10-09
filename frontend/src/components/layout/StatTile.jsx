import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const TONE_CLASSES = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success-soft text-success',
  accent: 'bg-accent-soft text-accent',
  coral: 'bg-coral-soft text-coral',
};

// Número grande e colorido + ícone, com o rótulo em caixa alta e pequeno acima do
// valor — mantém o visual "limpo" (ícone + número em destaque) mas sem depender só
// de tooltip/sr-only pra dizer o que é cada card (ver Dashboard.jsx e
// SessionDetails.jsx, aba Detalhes).
export function StatTile({ icon: Icon, label, value, tone = 'primary', className }) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl', TONE_CLASSES[tone])}>
          <Icon className="size-6" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <span className="text-3xl font-bold leading-none tabular-nums">{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}
