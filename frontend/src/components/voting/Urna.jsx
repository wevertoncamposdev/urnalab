import { Frown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CandidateAvatar } from '@/components/candidates/CandidateAvatar';
import { VoteKeypad } from '@/components/voting/VoteKeypad';
import { getCandidatePreviewState } from '@/lib/candidate-preview';
import { cn } from '@/lib/utils';

// Tela da urna (parte de cima do corpo escuro): enquanto o número não fecha,
// mostra os dígitos digitados (igual ao antigo BallotCard, só que numa tela clara
// em vez do visor escuro); assim que fecha, troca pra foto/nome do candidato (ou
// o aviso de nulo) — mesmo veredito que CandidatePreviewPanel mostra no painel
// lateral, só que direto "na tela", como uma urna de verdade.
function UrnaScreen({ positionLabel, digits, digitsRequired, blank, lookup }) {
  const typing = !blank && digits.length < digitsRequired;

  if (typing) {
    const slots = Array.from({ length: digitsRequired }, (_, i) => digits[i] ?? null);
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Você está votando para
          </span>
          <span className="font-heading text-base font-semibold md:text-xl">{positionLabel}</span>
        </div>
        <div className="flex gap-1.5 rounded-lg bg-muted p-2.5 md:gap-2 md:p-3">
          {slots.map((digit, index) => (
            <span
              key={index}
              className={cn(
                'flex h-9 w-6 items-center justify-center rounded-md font-mono text-xl font-semibold tabular-nums transition-colors duration-150 md:h-12 md:w-8 md:text-2xl',
                digit !== null ? 'bg-sidebar text-white' : 'border bg-white text-muted-foreground/30',
              )}
            >
              {digit ?? ''}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const state = getCandidatePreviewState({ blank, lookup });

  if (state.kind === 'blank') {
    return (
      <div className="flex min-h-24 w-full items-center justify-center rounded-lg bg-accent-soft px-4 md:min-h-32">
        <span className="text-base font-semibold text-accent-foreground md:text-lg">Voto em branco</span>
      </div>
    );
  }
  if (state.kind === 'loading') {
    return (
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="size-16 shrink-0 rounded-full md:size-20" />
        <span className="text-xs text-muted-foreground">Consultando...</span>
      </div>
    );
  }
  if (state.kind === 'found') {
    const { candidate } = state;
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <CandidateAvatar name={candidate.name} photo={candidate.photo} className="size-20 text-2xl md:size-24 md:text-3xl" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold md:text-lg">{candidate.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {candidate.party?.acronym} ({candidate.party?.number})
          </p>
        </div>
      </div>
    );
  }
  // not-found / inactive — mesma mensagem de nulo, só muda o motivo.
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Frown className="size-10 shrink-0 text-danger" />
      <div>
        <p className="text-sm font-medium text-danger">
          {state.kind === 'inactive' ? 'Este candidato está inativo' : 'Nenhum candidato com este número'}
        </p>
        <p className="text-xs text-muted-foreground">O voto será contado como nulo.</p>
      </div>
    </div>
  );
}

// Corpo físico da urna (Etapa 17) — reúne visor + teclado + confirma num componente
// só, como o hardware de verdade, em vez de três cartões soltos. `bg-sidebar` é o
// mesmo azul-marinho que o visor antigo (BallotCard) já usava — aqui vira o corpo
// inteiro da urna; VoteKeypad não precisou de nenhum ajuste visual pra sentar em
// cima dele: os botões de dígito (`variant="outline"`, fundo branco) já leem bem
// como teclas físicas claras sobre o corpo escuro.
export function Urna({
  positionLabel,
  digits,
  digitsRequired,
  blank,
  lookup,
  onDigit,
  onClear,
  onBlank,
  onConfirm,
  ready,
  submitting,
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[28px] bg-sidebar p-3 shadow-lg md:gap-4 md:p-4">
      <div className="flex min-h-[170px] items-center justify-center rounded-2xl bg-white p-4 md:min-h-[200px] md:p-6">
        <UrnaScreen positionLabel={positionLabel} digits={digits} digitsRequired={digitsRequired} blank={blank} lookup={lookup} />
      </div>

      <VoteKeypad onDigit={onDigit} onClear={onClear} onBlank={onBlank} disabled={submitting} />

      <Button
        className="h-11 bg-success text-base text-white hover:bg-success/90 md:h-12"
        disabled={!ready || submitting}
        onClick={onConfirm}
      >
        {submitting ? 'Confirmando...' : 'Confirma'}
      </Button>

      <p className="text-center text-xs text-white/50">
        Também dá para digitar no teclado e confirmar com Enter.
      </p>
    </div>
  );
}
