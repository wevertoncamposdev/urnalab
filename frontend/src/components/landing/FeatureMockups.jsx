import { CheckCircle2, Download, FileText, GraduationCap, Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mini-ilustrações das telas do UrnaLab para a landing page. Não são screenshots reais
// (o produto não tem capturas de tela prontas pra marketing) — são recriações
// simplificadas e fiéis ao fluxo de cada tela, no estilo recomendado pela identidade
// visual (docs/identidade-visual.md item 7: "interfaces simplificadas, telas da
// aplicação, ícones didáticos"), usando só os tokens de cor já definidos no projeto.

function MockupFrame({ url, children, className }) {
  return (
    <div className={cn('w-full overflow-hidden rounded-2xl border bg-card shadow-sm', className)}>
      <div className="flex items-center gap-1.5 border-b bg-muted/60 px-3 py-2">
        <span className="size-2 rounded-full bg-coral" />
        <span className="size-2 rounded-full bg-accent" />
        <span className="size-2 rounded-full bg-success" />
        <span className="ml-2 truncate rounded bg-card px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          {url}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function FieldBar({ label, value, tone = 'default' }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div
        className={cn(
          'flex h-7 items-center rounded-md border px-2 text-xs',
          tone === 'filled' ? 'bg-muted text-foreground' : 'bg-card text-muted-foreground',
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function CriarSessaoMockup() {
  return (
    <MockupFrame url="urnalab.app/sessoes/assistente">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {['1', '2', '3', '4'].map((step) => (
            <span
              key={step}
              className={cn(
                'flex size-5 items-center justify-center rounded-full text-[10px] font-semibold',
                step === '2' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {step}
            </span>
          ))}
          <span className="text-[11px] text-muted-foreground">Cargos e candidatos</span>
        </div>
        <FieldBar label="Nome da sessão" value="Eleição do grêmio — 9º ano" tone="filled" />
        <FieldBar label="Cargo" value="Presidente de turma" tone="filled" />
        <div className="flex justify-end">
          <span className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            Avançar
          </span>
        </div>
      </div>
    </MockupFrame>
  );
}

export function CandidatarMockup() {
  return (
    <MockupFrame url="urnalab.app/candidatar/8f3a2c">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold">Inscreva sua candidatura</p>
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
            <GraduationCap className="size-5" />
          </span>
          <div className="flex flex-1 flex-col gap-2">
            <FieldBar label="Nome completo" value="Ana Beatriz Souza" tone="filled" />
          </div>
        </div>
        <FieldBar label="Número de candidato" value="23" tone="filled" />
        <div className="flex justify-end">
          <span className="rounded-md bg-success px-3 py-1.5 text-xs font-medium text-white">
            Enviar candidatura
          </span>
        </div>
      </div>
    </MockupFrame>
  );
}

export function VotarMockup() {
  return (
    <MockupFrame url="urnalab.app/votar/8f3a2c">
      <div className="flex gap-4">
        <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border bg-sidebar p-4 text-center">
          <span className="font-mono text-2xl font-bold text-white">23</span>
          <span className="text-[11px] font-medium text-white/80">Ana Beatriz Souza</span>
          <span className="text-[10px] text-white/50">Partido Jovem Ação</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <span
              key={n}
              className="flex size-6 items-center justify-center rounded bg-muted font-mono text-[10px] text-muted-foreground"
            >
              {n}
            </span>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}

export function ResultadosMockup() {
  const bars = [
    { name: 'Ana Beatriz (23)', pct: 54, tone: 'bg-success' },
    { name: 'Carlos Eduardo (45)', pct: 31, tone: 'bg-primary' },
    { name: 'Branco/Nulo', pct: 15, tone: 'bg-muted-foreground/40' },
  ];
  return (
    <MockupFrame url="urnalab.app/sessoes/42 · Resultados">
      <div className="flex flex-col gap-2.5">
        {bars.map((bar) => (
          <div key={bar.name} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium">{bar.name}</span>
              <span className="text-muted-foreground">{bar.pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', bar.tone)} style={{ width: `${bar.pct}%` }} />
            </div>
          </div>
        ))}
        <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-medium text-success">
          <CheckCircle2 className="size-3" /> Eleita
        </span>
      </div>
    </MockupFrame>
  );
}

export function AuditoriaMockup() {
  const rows = ['a3f9…21c0', 'e710…9bb4', '04d2…fa18'];
  return (
    <MockupFrame url="urnalab.app/sessoes/42 · Auditoria">
      <div className="flex flex-col gap-2">
        {rows.map((hash, index) => (
          <div key={hash} className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
            <ShieldCheck className="size-3.5 shrink-0 text-success" />
            <span className="flex-1 truncate font-mono text-[10px] text-muted-foreground">
              voto #{index + 1} · hash {hash}
            </span>
            <span className="shrink-0 text-[10px] font-medium text-success">válido</span>
          </div>
        ))}
      </div>
    </MockupFrame>
  );
}

export function ExportarPdfMockup() {
  return (
    <MockupFrame url="urnalab.app/sessoes/42 · Resultados" className="opacity-100">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-coral-soft text-coral">
          <FileText className="size-5" />
        </span>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-xs font-medium">resultado-eleicao-9ano.pdf</span>
          <span className="text-[10px] text-muted-foreground">Apuração completa, pronta pra imprimir</span>
        </div>
        <Download className="size-4 shrink-0 text-muted-foreground" />
      </div>
    </MockupFrame>
  );
}

export function AtividadesMockup() {
  return (
    <MockupFrame url="urnalab.app/loja">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Lock className="size-5" />
        </span>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-xs font-medium">Guia: eleição em sala de aula</span>
          <span className="text-[10px] text-muted-foreground">Roteiro de aula pronto, passo a passo</span>
        </div>
      </div>
    </MockupFrame>
  );
}
