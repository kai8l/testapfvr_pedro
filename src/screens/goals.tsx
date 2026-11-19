import React, { useState } from 'react';
import { Alert, View, Text, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTable } from '../lib/useTable';
import { useTheme } from '../context/SettingsContext';
import { Btn, Card, DateField, Empty, Field, Icon, Screen, Segment, T } from '../components/ui';

export function Goals({ navigation }: any) {
  const { c, fs } = useTheme();
  const { data, reload } = useTable<any>('goals', 'created_at');
  const [tab, setTab] = useState('ativas');
  const list = data.filter(g => (tab === 'ativas' ? !g.done : g.done));

  const step = async (g: any, delta: number) => {
    const progress = Math.max(0, Math.min(100, g.progress + delta));
    await supabase.from('goals').update({ progress, done: progress >= 100 }).eq('id', g.id);
    reload();
  };
  const del = (g: any) => Alert.alert('Excluir meta', g.title, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: async () => { await supabase.from('goals').delete().eq('id', g.id); reload(); } },
  ]);

  return (
    <Screen title="Metas" subtitle="Acompanhe suas conquistas" fab={() => navigation.navigate('GoalForm')}>
      <Segment value={tab} onChange={setTab} options={[{ key: 'ativas', label: 'Ativas' }, { key: 'concluidas', label: 'Concluídas' }]} />
      {list.map((g, i) => (
        <Card key={g.id} onLongPress={() => del(g)}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.primary, fontWeight: '800' }}>{i + 1}</Text></View>
            <Text style={{ flex: 1, marginLeft: 10, color: c.text, fontWeight: '700', fontSize: fs(15) }}>{g.title}</Text>
            <Text style={{ color: c.muted, fontSize: fs(12) }}>{g.progress}%</Text>
          </View>
          <View style={{ height: 8, backgroundColor: c.soft, borderRadius: 4, marginTop: 10, overflow: 'hidden' }}>
            <View style={{ width: `${g.progress}%`, height: 8, backgroundColor: c.primary }} />
          </View>
          {!g.done ? (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 10 }}>
              <TouchableOpacity onPress={() => step(g, -10)}><Icon name="remove-circle" size={30} color={c.muted} /></TouchableOpacity>
              <TouchableOpacity onPress={() => step(g, 10)}><Icon name="add-circle" size={30} color={c.primary} /></TouchableOpacity>
            </View>
          ) : null}
        </Card>
      ))}
      {!list.length ? <Empty text={tab === 'ativas' ? 'Nenhuma meta ativa. Toque em + para criar.' : 'Você ainda não concluiu nenhuma meta.'} /> : <T muted style={{ textAlign: 'center', fontSize: 12 }}>Use + / − para atualizar o progresso. Segure para excluir.</T>}
    </Screen>
  );
}

export function GoalForm({ navigation }: any) {
  const { c } = useTheme();
  const [title, setTitle] = useState(''); const [desc, setDesc] = useState(''); const [deadline, setDeadline] = useState(''); const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!title.trim()) return Alert.alert('Atenção', 'Dê um título para a meta.');
    setBusy(true);
    const { error } = await supabase.from('goals').insert({ title: title.trim(), description: desc, deadline: deadline || null });
    setBusy(false);
    if (error) return Alert.alert('Erro', error.message);
    navigation.goBack();
  };
  return (
    <Screen title="Criar nova meta" subtitle="Adicione uma nova meta">
      <View style={{ alignItems: 'center', marginBottom: 12 }}><Icon name="locate" size={80} color={c.primary} /></View>
      <Field label="Título da meta" placeholder="Ex: estudar" value={title} onChangeText={setTitle} />
      <Field label="Descrição (opcional)" placeholder="Detalhes da meta..." value={desc} onChangeText={setDesc} multiline />
      <DateField label="Prazo" value={deadline} onChange={setDeadline} />
      <Btn title="Criar meta" onPress={save} loading={busy} />
    </Screen>
  );
}
