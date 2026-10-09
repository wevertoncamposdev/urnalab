import { useEffect } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Link2,
  ShieldCheck,
  Sparkles,
  Vote,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/branding/Logo';
import { Wordmark } from '@/components/branding/Wordmark';
import { DonationButton } from '@/components/landing/DonationButton';
import {
  AtividadesMockup,
  AuditoriaMockup,
  CandidatarMockup,
  CriarSessaoMockup,
  ExportarPdfMockup,
  ResultadosMockup,
  VotarMockup,
} from '@/components/landing/FeatureMockups';
import { useAuth } from '@/hooks/useAuth';

const FREE_FEATURES = [
  {
    icon: Sparkles,
    title: 'Criar sessão',
    description:
      'Um assistente guiado monta a eleição com você: cargos, partidos e candidatos, com as mesmas validações de uma eleição de verdade — número único por cargo, sigla única, e por aí vai.',
    visual: CriarSessaoMockup,
  },
  {
    icon: Link2,
    title: 'Link para se candidatar',
    description:
      'Gere um link público para que qualquer pessoa possa se candidatar e enviar sua proposta. Sem precisar de conta, direto do celular. Você só aprova.',
    visual: CandidatarMockup,
  },
  {
    icon: Vote,
    title: 'Link para votar',
    description:
      'Enquanto a sessão está aberta, qualquer pessoa com o link vota pelo próprio celular ou computador — teclado numérico, confirmação do voto, voto em branco e nulo, igual à urna real.',
    visual: VotarMockup,
  },
  {
    icon: BarChart3,
    title: 'Resultados',
    description:
      'Assim que a votação fecha, a apuração sai na hora: percentual por candidato, maioria absoluta e 2º turno calculados automaticamente nos cargos majoritários.',
    visual: ResultadosMockup,
  },
  {
    icon: ShieldCheck,
    title: 'Auditoria',
    description:
      'Cada voto referencia o hash do voto anterior na mesma sessão. Qualquer alteração, remoção ou reordenação depois de gravado fica visível na tela de auditoria.',
    visual: AuditoriaMockup,
  },
];

const PAID_FEATURES = [
  {
    icon: FileText,
    title: 'Exportar resultado em PDF',
    description: 'Baixe a apuração completa em PDF, pronta pra imprimir e colar no mural da escola.',
    visual: ExportarPdfMockup,
    badge: { label: 'Disponível', variant: 'success' },
  },
  {
    icon: FileSpreadsheet,
    title: 'Exportar resultado em CSV',
    description: 'Planilha com os votos da sessão pra analisar, cruzar dados ou arquivar com a turma.',
    visual: null,
    badge: { label: 'Em breve', variant: 'warning' },
  },
  {
    icon: Sparkles,
    title: 'Atividades prontas para sala de aula',
    description: 'Roteiros e guias de aula prontos pra conduzir a eleição com a turma do início ao fim.',
    visual: AtividadesMockup,
    badge: { label: 'Disponível', variant: 'success' },
  },
];

const STEPS = [
  { title: 'Crie sua conta', description: 'Já nasce com os 7 cargos do sistema brasileiro prontos para editar.' },
  { title: 'Monte a eleição', description: 'Cadastre partidos, pessoas e candidatos — ou use o Criar sessão.' },
  { title: 'Vote', description: 'Pela urna autenticada ou pelo link público, direto do celular.' },
  { title: 'Apure e audite', description: 'Resultado por cargo e a cadeia de hashes conferida voto a voto.' },
];

function PublicHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Logo size={36} />
          <Wordmark className="text-lg" />
        </div>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a href="#funcionalidades" className="transition-colors hover:text-foreground">Funcionalidades</a>
          <a href="#planos" className="transition-colors hover:text-foreground">Planos</a>
          <a href="#como-funciona" className="transition-colors hover:text-foreground">Como funciona</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <Link to="/registro">Criar conta</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function FeatureRow({ feature, reverse }) {
  const Icon = feature.icon;
  const Visual = feature.visual;
  return (
    <div className={`grid items-center gap-8 lg:grid-cols-2 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
      <div className="flex flex-col gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-semibold">{feature.title}</h3>
          {feature.badge && <Badge variant={feature.badge.variant}>{feature.badge.label}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground sm:text-base">{feature.description}</p>
      </div>
      <div className="flex items-center justify-center">
        {Visual ? (
          <Visual />
        ) : (
          <div className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            <Clock className="size-6" />
            <span className="text-sm font-medium">Chegando em breve</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Landing() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Volta do Checkout Pro de uma doação feita sem login (ver DonationButton +
  // backend/src/services/donation.service.js createCheckout, returnPath '/' pra quem
  // doa anônimo). Mesmo padrão de SessionResultsSection.jsx pro retorno do pagamento
  // de exportação — roda antes do redirect de autenticado abaixo pra não quebrar a
  // ordem dos hooks entre renders.
  useEffect(() => {
    const donation = searchParams.get('donation');
    if (!donation) return;

    if (donation === 'success') toast.success('Doação recebida! Muito obrigado por apoiar o UrnaLab. 💛');
    else if (donation === 'pending') toast.message('Doação em processamento. Assim que for aprovada, confirmamos por aqui.');
    else if (donation === 'failure') toast.error('Não foi possível concluir a doação. Tente de novo quando quiser.');

    navigate('/', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'authenticated') return <Navigate to="/painel" replace />;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* Hero: o banner já carrega a marca e a proposta visualmente — o H1 real
          (texto selecionável, lido por leitor de tela) acompanha ao lado/abaixo
          em vez de duplicar a mesma frase por cima da imagem. */}
      <section className="mx-auto flex max-w-6xl flex-col-reverse items-center gap-10 px-4 py-12 sm:px-6 lg:flex-row lg:py-20">
        <div className="flex flex-1 flex-col gap-5 text-center lg:text-left">
          <Badge variant="accent" className="mx-auto w-fit lg:mx-0">
            Grátis para criar sua primeira eleição
          </Badge>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            Simule uma eleição completa, da urna à apuração.
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            O UrnaLab é um simulador educacional de urna eletrônica: cadastre candidatos, abra a
            votação, vote pela urna ou por um link público, e acompanhe o resultado e a auditoria —
            tudo como uma eleição de verdade, sem ser uma.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start">
            <Button asChild size="lg">
              <Link to="/registro">Criar conta grátis</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Já tenho conta</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Projeto educacional — não é uma urna eletrônica oficial nem reproduz sistemas do TSE.
          </p>
        </div>
        <div className="flex-1">
          <img
            src="/img/urnalab-banner.png"
            alt="UrnaLab — simulador de urna eletrônica para educação. Eleição em sala de aula: aprenda cidadania na prática."
            className="w-full rounded-2xl border shadow-sm"
          />
        </div>
      </section>

      {/* Funcionalidades gratuitas */}
      <section id="funcionalidades" className="border-y bg-muted/30 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-14 flex max-w-2xl flex-col gap-2 text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-primary">
              Grátis, sempre
            </span>
            <h2 className="text-2xl font-semibold sm:text-3xl">Tudo que uma eleição de verdade tem</h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              As cinco telas que levam uma eleição do zero até a apuração final — sem custo.
            </p>
          </div>
          <div className="flex flex-col gap-16">
            {FREE_FEATURES.map((feature, index) => (
              <FeatureRow key={feature.title} feature={feature} reverse={index % 2 === 1} />
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades pagas */}
      <section id="planos" className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-10 flex max-w-2xl flex-col gap-2 text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-coral">
              Pra ir além
            </span>
            <h2 className="text-2xl font-semibold sm:text-3xl">Recursos extras, quando precisar</h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              A eleição em si é sempre gratuita. Esses recursos ajudam na hora de documentar e
              aprofundar o aprendizado em sala.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PAID_FEATURES.map((feature) => {
              const Icon = feature.icon;
              const Visual = feature.visual;
              return (
                <div key={feature.title} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-coral-soft text-coral">
                      <Icon className="size-5" />
                    </span>
                    <Badge variant={feature.badge.variant}>{feature.badge.label}</Badge>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                  {Visual && <Visual />}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Como funciona + imagem vertical */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,320px)]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold uppercase tracking-wide text-primary">Como funciona</span>
              <h2 className="text-2xl font-semibold sm:text-3xl">Da conta ao resultado em quatro passos</h2>
            </div>
            <ol className="flex flex-col gap-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <img
            src="/img/urnalab-post.png"
            alt="UrnaLab — simulador de urna eletrônica para educação"
            className="mx-auto w-full max-w-xs rounded-2xl border shadow-sm"
          />
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-sidebar py-16 text-sidebar-foreground">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 text-center sm:px-6">
          <CheckCircle2 className="size-10 text-accent" />
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Pronto para simular sua eleição?</h2>
          <p className="text-sidebar-foreground/80">
            Leva menos de um minuto para criar a conta e começar a cadastrar candidatos.
          </p>
          <Button asChild size="lg">
            <Link to="/registro">Criar conta grátis</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center sm:px-6">
          <Logo size={28} />
          <p className="text-xs text-muted-foreground">
            UrnaLab é um projeto educacional. Não é uma urna eletrônica oficial e não reproduz
            sistemas ou interfaces oficiais de votação.
          </p>
        </div>
      </footer>

      <DonationButton />
    </div>
  );
}
