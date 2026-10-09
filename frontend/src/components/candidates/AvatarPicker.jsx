import { useEffect, useMemo, useRef, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { createAvatar } from '@dicebear/core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

// Mesmo tamanho/formato de uma foto capturada pela câmera ou enviada por upload
// (ver PhotoCaptureField CAPTURE_SIZE) — assim o avatar escolhido aqui vira o
// mesmo tipo de data URI que o backend já sabe decodificar e salvar como foto,
// sem precisar de nenhum campo ou rota nova.
const AVATAR_SIZE = 480;
const GRID_SIZE = 12;

// Estilos do DiceBear (https://www.dicebear.com) escolhidos só entre os que não
// exigem crédito/atribuição (CC0, ou "livre pra uso pessoal/comercial" sem
// cláusula CC-BY — verificado lendo o LICENSE de cada pacote, não só a doc; ver
// ROADMAP.md). Versão fixada em 9.4.3 pra todos (inclusive @dicebear/core) de
// propósito, sem "^": é o par testado manualmente — @dicebear/core 10.x/11.x
// ainda não tem pacotes de estilo publicados na mesma major.
//
// Cada `loader` é um `import()` dinâmico com o nome do pacote literal — é o que
// faz o Vite code-splitar cada estilo no seu próprio chunk, carregado só quando
// a aba daquele estilo é aberta (ver também o lazy-load do dialog inteiro em
// PhotoCaptureField.jsx, pra nenhum desses chunks entrar no bundle inicial das
// páginas que usam este campo).
const STYLES = [
  { key: 'open-peeps', label: 'Pessoas', loader: () => import('@dicebear/open-peeps') },
  { key: 'bottts', label: 'Robôs', loader: () => import('@dicebear/bottts') },
  { key: 'pixel-art', label: 'Retrô', loader: () => import('@dicebear/pixel-art') },
  { key: 'lorelei', label: 'Ilustrado', loader: () => import('@dicebear/lorelei') },
  { key: 'notionists', label: 'Minimalista', loader: () => import('@dicebear/notionists') },
];

// Só pra variar a ilustração sorteada — não é sensível a segurança.
function randomSeeds(count) {
  return Array.from({ length: count }, () => Math.random().toString(36).slice(2));
}

const IDLE_ENTRY = { status: 'idle', mod: null, seeds: null, error: null };

export function AvatarPickerDialog({ open, onOpenChange, onSelect }) {
  const [activeStyle, setActiveStyle] = useState(STYLES[0].key);
  const [stylesState, setStylesState] = useState({});
  const [rasterizing, setRasterizing] = useState(false);

  const current = stylesState[activeStyle] ?? IDLE_ENTRY;

  // Só pra não aplicar o resultado de um import depois que o dialog já foi
  // desmontado de vez (ver PhotoCaptureField.jsx: fechar desmonta a árvore
  // inteira). O `StrictMode` (ver main.jsx) monta→desmonta→monta de propósito
  // em desenvolvimento pra pegar bug de limpeza — sem resetar pra `false` no
  // setup, a desmontagem "falsa" do meio desse ciclo deixava isso travado em
  // `true` pro resto da vida do componente (bug real, reproduzido: o avatar
  // carregava certinho mas `loader() resolveu` já via `unmounted: true` e
  // descartava o resultado).
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  // Controla "esse estilo já foi pedido" via `ref`, não via `stylesState` —
  // `setState` (mesmo com função) não atualiza nada de forma síncrona: o
  // updater só roda no próximo render, então checar uma variável que ele
  // seta não funciona pra decidir algo ainda dentro da mesma chamada (uma
  // primeira tentativa de corrigir isso caiu exatamente nessa pegadinha). Um
  // `ref` muda na hora, de verdade — por isso é o jeito certo de saber,
  // sincronamente, se `loadStyle` já está (ou já esteve) em andamento pra uma
  // chave antes de disparar `import()` de novo.
  const requestedKeysRef = useRef(new Set());

  // Carrega o pacote de `key` sob demanda, a não ser que já tenha sido pedido
  // antes (`requestedKeysRef`). Usada tanto pelo efeito abaixo quanto por
  // `retryLoad`.
  function loadStyle(key) {
    if (requestedKeysRef.current.has(key)) return;
    requestedKeysRef.current.add(key);
    setStylesState((prev) => ({ ...prev, [key]: { ...IDLE_ENTRY, status: 'loading' } }));

    const style = STYLES.find((s) => s.key === key);
    style
      .loader()
      .then((mod) => {
        if (unmountedRef.current) return;
        setStylesState((prev) => ({
          ...prev,
          [key]: { status: 'ready', mod, seeds: randomSeeds(GRID_SIZE), error: null },
        }));
      })
      .catch((error) => {
        if (unmountedRef.current) return;
        setStylesState((prev) => ({ ...prev, [key]: { status: 'error', mod: null, seeds: null, error } }));
      });
  }

  // Importante: as deps são só `[open, activeStyle]` — NÃO `current.status`
  // nem qualquer outra coisa que `loadStyle` mude. Uma versão anterior disto
  // dependia do status, e isso causava um bug real (reproduzido em dev): o
  // próprio `setStylesState` que marca o estilo como "loading" mudava
  // `current.status`, o que disparava este efeito de novo (cleanup incluído)
  // antes do `import()` terminar, cancelando a própria carga em andamento —
  // o dialog ficava preso no skeleton pra sempre.
  useEffect(() => {
    if (open) loadStyle(activeStyle);
  }, [open, activeStyle]);

  function retryLoad() {
    requestedKeysRef.current.delete(activeStyle);
    loadStyle(activeStyle);
  }

  function handleReroll() {
    setStylesState((prev) => ({
      ...prev,
      [activeStyle]: { ...prev[activeStyle], seeds: randomSeeds(GRID_SIZE) },
    }));
  }

  // Só na escolha final é que o SVG vira PNG: pra pré-visualização na grade,
  // um <img src="data:image/svg+xml..."> já basta, sem precisar rasterizar 12
  // avatares por estilo. `open` é checado antes de aplicar o resultado porque o
  // dialog pode ter sido fechado por outro caminho enquanto a imagem carregava.
  function handlePick(seed) {
    const svgDataUri = createAvatar(current.mod, { seed }).toDataUri();
    setRasterizing(true);
    const img = new Image();
    img.onload = () => {
      if (!open) return;
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      canvas.getContext('2d').drawImage(img, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      onSelect(canvas.toDataURL('image/png'));
      setRasterizing(false);
      onOpenChange(false);
    };
    img.onerror = () => setRasterizing(false);
    img.src = svgDataUri;
  }

  const previews = useMemo(
    () =>
      current.status === 'ready'
        ? current.seeds.map((seed) => ({ seed, uri: createAvatar(current.mod, { seed }).toDataUri() }))
        : [],
    [current.status, current.mod, current.seeds],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escolher avatar</DialogTitle>
          <DialogDescription>
            Uma imagem pronta em vez de foto pessoal — bom pra manter o cadastro mais didático.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {STYLES.map((style) => (
            <Button
              key={style.key}
              type="button"
              size="sm"
              variant={activeStyle === style.key ? 'default' : 'outline'}
              onClick={() => setActiveStyle(style.key)}
            >
              {style.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {STYLES.find((s) => s.key === activeStyle).label}
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={current.status !== 'ready' || rasterizing}
            onClick={handleReroll}
          >
            <Shuffle /> Sortear de novo
          </Button>
        </div>

        {current.status === 'error' && (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar este estilo</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>{current.error?.message ?? 'Verifique sua conexão e tente de novo.'}</span>
              <Button type="button" variant="outline" size="sm" onClick={retryLoad}>
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {(current.status === 'idle' || current.status === 'loading') && (
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: GRID_SIZE }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-full" />
            ))}
          </div>
        )}

        {current.status === 'ready' && (
          <div className="grid grid-cols-6 gap-2">
            {previews.map(({ seed, uri }) => (
              <button
                key={seed}
                type="button"
                disabled={rasterizing}
                onClick={() => handlePick(seed)}
                className="aspect-square overflow-hidden rounded-full transition-transform hover:scale-110 disabled:pointer-events-none disabled:opacity-50"
                title="Usar este avatar"
                aria-label="Usar este avatar"
              >
                <img src={uri} alt="" className="h-full w-full" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
