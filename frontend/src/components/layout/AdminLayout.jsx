import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, LayoutDashboard, LineChart, LogOut, MessageSquare, Package, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/branding/Logo';
import { AdminVerificationGate } from '@/components/admin/AdminVerificationGate';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  clearAdminVerificationToken,
  hasAdminVerificationToken,
  setAdminVerificationRequiredHandler,
} from '@/services/api';

// Shell próprio da Área de Gerenciamento (Etapa 18) — não reaproveita AppLayout/Sidebar.jsx
// (área comum do usuário) de propósito: nenhum componente daqui é compartilhado com a área
// comum, então um bug ou mudança futura num dos dois não tem como vazar pro outro. A
// autorização de verdade continua sendo RequireAuth+RequireAdmin (App.jsx) e `adminOnly: true`
// no backend — este componente só cuida da apresentação de quem já passou pelo gate.
const ADMIN_NAV = [
  { label: 'Visão geral', to: '/gerenciamento', icon: LayoutDashboard, end: true },
  { label: 'Produtos', to: '/gerenciamento/produtos', icon: Package },
  { label: 'Analytics', to: '/gerenciamento/analytics', icon: LineChart },
  { label: 'Feedback', to: '/gerenciamento/feedback', icon: MessageSquare },
  { label: 'Sistema', to: '/gerenciamento/sistema', icon: Activity },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // Terceira camada por cima de RequireAdmin (Etapa 19): mesmo já sendo ADMIN_EMAIL,
  // precisa confirmar o código mandado por e-mail a cada entrada na área — ver
  // AdminVerificationGate. `hasAdminVerificationToken` olha o sessionStorage (válido só
  // na aba atual); `setAdminVerificationRequiredHandler` cobre o caso do token expirar
  // (ou ser invalidado) no meio do uso, derrubando de volta pro gate numa chamada normal.
  const [verified, setVerified] = useState(hasAdminVerificationToken);

  useEffect(() => {
    setAdminVerificationRequiredHandler(() => setVerified(false));
    return () => setAdminVerificationRequiredHandler(null);
  }, []);

  if (!verified) {
    return <AdminVerificationGate email={user?.email} onVerified={() => setVerified(true)} />;
  }

  function handleLogout() {
    clearAdminVerificationToken();
    logout();
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-sidebar px-6 py-3 text-sidebar-foreground">
        <div className="flex items-center gap-3">
          <Logo size={28} />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Área de Gerenciamento</span>
            <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-sidebar-foreground/80">
              <ShieldAlert className="size-3" /> Restrito
            </span>
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Administração">
          {ADMIN_NAV.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-white/10 hover:text-white',
                  isActive && 'bg-sidebar-accent text-white',
                )
              }
            >
              <Icon className="size-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-sidebar-foreground/80 sm:inline">{user?.name}</span>
          <Button type="button" variant="ghost" size="sm" className="text-sidebar-foreground hover:bg-white/10 hover:text-white" onClick={() => navigate('/painel')}>
            Voltar ao painel
          </Button>
          <Button type="button" variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-white/10 hover:text-white" onClick={handleLogout} aria-label="Sair" title="Sair">
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
