import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Briefcase, CheckCircle2, Hourglass, Send, Sparkles, User, UserPlus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { PhotoCaptureField } from '@/components/candidates/PhotoCaptureField';
import { EmptyState } from '@/components/layout/EmptyState';
import { Logo } from '@/components/branding/Logo';
import { Wordmark } from '@/components/branding/Wordmark';
import { useAsync } from '@/hooks/useAsync';
import { trackEvent } from '@/lib/analytics';
import { fieldOfError } from '@/lib/form-errors';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

const GOVERNMENT_PROPOSAL_MAX_LENGTH = 2000;

const FIELD_RULES = [
  ['NAME', 'name'],
  ['PHOTO', 'photo'],
  ['NUMBER', 'number'],
  ['PARTY', 'partyId'],
  ['POSITION', 'position'],
  ['GOVERNMENT_PROPOSAL', 'governmentProposal'],
];

// Link público de candidatura (Etapa 20): irmão do link público de votação
// (PublicVoting.jsx), mas pra quem quer se candidatar em vez de votar — token em
// letras maiúsculas pra diferenciar visualmente (ver utils/id.js no backend).
// Formulário único: pessoa (nome, foto) + candidatura (cargo, partido, número,
// proposta) numa submissão só, que entra como PENDENTE até quem administra a
// sessão aprovar ou reprovar (ver Candidatos na Área de Gerenciamento).
export default function PublicCandidacy() {
  const { token } = useParams();
  const sessionState = useAsync(() => api.publicCandidacy.getSession(token), [token]);
  const info = sessionState.data;
  const [done, setDone] = useState(false);

  if (sessionState.error?.status === 404) {
    return (
      <PublicShell>
        <EmptyState icon={UserPlus} title="Link inválido" description="Este link de candidatura não existe ou foi removido." />
      </PublicShell>
    );
  }
  if (sessionState.error) {
    return (
      <PublicShell>
        <EmptyState
          icon={UserPlus}
          title="Não foi possível carregar"
          description={sessionState.error.message}
          action={<Button variant="outline" onClick={sessionState.reload}>Tentar novamente</Button>}
        />
      </PublicShell>
    );
  }
  if (!info) {
    return (
      <PublicShell>
        <Skeleton className="h-80" />
      </PublicShell>
    );
  }
  if (info.status !== 'DRAFT') {
    return (
      <PublicShell title={info.name} subtitle={`${info.year}`}>
        <EmptyState
          icon={Hourglass}
          title="Cadastro de candidaturas encerrado"
          description="A votação desta eleição já foi aberta e não aceita mais novas candidaturas."
        />
      </PublicShell>
    );
  }
  if (info.positions.length === 0 || info.parties.length === 0) {
    return (
      <PublicShell title={info.name} subtitle={`${info.year}`}>
        <EmptyState
          icon={UserPlus}
          title="Candidatura ainda não disponível"
          description="Quem organiza esta eleição ainda não cadastrou cargos ou partidos. Volte mais tarde."
        />
      </PublicShell>
    );
  }
  if (done) {
    return (
      <PublicShell title={info.name} subtitle={`${info.year}`}>
        <Card className="flex flex-col items-center gap-4 border-success/20 bg-success-soft/40 p-8 text-center md:p-10">
          <div className="flex size-16 items-center justify-center rounded-full bg-success text-white">
            <CheckCircle2 className="size-8" />
          </div>
          <div>
            <p className="font-heading text-lg font-semibold">Candidatura enviada!</p>
            <p className="text-sm text-muted-foreground">
              Quem organiza esta eleição vai analisar os dados e aprovar ou reprovar a candidatura.
            </p>
          </div>
        </Card>
      </PublicShell>
    );
  }

  return (
    <PublicShell title={info.name} subtitle={`${info.year}`}>
      <CandidacyHero info={info} />
      <CandidacyForm token={token} info={info} onSubmitted={() => setDone(true)} />
    </PublicShell>
  );
}

