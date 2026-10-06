import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';

const TYPE_OPTIONS = [
  { value: 'SUGGESTION', label: 'Sugestão' },
  { value: 'PROBLEM', label: 'Problema/Erro' },
  { value: 'QUESTION', label: 'Dúvida' },
  { value: 'OTHER', label: 'Outro' },
];

// Botão global (montado em App.jsx, fora das Routes) — aparece em toda página,
// exceto na votação pública (lá o feedback já é pedido depois do voto, ver
// PostVoteFeedback). Autenticado grava o userId; sem login, é anônimo (ver
// backend/src/services/feedback.service.js e a decisão de autoria da Etapa 10).
export function FeedbackButton() {
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('SUGGESTION');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = { type, message, page: window.location.pathname };
      if (status === 'authenticated') await api.feedback.create(payload);
      else await api.public.createFeedback(payload);
      toast.success('Obrigado pelo feedback!');
      setMessage('');
      setType('SUGGESTION');
      setOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 gap-2 rounded-full shadow-lg"
        size="sm"
      >
        <MessageCircle className="size-4" /> Enviar feedback
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar feedback</DialogTitle>
            <DialogDescription>
              Conte o que achou, relate um problema ou tire uma dúvida — sua opinião ajuda a
              melhorar o UrnaLab.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <FormField label="Tipo" htmlFor="feedback-type">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="feedback-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Mensagem" htmlFor="feedback-message">
              <textarea
                id="feedback-message"
                rows={4}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Escreva aqui..."
                className="flex w-full rounded-lg border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || !message.trim()}>
                {submitting ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
