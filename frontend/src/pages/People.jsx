import { useState } from 'react';
import { Pencil, Search, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/layout/ConfirmDialog';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { RowActions } from '@/components/layout/RowActions';
import { CandidateAvatar } from '@/components/candidates/CandidateAvatar';
import { PersonFormDialog } from '@/components/people/PersonFormDialog';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/services/api';

function candidacyLabel(count) {
  return count === 1 ? '1 candidatura' : `${count} candidaturas`;
}

// Pessoa é criada automaticamente quando alguém se candidata pelo link público de
// candidatura (ver public-candidacy.service.js) — esta tela só edita nome/foto ou
// remove quem nunca chegou a ter candidatura.
export default function People() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

  const { data: people, error, loading, reload } = useAsync(
    () => api.people.list({ search: debouncedSearch }),
    [debouncedSearch],
  );

  const [form, setForm] = useState({ open: false, person: null });
  const [removing, setRemoving] = useState(null);

  const openForm = (person) => setForm({ open: true, person });

  async function handleRemove(person) {
    try {
      await api.people.remove(person.id);
      toast.success('Pessoa removida.');
      setRemoving(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Pessoas"
        description="Pessoas cadastradas a partir do link de candidatura de cada sessão."
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome" aria-label="Buscar pessoas" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading && !people ? (
        <Skeleton className="h-48" />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : people.length === 0 ? (
        <EmptyState
          icon={Users}
          title={debouncedSearch ? 'Nenhuma pessoa encontrada' : 'Nenhuma pessoa cadastrada'}
          description={
            debouncedSearch
              ? 'Ajuste a busca.'
              : 'Pessoas aparecem aqui quando alguém se candidata pelo link de candidatura de uma sessão.'
          }
        />
      ) : (
        <Card className={loading ? 'opacity-60 transition-opacity' : undefined}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Candidaturas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => (
                <TableRow key={person.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CandidateAvatar name={person.name} photo={person.photo} />
                      <div className="font-medium">{person.name}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{candidacyLabel(person.candidaciesCount)}</TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      label={person.name}
                      items={[
                        { label: 'Editar', icon: Pencil, onSelect: () => openForm(person) },
                        {
                          label: 'Remover',
                          icon: Trash2,
                          onSelect: () => setRemoving(person),
                          disabled: person.candidaciesCount > 0,
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <PersonFormDialog
        open={form.open}
        person={form.person}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        onSaved={reload}
      />
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remover pessoa?"
        description={`"${removing?.name}" será removida definitivamente. Só é possível remover quem não tem nenhuma candidatura.`}
        confirmLabel="Remover"
        onConfirm={() => handleRemove(removing)}
      />
    </div>
  );
}
