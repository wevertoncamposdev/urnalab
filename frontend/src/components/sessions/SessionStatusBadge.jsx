import { Badge } from '@/components/ui/badge';

// Termos pensados em etapas didáticas (Candidatura → Votação → Encerrada) — não
// nos nomes técnicos DRAFT/OPEN/FINISHED, que continuam só no backend (ver
// SessionStageControl.jsx, que usa os mesmos três termos no stepper de etapas).
const STATUS_META = {
  DRAFT: { label: 'Candidatura', variant: 'default' },
  OPEN: { label: 'Votação', variant: 'success' },
  FINISHED: { label: 'Encerrada', variant: 'dark' },
};

export function SessionStatusBadge({ status }) {
  const meta = STATUS_META[status] ?? { label: status, variant: 'default' };
  return (
    <Badge variant={meta.variant}>
      {status === 'OPEN' && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {meta.label}
    </Badge>
  );
}
