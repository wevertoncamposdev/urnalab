import { useState } from 'react';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

// Pergunta opcional pós-votação (ver ROADMAP.md "Validação e Feedback") — dispensável,
// nunca bloqueia o fluxo de "próximo eleitor". Reaproveita o mesmo endpoint de feedback
// (type: 'OTHER', rating preenchido) em vez de criar um recurso novo.
export function PostVoteFeedback() {
  const { status } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done | dismissed

  if (state === 'done' || state === 'dismissed') return null;

  async function send() {
    setState('sending');
    try {
      const payload = { type: 'OTHER', rating, message: comment.trim() || undefined, page: window.location.pathname };
      if (status === 'authenticated') await api.feedback.create(payload);
      else await api.public.createFeedback(payload);
      setState('done');
      toast.success('Obrigado pela avaliação!');
    } catch {
      setState('idle');
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3 border-t pt-4 text-center">
      <p className="text-sm font-medium">Como foi sua experiência com o UrnaLab?</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${value} estrela(s)`}
            onClick={() => setRating(value)}
            className="p-0.5"
          >
            <Star className={cn('size-6', value <= rating ? 'fill-coral text-coral' : 'text-muted-foreground')} />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Comentário (opcional)"
            rows={2}
            className="w-full max-w-sm rounded-lg border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground"
          />
          <Button size="sm" onClick={send} disabled={state === 'sending'}>
            {state === 'sending' ? 'Enviando...' : 'Enviar avaliação'}
          </Button>
        </>
      )}
      <button
        type="button"
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => setState('dismissed')}
      >
        Agora não
      </button>
    </div>
  );
}
