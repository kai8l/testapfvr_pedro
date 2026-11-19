import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) throw new Error('Faltam EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copie .env.example para .env e reinicie com `npx expo start -c`.');

// flowType 'pkce': o login Google/Apple volta ao app com um `code` (não com tokens na URL).
export const supabase = createClient(url, anon, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: 'pkce' },
});

/** Envia uma imagem local (uri) para o bucket "avatars" em <uid>/<path> e devolve a URL pública. */
export async function uploadImage(uid: string, uri: string, path: string) {
  const buf = await (await fetch(uri)).arrayBuffer();
  const full = `${uid}/${path}`;
  const { error } = await supabase.storage.from('avatars').upload(full, buf, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(full).data.publicUrl + `?t=${Date.now()}`;
}
