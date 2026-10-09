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

function PersonForm({ person, onSaved, onCancel }) {
  const editing = Boolean(person);
  const [name, setName] = useState(person?.name ?? '');
  const [photo, setPhoto] = useState(person?.photo ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const errorField = fieldOfError(error, FIELD_RULES);
  const fieldError = (field) => (errorField === field ? error.message : null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = { name, photo };
    try {
      if (editing) await api.people.update(person.id, payload);
      else await api.people.create(payload);
      toast.success(editing ? 'Alterações salvas.' : 'Pessoa cadastrada.');
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
        hint={
          editing
            ? 'Alterar aqui atualiza a foto em todas as sessões onde esta pessoa é candidata.'
            : 'Envie uma foto do dispositivo, tire uma com a câmera, ou escolha um avatar pronto.'
        }
      >
        <PhotoCaptureField id="person-photo" value={photo} onChange={setPhoto} disabled={submitting} />
      </FormField>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>Cancelar</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar pessoa'}
        </Button>
      </div>
    </form>
  );
}

// `person` = null para criar; objeto para editar.
export function PersonFormDialog({ open, person, onOpenChange, onSaved }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{person ? 'Editar pessoa' : 'Nova pessoa'}</DialogTitle>
          <DialogDescription>
            Nome e foto reaproveitáveis em qualquer candidatura — a pessoa é cadastrada aqui uma
            vez e depois vinculada a sessões em Candidatos.
          </DialogDescription>
        </DialogHeader>
        <PersonForm
          person={person}
          onSaved={() => { onOpenChange(false); onSaved(); }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
