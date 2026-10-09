import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PhotoCaptureField } from '@/components/candidates/PhotoCaptureField';
import { fieldOfError } from '@/lib/form-errors';
import { api } from '@/services/api';

const FIELD_RULES = [['NAME', 'name'], ['PHOTO', 'photo']];

// Pessoas são criadas automaticamente pelo link público de candidatura (ver
// public-candidacy.service.js) — este diálogo só edita nome/foto de uma pessoa já cadastrada.
function PersonForm({ person, onSaved, onCancel }) {
  const [name, setName] = useState(person.name ?? '');
  const [photo, setPhoto] = useState(person.photo ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const errorField = fieldOfError(error, FIELD_RULES);
  const fieldError = (field) => (errorField === field ? error.message : null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.people.update(person.id, { name, photo });
      toast.success('Alterações salvas.');
      onSaved();
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {error && !errorField && (
        <Alert variant="destructive"><AlertDescription>{error.message}</AlertDescription></Alert>
      )}
      <FormField label="Nome" htmlFor="person-name" error={fieldError('name')}>
        <Input id="person-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome fictício" autoFocus />
      </FormField>
      <FormField
        label="Foto (opcional)"
        htmlFor="person-photo"
        error={fieldError('photo')}
        hint="Alterar aqui atualiza a foto em todas as sessões onde esta pessoa é candidata."
      >
        <PhotoCaptureField id="person-photo" value={photo} onChange={setPhoto} disabled={submitting} />
      </FormField>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>Cancelar</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  );
}

export function PersonFormDialog({ open, person, onOpenChange, onSaved }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar pessoa</DialogTitle>
          <DialogDescription>
            Nome e foto reaproveitáveis em qualquer candidatura desta pessoa.
          </DialogDescription>
        </DialogHeader>
        {person && (
          <PersonForm
            person={person}
            onSaved={() => { onOpenChange(false); onSaved(); }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
