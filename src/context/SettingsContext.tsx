import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const DEF = {
  fontScale: 1, highContrast: false, grayscale: false, linkUnderline: true,
  simpleLanguage: true, showTips: true, themeName: 'claro' as 'claro' | 'escuro',
  notif: { tarefas: true, novidades: true, atividades: true, emails: true, vibracao: true, prazos: true } as Record<string, boolean>,
};
export type Settings = typeof DEF;

const light = { bg: '#F3EEFF', header: '#DDD0FF', primary: '#7A00FF', card: '#FFFFFF', text: '#1E1B2E', muted: '#6B6580', danger: '#E5484D', ok: '#2FB344', border: '#E4DAFF', soft: '#EAE0FF' };
const dark = { bg: '#17142A', header: '#2A2450', primary: '#9B5CFF', card: '#231F3F', text: '#F4F0FF', muted: '#A9A3C4', danger: '#FF6B70', ok: '#4CD964', border: '#3A3466', soft: '#2E2858' };

export function palette(s: Settings) {
  let c = s.themeName === 'escuro' ? { ...dark } : { ...light };
  if (s.highContrast) c = { ...c, text: s.themeName === 'escuro' ? '#FFFFFF' : '#000000', muted: s.themeName === 'escuro' ? '#E0E0E0' : '#222222', border: s.themeName === 'escuro' ? '#FFFFFF' : '#000000', primary: s.themeName === 'escuro' ? '#C9A6FF' : '#4B0098' };
  if (s.grayscale) c = { ...c, primary: '#555555', header: s.themeName === 'escuro' ? '#333333' : '#DDDDDD', bg: s.themeName === 'escuro' ? '#1C1C1C' : '#F2F2F2', soft: '#E6E6E6', border: '#BBBBBB' };
  return c;
}

const Ctx = createContext<any>(null);
export const useTheme = () => useContext(Ctx) as { s: Settings; c: typeof light; fs: (n: number) => number; set: (p: Partial<Settings>) => void };

export function SettingsProvider({ children }: any) {
  const { profile } = useAuth();
  const [s, setS] = useState<Settings>(DEF);

  useEffect(() => { AsyncStorage.getItem('settings').then(v => v && setS(p => ({ ...p, ...JSON.parse(v) }))); }, []);
  useEffect(() => {
    if (profile?.settings && Object.keys(profile.settings).length) setS(p => ({ ...p, ...profile.settings }));
  }, [profile?.id]);

  const set = (patch: Partial<Settings>) => {
    const n = { ...s, ...patch };
    setS(n);
    AsyncStorage.setItem('settings', JSON.stringify(n));
    if (profile?.id) supabase.from('profiles').update({ settings: n }).eq('id', profile.id).then(() => {});
  };

  return <Ctx.Provider value={{ s, c: palette(s), fs: (n: number) => n * s.fontScale, set }}>{children}</Ctx.Provider>;
}
