// POST /functions/v1/create-payment  (exige JWT do usuário)
// body: { plan: 'mensal'|'anual', method: 'pix'|'cartao', cpf: string, card?: { token, payment_method_id, issuer_id? } }
import { admin, applyMpPayment, cors, isValidCPF, json, mpFetch, PLANS, PlanKey, userFromRequest } from '../_shared/mp.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: 'Sessão inválida. Entre novamente.' }, 401);
    if (!user.email) return json({ error: 'Sua conta precisa de um e-mail para pagar. Cadastre um em Perfil › Alterar e-mail.' }, 400);

    const body = await req.json().catch(() => ({}));
    const plan = body.plan as PlanKey;
    const method = body.method as string;
    const cpf = String(body.cpf || '').replace(/\D/g, '');
    if (!(plan in PLANS)) return json({ error: 'Plano inválido.' }, 400);
    if (method !== 'pix' && method !== 'cartao') return json({ error: 'Forma de pagamento inválida.' }, 400);
    if (!isValidCPF(cpf)) return json({ error: 'CPF inválido.' }, 400);
    if (method === 'cartao' && (!body.card?.token || !body.card?.payment_method_id)) return json({ error: 'Dados do cartão ausentes.' }, 400);

    const db = admin();
    const price = PLANS[plan].price; // nunca confiar em valor vindo do app
    const { data: row, error: insErr } = await db.from('payments')
      .insert({ user_id: user.id, plan, amount: price, method }).select('id').single();
    if (insErr) throw insErr;

    const payload: Record<string, unknown> = {
      transaction_amount: price,
      description: `NeuroConecta Premium ${plan}`,
      external_reference: row.id,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`,
      statement_descriptor: 'NEUROCONECTA',
      payer: { email: user.email, identification: { type: 'CPF', number: cpf } },
    };
    if (method === 'pix') payload.payment_method_id = 'pix';
    else Object.assign(payload, {
      token: body.card.token, payment_method_id: body.card.payment_method_id, installments: 1,
      ...(body.card.issuer_id ? { issuer_id: Number(body.card.issuer_id) } : {}),
    });

    const r = await mpFetch('/v1/payments', { method: 'POST', headers: { 'X-Idempotency-Key': row.id }, body: JSON.stringify(payload) });
    const mp = await r.json();
    if (!r.ok) {
      console.error('MP recusou criar pagamento', r.status, JSON.stringify(mp));
      await db.from('payments').update({ status: 'rejected', mp_status: 'error', mp_status_detail: String(mp?.message || r.status).slice(0, 200) }).eq('id', row.id);
      return json({ error: mp?.message ? `Mercado Pago: ${mp.message}` : 'Não foi possível processar o pagamento.' }, 400);
    }

    const status = (await applyMpPayment(db, mp)) ?? 'pending';
    const td = mp.point_of_interaction?.transaction_data;
    return json({
      payment_id: row.id,
      status: status === 'pending' ? mp.status : status, // 'approved' | 'in_process' | 'pending' | 'rejected' | ...
      status_detail: mp.status_detail,
      pix: method === 'pix' ? { qr_code: td?.qr_code, qr_code_base64: td?.qr_code_base64, ticket_url: td?.ticket_url } : undefined,
    });
  } catch (e) {
    console.error('create-payment', e);
    return json({ error: 'Erro interno ao processar o pagamento.' }, 500);
  }
});