// Cartão de abertura, mesma lógica de identidade visual das demais telas (ícone
// num círculo colorido + número/texto em destaque, ver StatTile.jsx) — aqui em
// tom amarelo educativo (destaque, não estrutural) pra não competir com o azul
// do cabeçalho nem com o verde do botão de envio.
function CandidacyHero({ info }) {
  return (
    <Card className="overflow-hidden border-accent/20 bg-gradient-to-br from-accent-soft/70 via-card to-card">
      <CardContent className="flex flex-col gap-4 p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <UserPlus className="size-7" />
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
              <Sparkles className="size-3.5" /> Candidatura aberta
            </p>
            <h1 className="truncate font-heading text-2xl font-bold leading-tight">{info.name}</h1>
            <p className="text-sm text-muted-foreground">
              {info.year} · Preencha seus dados para concorrer a um dos cargos abaixo.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {info.positions.map((p) => (
            <span
              key={p.code}
              className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium shadow-sm"
            >
              <Briefcase className="size-3.5 text-muted-foreground" /> {p.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeading({ icon: Icon, tone, children }) {
  const toneClasses = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent-soft text-accent',
  };
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', toneClasses[tone])}>
        <Icon className="size-3.5" />
      </div>
      <p className="text-sm font-semibold">{children}</p>
    </div>
  );
}

function CandidacyForm({ token, info, onSubmitted }) {
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState('');
  const [position, setPosition] = useState('');
  const [partyId, setPartyId] = useState('');
  const [number, setNumber] = useState('');
  const [governmentProposal, setGovernmentProposal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const positionRule = info.positions.find((p) => p.code === position);
  const digits = positionRule?.digits;

  const errorField = fieldOfError(error, FIELD_RULES);
  const fieldError = (field) => (errorField === field ? error.message : null);

  function changePosition(value) {
    setPosition(value);
    setNumber('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.publicCandidacy.create(token, {
        name,
        photo: photo || null,
        position,
        partyId,
        number,
        governmentProposal: governmentProposal.trim() || null,
      });
      trackEvent('CANDIDATE_REGISTERED', { sessionId: token });
      onSubmitted();
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-5 md:p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div>
          <p className="font-heading text-lg font-semibold">Cadastrar candidatura</p>
          <p className="text-sm text-muted-foreground">
            Preencha seus dados e os da sua candidatura. Depois de enviar, quem organiza esta
            eleição analisa e aprova ou reprova.
          </p>
        </div>

        {error && !errorField && (
          <Alert variant="destructive"><AlertDescription>{error.message}</AlertDescription></Alert>
        )}

        <div className="flex flex-col gap-4">
          <SectionHeading icon={User} tone="primary">Seus dados</SectionHeading>

          <FormField label="Nome" htmlFor="candidacy-name" error={fieldError('name')}>
            <Input id="candidacy-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoFocus />
          </FormField>

          <FormField
            label="Foto (opcional)"
            htmlFor="candidacy-photo"
            error={fieldError('photo')}
            hint="Envie uma foto do dispositivo, tire uma com a câmera, ou escolha um avatar pronto."
          >
            <PhotoCaptureField id="candidacy-photo" value={photo} onChange={setPhoto} disabled={submitting} />
          </FormField>
        </div>

        <div className="h-px bg-border" />

        <div className="flex flex-col gap-4">
          <SectionHeading icon={Briefcase} tone="accent">Sua candidatura</SectionHeading>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Cargo" htmlFor="candidacy-position" error={fieldError('position')}>
              <Select value={position} onValueChange={changePosition}>
                <SelectTrigger id="candidacy-position"><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                <SelectContent>
                  {info.positions.map((p) => (
                    <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Número"
              htmlFor="candidacy-number"
              error={fieldError('number')}
              hint={digits ? `${digits} dígitos para este cargo.` : 'Escolha o cargo primeiro.'}
            >
              <Input
                id="candidacy-number"
                inputMode="numeric"
                value={number}
                disabled={!digits}
                onChange={(e) => setNumber(e.target.value.replace(/\D/g, '').slice(0, digits))}
              />
            </FormField>
          </div>

          <FormField label="Partido" htmlFor="candidacy-party" error={fieldError('partyId')}>
            <Select value={partyId} onValueChange={setPartyId}>
              <SelectTrigger id="candidacy-party"><SelectValue placeholder="Selecione o partido" /></SelectTrigger>
              <SelectContent>
                {info.parties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.acronym} — {p.name} ({p.number})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="Proposta de governo (opcional)"
            htmlFor="candidacy-government-proposal"
            error={fieldError('governmentProposal')}
            hint={`O que você pretende fazer no mandato, se eleito (${governmentProposal.length}/${GOVERNMENT_PROPOSAL_MAX_LENGTH}).`}
          >
            <Textarea
              id="candidacy-government-proposal"
              rows={6}
              maxLength={GOVERNMENT_PROPOSAL_MAX_LENGTH}
              value={governmentProposal}
              onChange={(e) => setGovernmentProposal(e.target.value)}
              placeholder="Descreva aqui os seus planos para o mandato."
            />
          </FormField>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto"
            disabled={submitting || !name || !position || !partyId || !number}
          >
            {submitting ? 'Enviando...' : <><Send /> Enviar candidatura</>}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PublicShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 px-3 py-3 md:px-6">
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <Wordmark className="text-base" />
          </div>
          {title && (
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">{title}</p>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto flex max-w-2xl flex-col gap-3 px-3 py-8 md:gap-4 md:px-6">
        {children}
      </main>
    </div>
  );
}
