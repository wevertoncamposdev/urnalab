import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, ChevronDown, Maximize, Minimize } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { OrgChart } from '@/components/org-chart/OrgChart';
import { POSITIONS_INFO, getPositionInfo, positionSlug } from '@/content/electoral-system';

const SYSTEM_VARIANT = { Majoritário: 'dark', Proporcional: 'default' };

const ROWS = [
  { id: 'executivo', label: 'Poder Executivo' },
  { id: 'legislativo', label: 'Poder Legislativo' },
];

const COLUMNS = [
  { id: 'federal', label: 'Federal' },
  { id: 'estadual', label: 'Estadual' },
  { id: 'municipal', label: 'Municipal' },
];

// Grade pronta pra o OrgChart: linha = poder, coluna = esfera de governo —
// assim o organograma mostra de cara onde cada cargo se encaixa nas duas
// classificações mais importantes do sistema eleitoral brasileiro.
const CHART_ITEMS = POSITIONS_INFO.map((position) => ({
  id: position.code,
  anchorId: positionSlug(position.code),
  rowId: position.power.toLowerCase(),
  columnId: position.scope.toLowerCase(),
  title: position.label,
  subtitle: `Mandato de ${position.term}`,
  badge: <Badge variant={SYSTEM_VARIANT[position.system]}>{position.system}</Badge>,
}));

function goToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Um "momento" da explicação: ocupa quase a tela toda, pra ler um assunto de
// cada vez (como uma landpage), com um botão pra rolar até o próximo.
function Section({ id, eyebrow, title, description, children, nextId, nextLabel = 'Continuar' }) {
  return (
    <section id={id} className="flex min-h-[80vh] scroll-mt-6 flex-col justify-center gap-8 px-4 py-16">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
        {eyebrow && <span className="text-sm font-semibold uppercase tracking-wide text-primary">{eyebrow}</span>}
        <h2 className="text-3xl font-semibold sm:text-4xl">{title}</h2>
        {description && <p className="text-base text-muted-foreground sm:text-lg">{description}</p>}
      </div>
      {children}
      {nextId && (
        <div className="flex justify-center pt-2">
          <Button type="button" variant="outline" size="lg" className="gap-2 rounded-full" onClick={() => goToSection(nextId)}>
            {nextLabel} <ChevronDown className="size-4" />
          </Button>
        </div>
      )}
    </section>
  );
}

