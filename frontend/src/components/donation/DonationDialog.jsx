import { useState } from 'react';
import { Heart, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { formatCents } from '@/lib/format';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

// Espelha backend/src/rules/donation-rules.js — duplicado de propósito (mesmo
// princípio de outros limites já comentados no projeto, ex. PRODUCT_LIMITS): o
// backend é quem de fato valida, isso aqui só evita mandar uma doação fora da faixa
// e descobrir só depois do erro voltar.
const PRESETS_CENTS = [1000, 2500, 5000, 10000];
const MIN_CENTS = 500;
const MAX_CENTS = 100000;

const BENEFITS = [
  'Ajuda a manter o UrnaLab gratuito nas funcionalidades essenciais de qualquer escola',
  'Cobre servidor, armazenamento e o tempo de quem desenvolve o projeto',
  'Sem contrapartida nenhuma além da nossa gratidão — não é compra de produto',
];

function parseAmountCents(rawValue) {
  const normalized = rawValue.replace(',', '.').replace(/[^0-9.]/g, '');
  if (!normalized) return NaN;
  return Math.round(Number(normalized) * 100);
}

// Diálogo de doação reaproveitado nos dois pontos de entrada (ver DonationButton.jsx
// na landing e Sidebar.jsx na área logada) — mesma "arte" do ExportPdfDialog
// (ícone + título, benefícios com check, cartão de valor com selo de segurança,
// CTA grande), adaptada pra valor livre em vez de preço fixo.
export function DonationDialog({ open, onOpenChange }) {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';

  const [selectedCents, setSelectedCents] = useState(2500);
  const [customValue, setCustomValue] = useState('');
  const [donorName, setDonorName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const amountCents = customValue ? parseAmountCents(customValue) : selectedCents;
  const isValidAmount = Number.isInteger(amountCents) && amountCents >= MIN_CENTS && amountCents <= MAX_CENTS;

  function selectPreset(cents) {
    setSelectedCents(cents);
    setCustomValue('');
  }

  async function handleDonate() {
    if (!isValidAmount) return;
    setSubmitting(true);
    try {
      const { checkoutUrl } = await api.donations.createCheckout({
        amountCents,
        donorName: isAuthenticated ? undefined : donorName,
      });
      window.location.href = checkoutUrl;
    } catch (err) {
      toast.error(err.message);
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-coral text-white shadow-sm">
              <Heart className="size-5 fill-current" />
            </span>
            <div>
              <DialogTitle>Apoie o UrnaLab</DialogTitle>
              <DialogDescription>Uma doação livre, sem troca por nenhum recurso</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label>Quanto você quer doar?</Label>
          <div className="grid grid-cols-4 gap-2">
            {PRESETS_CENTS.map((cents) => (
              <button
                key={cents}
                type="button"
                onClick={() => selectPreset(cents)}
                className={cn(
                  'rounded-lg border py-2 text-sm font-semibold transition-colors',
                  !customValue && selectedCents === cents
                    ? 'border-coral bg-coral text-white'
                    : 'bg-card hover:bg-muted',
                )}
              >
                {formatCents(cents)}
              </button>
            ))}
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              R$
            </span>
            <Input
              inputMode="decimal"
              placeholder="Outro valor"
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              className="pl-9"
            />
          </div>
          {customValue && !isValidAmount && (
            <p className="text-xs text-danger">
              Escolha um valor entre {formatCents(MIN_CENTS)} e {formatCents(MAX_CENTS)}.
            </p>
          )}
        </div>

        {!isAuthenticated && (
          <FormField label="Seu nome (opcional)" htmlFor="donor-name">
            <Input
              id="donor-name"
              value={donorName}
              onChange={(event) => setDonorName(event.target.value)}
              placeholder="Como quer ser chamado"
              maxLength={80}
            />
          </FormField>
        )}

        <ul className="flex flex-col gap-2">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-coral" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between rounded-xl border bg-card p-3">
          <div>
            <p className="text-xs text-muted-foreground">Você vai doar</p>
            <p className="text-2xl font-bold leading-tight">{isValidAmount ? formatCents(amountCents) : '—'}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0" /> Via Mercado Pago
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            type="button"
            size="lg"
            onClick={handleDonate}
            disabled={submitting || !isValidAmount}
            className="gap-2 bg-coral text-white shadow-lg shadow-coral/30 hover:bg-coral/90"
          >
            {submitting ? 'Abrindo pagamento...' : `Doar ${isValidAmount ? formatCents(amountCents) : ''}`}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
