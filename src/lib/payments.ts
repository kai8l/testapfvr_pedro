import { supabase } from './supabase';
import type { CardToken } from './mercadopago';

/** Preços só para EXIBIÇÃO. O valor cobrado é definido na Edge Function (supabase/functions/_shared/mp.ts) — mantenha os dois iguais. */
export const PLANS = {
  mensal: { price: 9.9, label: 'mês' },
  anual: { price: 89.9, label: 'ano' },
} as const;
export type PlanKey = keyof typeof PLANS;

export type PixData = { qr_code: string; qr_code_base64?: string; ticket_url?: string };
export type PaymentResult = { payment_id: string; status: string; status_detail?: string; pix?: PixData };

async function toError(error: any): Promise<Error> {
  try {
    const j = await error?.context?.json?.();
    if (j?.error) return new Error(j.error);
  } catch {}
  return new Error(error?.message || 'Erro de comunicação. Tente novamente.');
}

export async function createPayment(body: { plan: PlanKey; method: 'pix' | 'cartao'; cpf: string; card?: CardToken }): Promise<PaymentResult> {
  const { data, error } = await supabase.functions.invoke('create-payment', { body });
  if (error) throw await toError(error);
  return data as PaymentResult;
}

/** Consulta o Mercado Pago (via Edge Function) e, se aprovado, libera o Premium. Serve de plano B caso o webhook demore. */
export async function checkPayment(payment_id: string): Promise<{ status: string; status_detail?: string }> {
  const { data, error } = await supabase.functions.invoke('check-payment', { body: { payment_id } });
  if (error) throw await toError(error);
  return data;
}

const REJECT: Record<string, string> = {
  cc_rejected_insufficient_amount: 'Saldo/limite insuficiente no cartão.',
  cc_rejected_bad_filled_card_number: 'Número do cartão incorreto.',
  cc_rejected_bad_filled_date: 'Data de validade incorreta.',
  cc_rejected_bad_filled_security_code: 'Código de segurança incorreto.',
  cc_rejected_bad_filled_other: 'Confira os dados do cartão.',
  cc_rejected_call_for_authorize: 'Autorize o pagamento com o seu banco e tente de novo.',
  cc_rejected_card_disabled: 'Cartão desativado. Ligue para o banco para ativá-lo.',
  cc_rejected_high_risk: 'Pagamento recusado por segurança. Tente outro meio de pagamento.',
  cc_rejected_max_attempts: 'Limite de tentativas atingido. Use outro cartão.',
  cc_rejected_duplicated_payment: 'Você já fez um pagamento igual a este.',
};
export const rejectMessage = (detail?: string) => (detail && REJECT[detail]) || 'O pagamento foi recusado. Tente outro cartão ou use PIX.';
