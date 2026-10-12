import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fieldOfError } from '@/lib/form-errors';
import { api } from '@/services/api';

const FIELD_RULES = [['LABEL', 'label'], ['DIGITS', 'digits'], ['ORDER', 'order'], ['DESCRIPTION', 'description']];

function PositionForm({ position, onSaved, onCancel }) {
  const editing = Boolean(position);
  const [label, setLabel] = useState(position?.label ?? '');
  const [digits, setDigits] = useState(position ? String(position.digits) : '');
  const [order, setOrder] = useState(position ? String(position.order) : '');
  const [twoRoundEnabled, setTwoRoundEnabled] = useState(position?.twoRoundEnabled ?? false);
  const [description, setDescription] = useState(position?.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const errorField = fieldOfError(error, FIELD_RULES);
  const fieldError = (field) => (errorField === field ? error.message : null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = {
      label,
      digits: digits === '' ? null : Number(digits),
      order: order === '' ? undefined : Number(order),
      twoRoundEnabled,
      description: description.trim() || null,
    };
    try {
      if (editing) await api.positions.update(position.id, payload);
      else await api.positions.create(payload);
      toast.success(editing ? 'Alterações salvas.' : 'Cargo criado.');
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
      <FormField label="Nome do cargo" htmlFor="position-label" error={fieldError('label')}>
        <Input
          id="position-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Presidente, Diretor de Turma, Síndico..."
          autoFocus
        />
      </FormField>
      {editing && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Identificador interno: <span className="font-mono">{position.code}</span> (fixo, não muda ao renomear).
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Dígitos do número"
          htmlFor="position-digits"
          error={fieldError('digits')}
          hint="Quantos dígitos o número de urna deste cargo tem."
        >
          <Input
            id="position-digits"
            inputMode="numeric"
            value={digits}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 1))}
            placeholder="2"
          />
        </FormField>
        <FormField
          label="Ordem na cédula"
          htmlFor="position-order"
          error={fieldError('order')}
          hint="Em que posição vem na votação."
        >
          <Input
            id="position-order"
            inputMode="numeric"
            value={order}
            onChange={(e) => setOrder(e.target.value.replace(/\D/g, '').slice(0, 3))}
            placeholder={editing ? undefined : 'Automático se vazio'}
          />
        </FormField>
      </div>
      <FormField
        label="Descrição (opcional)"
        htmlFor="position-description"
        error={fieldError('description')}
        hint="Explica as funções/atribuições do cargo — aparece para quem for consultar, inclusive na tela de votação."
      >
        <Textarea
          id="position-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="O que esse cargo faz..."
          rows={3}
        />
      </FormField>
      <Label htmlFor="position-two-round" className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card px-3 py-2.5 font-normal">
        <Checkbox
          id="position-two-round"
          checked={twoRoundEnabled}
          onCheckedChange={(checked) => setTwoRoundEnabled(checked === true)}
          className="mt-0.5"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm">Permite 2º turno</span>
          <span className="text-xs text-muted-foreground">
            Sem maioria absoluta (mais de 50% dos votos válidos) no 1º turno, a apuração aponta os
            dois mais votados para a disputa, em vez de declarar um vencedor.
          </span>
        </span>
      </Label>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>Cancelar</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar cargo'}
        </Button>
      </div>
    </form>
  );
}

// `position` = null para criar; objeto para editar.
export function PositionFormDialog({ open, position, onOpenChange, onSaved }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{position ? 'Editar cargo' : 'Novo cargo'}</DialogTitle>
          <DialogDescription>
            Defina o nome, quantos dígitos o número de urna tem e em que ordem o cargo aparece na votação.
          </DialogDescription>
        </DialogHeader>
        <PositionForm
          position={position}
          onSaved={() => { onOpenChange(false); onSaved(); }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
