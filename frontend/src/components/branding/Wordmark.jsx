import { cn } from '@/lib/utils';

// Wordmark oficial (ver docs/identidade-visual.md): sempre minúsculo, "urna" em azul
// profundo + "lab" em verde, mesmo peso (Manrope ExtraBold). `dark` existe pro menu
// lateral (fundo azul-marinho escuro) — ali "urna" em --primary perderia contraste,
// então vira branco; "lab" continua verde, igual ao logo sobre fundo escuro.
export function Wordmark({ dark = false, className }) {
  return (
    <span className={cn('font-sans font-extrabold lowercase tracking-tight', className)}>
      <span className={dark ? 'text-white' : 'text-primary'}>urna</span>
      <span className="text-brand-green">lab</span>
    </span>
  );
}
