import { onlyDigits } from './br';

const API = 'https://api.mercadopago.com';
const KEY = process.env.EXPO_PUBLIC_MP_PUBLIC_KEY;

export type CardInput = { number: string; cvv: string; exp: string; holder: string; cpf: string };
export type CardToken = { token: string; payment_method_id: string; issuer_id?: string };

async function mp(path: string, init?: RequestInit) {
  const r = await fetch(`${API}${path}`, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(cardError(j));
  return j;
}

function cardError(j: any) {
  const code = String(j?.cause?.[0]?.code ?? '');
  const map: Record<string, string> = {
    '205': 'Digite o número do cartão.', '208': 'Escolha o mês de validade.', '209': 'Escolha o ano de validade.',
    '212': 'Informe o documento do titular.', '213': 'Informe o documento do titular.', '214': 'Informe o documento do titular.',
    '220': 'Informe o banco emissor.', '221': 'Informe o nome do titular.', '224': 'Digite o código de segurança.',
    'E301': 'Número do cartão inválido.', 'E302': 'Código de segurança inválido.', '316': 'Nome do titular inválido.',
    '322': 'Documento do titular inválido.', '324': 'Documento do titular inválido.', '325': 'Mês de validade inválido.', '326': 'Ano de validade inválido.',
  };
  return map[code] || j?.message || 'Não foi possível validar o cartão.';
}

/**
 * Tokeniza o cartão DIRETO no Mercado Pago com a chave pública. Os dados do cartão
 * nunca passam pelo nosso servidor — só o token (uso único) vai para a Edge Function.
 */
export async function tokenizeCard(i: CardInput): Promise<CardToken> {
  if (!KEY) throw new Error('Pagamento indisponível: falta EXPO_PUBLIC_MP_PUBLIC_KEY no .env.');
  const number = onlyDigits(i.number);
  const [mm, yy] = i.exp.split('/');

  const pm = await mp(`/v1/payment_methods/search?public_key=${KEY}&marketplace=NONE&bins=${number.slice(0, 6)}`);
  const list: any[] = pm?.results || [];
  const method = list.find(m => m.payment_type_id === 'credit_card') || list[0];
  if (!method?.id) throw new Error('Bandeira do cartão não reconhecida.');

  const tk = await mp(`/v1/card_tokens?public_key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      card_number: number,
      security_code: onlyDigits(i.cvv),
      expiration_month: Number(mm),
      expiration_year: 2000 + Number(yy),
      cardholder: { name: i.holder.trim(), identification: { type: 'CPF', number: onlyDigits(i.cpf) } },
    }),
  });
  return { token: tk.id, payment_method_id: method.id, issuer_id: method.issuer?.id ? String(method.issuer.id) : undefined };
}
