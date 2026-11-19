import React, { useState } from 'react';
import { Alert, View, Text, TextInput } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTable } from '../lib/useTable';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/SettingsContext';
import { iso, money } from '../lib/dates';
import { Btn, Card, DateField, Empty, Field, H, Icon, Screen, Segment, T } from '../components/ui';

const num = (v: string) => parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;

export function Finance({ navigation }: any) {
  const { c, fs } = useTheme();
  const { profile, refreshProfile } = useAuth();
  const { data, reload } = useTable<any>('expenses', 'spent_on');
  const [salary, setSalary] = useState<string | null>(null);
  const month = iso(new Date()).slice(0, 7);
  const cur = data.filter(e => e.spent_on?.startsWith(month));
  const rec = cur.filter(e => e.kind === 'receita').reduce((a, e) => a + Number(e.amount), 0);
  const des = cur.filter(e => e.kind === 'despesa').reduce((a, e) => a + Number(e.amount), 0);

  const saveSalary = async () => {
    if (salary === null) return;
    await supabase.from('profiles').update({ monthly_income: num(salary) }).eq('id', profile.id);
    await refreshProfile(); setSalary(null);
  };
  const del = (e: any) => Alert.alert('Excluir', e.title, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: async () => { await supabase.from('expenses').delete().eq('id', e.id); reload(); } },
  ]);

  return (
    <Screen title="Finanças" fab={() => navigation.navigate('ExpenseForm')}>
      <H>Salário atual</H>
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon name="cash" size={30} color={c.primary} />
        <TextInput
          value={salary ?? String(profile?.monthly_income ?? 0).replace('.', ',')}
          onChangeText={setSalary} onEndEditing={saveSalary} keyboardType="decimal-pad"
          style={{ flex: 1, marginLeft: 10, fontSize: fs(20), fontWeight: '800', color: c.text }}
        />
        <T muted>R$</T>
      </Card>
      <Card>
        <T style={{ fontWeight: '800' }}>Resumo do mês</T>
        <T muted style={{ marginBottom: 8 }}>{month.split('-').reverse().join('/')}</T>
        <Text style={{ color: c.ok, fontSize: fs(15) }}>Receitas: {money(rec)}</Text>
        <Text style={{ color: c.danger, fontSize: fs(15) }}>Despesas: {money(des)}</Text>
        <Text style={{ color: c.text, fontSize: fs(15), fontWeight: '800', marginTop: 6 }}>Saldo: {money(Number(profile?.monthly_income || 0) + rec - des)}</Text>
      </Card>
      <H>Todas as despesas</H>
      {data.map(e => (
        <Card key={e.id} onLongPress={() => del(e)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '700' }}>{e.title}</T>
            <T muted style={{ fontSize: 12 }}>{e.spent_on?.split('-').reverse().join('/')} · {e.payment_method || '—'}</T>
          </View>
          <Text style={{ color: e.kind === 'receita' ? c.ok : c.danger, fontWeight: '800', fontSize: fs(15) }}>{e.kind === 'receita' ? '+' : '-'} {money(Number(e.amount))}</Text>
        </Card>
      ))}
      {!data.length ? <Empty text="Nenhum lançamento. Toque em + para adicionar." /> : <T muted style={{ textAlign: 'center', fontSize: 12 }}>Segure um item para excluir.</T>}
    </Screen>
  );
}

export function ExpenseForm({ navigation }: any) {
  const [kind, setKind] = useState('despesa');
  const [f, setF] = useState({ title: '', desc: '', amount: '', date: iso(new Date()), pay: '' });
  const [busy, setBusy] = useState(false);
  const up = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.title.trim() || !num(f.amount)) return Alert.alert('Atenção', 'Informe o que é e o valor.');
    setBusy(true);
    const { error } = await supabase.from('expenses').insert({ kind, title: f.title.trim(), description: f.desc, amount: num(f.amount), spent_on: f.date, payment_method: f.pay });
    setBusy(false);
    if (error) return Alert.alert('Erro', error.message);
    navigation.goBack();
  };
  return (
    <Screen title={kind === 'despesa' ? 'Nova despesa' : 'Nova receita'}>
      <Segment value={kind} onChange={setKind} options={[{ key: 'despesa', label: 'Despesa' }, { key: 'receita', label: 'Receita' }]} />
      <Field label="O que?" placeholder="Ex: comprar moto" value={f.title} onChangeText={up('title')} />
      <Field label="Descrição" placeholder="Ex: Presente para o pai" value={f.desc} onChangeText={up('desc')} />
      <Field label="Valor (R$)" placeholder="0,00" value={f.amount} onChangeText={up('amount')} keyboardType="decimal-pad" />
      <DateField label="Data" value={f.date} onChange={up('date')} />
      <Field label="Forma de pagamento" placeholder="Ex: Dinheiro" value={f.pay} onChangeText={up('pay')} />
      <Btn title="Salvar" onPress={save} loading={busy} />
    </Screen>
  );
}
