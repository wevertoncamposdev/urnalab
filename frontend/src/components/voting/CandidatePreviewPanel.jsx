import { Frown, UserRound, Vote } from 'lucide-react';
import { CandidateAvatar } from '@/components/candidates/CandidateAvatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getCandidatePreviewState } from '@/lib/candidate-preview';
import { cn } from '@/lib/utils';

const PHOTO_SIZE = 'size-14 shrink-0 text-lg md:size-40 md:text-4xl';
const PLACEHOLDER_CIRCLE =
  'flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed text-muted-foreground md:size-40';

// Painel da foto do candidato: no celular, uma faixa compacta (foto ao lado do
// nome) acima do teclado — no desktop/tablet (md+), o painel maior e vertical
// ao lado da cédula, como o monitor separado de uma urna real. O anel colorido
// (verde/coral/amarelo) dá o mesmo veredito da cor sem precisar ler o texto.
export function CandidatePreviewPanel({ blank, lookup }) {
  const state = getCandidatePreviewState({ blank, lookup });
  let content;
  let eyebrow = null;
  let ringClass = 'ring-0';

  if (state.kind === 'blank') {
    eyebrow = 'Voto em branco';
    ringClass = 'ring-[3px] ring-accent/40';
    content = (
      <>
        <div className={PLACEHOLDER_CIRCLE}>
          <Vote className="size-6 md:size-14" />
        </div>
        <p className="text-base font-semibold md:text-lg">Voto em branco</p>
      </>
    );
  } else if (state.kind === 'loading') {
    eyebrow = 'Consultando...';
    content = <Skeleton className="size-14 shrink-0 rounded-full md:size-40" />;
  } else if (state.kind === 'found') {
    const { candidate } = state;
    eyebrow = 'Seu voto vai para';
    ringClass = 'ring-[3px] ring-success/40';
    content = (
      <>
        <CandidateAvatar name={candidate.name} photo={candidate.photo} className={PHOTO_SIZE} />
        <div className="min-w-0 md:text-center">
          <p className="truncate text-base font-semibold md:text-xl">{candidate.name}</p>
          <p className="truncate text-sm text-muted-foreground md:text-base">
            {candidate.party?.acronym} ({candidate.party?.number})
          </p>
        </div>
      </>
    );
  } else if (state.kind === 'not-found') {
    eyebrow = 'Atenção';
    ringClass = 'ring-[3px] ring-coral/40';
    content = (
      <>
        <Frown className="size-6 shrink-0 text-danger md:size-14" />
        <div>
          <p className="text-sm font-medium text-danger md:text-base">Nenhum candidato com este número</p>
          <p className="text-xs text-muted-foreground md:text-sm">O voto será contado como nulo.</p>
        </div>
      </>
    );
  } else if (state.kind === 'inactive') {
    eyebrow = 'Atenção';
    ringClass = 'ring-[3px] ring-coral/40';
    content = (
      <>
        <Frown className="size-6 shrink-0 text-danger md:size-14" />
        <div>
          <p className="text-sm font-medium text-danger md:text-base">Este candidato está inativo</p>
          <p className="text-xs text-muted-foreground md:text-sm">O voto será contado como nulo.</p>
        </div>
      </>
    );
  } else {
    content = (
      <>
        <div className={PLACEHOLDER_CIRCLE}>
          <UserRound className="size-6 md:size-16" />
        </div>
        <p className="text-sm text-muted-foreground md:text-base">Digite o número do candidato</p>
      </>
    );
  }

  return (
    <Card
      className={cn(
        'flex flex-row items-center gap-3 p-3 transition-shadow duration-200 md:flex-col md:justify-center md:gap-3 md:p-6 md:text-center md:min-h-80',
        ringClass,
      )}
    >
      {eyebrow && (
        <p className="hidden text-xs font-semibold uppercase tracking-wide text-muted-foreground md:order-first md:block">
          {eyebrow}
        </p>
      )}
      {content}
    </Card>
  );
}
