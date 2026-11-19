import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/SettingsContext';
import { Btn, Field, H, Icon, T } from './ui';

type Props = {
  taskId?: string;                       // tarefa já salva: grava direto no banco
  pending: string[];                     // tarefa nova: guarda aqui até salvar
  setPending: (v: string[]) => void;
};

/** "Quebra de tarefas": lista de passos pequenos dentro da tarefa. */
export function Subtasks({ taskId, pending, setPending }: Props) {
  const { c, fs } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [text, setText] = useState('');

  const load = useCallback(async () => {
    if (!taskId) return;
    const { data } = await supabase.from('subtasks').select('*').eq('task_id', taskId).order('position').order('created_at');
    setItems(data || []);
  }, [taskId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const title = text.trim();
    if (!title) return;
    setText('');
    if (!taskId) return setPending([...pending, title]);
    const { error } = await supabase.from('subtasks').insert({ task_id: taskId, title, position: items.length });
    if (error) { setText(title); return Alert.alert('Erro', error.message); }
    load();
  };
  const toggle = async (s: any) => {
    const { error } = await supabase.from('subtasks').update({ done: !s.done, done_at: !s.done ? new Date().toISOString() : null }).eq('id', s.id);
    if (error) return Alert.alert('Erro', error.message);
    load();
  };
  const remove = async (s: any) => { await supabase.from('subtasks').delete().eq('id', s.id); load(); };

  const rows = taskId ? items.map(s => ({ key: s.id, title: s.title, done: s.done, s })) : pending.map((t, i) => ({ key: String(i), title: t, done: false, s: i }));
  const done = rows.filter(r => r.done).length;

  return (
    <View style={{ marginTop: 8, marginBottom: 8 }}>
      <H>Quebrar em passos</H>
      <T muted style={{ marginBottom: 8, fontSize: fs(13) }}>
        {rows.length ? `${done} de ${rows.length} passos concluídos` : 'Divida a tarefa em passos pequenos. Cada passo concluído já conta!'}
      </T>
      {rows.map(r => (
        <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 10, marginBottom: 6 }}>
          {taskId ? (
            <TouchableOpacity onPress={() => toggle(r.s)} hitSlop={8} accessibilityLabel={r.done ? 'Desmarcar passo' : 'Concluir passo'}>
              <Icon name={r.done ? 'checkbox' : 'square-outline'} size={24} color={c.primary} />
            </TouchableOpacity>
          ) : <Icon name="ellipse-outline" size={14} color={c.muted} />}
          <Text style={{ flex: 1, marginLeft: 10, color: c.text, fontSize: fs(15), textDecorationLine: r.done ? 'line-through' : 'none', opacity: r.done ? 0.5 : 1 }}>{r.title}</Text>
          <TouchableOpacity onPress={() => (taskId ? remove(r.s) : setPending(pending.filter((_, i) => i !== r.s)))} hitSlop={8} accessibilityLabel="Remover passo">
            <Icon name="close-circle" size={22} color={c.muted} />
          </TouchableOpacity>
        </View>
      ))}
      <Field placeholder="Ex: Separar a louça suja" value={text} onChangeText={setText} onSubmitEditing={add} returnKeyType="done" autoCapitalize="sentences" />
      <Btn title="Adicionar passo" variant="outline" icon="add" onPress={add} style={{ marginTop: -6 }} />
    </View>
  );
}
