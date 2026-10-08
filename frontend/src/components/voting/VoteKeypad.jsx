import { Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DIGIT_ROWS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];

// Teclado numérico da votação. Aceita clique ou teclado físico (ver useBallotFlow).
// Branco e Corrige têm cor própria (amarelo educativo / coral) pra se distinguir
// dos dígitos num piscar de olhos, sem precisar ler o texto do botão.
//
// Altura dinâmica: o grid usa `grid-rows-[repeat(4,minmax(0,1fr))]` pra dividir
// igualmente a altura que o teclado tiver disponível (o próprio teclado é
// `flex-1` dentro da urna, ver Urna.jsx) entre as 4 linhas de botões — cada
// botão é `h-full` pra acompanhar a linha, com um `min-h` só como piso. Assim o
// teclado inteiro encolhe junto com a tela em vez de ter uma altura fixa que
// podia não caber (gerando scroll dentro da urna).
export function VoteKeypad({ onDigit, onClear, onBlank, disabled }) {
  const digitButton = (digit) => (
    <Button
      key={digit}
      type="button"
      variant="outline"
      className="h-full min-h-9 text-base font-semibold md:text-xl"
      disabled={disabled}
      onClick={() => onDigit(digit)}
    >
      {digit}
    </Button>
  );

  return (
    <div className="grid flex-1 grid-cols-3 grid-rows-[repeat(4,minmax(0,1fr))] gap-1.5 md:gap-2">
      {DIGIT_ROWS.flat().map(digitButton)}
      <Button
        type="button"
        variant="outline"
        className="h-full min-h-9 border-accent/40 bg-accent-soft text-xs text-accent-foreground hover:bg-accent-soft/70 md:text-base"
        disabled={disabled}
        onClick={onBlank}
      >
        Branco
      </Button>
      {digitButton('0')}
      <Button
        type="button"
        variant="outline"
        className="h-full min-h-9 border-coral/30 text-xs text-coral hover:bg-coral-soft md:text-base"
        disabled={disabled}
        onClick={onClear}
      >
        <Delete /> Corrige
      </Button>
    </div>
  );
}
