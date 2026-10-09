// Teto/piso de uma doação avulsa (tela principal e sidebar da área logada) — sem
// catálogo de "produto" nenhum por trás (ver services/donation.service.js), o valor
// vem direto de quem doa, então precisa de limites próprios pra não aceitar um
// `amountCents` de R$ 0,01 nem um de R$ 1 milhão por engano/abuso.
export const DONATION_LIMITS = Object.freeze({
  minCents: 500, // R$ 5
  maxCents: 100000, // R$ 1.000
});

// Valores sugeridos nos botões rápidos do diálogo de doação (frontend) — não é
// validado aqui, a pessoa também pode digitar qualquer valor dentro dos limites acima.
export const DONATION_SUGGESTED_CENTS = Object.freeze([1000, 2500, 5000, 10000]);
