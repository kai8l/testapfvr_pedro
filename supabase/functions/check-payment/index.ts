// POST /functions/v1/check-payment  (exige JWT)  body: { payment_id: <uuid do nosso payments.id> }
// Consulta o MP e aplica o resultado. Plano B para quando o webhook atrasa (ex.: PIX).
import { admin, applyMpPayment, cors, getMpPayment, json, userFromRequest } from '../_shared/mp.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: 'Sessão inválida.' }, 401);
    const { payment_id } = await req.json().catch(() => ({}));
    if (!payment_id) return json({ error: 'payment_id ausente.' }, 400);

    const db = admin();
    const { data: row } = await db.from('payments').select('id, user_id, status, mp_payment_id').eq('id', payment_id).maybeSingle();
    if (!row || row.user_id !== user.id) return json({ error: 'Pagamento não encontrado.' }, 404);
    if (row.status === 'approved' || !row.mp_payment_id) return json({ status: row.status });

    const mp = await getMpPayment(row.mp_payment_id);
    const status = mp ? await applyMpPayment(db, mp) : null;
    return json({ status: status ?? row.status, status_detail: mp?.status_detail });
  } catch (e) {
    console.error('check-payment', e);
    return json({ error: 'Erro ao consultar o pagamento.' }, 500);
  }
});
