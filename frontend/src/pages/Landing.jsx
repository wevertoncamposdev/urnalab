import { Link, Navigate } from 'react-router-dom';
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Link2,
  ShieldCheck,
  Smartphone,
  Vote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Logo } from '@/components/branding/Logo';
import { Wordmark } from '@/components/branding/Wordmark';
import { useAuth } from '@/hooks/useAuth';

const FEATURES = [
  {
    icon: ClipboardList,
    title: 'Monte a eleição do zero',
    description:
      'Cargos, partidos, pessoas e candidatos — com uma criação guiada para quem está começando e validações iguais às de uma eleição de verdade (número único por cargo, sigla única, etc.).',
  },
  {
    icon: Vote,
    title: 'Urna fiel à votação real',
    description:
      'Teclado numérico, confirmação do candidato antes de gravar, voto em branco e nulo — a mesma mecânica de digitar o número e ver nome, foto e partido na tela.',
  },
  {
    icon: BarChart3,
    title: 'Apuração automática',
    description:
      'Resultado por cargo assim que a votação é finalizada, com percentual sobre votos válidos e, em cargos majoritários, a regra de maioria absoluta com 2º turno.',
  },
  {
    icon: ShieldCheck,
    title: 'Auditoria com cadeia de hash',
    description:
      'Cada voto referencia o hash do anterior na mesma sessão — qualquer alteração, remoção ou reordenação depois de gravado é detectável, na tela de Auditoria.',
  },
  {
    icon: Smartphone,
    title: 'Link público de votação',
    description:
      'Enquanto a sessão está aberta, qualquer pessoa com o link vota pelo próprio celular, sem precisar de conta — ótimo para simular uma eleição com a turma inteira.',
  },
  {
    icon: Link2,
    title: 'Sua conta, seus dados',
    description:
      'Cada conta tem suas próprias sessões, cargos, partidos e candidatos, isolados dos de qualquer outra — dá para simular várias eleições sem misturar uma com a outra.',
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
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <Link to="/registro">Criar conta</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export default function Landing() {
  const { status } = useAuth();
  if (status === 'authenticated') return <Navigate to="/painel" replace />;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* Hero: o banner já carrega a marca e a proposta visualmente — o H1 real
          (texto selecionável, lido por leitor de tela) acompanha ao lado/abaixo
          em vez de duplicar a mesma frase por cima da imagem. */}
      <section className="mx-auto flex max-w-6xl flex-col-reverse items-center gap-10 px-4 py-12 sm:px-6 lg:flex-row lg:py-20">
        <div className="flex flex-1 flex-col gap-5 text-center lg:text-left">
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

      {/* Features */}
      <section className="border-y bg-muted/30 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto mb-10 flex max-w-2xl flex-col gap-2 text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-primary">O que já dá pra fazer</span>
            <h2 className="text-2xl font-semibold sm:text-3xl">Tudo que uma eleição de verdade tem</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <Card key={title}>
                <CardContent className="flex flex-col gap-3 p-6">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona + imagem vertical */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
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
    </div>
  );
}
