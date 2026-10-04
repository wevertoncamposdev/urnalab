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
import { trackEvent } from '@/lib/analytics';
import { api } from '@/services/api';

// Serve para criar (/sessoes/nova) e editar (/sessoes/:id/editar) uma sessão em rascunho.
export default function SessionCreate() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { select } = useCurrentSession();

  const positionsState = useAsync(() => api.positions.list(), []);
  const sessionState = useAsync(() => (editing ? api.sessions.get(id) : Promise.resolve(null)), [id]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const loadError = positionsState.error ?? sessionState.error;
  const loading = positionsState.loading || sessionState.loading;
  const session = sessionState.data;
  const goBack = () => navigate(editing ? `/sessoes/${id}` : '/sessoes');

  async function handleSubmit(values) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const saved = editing ? await api.sessions.update(id, values) : await api.sessions.create(values);
      if (!editing) trackEvent('SESSION_CREATED', { sessionId: saved.id });
      select(saved);
      toast.success(editing ? 'Alterações salvas.' : 'Sessão criada.');
      navigate(`/sessoes/${saved.id}`);
    } catch (error) {
      if (error.code === 'INSTITUTION_PROFILE_REQUIRED') {
        toast.error(error.message);
        navigate('/perfil');
        return;
      }
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
  } else if (editing && session.status !== 'DRAFT') {
    content = (
      <Alert>
        <AlertDescription className="flex flex-col items-start gap-3">
          Só é possível editar sessões em rascunho.
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
            submitLabel={editing ? 'Salvar alterações' : 'Criar sessão'}
            onSubmit={handleSubmit}
            onCancel={goBack}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={editing ? 'Editar sessão' : 'Nova sessão eleitoral'}
        description="Defina o nome, o ano e os cargos que estarão em disputa."
      />
      {content}
    </div>
  );
}
