import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'google' | 'apple';

/**
 * Build/standalone: neuroconecta://auth/callback
 * Expo Go: exp://<ip>:8081/--/auth/callback
 * ➜ cadastre a(s) URL(s) em Supabase > Authentication > URL Configuration > Redirect URLs.
 */
export const redirectTo = makeRedirectUri({ scheme: 'neuroconecta', path: 'auth/callback' });

/** Junta os parâmetros de `?query` e `#fragment` da URL de retorno. */
function parseParams(url: string) {
  const out: Record<string, string> = {};
  const q = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const h = url.includes('#') ? url.split('#')[1] : '';
  [q, h].forEach(part => new URLSearchParams(part).forEach((v, k) => { out[k] = v; }));
  return out;
}

/** Retorna true se logou, false se o usuário cancelou. Lança Error em falha. */
export async function signInWithProvider(provider: OAuthProvider): Promise<boolean> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Não foi possível iniciar o login. Tente novamente.');

  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return false;

  const p = parseParams(res.url);
  if (p.error || p.error_description) throw new Error(p.error_description || p.error);
  if (p.code) {
    const { error: e } = await supabase.auth.exchangeCodeForSession(p.code);
    if (e) throw e;
    return true;
  }
  if (p.access_token && p.refresh_token) { // fallback p/ fluxo implícito
    const { error: e } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
    if (e) throw e;
    return true;
  }
  throw new Error('Resposta de login inválida.');
}
