import { cn } from '@/lib/utils';

// Mostra o cargo atual e os dígitos digitados, como o visor de uma urna de
// verdade (fundo escuro, dígitos grandes em mono). A prévia do candidato
// (foto, nome, partido) fica no painel lateral — ver CandidatePreviewPanel.
export function BallotCard({ positionLabel, digits, digitsRequired, blank }) {
  const slots = Array.from({ length: digitsRequired }, (_, i) => digits[i] ?? null);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-4 text-center shadow-sm md:gap-6 md:p-6">
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground md:text-sm">
          Você está votando para
        </span>
        <span className="font-heading text-lg font-semibold md:text-2xl">{positionLabel}</span>
      </div>

      {blank ? (
        <div className="flex h-20 w-full items-center justify-center rounded-xl bg-accent-soft px-4 md:h-28">
          <span className="text-base font-semibold text-accent-foreground md:text-xl">Voto em branco</span>
        </div>
      ) : (
        <div className="flex gap-2 rounded-xl bg-sidebar px-4 py-5 shadow-inner md:gap-3 md:px-6 md:py-7">
          {slots.map((digit, index) => (
            <span
              key={index}
              className={cn(
                'flex h-10 w-7 items-center justify-center rounded-md font-mono text-2xl font-semibold tabular-nums transition-colors duration-150 md:h-14 md:w-10 md:text-4xl',
                digit !== null ? 'bg-sidebar-accent text-white' : 'bg-white/5 text-sidebar-foreground/30',
              )}
            >
              {digit ?? ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
