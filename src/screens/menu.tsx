import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/SettingsContext';
import { useTable } from '../lib/useTable';
import { WD, addDays, iso, startOfWeek } from '../lib/dates';
import { FOCO_MESTRE_CICLOS } from './focus';
import { Avatar, Btn, Card, Check, Empty, H, Icon, Screen, T } from '../components/ui';

export const TIPS = [
  { t: 'Quebre em passos pequenos', d: 'Divida uma tarefa grande em partes de 5 a 10 minutos. Concluir um passo já conta!' },
  { t: 'Técnica Pomodoro', d: 'Foque por 25 minutos e descanse 5. Depois de 4 ciclos, faça uma pausa maior.' },
  { t: 'Use lembretes visuais', d: 'Crie lembretes com horário para as rotinas importantes, como remédios e refeições.' },
  { t: 'Uma coisa por vez', d: 'Escolha só uma tarefa de prioridade alta por dia para começar.' },
  { t: 'Comemore as conquistas', d: 'Cada meta concluída merece reconhecimento. Olhe suas conquistas com carinho.' },
  { t: 'Prepare o ambiente', d: 'Deixe por perto o que vai precisar antes de começar. Menos distrações, mais foco.' },
];

export function Menu({ navigation }: any) {
  const { c, fs, s } = useTheme();
  const { profile } = useAuth();
  const tip = TIPS[new Date().getDate() % TIPS.length];
  const tiles = [
    { l: 'Metas', i: 'flag', to: 'Goals', bg: '#E6D9FF' }, { l: 'Finanças', i: 'wallet', to: 'Finance', bg: '#D8F2DD' },
    { l: 'Tarefas', i: 'checkbox', to: 'Tasks', bg: '#D6E8FF' }, { l: 'Conquistas', i: 'trophy', to: 'Achievements', bg: '#EBD9FF' },
    { l: 'Agenda', i: 'calendar', to: 'Agenda', bg: '#D6E4FF' }, { l: 'Biblioteca de dicas', i: 'bulb', to: 'Tips', bg: '#FFE0CC' },
    { l: 'Foco', i: 'timer', to: 'Focus', bg: '#FFF1C9' },
  ];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} accessibilityLabel="Configurações"><Icon name="settings-outline" size={30} color={c.text} /></TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}><Avatar url={profile?.avatar_url} size={56} /></TouchableOpacity>
        </View>
        <Text style={{ fontSize: fs(24), fontWeight: '800', color: c.text, marginTop: 8 }}>Olá, {profile?.name?.split(' ')[0] || 'Pessoa'}! 👋</Text>
        <T muted style={{ marginBottom: 16 }}>Que bom te ver por aqui!</T>
        {s.showTips ? (
          <Card style={{ backgroundColor: c.soft }}>
            <T style={{ fontWeight: '800' }}>💡 Dica do dia: {tip.t}</T>
            <T muted style={{ marginTop: 4 }}>{tip.d}</T>
          </Card>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 6 }}>
          {tiles.map(t => (
            <TouchableOpacity key={t.l} onPress={() => navigation.navigate(t.to)} style={{ width: '48%', aspectRatio: 1, backgroundColor: s.themeName === 'escuro' ? c.card : t.bg, borderRadius: 20, marginBottom: 14, alignItems: 'center', justifyContent: 'center', padding: 8 }}>
              <Icon name={t.i as any} size={56} color={c.primary} />
              <Text style={{ color: c.text, fontWeight: '800', marginTop: 8, fontSize: fs(15), textAlign: 'center' }}>{t.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function streakOf(doneAt: string[]) {
  const days = new Set(doneAt.map(d => iso(new Date(d))));
  let cur = new Date(); let n = 0;
  if (!days.has(iso(cur))) cur = addDays(cur, -1);
  while (days.has(iso(cur))) { n++; cur = addDays(cur, -1); }
  return n;
}

export function Achievements() {
  const { c, fs } = useTheme();
  const tasks = useTable<any>('tasks'); const goals = useTable<any>('goals'); const rem = useTable<any>('reminders'); const focus = useTable<any>('focus_sessions');
  const perDay: Record<string, number> = {};
  focus.data.forEach(f => { const d = iso(new Date(f.created_at)); perDay[d] = (perDay[d] || 0) + 1; });
  const done = tasks.data.filter(t => t.done);
  const list = [
    { i: 'star', t: 'Primeira meta', d: 'Crie sua primeira meta', ok: goals.data.length >= 1 },
    { i: 'flame', t: '7 dias seguidos', d: 'Conclua tarefas por 7 dias', ok: streakOf(done.map(t => t.done_at)) >= 7 },
    { i: 'checkmark-done', t: 'Mão na massa', d: 'Conclua 10 tarefas', ok: done.length >= 10 },
    { i: 'albums', t: 'Organização', d: 'Crie 10 tarefas', ok: tasks.data.length >= 10 },
    { i: 'time', t: 'No horário', d: 'Conclua uma tarefa até o prazo', ok: done.some(t => t.due_date && iso(new Date(t.done_at)) <= t.due_date) },
    { i: 'megaphone', t: 'Lembrete seguido', d: 'Crie seu primeiro lembrete', ok: rem.data.length >= 1 },
    { i: 'trophy', t: 'Meta conquistada', d: 'Conclua uma meta', ok: goals.data.some(g => g.done) },
    { i: 'timer', t: 'Foco mestre', d: `Complete ${FOCO_MESTRE_CICLOS} ciclos de foco em um dia`, ok: Object.values(perDay).some(n => n >= FOCO_MESTRE_CICLOS) },
  ];
  return (
    <Screen title="Conquistas">
      <View style={{ alignItems: 'center', marginBottom: 12 }}><Icon name="trophy" size={80} color={c.primary} /></View>
      <T muted style={{ textAlign: 'center', marginBottom: 12 }}>{list.filter(l => l.ok).length} de {list.length} desbloqueadas</T>
      {list.map(l => (
        <Card key={l.t} style={{ flexDirection: 'row', alignItems: 'center', opacity: l.ok ? 1 : 0.5 }}>
          <Icon name={l.i as any} size={28} color={l.ok ? '#F5A623' : c.muted} style={{ width: 40 }} />
          <View style={{ flex: 1 }}><T style={{ fontWeight: '800' }}>{l.t}</T><T muted style={{ fontSize: fs(12) }}>{l.d}</T></View>
          {l.ok ? <Icon name="checkmark-circle" size={22} color={c.ok} /> : <Icon name="lock-closed" size={18} color={c.muted} />}
        </Card>
      ))}
    </Screen>
  );
}

export function Stats() {
  const { c, fs } = useTheme();
  const tasks = useTable<any>('tasks'); const goals = useTable<any>('goals');
  const start = startOfWeek(new Date());
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = iso(addDays(start, i));
    const day = tasks.data.filter(t => t.due_date === d);
    return { label: WD[i], pct: day.length ? Math.round((day.filter(t => t.done).length / day.length) * 100) : 0 };
  });
  const doneWeek = tasks.data.filter(t => t.done && t.done_at && new Date(t.done_at) >= start).length;
  return (
    <Screen title="Estatísticas">
      <H>Produtividade (esta semana)</H>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 160, justifyContent: 'space-between' }}>
          {week.map(w => (
            <View key={w.label} style={{ flex: 1, alignItems: 'center' }}>
              <T muted style={{ fontSize: 10 }}>{w.pct}%</T>
              <View style={{ width: 20, height: Math.max(4, w.pct * 1.2), backgroundColor: c.primary, borderRadius: 4 }} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>{week.map(w => <T key={w.label} muted style={{ flex: 1, textAlign: 'center', fontSize: fs(12) }}>{w.label}</T>)}</View>
      </Card>
      <T muted style={{ fontSize: 12, marginBottom: 12 }}>% de tarefas do dia que foram concluídas.</T>
      <Card><T>Tarefas concluídas (semana)</T><Text style={{ color: c.primary, fontSize: fs(30), fontWeight: '800' }}>{doneWeek}</Text></Card>
      <Card><T>Metas conquistadas</T><Text style={{ color: c.primary, fontSize: fs(30), fontWeight: '800' }}>{goals.data.filter(g => g.done).length}</Text></Card>
    </Screen>
  );
}

export function Tips() {
  return (
    <Screen title="Biblioteca de dicas" subtitle="Pequenos truques que ajudam no dia a dia">
      {TIPS.map(t => <Card key={t.t}><T style={{ fontWeight: '800', marginBottom: 4 }}>💡 {t.t}</T><T muted>{t.d}</T></Card>)}
    </Screen>
  );
}

export function HowTo() {
  const { c } = useTheme();
  const steps = [
    ['Explorar o menu inicial', 'Navegue pelas opções principais do app.'],
    ['Crie tarefas e metas', 'Organize suas atividades diárias e acompanhe suas conquistas de forma simples.'],
    ['Receba lembretes', 'Nunca perca uma tarefa importante.'],
    ['Acompanhe seu progresso', 'Conclua tarefas, alcance suas metas e acompanhe seu progresso.'],
  ];
  return (
    <Screen title="Como usar o App??" subtitle="Seu guia rápido para começar!!">
      {steps.map((s, i) => (
        <Card key={i} style={{ flexDirection: 'row' }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}><Text style={{ color: c.primary, fontWeight: '800' }}>{i + 1}</Text></View>
          <View style={{ flex: 1 }}><T style={{ fontWeight: '800' }}>{s[0]}</T><T muted>{s[1]}</T></View>
        </Card>
      ))}
    </Screen>
  );
}

const FAQS = [
  ['Como funciona o app??', 'O NeuroConecta ajuda você a organizar tarefas, metas, lembretes e finanças de um jeito simples e acessível.'],
  ['Como adiciono uma tarefa??', 'Abra Tarefas e toque no botão + no canto da tela. Preencha o título, a data e a prioridade.'],
  ['O app é seguro??', 'Seus dados ficam protegidos e só você tem acesso a eles. Veja a Política de Privacidade em Configurações.'],
  ['Como funciona o financeiro??', 'Em Finanças você registra receitas e despesas e vê o resumo do mês.'],
  ['Posso usar offline??', 'Por enquanto é necessário estar conectado à internet para sincronizar seus dados.'],
];
export function FAQ() {
  const { c } = useTheme();
  const [q, setQ] = useState(''); const [open, setOpen] = useState<number | null>(null);
  const list = FAQS.filter(f => f[0].toLowerCase().includes(q.toLowerCase()));
  return (
    <Screen title="Perguntas frequentes">
      <Card><View style={{ flexDirection: 'row', alignItems: 'center' }}><Icon name="search" size={18} color={c.muted} /><TextInputLite value={q} onChange={setQ} /></View></Card>
      {list.map((f, i) => (
        <Card key={f[0]} onPress={() => setOpen(open === i ? null : i)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T style={{ fontWeight: '700', flex: 1 }}>{f[0]}</T><Icon name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} /></View>
          {open === i ? <T muted style={{ marginTop: 8 }}>{f[1]}</T> : null}
        </Card>
      ))}
      {!list.length ? <Empty text="Nenhuma pergunta encontrada." /> : null}
    </Screen>
  );
}
import { TextInput } from 'react-native';
const TextInputLite = ({ value, onChange }: any) => {
  const { c } = useTheme();
  return <TextInput value={value} onChangeText={onChange} placeholder="Buscar ..." placeholderTextColor={c.muted} style={{ flex: 1, marginLeft: 8, color: c.text }} />;
};

const LEGAL: any = {
  privacy: { title: 'Política de privacidade', icon: 'shield-checkmark', check: 'Li e concordo com a Política de Privacidade', body: [
    'Última atualização: 06 de agosto de 2026.', 'Bem-vindo ao NeuroConecta. A sua privacidade é importante para nós. Esta Política explica como coletamos, utilizamos, armazenamos e protegemos suas informações ao utilizar nosso aplicativo.',
    '1. Dados coletados: nome, e-mail, data de nascimento, diagnóstico (opcional) e o conteúdo que você cria (tarefas, metas, lembretes e finanças).',
    '2. Uso: usamos seus dados apenas para fornecer as funcionalidades do app e melhorar sua experiência.',
    '3. Seus direitos (LGPD): você pode acessar, corrigir e excluir seus dados a qualquer momento em Configurações > Perfil.',
    '4. Segurança: os dados são armazenados com criptografia e acesso restrito à sua conta.',
    '[Substitua este texto pelo documento final revisado pelo seu responsável jurídico.]'] },
  terms: { title: 'Termos de uso', icon: 'document-text', check: 'Li e concordo com os Termos de Uso', body: [
    'Última atualização: 06 de agosto de 2026.', 'Bem-vindo ao NeuroConecta. Ao acessar ou utilizar este aplicativo, você concorda com os presentes Termos de Uso. Caso não concorde com qualquer disposição, recomendamos que não utilize o aplicativo.',
    '1. Sobre o aplicativo: o NeuroConecta é um aplicativo de organização e apoio à rotina. Ele não substitui acompanhamento médico ou terapêutico.',
    '2. Conta: você é responsável por manter a confidencialidade das suas credenciais.',
    '3. Planos: alguns recursos fazem parte do plano Premium, com cobrança mensal ou anual e cancelamento a qualquer momento.',
    '[Substitua este texto pelo documento final revisado pelo seu responsável jurídico.]'] },
};
export function Legal({ route, navigation }: any) {
  const { c } = useTheme();
  const L = LEGAL[route.params?.type || 'terms'];
  const [ok, setOk] = useState(false);
  return (
    <Screen title={L.title} footer={<Btn title="Entendi" onPress={() => navigation.goBack()} />}>
      <View style={{ alignItems: 'center', marginBottom: 12 }}><Icon name={L.icon} size={72} color={c.primary} /></View>
      {L.body.map((p: string, i: number) => <T key={i} style={{ marginBottom: 10 }}>{p}</T>)}
      <Check checked={ok} onPress={() => setOk(!ok)}>{L.check}</Check>
    </Screen>
  );
}

export function Thanks({ route, navigation }: any) {
  const { c } = useTheme();
  return (
    <Screen title="Obrigado!" back={false} footer={<Btn title="Obrigado (a)" onPress={() => navigation.popToTop()} />}>
      <View style={{ alignItems: 'center', marginVertical: 24 }}><Icon name="happy" size={110} color="#F5C518" /></View>
      <T style={{ textAlign: 'center' }}>{route.params?.message || 'Tudo certo!'}</T>
    </Screen>
  );
}
