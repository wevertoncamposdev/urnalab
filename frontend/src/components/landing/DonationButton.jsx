import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DonationDialog } from '@/components/donation/DonationDialog';

// Botão flutuante de doação (landing page apenas) — acompanha o scroll no canto
// onde antes ficava o FeedbackButton global (ver App.jsx: escondido em "/" pra
// não disputar espaço com este aqui). Maior e mais chamativo de propósito, com um
// leve pulso atrás pra puxar o olho sem travar a leitura da página.
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

      <DonationDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
