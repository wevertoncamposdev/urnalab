import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CandidateAvatar } from '@/components/candidates/CandidateAvatar';
import { useAsync } from '@/hooks/useAsync';
import { useCurrentSession } from '@/hooks/useCurrentSession';
import { fieldOfError } from '@/lib/form-errors';
import { api } from '@/services/api';

const FIELD_RULES = [
  ['NAME', 'name'],
  ['YEAR', 'year'],
];

// `session` = sessão de origem (null fecha o dialog). Reaproveita cargos, partidos
// e pessoas da conta sem duplicar nada — só cria uma sessão nova (rascunho) e,
// pra cada candidato marcado, uma candidatura nova nela (ver ROADMAP.md).
export function DuplicateSessionDialog({ session, positionLabels, onOpenChange }) {
  const navigate = useNavigate();
  const { select } = useCurrentSession();

  const [name, setName] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [selected, setSelected] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const candidatesState = useAsync(
    () => (session ? api.candidates.list({ sessionId: session.id, status: 'ACTIVE' }) : Promise.resolve(null)),
    [session?.id],
  );
  const candidates = candidatesState.data ?? [];

  // Toda vez que o dialog abre pra uma sessão nova, reseta o formulário e já
  // marca todo mundo — a professora desmarca só quem não concorre de novo.
  useEffect(() => {
    if (!session) return;
    setName(session.name);
    setYear(String(new Date().getFullYear()));
    setError(null);
  }, [session]);

  useEffect(() => {
    if (candidatesState.data) setSelected(new Set(candidatesState.data.map((c) => c.id)));
  }, [candidatesState.data]);

  const errorField = fieldOfError(error, FIELD_RULES);
  const fieldError = (field) => (errorField === field ? error.message : null);

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.sessions.duplicate(session.id, {
        name,
        year: year === '' ? null : Number(year),
        candidateIds: [...selected],
      });
      select(result.session);
      if (result.skipped.length > 0) {
        toast.warning(
          `${result.copied} candidato(s) copiado(s), ${result.skipped.length} pulado(s): ` +
            result.skipped.map((s) => `${s.name} (${s.reason})`).join('; '),
        );
      } else {
        toast.success(
          result.copied === 0 ? 'Sessão criada.' : `Sessão criada com ${result.copied} candidato(s) copiado(s).`,
        );
      }
      onOpenChange(false);
      navigate(`/sessoes/${result.session.id}`);
    } catch (err) {
      if (err.code === 'INSTITUTION_PROFILE_REQUIRED') {
        toast.error(err.message);
        navigate('/perfil');
        return;
      }
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={Boolean(session)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Duplicar sessão</DialogTitle>
          <DialogDescription>
            Cria uma sessão nova em rascunho com os mesmos cargos de "{session?.name}" e uma
            candidatura nova pra cada candidato marcado abaixo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && !errorField && (
            <Alert variant="destructive"><AlertDescription>{error.message}</AlertDescription></Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <FormField label="Nome da nova sessão" htmlFor="duplicate-name" error={fieldError('name')}>
              <Input id="duplicate-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </FormField>
            <FormField label="Ano" htmlFor="duplicate-year" error={fieldError('year')}>
              <Input id="duplicate-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            </FormField>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Candidatos a reaproveitar</Label>
              {candidates.length > 0 && (
                <div className="flex gap-3 text-xs">
                  <button type="button" className="text-primary hover:underline" onClick={() => setSelected(new Set(candidates.map((c) => c.id)))}>
                    Selecionar todos
                  </button>
                  <button type="button" className="text-primary hover:underline" onClick={() => setSelected(new Set())}>
                    Nenhum
                  </button>
                </div>
              )}
            </div>

            {candidatesState.loading ? (
              <p className="text-sm text-muted-foreground">Carregando candidatos...</p>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esta sessão não tem candidatos ativos — a nova sessão nasce só com os cargos.
              </p>
            ) : (
              <div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg border p-2">
                {candidates.map((candidate) => (
                  <Label
                    key={candidate.id}
                    htmlFor={`dup-candidate-${candidate.id}`}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 font-normal hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`dup-candidate-${candidate.id}`}
                      checked={selected.has(candidate.id)}
                      onCheckedChange={() => toggle(candidate.id)}
                    />
                    <CandidateAvatar name={candidate.name} photo={candidate.photo} className="size-7 text-xs" />
                    <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {positionLabels[candidate.position] ?? candidate.position} · nº {candidate.number}
                    </span>
                  </Label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Duplicando...' : 'Duplicar sessão'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