// Página de referência sobre o sistema eleitoral brasileiro, em formato de
// landpage: cada seção explica um conceito por vez (poderes, esferas, sistema
// de votação, turnos) e termina no organograma clicável dos cargos. A página
// inteira pode entrar em "modo imersivo" (botão fixo no topo) pra ficar em
// foco do começo ao fim. Não usamos a API nativa de Fullscreen do navegador
// aqui — ela se mostrou inconsistente pra rolar dentro do próprio elemento;
// em vez disso é um overlay fixo (position: fixed, nossa própria rolagem),
// mais previsível. Conteúdo estático (não depende da API). O OrgChart em si é
// genérico: a mesma estrutura (linhas/colunas/itens) poderá, no futuro,
// mostrar os candidatos vencedores de uma sessão finalizada nessas mesmas
// posições, em vez dos cargos "em abstrato".
export default function ElectoralSystem() {
  const location = useLocation();
  const [selectedCode, setSelectedCode] = useState(POSITIONS_INFO[0].code);
  const selected = useMemo(() => getPositionInfo(selectedCode), [selectedCode]);
  const [immersive, setImmersive] = useState(false);

  useEffect(() => {
    if (!immersive) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleKeyDown(event) {
      if (event.key === 'Escape') setImmersive(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [immersive]);

  useEffect(() => {
    if (!location.hash) return;
    const code = POSITIONS_INFO.find((p) => positionSlug(p.code) === location.hash.slice(1))?.code;
    if (!code) return;
    setSelectedCode(code);
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [location.hash]);

  return (
    <div className={cn('bg-background', immersive && 'fixed inset-0 z-50 overflow-y-auto')}>
      <div className="sticky top-4 z-10 mx-auto flex max-w-5xl justify-end px-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setImmersive((current) => !current)}
          aria-label={immersive ? 'Sair da tela cheia' : 'Tela cheia'}
          title={immersive ? 'Sair da tela cheia' : 'Tela cheia'}
        >
          {immersive ? <Minimize /> : <Maximize />}
        </Button>
      </div>

      <div className="relative mx-auto flex max-w-5xl flex-col">
      <Section
        id="intro"
        title="Sistema eleitoral brasileiro"
        description="Para quem vai votar no simulador: o que cada cargo faz, quanto dura o mandato e quando existe segundo turno. Role a página (ou use os botões) pra ver cada parte com calma."
        nextId="poderes"
        nextLabel="Começar"
      />

      <Section
        id="poderes"
        eyebrow="1. Poderes"
        title="Executivo x Legislativo"
        nextId="esferas"
      >
        <Card className="mx-auto w-full max-w-3xl">
          <CardContent className="p-8 text-base text-muted-foreground sm:text-lg">
            O <strong className="text-foreground">Executivo</strong> (Presidente, Governador, Prefeito) administra:
            comanda a máquina pública, propõe o orçamento e sanciona leis. O{' '}
            <strong className="text-foreground">Legislativo</strong> (Senador, Deputados, Vereador) elabora e vota as
            leis, e fiscaliza o que o Executivo faz.
          </CardContent>
        </Card>
      </Section>

      <Section
        id="esferas"
        eyebrow="2. Abrangência"
        title="Federal, estadual e municipal"
        nextId="sistema"
      >
        <Card className="mx-auto w-full max-w-3xl">
          <CardContent className="p-8 text-base text-muted-foreground sm:text-lg">
            Cada cargo atua em um nível diferente de governo: o <strong className="text-foreground">federal</strong>{' '}
            cuida do país inteiro, o <strong className="text-foreground">estadual</strong> de um estado, e o{' '}
            <strong className="text-foreground">municipal</strong> de uma cidade. O que é decidido numa esfera não
            interfere diretamente nas outras.
          </CardContent>
        </Card>
      </Section>

      <Section
        id="sistema"
        eyebrow="3. Sistema de votação"
        title="Majoritário x proporcional"
        nextId="turnos"
      >
        <Card className="mx-auto w-full max-w-3xl">
          <CardContent className="p-8 text-base text-muted-foreground sm:text-lg">
            No <strong className="text-foreground">majoritário</strong> vence quem tem mais votos individuais —
            usado para os cargos do Executivo e para Senador. No{' '}
            <strong className="text-foreground">proporcional</strong>, usado para Deputados e Vereador, as vagas são
            divididas entre os partidos conforme o total de votos de cada um.
          </CardContent>
        </Card>
      </Section>

      <Section
        id="turnos"
        eyebrow="4. Turnos"
        title="Turno único x dois turnos"
        nextId="organograma"
        nextLabel="Ver o organograma"
      >
        <Card className="mx-auto w-full max-w-3xl">
          <CardContent className="flex flex-col gap-4 p-8 text-base text-muted-foreground sm:text-lg">
            <p>
              Só cargos majoritários podem ter 2º turno — e só quando ninguém atinge maioria absoluta (mais de 50%
              dos votos válidos, sem contar brancos e nulos) no 1º turno. Nesse caso, os dois candidatos mais
              votados disputam uma segunda rodada.
            </p>
            <p>
              Presidente e Governador seguem sempre essa regra. Prefeito só tem 2º turno em municípios com mais de
              200 mil eleitores. Senador é majoritário mas nunca tem 2º turno. Cargos proporcionais (Deputados e
              Vereador) também são sempre em turno único.
            </p>
            <p className="italic">
              Neste simulador, "permite 2º turno" é uma opção por cargo (tela de Cargos) — ative para quem deve
              seguir a regra de maioria absoluta. Quando ninguém alcança a maioria, a tela de Resultados mostra
              quem disputaria a segunda rodada e deixa criar essa sessão com um clique, já com os dois candidatos
              registrados.
            </p>
          </CardContent>
        </Card>
      </Section>

      <section id="organograma" className="flex min-h-[80vh] scroll-mt-6 flex-col justify-center gap-6 px-4 py-16">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">5. Organograma</span>
          <h2 className="text-3xl font-semibold sm:text-4xl">Organograma dos cargos</h2>
          <p className="text-base text-muted-foreground sm:text-lg">Clique em um cargo para ver os detalhes.</p>
        </div>

        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          <OrgChart rows={ROWS} columns={COLUMNS} items={CHART_ITEMS} selectedId={selectedCode} onSelect={setSelectedCode} />

          {selected && (
            <Card className="scroll-mt-4">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl">{selected.label}</CardTitle>
                  <Badge variant={SYSTEM_VARIANT[selected.system]}>{selected.system}</Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>{selected.power}</span>
                  <span>·</span>
                  <span>{selected.scope}</span>
                  <span>·</span>
                  <span>Mandato de {selected.term}</span>
                  <span>·</span>
                  <span>{selected.rounds}</span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-0 text-base text-muted-foreground">
                <p>{selected.summary}</p>
                <p>{selected.roundsDetail}</p>
              </CardContent>
            </Card>
          )}

          <Card className="mx-auto w-full max-w-3xl">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="flex items-center gap-3">
                <BookOpen className="size-5 shrink-0 text-primary" />
                <span className="text-sm text-muted-foreground">
                  Planos de aula de cidadania pra usar em sala, com o UrnaLab, estão na loja.
                </span>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/loja">Ver materiais</Link>
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-center pt-2">
            <Button
              type="button"
              variant="ghost"
              className="gap-2 text-muted-foreground"
              onClick={() => goToSection('intro')}
            >
              Voltar ao início
            </Button>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}
