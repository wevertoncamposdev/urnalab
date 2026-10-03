import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { TIMELINE } from '@/content/timeline';

// Linha do tempo do projeto: o que cada etapa construiu e o que ela ensina.
// Puramente informativo — ver ROADMAP.md pra ideias que ainda não viraram etapa.
export default function Timeline() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Linha do tempo do projeto"
        description="O que cada etapa construiu e o que ela ensina — útil pra quem usar este repo como material de estudo."
      />

      <ol className="relative flex flex-col gap-6 border-l-2 border-border pl-8">
        {TIMELINE.map((item, index) => (
          <li key={item.title} className="relative">
            <span className="absolute -left-[39px] top-1 flex size-5 items-center justify-center rounded-full border-2 border-primary bg-card text-[10px] font-semibold text-primary">
              {index + 1}
            </span>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{item.title}</CardTitle>
                  <Badge>{item.phase}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 pt-0 text-sm text-muted-foreground">
                <p>{item.summary}</p>
                <p className="border-t pt-2">
                  <span className="font-medium text-foreground">O que ensina: </span>
                  {item.lesson}
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
