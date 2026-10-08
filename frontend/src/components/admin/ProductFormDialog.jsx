import { useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CoverImageField } from '@/components/admin/CoverImageField';
import { fieldOfError } from '@/lib/form-errors';
import { api } from '@/services/api';

const KIND_LABELS = { SESSION_EXPORT: 'Por sessão (gerado na hora)', EBOOK: 'Por conta (arquivo fixo)' };
const FIELD_RULES = [
  ['NAME', 'name'], ['DESCRIPTION', 'description'], ['PRICE', 'priceCents'], ['KIND', 'kind'],
  ['COVER_IMAGE', 'coverImage'], ['FILE', 'file'],
];
// Mesmo teto de backend/src/rules/product-rules.js PRODUCT_FILE_LIMITS.ebookMaxBytes —
// só pra dar erro na hora, sem esperar o upload inteiro pra descobrir no servidor.
const EBOOK_MAX_BYTES = 15_000_000;

function centsToReais(cents) {
  return cents == null ? '' : (cents / 100).toFixed(2);
}

function readFileAsDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// Arquivo do produto (EBOOK) — `file` fica `undefined` enquanto a conta não escolhe um
// novo arquivo (editar sem mexer nisso mantém o que já existe no servidor); vira a data
// URI só depois de selecionado.
function EbookFileField({ hasExistingFile, fileName, onSelect, error }) {
  return (
    <FormField label="Arquivo (PDF)" htmlFor="product-file" error={error}>
      <div className="flex flex-col gap-1.5">
        <Button type="button" size="sm" variant="outline" className="w-fit" asChild>
          <label htmlFor="product-file" className="cursor-pointer">
            <Upload /> {hasExistingFile || fileName ? 'Substituir arquivo' : 'Selecionar arquivo'}
          </label>
        </Button>
        <input
          id="product-file"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        />
        {fileName ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="size-3.5" /> {fileName}
          </span>
        ) : hasExistingFile ? (
          <span className="text-xs text-muted-foreground">Arquivo já enviado — selecione um novo pra substituir.</span>
        ) : null}
      </div>
    </FormField>
  );
}

function ProductForm({ product, onSaved, onCancel }) {
  const editing = Boolean(product);
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [priceReais, setPriceReais] = useState(centsToReais(product?.priceCents));
  const [kind, setKind] = useState(product?.kind ?? 'EBOOK');
  const [active, setActive] = useState(product?.active ?? true);
  const [coverImage, setCoverImage] = useState(product?.coverImage ?? '');
  const [file, setFile] = useState(undefined); // undefined = não trocado
  const [fileName, setFileName] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const errorField = fieldOfError(error, FIELD_RULES);
  const fieldError = (field) => (errorField === field ? error.message : null);

  async function handleFileSelected(selectedFile) {
    if (!selectedFile) return;
    if (selectedFile.type !== 'application/pdf') {
      setError({ code: 'PRODUCT_FILE_INVALID', message: 'Selecione um arquivo PDF.' });
      return;
    }
    if (selectedFile.size > EBOOK_MAX_BYTES) {
      setError({ code: 'PRODUCT_FILE_TOO_LARGE', message: 'O arquivo é grande demais (máximo 15MB).' });
      return;
    }
    setError(null);
    setFile(await readFileAsDataUri(selectedFile));
    setFileName(selectedFile.name);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = {
      name,
      description,
      priceCents: Math.round(Number(priceReais.replace(',', '.')) * 100),
      active,
      coverImage: coverImage || null,
      ...(editing ? {} : { kind }),
      ...(file !== undefined ? { file } : {}),
    };
    try {
      if (editing) await api.admin.products.update(product.id, payload);
      else await api.admin.products.create(payload);
      toast.success(editing ? 'Alterações salvas.' : 'Produto criado.');
      onSaved();
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {error && !errorField && (
        <Alert variant="destructive"><AlertDescription>{error.message}</AlertDescription></Alert>
      )}
      <FormField label="Nome" htmlFor="product-name" error={fieldError('name')}>
        <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do produto" autoFocus />
      </FormField>
      <FormField label="Descrição" htmlFor="product-description" error={fieldError('description')}>
        <Textarea
          id="product-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="O que esse produto libera"
          rows={3}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Preço (R$)" htmlFor="product-price" error={fieldError('priceCents')}>
          <Input
            id="product-price"
            inputMode="decimal"
            value={priceReais}
            onChange={(e) => setPriceReais(e.target.value)}
            placeholder="9.90"
          />
        </FormField>
        <FormField
          label="Tipo"
          htmlFor="product-kind"
          error={fieldError('kind')}
          hint={editing ? 'Não pode ser alterado depois de criado.' : undefined}
        >
          <Select value={kind} onValueChange={setKind} disabled={editing}>
            <SelectTrigger id="product-kind"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {kind === 'EBOOK' && (
        <>
          <FormField
            label="Capa (opcional)"
            htmlFor="product-cover"
            error={fieldError('coverImage')}
            hint="Aparece na loja pra quem ainda não comprou — é só uma pré-visualização, não o material em si."
          >
            <CoverImageField id="product-cover" value={coverImage} onChange={setCoverImage} disabled={submitting} />
          </FormField>
          <EbookFileField
            hasExistingFile={Boolean(product?.fileKey)}
            fileName={fileName}
            onSelect={handleFileSelected}
            error={fieldError('file')}
          />
        </>
      )}

      <Label htmlFor="product-active" className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2.5 font-normal">
        <Checkbox id="product-active" checked={active} onCheckedChange={(checked) => setActive(checked === true)} />
        <span className="text-sm">Ativo (aparece na loja pra quem ainda não comprou)</span>
      </Label>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>Cancelar</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar produto'}
        </Button>
      </div>
    </form>
  );
}

// `product` = null para criar; objeto para editar.
export function ProductFormDialog({ open, product, onOpenChange, onSaved }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? 'Editar produto' : 'Novo produto'}</DialogTitle>
          <DialogDescription>
            Nome, descrição, preço e disponibilidade na loja — produtos "por conta" (EBOOK)
            também têm capa e arquivo.
          </DialogDescription>
        </DialogHeader>
        <ProductForm
          product={product}
          onSaved={() => { onOpenChange(false); onSaved(); }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
