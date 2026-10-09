import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Botão flutuante de doação (landing page apenas) — acompanha o scroll no canto
// onde antes ficava o FeedbackButton global (ver App.jsx: escondido em "/" pra
// não disputar espaço com este aqui). Maior e mais chamativo de propósito, com um
// leve pulso atrás pra puxar o olho sem travar a leitura da página.
// A doação em si ainda não existe (ver pedido do produto); por enquanto o clique só
// explica que a funcionalidade está a caminho, sem prometer nada além disso.
export function DonationButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-coral/50" />
        <Button
          type="button"
          onClick={() => setOpen(true)}
          size="lg"
          className="gap-2.5 rounded-full bg-coral px-6 py-6 text-base font-semibold text-white shadow-xl shadow-coral/30 hover:bg-coral/90"
        >
          <Heart className="size-5 fill-current" /> Apoiar o projeto
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apoie o UrnaLab</DialogTitle>
            <DialogDescription>
              A doação ainda não está disponível — estamos preparando essa funcionalidade.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O UrnaLab é mantido para seguir gratuito nas funcionalidades essenciais de qualquer
            escola. Em breve você vai poder contribuir diretamente por aqui. Por enquanto, a forma
            que mais ajuda é indicar o projeto para outros professores.
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setOpen(false)}>
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
