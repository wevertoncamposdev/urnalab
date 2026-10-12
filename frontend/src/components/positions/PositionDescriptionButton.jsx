import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Botão "?" reutilizável em qualquer lugar que mencione um cargo (lista de cargos,
// wizard de sessão, detalhes, resultados, formulários de candidato/candidatura e a
// própria tela de votação pública) — abre a descrição das funções do cargo num Dialog
// (reaproveitando o primitivo já existente, em vez de instalar um Popover/Tooltip novo
// só para isso). Sem descrição cadastrada, não renderiza nada.
export function PositionDescriptionButton({ label, description, className }) {
  const [open, setOpen] = useState(false);
  if (!description) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('size-5 shrink-0 text-muted-foreground hover:text-foreground', className)}
        onClick={(e) => {
          // preventDefault + stopPropagation: em pontos onde o botão fica dentro de um
          // <Label htmlFor> (ex. checkbox de cargo no SessionWizard), um clique nele
          // senão também alternaria o checkbox associado (comportamento nativo do label).
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Ver descrição do cargo ${label}`}
      >
        <Info className="size-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <DialogDescription className="whitespace-pre-wrap text-sm text-foreground">
            {description}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}
