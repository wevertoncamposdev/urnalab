import { useRef, useState } from 'react';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolvePhotoUrl } from '@/services/api';

// Capa de produto (Etapa 16): mesmo contrato de PhotoCaptureField (upload vira data URI,
// o backend decodifica e grava o arquivo), mas sem câmera nem recorte quadrado forçado —
// uma capa de material é melhor em pé, não precisa ser um avatar.
export function CoverImageField({ id, value, onChange, disabled }) {
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  function openFilePicker() {
    setError(null);
    fileInputRef.current?.click();
  }

  function handleFileSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onerror = () => setError('Não foi possível ler o arquivo selecionado.');
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  }

  const isDataUri = value?.startsWith('data:');
  const previewUrl = isDataUri ? value : resolvePhotoUrl(value);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="h-20 w-16 shrink-0 rounded-md border object-cover" />
        ) : (
          <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground">
            <ImageIcon className="size-5" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={openFilePicker}>
              <Upload /> Fazer upload
            </Button>
            {value && (
              <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange('')}>
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
