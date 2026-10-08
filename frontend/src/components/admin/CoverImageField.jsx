import { useRef, useState } from 'react';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolvePhotoUrl } from '@/services/api';

// Mesmo teto de backend/src/rules/product-rules.js PRODUCT_FILE_LIMITS.coverImageMaxBytes
// — a compressão abaixo mira ficar bem abaixo disso, com folga.
const COVER_IMAGE_MAX_BYTES = 500_000;
// Lado maior em pixels depois de redimensionada — generoso o bastante pra tela de
// retina no tamanho que a capa aparece na loja (ver pages/Loja.jsx, aspect-[3/2]), sem
// guardar uma foto de câmera em resolução total (frequentemente vários MB).
const MAX_DIMENSION = 1600;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível abrir essa imagem.'));
    img.src = src;
  });
}

function readFileAsDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// Tamanho do arquivo decodificado (o que o backend de fato mede, ver
// product.service.js resolveCoverImage) — maior que a string base64 em si.
function dataUriByteLength(dataUri) {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
  const padding = (base64.match(/=+$/)?.[0] ?? '').length;
  return Math.floor((base64.length * 3) / 4) - padding;
}

// Redimensiona pro maior lado caber em MAX_DIMENSION (preservando a proporção original —
// diferente de PhotoCaptureField, não força quadrado: uma capa de material fica melhor
// na proporção natural da imagem) e reduz a qualidade JPEG até caber no teto de tamanho.
async function compressImage(file) {
  const original = await readFileAsDataUri(file);
  const img = await loadImage(original);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

  let quality = 0.85;
  let output = canvas.toDataURL('image/jpeg', quality);
  while (dataUriByteLength(output) > COVER_IMAGE_MAX_BYTES && quality > 0.35) {
    quality -= 0.15;
    output = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUriByteLength(output) > COVER_IMAGE_MAX_BYTES) {
    throw new Error('Mesmo comprimida, essa imagem ainda é grande demais. Tente uma foto menor.');
  }
  return output;
}

// Capa de produto (Etapa 16): mesmo contrato de PhotoCaptureField (upload vira data URI,
// o backend decodifica e grava o arquivo), mas sem câmera nem recorte quadrado forçado —
// uma capa de material é melhor em pé, não precisa ser um avatar. A imagem é
// redimensionada/comprimida no navegador antes de virar data URI (ver compressImage),
// pra uma foto de celular (facilmente vários MB) nunca estourar o teto do backend.
export function CoverImageField({ id, value, onChange, disabled }) {
  const [error, setError] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef(null);

  function openFilePicker() {
    setError(null);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem.');
      return;
    }
    setError(null);
    setCompressing(true);
    try {
      onChange(await compressImage(file));
    } catch (err) {
      setError(err.message);
    } finally {
      setCompressing(false);
    }
  }

  const isDataUri = value?.startsWith('data:');
  const previewUrl = isDataUri ? value : resolvePhotoUrl(value);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="aspect-[3/2] w-24 shrink-0 rounded-md border object-cover" />
        ) : (
          <div className="flex aspect-[3/2] w-24 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground">
            <ImageIcon className="size-5" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={disabled || compressing} onClick={openFilePicker}>
              <Upload /> {compressing ? 'Processando...' : 'Fazer upload'}
            </Button>
            {value && (
              <Button type="button" size="sm" variant="outline" disabled={disabled || compressing} onClick={() => onChange('')}>
                <Trash2 /> Remover
              </Button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
          <Input
            id={id}
            value={isDataUri ? '' : value ?? ''}
            placeholder={isDataUri ? 'Imagem selecionada' : 'ou cole o link de uma imagem (https://)'}
            disabled={disabled || isDataUri}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
