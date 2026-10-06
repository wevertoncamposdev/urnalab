import { useEffect, useRef, useState } from 'react';
import { Camera, Check, RotateCcw, Trash2, Upload, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolvePhotoUrl } from '@/services/api';

// Captura sempre um quadrado: é como a foto é exibida em todo o resto do app
// (CandidateAvatar é sempre um círculo via object-cover). Pedir isso já na
// câmera (constraint `aspectRatio`) é só uma sugestão — nem toda câmera atende
// — por isso `takeSnapshot` também recorta pro quadrado central na hora de
// desenhar no canvas, não importa a proporção nativa que a câmera devolveu
// (16:9 comum em webcam de notebook, outra coisa no celular, etc.).
const CAPTURE_SIZE = 480;

const CAMERA_ERROR_MESSAGES = {
  NotAllowedError: 'Permissão da câmera negada. Libere o acesso nas configurações do navegador.',
  NotFoundError: 'Nenhuma câmera encontrada neste dispositivo.',
  NotReadableError: 'A câmera já está em uso por outro aplicativo ou aba.',
};

// Campo de foto: aceita um arquivo enviado do dispositivo, uma captura da
// webcam, ou um link http(s) digitado. Upload e câmera viram um data URI (o
// backend decodifica, salva o arquivo e devolve o caminho). `value` é sempre o
// que vai no formulário: um link, um caminho já salvo (/photos/...) ou,
// enquanto não enviado, o data URI recém-gerado.
export function PhotoCaptureField({ id, value, onChange, disabled }) {
  const [capturing, setCapturing] = useState(false);
  const [stream, setStream] = useState(null);
  const [snapshot, setSnapshot] = useState(null); // prévia aguardando confirmação
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Único lugar que para as tracks: dispara ao trocar/zerar o stream e no
  // desmonte do componente (ex.: fechar o diálogo com a câmera ainda ligada).
  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  // O <video> só existe no DOM quando `capturing` é true, e é recriado do zero
  // sempre que se alterna entre a prévia ao vivo e o snapshot congelado — por
  // isso este efeito roda de novo a cada troca (via a dependência `snapshot`),
  // conectando o stream ao elemento que acabou de montar. Fazer isso direto no
  // handler de clique não funciona: a re-renderização que cria o <video> ainda
  // não aconteceu naquele momento, e a câmera liga com a prévia preta.
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream && !snapshot) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
  }, [stream, capturing, snapshot]);

  function stopCamera() {
    setStream(null);
    setCapturing(false);
    setSnapshot(null);
  }

  async function startCamera() {
    setError(null);
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: CAPTURE_SIZE },
          height: { ideal: CAPTURE_SIZE },
          aspectRatio: { ideal: 1 },
          facingMode: 'user',
        },
      });
      setStream(nextStream);
      setCapturing(true);
    } catch (err) {
      setError(
        CAMERA_ERROR_MESSAGES[err.name] ?? 'Não foi possível acessar a câmera. Verifique as permissões do navegador.',
      );
    }
  }

  // Congela o quadro atual numa prévia (sem confirmar ainda, pra dar chance de
  // repetir). O vídeo é espelhado na tela (parece mais natural, como um
  // espelho); espelha o canvas do mesmo jeito para a foto final bater com o
  // que a pessoa viu ao tirar. Recorta pro maior quadrado central do quadro
  // nativo da câmera (`videoWidth`/`videoHeight`, não o que foi pedido em
  // `startCamera` — a câmera pode ter ignorado o pedido) em vez de esticar o
  // retângulo inteiro pro quadrado: é isso que evita a distorção.
  function takeSnapshot() {
    const video = videoRef.current;
    if (!video) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = CAPTURE_SIZE;
    canvas.height = CAPTURE_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.translate(CAPTURE_SIZE, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, size, size, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);
    setSnapshot(canvas.toDataURL('image/jpeg', 0.8));
  }

  function confirmSnapshot() {
    onChange(snapshot);
    stopCamera();
  }

  function openFilePicker() {
    setError(null);
    fileInputRef.current?.click();
  }

  // Mesmo recorte quadrado central da câmera (ver `takeSnapshot`), mas sem
  // espelhar — a foto enviada já está do jeito que a pessoa quer.
  function handleFileSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // permite selecionar o mesmo arquivo de novo depois
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onerror = () => setError('Não foi possível ler o arquivo selecionado.');
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => setError('Não foi possível abrir essa imagem.');
      img.onload = () => {
        const size = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - size) / 2;
        const sy = (img.naturalHeight - size) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = CAPTURE_SIZE;
        canvas.height = CAPTURE_SIZE;
        canvas.getContext('2d').drawImage(img, sx, sy, size, size, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);
        onChange(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  const isDataUri = value?.startsWith('data:');
  const previewUrl = isDataUri ? value : resolvePhotoUrl(value);

  if (capturing) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-3">
        {snapshot ? (
          <img
            src={snapshot}
            alt="Prévia da foto capturada"
            className="aspect-square w-full max-w-xs rounded-lg bg-black object-cover"
          />
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ transform: 'scaleX(-1)' }}
            className="aspect-square w-full max-w-xs rounded-lg bg-black object-cover"
          />
        )}
        <div className="flex gap-2">
          {snapshot ? (
            <>
              <Button type="button" size="sm" onClick={confirmSnapshot}><Check /> Usar foto</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setSnapshot(null)}>
                <RotateCcw /> Tirar outra
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" onClick={takeSnapshot}><Camera /> Capturar</Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={stopCamera}><X /> Cancelar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            <Camera className="size-5" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={openFilePicker}>
              <Upload /> Fazer upload
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={startCamera}>
              <Video /> Tirar foto
            </Button>
            {value && (
              <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange('')}>
                <Trash2 /> Remover
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelected}
          />
          <Input
            id={id}
            value={isDataUri ? '' : value ?? ''}
            placeholder={isDataUri ? 'Foto selecionada' : 'ou cole o link de uma imagem (https://)'}
            disabled={disabled || isDataUri}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
