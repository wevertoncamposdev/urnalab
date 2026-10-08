import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/branding/Logo';
import { api, setAdminVerificationToken } from '@/services/api';

// Segunda camada de acesso à Área de Gerenciamento (Etapa 19): além da conta já ser
// ADMIN_EMAIL, confirma posse do e-mail a cada entrada na área — um código de 6 dígitos
// é mandado automaticamente ao montar (ver useEffect abaixo), e só depois de confirmado
// o shell de verdade (AdminLayout) renderiza. O token resultante fica só em
// sessionStorage (ver api.js) — fecha a aba, perde a verificação, sem sessão nenhuma
// guardada no servidor pra isso.
export function AdminVerificationGate({ email, onVerified }) {
  const [sendingInitial, setSendingInitial] = useState(true);
  const [requestError, setRequestError] = useState(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await api.admin.verify.request();
      } catch (err) {
        if (active) setRequestError(err);
      } finally {
        if (active) setSendingInitial(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { token } = await api.admin.verify.confirm(code);
      setAdminVerificationToken(token);
      onVerified();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setRequestError(null);
    try {
      await api.admin.verify.request();
      toast.success('Código reenviado.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo size={56} />
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldAlert className="size-5 text-coral" /> Verificação em duas etapas
          </h1>
          <p className="text-sm text-muted-foreground">
            {sendingInitial ? (
              'Enviando um código de verificação...'
            ) : (
              <>
                Enviamos um código de 6 dígitos para <strong>{email}</strong>.
              </>
            )}
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            {requestError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{requestError.message}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              )}
              <FormField label="Código" htmlFor="admin-verify-code">
                <Input
                  id="admin-verify-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  autoComplete="one-time-code"
                  disabled={sendingInitial}
                />
              </FormField>
              <Button type="submit" className="mt-2" disabled={submitting || sendingInitial || !code}>
                {submitting ? 'Confirmando...' : 'Confirmar e entrar'}
              </Button>
              <Button type="button" variant="ghost" disabled={resending || sendingInitial} onClick={handleResend}>
                {resending ? 'Reenviando...' : 'Reenviar código'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
