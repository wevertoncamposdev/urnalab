import { useState } from 'react';
import { Briefcase, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/layout/ConfirmDialog';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { RowActions } from '@/components/layout/RowActions';
import { PositionDescriptionButton } from '@/components/positions/PositionDescriptionButton';
import { PositionFormDialog } from '@/components/positions/PositionFormDialog';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/services/api';

// Cadastro livre de cargos: nome, dígitos do número de urna e ordem na cédula.
// Substitui a lista fixa de cargos brasileiros por um registro editável, para
// o simulador também servir eleições fora desse modelo (sindicato, grêmio, etc.).
export default function Positions() {
  const { data: positions, error, loading, reload } = useAsync(() => api.positions.list(), []);

  const [form, setForm] = useState({ open: false, position: null });
  const [removing, setRemoving] = useState(null);

  const openForm = (position = null) => setForm({ open: true, position });

  async function handleRemove(position) {
    try {
      await api.positions.remove(position.id);
      toast.success('Cargo removido.');
      setRemoving(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const newButton = (
    <Button onClick={() => openForm()}><Plus /> Novo cargo</Button>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Cargos"
        description="Cargos disponíveis para compor sessões eleitorais e cadastrar candidatos."
        actions={newButton}
      />

      {loading && !positions ? (
        <Skeleton className="h-48" />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : positions.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Nenhum cargo cadastrado"
          description="Cadastre os cargos em disputa antes de criar uma sessão eleitoral."
          action={newButton}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Ordem</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Dígitos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((position) => (
                <TableRow key={position.id}>
                  <TableCell className="tabular-nums text-muted-foreground">{position.order}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{position.label}</span>
                      <PositionDescriptionButton label={position.label} description={position.description} />
                      {position.twoRoundEnabled && <Badge>2º turno</Badge>}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">{position.code}</div>
                  </TableCell>
                  <TableCell>{position.digits}</TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      label={position.label}
                      items={[
                        { label: 'Editar', icon: Pencil, onSelect: () => openForm(position) },
                        { label: 'Remover', icon: Trash2, onSelect: () => setRemoving(position) },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <PositionFormDialog
        open={form.open}
        position={form.position}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        onSaved={reload}
      />
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remover cargo?"
        description={`"${removing?.label}" será removido definitivamente. Só é possível remover cargos que não estejam em uso em nenhuma eleição.`}
        confirmLabel="Remover"
        onConfirm={() => handleRemove(removing)}
      />
    </div>
  );
}
