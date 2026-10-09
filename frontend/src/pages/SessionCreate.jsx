import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/layout/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { SessionForm } from '@/components/sessions/SessionForm';
import { useAsync } from '@/hooks/useAsync';
import { useCurrentSession } from '@/hooks/useCurrentSession';
import { api } from '@/services/api';

// Só edita (/sessoes/:id/editar) uma sessão já existente, na etapa de candidatura —
// criar uma sessão nova é sempre pelo Criar sessão (ver SessionWizard.jsx), que
// também cadastra os partidos; esta tela não tem mais rota de criação própria.
export default function SessionCreate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { select } = useCurrentSession();

  const positionsState = useAsync(() => api.positions.list(), []);
  const sessionState = useAsync(() => api.sessions.get(id), [id]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const loadError = positionsState.error ?? sessionState.error;
  const loading = positionsState.loading || sessionState.loading;
  const session = sessionState.data;
  const goBack = () => navigate(`/sessoes/${id}`);

  async function handleSubmit(values) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const saved = await api.sessions.update(id, values);
      select(saved);
      toast.success('Alterações salvas.');
      navigate(`/sessoes/${saved.id}`);
    } catch (error) {
      setSubmitError(error);
      setSubmitting(false);
    }
  }

  let content;
  if (loadError) {
    content = (
      <ErrorState
        error={loadError}
        onRetry={() => { positionsState.reload(); sessionState.reload(); }}
      />
    );
  } else if (loading) {
    content = <Skeleton className="h-96" />;
  } else if (session.status !== 'DRAFT') {
    content = (
      <Alert>
        <AlertDescription className="flex flex-col items-start gap-3">
          Só é possível editar sessões na etapa de candidatura.
          <Button asChild variant="outline" size="sm">
            <Link to={`/sessoes/${id}`}>Voltar para a sessão</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  } else {
    content = (
      <Card>
        <CardContent className="p-6">
          <SessionForm
            positions={positionsState.data}
            initial={session}
            error={submitError}
            submitting={submitting}
            submitLabel="Salvar alterações"
            onSubmit={handleSubmit}
            onCancel={goBack}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title="Editar sessão" description="Defina o nome, o ano e os cargos que estarão em disputa." />
      {content}
    </div>
  );
}
