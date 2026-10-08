import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';
import { useAuth } from '@/hooks/useAuth';
import { trackEvent } from '@/lib/analytics';
import Admin from '@/pages/Admin';
import AdminAnalytics from '@/pages/AdminAnalytics';
import AdminFeedback from '@/pages/AdminFeedback';
import Audit from '@/pages/Audit';
import Candidates from '@/pages/Candidates';
import ConfirmEmail from '@/pages/ConfirmEmail';
import Dashboard from '@/pages/Dashboard';
import ElectoralSystem from '@/pages/ElectoralSystem';
import Financeiro from '@/pages/Financeiro';
import ForgotPassword from '@/pages/ForgotPassword';
import Landing from '@/pages/Landing';
import Loja from '@/pages/Loja';
import Login from '@/pages/Login';
import Parties from '@/pages/Parties';
import People from '@/pages/People';
import Positions from '@/pages/Positions';
import Profile from '@/pages/Profile';
import PublicVoting from '@/pages/PublicVoting';
import Register from '@/pages/Register';
import ResetPassword from '@/pages/ResetPassword';
import Results from '@/pages/Results';
import SessionCreate from '@/pages/SessionCreate';
import SessionDetails from '@/pages/SessionDetails';
import Sessions from '@/pages/Sessions';
import SessionWizard from '@/pages/SessionWizard';
import Timeline from '@/pages/Timeline';

// PAGE_VIEW a cada navegação (ver lib/analytics.js) — primeiro disparo leva o
// document.referrer (origem de fora do app); os seguintes não, já que a navegação
// interna não é "origem de visitante" nenhuma.
function AnalyticsPageViewTracker() {
  const location = useLocation();
  const firstRender = useRef(true);

  useEffect(() => {
    trackEvent('PAGE_VIEW', {
      path: `${location.pathname}${location.search}`,
      referrer: firstRender.current ? document.referrer || null : null,
    });
    firstRender.current = false;
  }, [location.pathname, location.search]);

  return null;
}

// Só deixa passar com sessão confirmada; sem ela, manda pro login (e lembra de
// onde a pessoa estava, pra voltar depois de entrar).
function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Carregando...</div>;
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return children;
}

// Além de autenticado (RequireAuth já garante isso), a conta precisa ser a
// ADMIN_EMAIL configurada no backend (ver /api/auth/me, campo isAdmin) — qualquer
// outra conta nem vê essa rota existir, ela só volta pro painel normal.
function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (!user?.isAdmin) return <Navigate to="/painel" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  // Na votação pública o feedback já é pedido depois do voto (PostVoteFeedback,
  // dentro da tela de "voto computado") — o botão flutuante some pra não duplicar
  // e deixar a cédula mais limpa.
  const hideFeedbackButton = location.pathname.startsWith('/votar/');

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="login" element={<Login />} />
        <Route path="registro" element={<Register />} />
        <Route path="confirmar-email" element={<ConfirmEmail />} />
        <Route path="esqueci-senha" element={<ForgotPassword />} />
        <Route path="redefinir-senha/:token" element={<ResetPassword />} />
        <Route path="votar/:token" element={<PublicVoting />} />
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route path="painel" element={<Dashboard />} />
          <Route path="perfil" element={<Profile />} />
          <Route path="sessoes" element={<Sessions />} />
          <Route path="sessoes/assistente" element={<SessionWizard />} />
          <Route path="sessoes/nova" element={<SessionCreate />} />
          <Route path="sessoes/:id" element={<SessionDetails />} />
          <Route path="sessoes/:id/editar" element={<SessionCreate />} />
          <Route path="cargos" element={<Positions />} />
          <Route path="partidos" element={<Parties />} />
          <Route path="pessoas" element={<People />} />
          <Route path="candidatos" element={<Candidates />} />
          <Route path="resultados" element={<Results />} />
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="auditoria" element={<Audit />} />
          <Route path="sistema-eleitoral" element={<ElectoralSystem />} />
          <Route path="loja" element={<Loja />} />
          <Route path="linha-do-tempo" element={<Timeline />} />
          <Route path="admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
          <Route path="admin/analytics" element={<RequireAdmin><AdminAnalytics /></RequireAdmin>} />
          <Route path="admin/feedback" element={<RequireAdmin><AdminFeedback /></RequireAdmin>} />
        </Route>
      </Routes>
      <AnalyticsPageViewTracker />
      {!hideFeedbackButton && <FeedbackButton />}
      <Toaster />
    </>
  );
}
