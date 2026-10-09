import { LineChart, PieChart, Table2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatNumber } from '@/lib/format';
import { PositionResultsTable } from '@/components/results/PositionResultsTable';
import { PositionPieView } from '@/components/results/PositionPieView';
import { PositionTimelineChart } from '@/components/results/PositionTimelineChart';

// Apuração de um cargo, com três formas de ver o mesmo resultado — tabela (densa,
// boa pra comparar números), pizza (proporção, boa pra apresentar) e temporal
// (evolução voto a voto, boa pra contar a história da apuração). Brancos/nulos não
// entram na disputa (convenção eleitoral) e ficam só no resumo do rodapé.
export function PositionResult({ result }) {
  const { label, candidates, totals, winners, runoff, timeline } = result;
  const runoffCandidates = runoff
    ? candidates.filter((c) => runoff.candidateIds.includes(c.id))
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {runoff && (
          <Alert className="mb-3">
            <AlertDescription>
              Ninguém alcançou maioria absoluta dos votos válidos (mais de 50%).
              {runoff.tied && (
                <> <strong>Empate</strong> no ponto de corte do 2º turno —</>
              )}{' '}
              Vai para o 2º turno: <strong>{runoffCandidates.map((c) => c.name).join(' × ')}</strong>.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="tabela">
          <TabsList>
            <TabsTrigger value="tabela" icon={Table2}>Tabela</TabsTrigger>
            <TabsTrigger value="pizza" icon={PieChart}>Pizza</TabsTrigger>
            <TabsTrigger value="temporal" icon={LineChart}>Temporal</TabsTrigger>
          </TabsList>
          <TabsContent value="tabela" className="pt-4">
            <PositionResultsTable candidates={candidates} winners={winners} runoff={runoff} />
          </TabsContent>
          <TabsContent value="pizza" className="pt-4">
            <PositionPieView candidates={candidates} validVotes={totals.validVotes} />
          </TabsContent>
          <TabsContent value="temporal" className="pt-4">
            <PositionTimelineChart candidates={candidates} timeline={timeline} />
          </TabsContent>
        </Tabs>

        <div className="mt-3 flex flex-wrap justify-between gap-x-6 gap-y-1 border-t pt-3 text-sm text-muted-foreground">
          <span>Válidos: {formatNumber(totals.validVotes)}</span>
          <span>Brancos: {formatNumber(totals.blankVotes)} ({totals.blankPercent.toFixed(1)}%)</span>
          <span>Nulos: {formatNumber(totals.nullVotes)} ({totals.nullPercent.toFixed(1)}%)</span>
          <span>Total: {formatNumber(totals.totalVotes)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
