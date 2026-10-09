import { NavLink } from 'react-router-dom';
import {
  BookOpen,
  Briefcase,
  ClipboardList,
  Flag,
  IdCard,
  LayoutDashboard,
  Store,
  Wallet,
  Wand2,
} from 'lucide-react';
import { Logo } from '@/components/branding/Logo';
import { Wordmark } from '@/components/branding/Wordmark';
import { cn } from '@/lib/utils';

// Agrupado por momento do fluxo (não por ordem alfabética ou de criação): visão geral
// primeiro, depois o que precisa existir ANTES de uma sessão (cargos, partidos,
// pessoas — nessa ordem de pré-requisito) terminando na própria sessão, e por fim o
// conteúdo de referência/estudo. Candidatos não tem item próprio aqui de propósito —
// já é acessível direto de dentro da sessão (ver SessionDetails.jsx), não precisa
// duplicar no menu. "Linha do tempo" também saiu do menu por ora (ideia em aberto pra
// ela, ver ROADMAP.md) — rota e página continuam existindo, só não aparecem aqui.
// Resultados e Auditoria são um caso diferente dos dois acima: não têm mais nem rota
// nem página — o conteúdo que existia nelas virou seção dentro da própria tela da
// sessão (ver SessionDetails.jsx), então não há mais link nenhum pra apontar aqui.
const NAV_GROUPS = [
  {
    label: null,
    items: [{ label: 'Dashboard', to: '/painel', icon: LayoutDashboard }],
  },
  {
    label: 'Montar a eleição',
    items: [
      { label: 'Assistente guiado', to: '/sessoes/assistente', icon: Wand2, accent: true },
      { label: 'Cargos', to: '/cargos', icon: Briefcase },
      { label: 'Partidos', to: '/partidos', icon: Flag },
      { label: 'Pessoas', to: '/pessoas', icon: IdCard },
      { label: 'Eleições', to: '/sessoes', icon: ClipboardList },
    ],
  },
  {
    label: 'Conta',
    items: [
      { label: 'Financeiro', to: '/financeiro', icon: Wallet },
    ],
  },
  {
    label: 'Conteúdo',
    items: [
      { label: 'Sistema eleitoral', to: '/sistema-eleitoral', icon: BookOpen },
      { label: 'Atividades', to: '/loja', icon: Store },
    ],
  },
];

// A Área de Gerenciamento (/gerenciamento*, Etapa 16) nunca aparece aqui, pra conta
// nenhuma — ela tem shell próprio (AdminLayout.jsx, Etapa 18), sem nenhum componente
// compartilhado com a área comum. Reduz o acoplamento entre as duas: um bug ou mudança
// futura num dos dois não tem como vazar visualmente pro outro.
function NavItem({ label, to, icon: Icon, accent }) {
  return (
    <NavLink
      to={to}
      end={to === '/painel'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          accent
            ? 'bg-accent/15 text-accent font-medium hover:bg-accent/25'
            : 'text-sidebar-foreground hover:bg-white/10 hover:text-white',
          isActive && !accent && 'bg-sidebar-accent text-white',
          isActive && accent && 'bg-accent text-accent-foreground hover:bg-accent',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent opacity-0 transition-opacity',
              isActive && !accent && 'opacity-100',
            )}
            aria-hidden="true"
          />
          <Icon className="size-4 shrink-0" />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ collapsed }) {
  if (collapsed) return null;

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Logo size={32} />
        <div className="flex flex-col leading-tight">
          <Wordmark dark className="text-sm" />
          <span className="text-[11px] text-sidebar-foreground/70">Urna eletrônica educacional</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4" aria-label="Principal">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.label ?? `group-${index}`} className="flex flex-col gap-1">
            {group.label && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </div>
        ))}
      </nav>

      <p className="px-5 py-4 text-xs leading-relaxed text-sidebar-foreground/50">
        Projeto educacional. Não é uma urna eletrônica oficial.
      </p>
    </aside>
  );
}

// Navegação compacta para telas pequenas (a sidebar fica oculta abaixo de md):
// mesma ordem dos grupos, com um separador sutil entre eles.
export function MobileNav() {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b bg-card px-3 py-2 md:hidden" aria-label="Principal">
      {NAV_GROUPS.map((group, groupIndex) => (
        <div key={group.label ?? `mgroup-${groupIndex}`} className="flex items-center gap-1">
          {groupIndex > 0 && <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />}
          {group.items.map(({ label, to, icon: Icon, accent }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/painel'}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm',
                  accent && 'bg-accent/15 font-medium text-accent',
                  !accent && isActive && 'bg-muted font-medium',
                )
              }
            >
              <Icon className="size-4" /> {label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
