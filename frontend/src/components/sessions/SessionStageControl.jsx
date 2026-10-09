import { Lock, UserPlus, Vote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmAction } from './ConfirmAction';

// Termos pensados em etapas didáticas (não nos nomes técnicos de status
// DRAFT/OPEN/FINISHED, que continuam só no backend): Candidatura → Votação →
// Encerrada. `back`/`forward` descrevem a transição que o clique nesse estágio
// dispara a partir de QUALQUER estágio atual — são resolvidos contra o estágio
// atual em getTransition, não fixos por posição.
const STAGES = [
  { status: 'DRAFT', label: 'Candidatura', icon: UserPlus },
  { status: 'OPEN', label: 'Votação', icon: Vote },
  { status: 'FINISHED', label: 'Encerrada', icon: Lock },
];

function getTransition(currentStatus, targetStatus) {
  if (currentStatus === 'DRAFT' && targetStatus === 'OPEN') {
    return {
      direction: 'forward',
      title: 'Iniciar a votação?',
      description:
        'A sessão passa para a etapa de Votação e começa a receber votos. Nome, ano e cargos deixam de poder ser alterados — mas dá pra voltar para a etapa de Candidatura a qualquer momento se precisar corrigir algo.',
      confirmLabel: 'Iniciar votação',
      action: 'open',
      successMessage: 'Votação iniciada.',
    };
  }
  if (currentStatus === 'OPEN' && targetStatus === 'DRAFT') {
    return {
      direction: 'back',
      title: 'Voltar para a etapa de Candidatura?',
      description:
        'Cargos e candidatos voltam a ficar editáveis. Os votos já registrados não são apagados e continuam valendo quando a votação for retomada.',
      confirmLabel: 'Voltar para candidatura',
      action: 'reopen',
      successMessage: 'Sessão voltou para a etapa de candidatura.',
    };
  }
  if (currentStatus === 'OPEN' && targetStatus === 'FINISHED') {
    return {
      direction: 'forward',
      title: 'Encerrar a votação?',
      description:
        'A sessão deixa de receber votos e a apuração fica disponível. Dá pra reabrir a votação depois, se precisar.',
      confirmLabel: 'Encerrar votação',
      action: 'finish',
      successMessage: 'Votação encerrada.',
    };
  }
  if (currentStatus === 'FINISHED' && targetStatus === 'OPEN') {
    return {
      direction: 'back',
      title: 'Reabrir a votação?',
      description:
        'A sessão volta a aceitar votos. Resultados e auditoria ficam indisponíveis até encerrar de novo.',
      confirmLabel: 'Reabrir votação',
      action: 'resume',
      successMessage: 'Votação reaberta.',
    };
  }
  return null;
}

// Indicador de etapa em formato de stepper horizontal: mostra as 3 etapas da
// sessão lado a lado (conectadas por uma linha), com a atual em destaque — e os
// dois vizinhos (um passo pra frente, um passo pra trás) clicáveis, cada um
// abrindo a confirmação certa pra essa transição. A etapa "dois passos" de
// distância (ex.: Candidatura vista a partir de Encerrada) fica só visível,
// sem clique: não dá pra pular etapa.
export function SessionStageControl({ session, working, onAction }) {
  const currentIndex = STAGES.findIndex((stage) => stage.status === session.status);

  return (
    <div className="flex items-center gap-1 rounded-full border bg-card p-1.5">
      {STAGES.map((stage, index) => {
        const isCurrent = index === currentIndex;
        const transition = isCurrent ? null : getTransition(session.status, stage.status);
        const clickable = Boolean(transition) && !working;
        const Icon = stage.icon;

        const segment = (
          <button
            type="button"
            disabled={!clickable}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed',
              isCurrent && 'bg-primary text-primary-foreground shadow-sm',
              !isCurrent && transition?.direction === 'forward' &&
                'text-primary hover:bg-primary/10',
              !isCurrent && transition?.direction === 'back' &&
                'text-muted-foreground hover:bg-muted hover:text-foreground',
              !isCurrent && !transition && 'text-muted-foreground/40',
            )}
          >
            <Icon className="size-4" />
            {stage.label}
          </button>
        );

        return (
          <div key={stage.status} className="flex items-center">
            {index > 0 && (
              <div className={cn('mx-1 h-px w-5 sm:w-8', index <= currentIndex ? 'bg-primary/30' : 'bg-border')} />
            )}
            {clickable ? (
              <ConfirmAction
                trigger={segment}
                title={transition.title}
                description={transition.description}
                confirmLabel={transition.confirmLabel}
                onConfirm={() => onAction(transition.action, transition.successMessage)}
              />
            ) : (
              segment
            )}
          </div>
        );
      })}
    </div>
  );
}
