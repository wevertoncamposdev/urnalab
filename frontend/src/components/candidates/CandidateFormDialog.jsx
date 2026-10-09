import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { fieldOfError } from '@/lib/form-errors';
import { api } from '@/services/api';
import { CandidateAvatar } from './CandidateAvatar';

const GOVERNMENT_PROPOSAL_MAX_LENGTH = 2000;

const FIELD_RULES = [
  ['NUMBER', 'number'],
  ['PARTY', 'partyId'],
  ['POSITION', 'position'],
  ['GOVERNMENT_PROPOSAL', 'governmentProposal'],
];

// Toda candidatura chega pelo link público de candidatura (ver public-candidacy.service.js
// no backend e PublicCandidacy.jsx no frontend) — este diálogo só edita uma candidatura já
// existente (aprovar/reprovar, corrigir partido/número/proposta, ou mudar o status).
function CandidateForm({ candidate, sessions, parties, positions, onSaved, onCancel }) {
  const session = sessions.find((s) => s.id === candidate.sessionId);
  const rules = Object.fromEntries(positions.map((p) => [p.code, p]));
  const sessionPositions = (session?.positions ?? []).map((code) => rules[code]).filter(Boolean);

  const [position, setPosition] = useState(candidate.position ?? '');
  const [partyId, setPartyId] = useState(candidate.partyId ?? '');
  const [number, setNumber] = useState(candidate.number ?? '');
  const [status, setStatus] = useState(candidate.status ?? 'ACTIVE');
  const [governmentProposal, setGovernmentProposal] = useState(candidate.governmentProposal ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const digits = rules[position]?.digits;
  const partyOptions = parties.filter((p) => p.status === 'ACTIVE' || p.id === candidate.partyId);

  // Depois que a votação abre, o backend só aceita mudar o status (e a proposta).
  const identityLocked = session?.status !== 'DRAFT';

  const errorField = fieldOfError(error, FIELD_RULES);
  const fieldError = (field) => (errorField === field ? error.message : null);

  function changePosition(value) {
    setPosition(value);
    setNumber('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = {
      partyId,
      position,
      number,
      status,
      governmentProposal: governmentProposal.trim() || null,
    };
    try {
      await api.candidates.update(candidate.id, payload);
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
      {identityLocked && (
        <Alert><AlertDescription>A votação já abriu: só o status e a proposta de governo podem ser alterados.</AlertDescription></Alert>
      )}

      <FormField label="Candidato">
        <div className="flex items-center gap-3 rounded-lg border bg-card p-2">
          <CandidateAvatar name={candidate.name} photo={candidate.photo} />
          <div className="text-sm font-medium">{candidate.name}</div>
        </div>
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Cargo" htmlFor="candidate-position" error={fieldError('position')}>
          <Select value={position} onValueChange={changePosition} disabled={identityLocked}>
            <SelectTrigger id="candidate-position"><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
            <SelectContent>
              {sessionPositions.map((p) => (
                <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          label="Número"
          htmlFor="candidate-number"
          error={fieldError('number')}
          hint={digits ? `${digits} dígitos para este cargo.` : 'Escolha o cargo primeiro.'}
        >
          <Input
            id="candidate-number"
            inputMode="numeric"
            value={number}
            disabled={!digits || identityLocked}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, '').slice(0, digits))}
          />
        </FormField>
      </div>

      <FormField label="Partido" htmlFor="candidate-party" error={fieldError('partyId')}>
        <Select value={partyId} onValueChange={setPartyId} disabled={identityLocked}>
          <SelectTrigger id="candidate-party"><SelectValue placeholder="Selecione o partido" /></SelectTrigger>
          <SelectContent>
            {partyOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.acronym} — {p.name} ({p.number})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField
        label="Proposta de governo"
        htmlFor="candidate-government-proposal"
        error={fieldError('governmentProposal')}
        hint={`Opcional. O que o candidato pretende fazer no mandato (${governmentProposal.length}/${GOVERNMENT_PROPOSAL_MAX_LENGTH}).`}
      >
        <Textarea
          id="candidate-government-proposal"
          rows={6}
          maxLength={GOVERNMENT_PROPOSAL_MAX_LENGTH}
          value={governmentProposal}
          onChange={(e) => setGovernmentProposal(e.target.value)}
          placeholder="Descreva aqui os planos para o mandato, se eleito."
        />
      </FormField>

      <FormField label="Status" htmlFor="candidate-status" hint="Candidato inativo não recebe novos votos.">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger id="candidate-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            {candidate.status === 'PENDING' && <SelectItem value="PENDING">Pendente</SelectItem>}
            <SelectItem value="ACTIVE">Ativo</SelectItem>
            <SelectItem value="INACTIVE">Inativo</SelectItem>
          </SelectContent>
        </Select>
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

export function CandidateFormDialog({ open, candidate, onOpenChange, onSaved, ...formProps }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar candidatura</DialogTitle>
          <DialogDescription>
            O número deve ser único para o cargo dentro da sessão.
          </DialogDescription>
        </DialogHeader>
        {candidate && (
          <CandidateForm
            candidate={candidate}
            {...formProps}
            onSaved={() => { onOpenChange(false); onSaved(); }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
