import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics';
import { playBallotConfirmedSound } from '@/lib/sound';

// Lógica de uma cédula de votação: um cargo por vez, na ordem recebida, teclado
// físico incluso, até fechar. Compartilhada entre a votação autenticada
// (Voting.jsx) e o link público (PublicVoting.jsx) — só muda quem faz a
// consulta do candidato e a gravação do voto (`lookupVote`/`submitVote`). `sessionId`
// é opcional e só alimenta o funil de analytics (ver ROADMAP.md "Validação e Feedback").
export function useBallotFlow({ positions, enabled, lookupVote, submitVote, onBallotComplete, sessionId }) {
  const [index, setIndex] = useState(0);
  const [digits, setDigits] = useState('');
  const [blank, setBlank] = useState(false);
  const [lookup, setLookup] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [votesCast, setVotesCast] = useState(0);
  const [closed, setClosed] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (enabled && !startedRef.current) {
      startedRef.current = true;
      trackEvent('VOTING_STARTED', { sessionId });
    }
    if (!enabled) startedRef.current = false;
  }, [enabled, sessionId]);

  const rule = positions[index];
  const ballotDone = Boolean(enabled) && index >= positions.length;
  const ready = rule && (blank || (digits.length === rule.digits && lookup && !lookup.loading));

  useEffect(() => {
    if (!enabled || !rule || blank || digits.length !== rule.digits) {
      setLookup(null);
      return;
    }
    let active = true;
    setLookup({ loading: true, result: null });
    lookupVote(rule.code, digits)
      .then((result) => {
        if (active) setLookup({ loading: false, result });
      })
      .catch(() => {
        if (active) setLookup({ loading: false, result: null });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, blank, rule?.code, enabled]);

  function resetBallot() {
    setIndex(0);
    setDigits('');
    setBlank(false);
    setLookup(null);
    setClosed(false);
  }

  function clearEntry() {
    setDigits('');
    setBlank(false);
  }

  function pressDigit(digit) {
    setBlank(false);
    setDigits((current) => (rule && current.length < rule.digits ? current + digit : current));
  }

  function pressBlank() {
    setDigits('');
    setBlank(true);
  }

  async function confirmVote() {
    const type = blank ? 'BLANK' : lookup?.result?.status === 'FOUND' ? 'VALID' : 'NULL';
    setSubmitting(true);
    try {
      await submitVote({ position: rule.code, type, number: blank ? undefined : digits });
      setDigits('');
      setBlank(false);
      setLookup(null);
      const next = index + 1;
      setIndex(next);
      if (next >= positions.length) {
        setVotesCast((count) => count + 1);
        playBallotConfirmedSound();
        trackEvent('VOTING_COMPLETED', { sessionId });
        onBallotComplete?.();
      }
    } catch (err) {
      if (err.code === 'VOTE_SESSION_NOT_OPEN') {
        setClosed(true);
        toast.error('A votação desta sessão foi encerrada.');
      } else {
        toast.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Teclado físico: dígitos, Backspace/Delete para corrigir, Enter para
  // confirmar o voto (ou avançar para o próximo eleitor quando a cédula fecha).
  useEffect(() => {
    if (!enabled) return undefined;

    function handleKeyDown(event) {
      if (closed) return;
      const tag = event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target.isContentEditable) return;

      if (ballotDone) {
        if (event.key === 'Enter') {
          event.preventDefault();
          resetBallot();
        }
        return;
      }
      if (!rule || submitting) return;

      if (event.key >= '0' && event.key <= '9') {
        event.preventDefault();
        pressDigit(event.key);
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        clearEntry();
      } else if (event.key === 'Enter' && ready) {
        event.preventDefault();
        confirmVote();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, rule, submitting, ready, ballotDone, closed]);

  return {
    index,
    rule,
    digits,
    blank,
    lookup,
    submitting,
    votesCast,
    closed,
    ballotDone,
    ready,
    pressDigit,
    clearEntry,
    pressBlank,
    confirmVote,
    resetBallot,
  };
}
