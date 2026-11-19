import React, { useMemo, useState } from 'react';
import { Alert, View, Text, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTable } from '../lib/useTable';
import { scheduleReminder } from '../lib/notify';
import { useTheme } from '../context/SettingsContext';
import { MONTHS, WD, WD_LONG, addDays, fromISO, iso, startOfWeek } from '../lib/dates';
import { Btn, Card, DateField, Empty, Field, H, Icon, Screen, T } from '../components/ui';

type Item = { id: string; time: string; title: string; kind: 'tarefa' | 'lembrete'; raw: any };

function useItems() {
  const t = useTable<any>('tasks', 'created_at');
  const r = useTable<any>('reminders', 'remind_date', true);
  const itemsFor = (day: string): Item[] => [
    ...t.data.filter(x => x.due_date === day).map(x => ({ id: x.id, time: '', title: x.title, kind: 'tarefa' as const, raw: x })),
    ...r.data.filter(x => x.remind_date === day).map(x => ({ id: x.id, time: (x.remind_time || '').slice(0, 5), title: x.title, kind: 'lembrete' as const, raw: x })),
  ].sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const marks = new Set<string>([...t.data.map(x => x.due_date), ...r.data.map(x => x.remind_date)].filter(Boolean));
  return { itemsFor, marks, reloadAll: () => { t.reload(); r.reload(); } };
}

function ItemRow({ it, navigation, onChanged }: { it: Item; navigation: any; onChanged: () => void }) {
  const { c, fs } = useTheme();
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center' }}
      onPress={() => it.kind === 'tarefa' ? navigation.navigate('TaskForm', { task: it.raw }) : undefined}
      onLongPress={() => it.kind === 'lembrete' && Alert.alert('Excluir lembrete', it.title, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: async () => { await supabase.from('reminders').delete().eq('id', it.id); onChanged(); } },
      ])}>
      <Text style={{ width: 52, color: c.muted, fontSize: fs(13) }}>{it.time || '—'}</Text>
      <Icon name={it.kind === 'tarefa' ? 'checkbox-outline' : 'notifications'} size={18} color={c.primary} />
      <Text style={{ flex: 1, marginLeft: 8, color: c.text, fontSize: fs(15) }}>{it.title}</Text>
    </Card>
  );
}

export function Agenda({ navigation }: any) {
  const { c, fs } = useTheme();
  const [sel, setSel] = useState(iso(new Date()));
  const { itemsFor, reloadAll } = useItems();
  const d = fromISO(sel);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(d), i)), [sel]);
  const items = itemsFor(sel);
  return (
    <Screen title="Agenda" fab={() => Alert.alert('Adicionar', 'O que deseja criar?', [
      { text: 'Tarefa', onPress: () => navigation.navigate('TaskForm') },
      { text: 'Lembrete', onPress: () => navigation.navigate('ReminderForm', { date: sel }) },
      { text: 'Cancelar', style: 'cancel' },
    ])}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => setSel(iso(addDays(d, -7)))}><Icon name="chevron-back" size={22} color={c.text} /></TouchableOpacity>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: fs(15) }}>{WD_LONG[d.getDay()]}, {d.getDate()} de {MONTHS[d.getMonth()]}</Text>
        <TouchableOpacity onPress={() => setSel(iso(addDays(d, 7)))}><Icon name="chevron-forward" size={22} color={c.text} /></TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 14 }}>
        {week.map(w => {
          const on = iso(w) === sel;
          return (
            <TouchableOpacity key={iso(w)} onPress={() => setSel(iso(w))} style={{ alignItems: 'center', padding: 6, borderRadius: 10, backgroundColor: on ? c.primary : 'transparent', minWidth: 40 }}>
              <Text style={{ color: on ? '#fff' : c.muted, fontSize: fs(12) }}>{WD[w.getDay()]}</Text>
              <Text style={{ color: on ? '#fff' : c.text, fontWeight: '800', fontSize: fs(16) }}>{w.getDate()}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Btn title="Ver calendário do mês" variant="outline" icon="calendar" onPress={() => navigation.navigate('Calendar')} />
      <View style={{ height: 12 }} />
      {items.length ? items.map(it => <ItemRow key={it.kind + it.id} it={it} navigation={navigation} onChanged={reloadAll} />) : <Empty text="Nada planejado para este dia." />}
    </Screen>
  );
}

export function CalendarScreen({ navigation }: any) {
  const { c, fs } = useTheme();
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [sel, setSel] = useState(iso(today));
  const { itemsFor, marks, reloadAll } = useItems();
  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const dayISO = (n: number) => iso(new Date(month.getFullYear(), month.getMonth(), n));
  const items = itemsFor(sel);
  return (
    <Screen title="Calendário">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Icon name="chevron-back" size={22} color={c.text} /></TouchableOpacity>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: fs(16) }}>{MONTHS[month.getMonth()]} {month.getFullYear()}</Text>
        <TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Icon name="chevron-forward" size={22} color={c.text} /></TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row' }}>{WD.map(w => <Text key={w} style={{ flex: 1, textAlign: 'center', color: c.muted, fontSize: fs(12) }}>{w}</Text>)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
        {cells.map((n, i) => {
          const on = n && dayISO(n) === sel;
          return (
            <TouchableOpacity key={i} disabled={!n} onPress={() => n && setSel(dayISO(n))} style={{ width: '14.285%', height: 44, alignItems: 'center', justifyContent: 'center' }}>
              {n ? (
                <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.primary : 'transparent' }}>
                  <Text style={{ color: on ? '#fff' : c.text, fontSize: fs(14) }}>{n}</Text>
                  {marks.has(dayISO(n)) ? <View style={{ position: 'absolute', bottom: 3, width: 5, height: 5, borderRadius: 3, backgroundColor: on ? '#fff' : c.primary }} /> : null}
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
      <H>Eventos do dia</H>
      {items.length ? items.map(it => <ItemRow key={it.kind + it.id} it={it} navigation={navigation} onChanged={reloadAll} />) : <Empty text="Sem eventos neste dia." />}
      <Btn title="Novo lembrete neste dia" icon="add" onPress={() => navigation.navigate('ReminderForm', { date: sel })} />
    </Screen>
  );
}

export function ReminderForm({ route, navigation }: any) {
  const [title, setTitle] = useState(''); const [desc, setDesc] = useState('');
  const [date, setDate] = useState(route.params?.date || ''); const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!title.trim() || !date) return Alert.alert('Atenção', 'Informe o lembrete e a data.');
    setBusy(true);
    const { error } = await supabase.from('reminders').insert({ title: title.trim(), description: desc, remind_date: date, remind_time: time || null });
    setBusy(false);
    if (error) return Alert.alert('Erro', error.message);
    await scheduleReminder(title.trim(), desc, date, time);
    navigation.goBack();
  };
  return (
    <Screen title="Criar lembrete">
      <View style={{ alignItems: 'center', marginBottom: 12 }}><Icon name="notifications" size={72} color="#F5A623" /></View>
      <Field label="Lembrete" placeholder="Ex: Acordar e tomar café" value={title} onChangeText={setTitle} />
      <Field label="Descrição" placeholder="Ex: Pão com geleia" value={desc} onChangeText={setDesc} />
      <DateField label="Data" value={date} onChange={setDate} />
      <DateField label="Horário" value={time} onChange={setTime} mode="time" />
      <Btn title="Salvar" onPress={save} loading={busy} />
    </Screen>
  );
}
