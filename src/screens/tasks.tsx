import React, { useState } from 'react';
import { Alert, View, Text, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTable } from '../lib/useTable';
import { useTheme } from '../context/SettingsContext';
import { Btn, Card, DateField, Empty, Field, H, Icon, Screen, T } from '../components/ui';
import { Subtasks } from '../components/Subtasks';

export const PR: any = {
  baixa: { label: 'Baixa', icon: 'ellipse', color: '#2FB344' },
  media: { label: 'Média', icon: 'star', color: '#F5C518' },
  alta: { label: 'Alta', icon: 'heart', color: '#E5484D' },
};

export function Tasks({ navigation }: any) {
  const { c, fs } = useTheme();
  const { data, reload } = useTable<any>('tasks', 'created_at');
  const subs = useTable<any>('subtasks', 'created_at', true);
  const progress = (id: string) => { const l = subs.data.filter(x => x.task_id === id); return l.length ? `${l.filter(x => x.done).length}/${l.length} passos` : ''; };
  const toggle = async (t: any) => {
    await supabase.from('tasks').update({ done: !t.done, done_at: !t.done ? new Date().toISOString() : null }).eq('id', t.id);
    reload();
  };
  return (
    <Screen title="Tarefas" fab={() => navigation.navigate('TaskForm')}>
      <H>Minhas tarefas:</H>
      {(['baixa', 'media', 'alta'] as const).map(p => {
        const list = data.filter(t => t.priority === p);
        if (!list.length) return null;
        return (
          <View key={p} style={{ marginBottom: 8 }}>
            <T muted style={{ marginBottom: 6 }}>{PR[p].label}:</T>
            {list.map(t => (
              <Card key={t.id} onPress={() => navigation.navigate('TaskForm', { task: t })} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name={PR[p].icon} size={18} color={PR[p].color} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ color: c.text, fontSize: fs(15), textDecorationLine: t.done ? 'line-through' : 'none', opacity: t.done ? 0.5 : 1 }}>{t.title}</Text>
                  {progress(t.id) ? <Text style={{ color: c.muted, fontSize: fs(12) }}>{progress(t.id)}</Text> : null}
                </View>
                {!t.done ? (
                  <TouchableOpacity onPress={() => navigation.navigate('Focus', { task: { id: t.id, title: t.title } })} hitSlop={10} accessibilityLabel="Focar nesta tarefa" style={{ marginRight: 14 }}>
                    <Icon name="timer-outline" size={24} color={c.primary} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => toggle(t)} hitSlop={10} accessibilityLabel="Concluir tarefa">
                  <Icon name={t.done ? 'checkbox' : 'square-outline'} size={26} color={c.primary} />
                </TouchableOpacity>
              </Card>
            ))}
          </View>
        );
      })}
      {!data.length ? <Empty text="Nenhuma tarefa ainda. Toque em + para criar a primeira." /> : null}
      <Btn title="Temporizador de foco" icon="timer" onPress={() => navigation.navigate('Focus')} />
      <Btn title="Biblioteca de dicas" variant="outline" icon="bulb" onPress={() => navigation.navigate('Tips')} />
    </Screen>
  );
}

export function TaskForm({ route, navigation }: any) {
  const { c, fs } = useTheme();
  const task = route.params?.task;
  const [title, setTitle] = useState(task?.title || '');
  const [desc, setDesc] = useState(task?.description || '');
  const [date, setDate] = useState(task?.due_date || '');
  const [prio, setPrio] = useState(task?.priority || 'media');
  const [busy, setBusy] = useState(false);
  const [pendingSubs, setPendingSubs] = useState<string[]>([]);

  const save = async () => {
    if (!title.trim()) return Alert.alert('Atenção', 'Dê um título para a tarefa.');
    setBusy(true);
    const row = { title: title.trim(), description: desc, due_date: date || null, priority: prio };
    if (task) {
      const { error } = await supabase.from('tasks').update(row).eq('id', task.id);
      setBusy(false);
      if (error) return Alert.alert('Erro', error.message);
      return navigation.goBack();
    }
    const created = await supabase.from('tasks').insert(row).select('id').single();
    if (created.error) { setBusy(false); return Alert.alert('Erro', created.error.message); }
    if (pendingSubs.length) {
      const r = await supabase.from('subtasks').insert(pendingSubs.map((title, i) => ({ task_id: created.data.id, title, position: i })));
      if (r.error) Alert.alert('Tarefa criada', 'Mas não foi possível salvar os passos. Abra a tarefa e adicione-os de novo.');
    }
    setBusy(false);
    navigation.goBack();
  };
  const del = () => Alert.alert('Excluir tarefa', 'Tem certeza?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: async () => { await supabase.from('tasks').delete().eq('id', task.id); navigation.goBack(); } },
  ]);

  return (
    <Screen title={task ? 'Editar tarefa' : 'Criar nova tarefa'} subtitle={task ? undefined : 'Adicione uma nova tarefa'}>
      <View style={{ alignItems: 'center', marginBottom: 12 }}><Icon name="clipboard" size={80} color={c.primary} /></View>
      <Field label="Título da tarefa" placeholder="Ex: Limpar a casa" value={title} onChangeText={setTitle} />
      <Field label="Descrição (opcional)" placeholder="Detalhes da tarefa..." value={desc} onChangeText={setDesc} multiline />
      <DateField label="Data" value={date} onChange={setDate} />
      <T style={{ fontWeight: '600', marginBottom: 6 }}>Prioridade</T>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {Object.keys(PR).map(k => (
          <TouchableOpacity key={k} onPress={() => setPrio(k)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 10, borderWidth: 2, borderColor: prio === k ? c.primary : c.border, backgroundColor: prio === k ? c.soft : c.card }}>
            <Text style={{ color: c.text, fontSize: fs(14), marginRight: 6 }}>{PR[k].label}</Text>
            <Icon name={PR[k].icon} size={16} color={PR[k].color} />
          </TouchableOpacity>
        ))}
      </View>
      <Subtasks taskId={task?.id} pending={pendingSubs} setPending={setPendingSubs} />
      <Btn title={task ? 'Salvar alteração' : 'Criar tarefa'} onPress={save} loading={busy} />
      {task ? <Btn title="Focar nesta tarefa" variant="outline" icon="timer" onPress={() => navigation.navigate('Focus', { task: { id: task.id, title: task.title } })} /> : null}
      {task ? <Btn title="Excluir tarefa" variant="danger" icon="trash" onPress={del} /> : null}
    </Screen>
  );
}
