// Webhook do Mercado Pago. Deploy SEM verificação de JWT (o MP não envia):
//   supabase functions deploy mp-webhook --no-verify-jwt
// Segurança: (1) valida a assinatura x-signature se MP_WEBHOOK_SECRET estiver definido;
// (2) NUNCA confia no corpo — busca o pagamento na API do MP com nosso Access Token e confere o valor.
import { admin, applyMpPayment, getMpPayment } from '../_shared/mp.ts';

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
const safeEq = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

async function validSignature(req: Request, dataId: string) {
  const secret = Deno.env.get('MP_WEBHOOK_SECRET');
  if (!secret) return true; // assinatura opcional (recomendado configurar)
  const sig = req.headers.get('x-signature'); const reqId = req.headers.get('x-request-id');
  if (!sig || !reqId) return false;
  const parts: Record<string, string> = {};
  sig.split(',').forEach(p => { const i = p.indexOf('='); if (i > 0) parts[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${reqId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)));
  return safeEq(mac, parts.v1);
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({} as any));
    const type = body?.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic');
    const dataId = String(url.searchParams.get('data.id') ?? body?.data?.id ?? url.searchParams.get('id') ?? '');

    if (!(await validSignature(req, dataId))) return new Response('invalid signature', { status: 401 });
    if (type !== 'payment' || !dataId) return new Response('ignored', { status: 200 });

    const mp = await getMpPayment(dataId);
    if (!mp) return new Response('not found', { status: 200 }); // ex.: notificação de teste do painel
    await applyMpPayment(admin(), mp);
    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('mp-webhook', e);
    return new Response('error', { status: 500 }); // o MP reenvia
  }
});
