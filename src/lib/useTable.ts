import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from './supabase';

/** Carrega uma tabela (RLS já filtra pelo usuário) e recarrega sempre que a tela ganha foco. */
export function useTable<T = any>(table: string, order = 'created_at', asc = false) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const { data, error } = await supabase.from(table).select('*').order(order, { ascending: asc });
    if (!error && data) setData(data as T[]);
    setLoading(false);
  }, [table, order, asc]);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { data, loading, reload };
}
