// Utilitários compartilhados pelas Edge Functions de pagamento (Deno).
import { createClient } from 'npm:@supabase/supabase-js@2';

/** FONTE DA VERDADE dos preços. O app só exibe; o valor cobrado sai daqui. Mantenha igual a src/lib/payments.ts. */
export const PLANS = {
  mensal: { price: 9.9, months: 1 },
  anual: { price: 89.9, months: 12 },
} as const;
export type PlanKey = keyof typeof PLANS;

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export const admin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

/** Usuário dono do JWT enviado pelo app. */
export async function userFromRequest(req: Request) {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const c = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data, error } = await c.auth.getUser();
  return error ? null : data.user;
}

export function isValidCPF(v: string) {
  const d = (v || '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return calc(9) === +d[9] && calc(10) === +d[10];
}

export const mpFetch = (path: string, init: RequestInit = {}) =>
  fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });

/** Busca o pagamento no Mercado Pago. null = não existe (404). Lança erro em falha transitória. */
export async function getMpPayment(id: string | number) {
  const r = await mpFetch(`/v1/payments/${id}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Mercado Pago respondeu ${r.status}`);
  return await r.json();
}

const STATUS: Record<string, string> = {
  approved: 'approved', authorized: 'pending', pending: 'pending', in_process: 'pending', in_mediation: 'pending',
  rejected: 'rejected', cancelled: 'cancelled', refunded: 'refunded', charged_back: 'charged_back',
};

/**
 * Aplica o estado real do pagamento (vindo da API do MP, nunca do corpo do webhook) ao banco.
 * Idempotente: pode ser chamada pelo webhook, pelo check-payment e pelo create-payment ao mesmo tempo.
 * Retorna o status interno resultante ou null se o pagamento não é nosso.
 */
export async function applyMpPayment(db: ReturnType<typeof admin>, mp: any): Promise<string | null> {
  const ref = String(mp?.external_reference || '');
  if (!/^[0-9a-f-]{36}$/i.test(ref)) return null;
  const { data: row } = await db.from('payments').select('id, amount, status').eq('id', ref).maybeSingle();
  if (!row) return null;

  const detail = { p_payment_id: row.id, p_mp_payment_id: mp.id, p_mp_status: mp.status, p_mp_detail: mp.status_detail ?? null };

  if (mp.status === 'approved') {
    const okAmount = Math.abs(Number(mp.transaction_amount) - Number(row.amount)) < 0.005 && (mp.currency_id ?? 'BRL') === 'BRL';
    if (!okAmount) { // valor diferente do esperado: não libera nada
      console.error('Valor divergente', { payment: row.id, esperado: row.amount, recebido: mp.transaction_amount });
      await db.from('payments').update({ status: 'rejected', mp_payment_id: mp.id, mp_status: mp.status, mp_status_detail: 'amount_mismatch' }).eq('id', row.id).neq('status', 'approved');
      return 'rejected';
    }
    const { error } = await db.rpc('grant_premium', detail);
    if (error) throw error;
    return 'approved';
  }
  if (mp.status === 'refunded' || mp.status === 'charged_back') {
    const { error } = await db.rpc('revoke_premium', { ...detail, p_status: STATUS[mp.status] });
    if (error) throw error;
    return STATUS[mp.status];
  }
  const status = STATUS[mp.status] ?? 'pending';
  await db.from('payments').update({ status, mp_payment_id: mp.id, mp_status: mp.status, mp_status_detail: mp.status_detail ?? null }).eq('id', row.id).neq('status', 'approved');
  return status;
}
