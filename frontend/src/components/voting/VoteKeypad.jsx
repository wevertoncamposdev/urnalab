import { Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DIGIT_ROWS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];

// Teclado numérico da votação. Aceita clique ou teclado físico (ver useBallotFlow).
// Branco e Corrige têm cor própria (amarelo educativo / coral) pra se distinguir
// dos dígitos num piscar de olhos, sem precisar ler o texto do botão.
export function VoteKeypad({ onDigit, onClear, onBlank, disabled }) {
  const digitButton = (digit) => (
    <Button
      key={digit}
      type="button"
      variant="outline"
      className="h-11 text-lg font-semibold md:h-14 md:text-xl"
      disabled={disabled}
      onClick={() => onDigit(digit)}
    >
      {digit}
    </Button>
  );

  return (
    <div className="grid grid-cols-3 gap-1.5 md:gap-2">
      {DIGIT_ROWS.flat().map(digitButton)}
      <Button
        type="button"
        variant="outline"
        className="h-11 border-accent/40 bg-accent-soft text-sm text-accent-foreground hover:bg-accent-soft/70 md:h-14 md:text-base"
        disabled={disabled}
        onClick={onBlank}
      >
        Branco
      </Button>
      {digitButton('0')}
      <Button
        type="button"
        variant="outline"
        className="h-11 border-coral/30 text-sm text-coral hover:bg-coral-soft md:h-14 md:text-base"
        disabled={disabled}
        onClick={onClear}
      >
        <Delete /> Corrige
      </Button>
    </div>
  );
}
