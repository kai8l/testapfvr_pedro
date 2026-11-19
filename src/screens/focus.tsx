import React, { useEffect, useRef, useState } from 'react';
import { Alert, Vibration, View, Text } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTable } from '../lib/useTable';
import { cancelNotification, scheduleTimerEnd } from '../lib/notify';
import { iso } from '../lib/dates';
import { useTheme } from '../context/SettingsContext';
import { Btn, Card, Screen, Segment, T } from '../components/ui';

/** Conquista "Foco mestre": concluir esta quantidade de ciclos de foco no mesmo dia (1 rodada completa do Pomodoro). */
export const FOCO_MESTRE_CICLOS = 4;

type Mode = 'foco' | 'pausa' | 'longa';
const BREAK_MIN = 5, LONG_MIN = 15, CYCLES_BEFORE_LONG = 4;
const p2 = (n: number) => String(n).padStart(2, '0');
const mmss = (s: number) => `${p2(Math.floor(s / 60))}:${p2(s % 60)}`;
const secsOf = (m: Mode, focusMin: string) => (m === 'foco' ? Number(focusMin) : m === 'pausa' ? BREAK_MIN : LONG_MIN) * 60;
const LABEL: Record<Mode, string> = { foco: 'Hora de focar', pausa: 'Pausa curta', longa: 'Pausa longa' };

export function Focus({ route, navigation }: any) {
  const { c, fs } = useTheme();
  const task: { id: string; title: string } | undefined = route.params?.task;
  const { data: sessions, reload } = useTable<any>('focus_sessions');

  const [focusMin, setFocusMin] = useState('25');
  const [mode, setMode] = useState<Mode>('foco');
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(25 * 60);
  const [cycle, setCycle] = useState(0);            // ciclos concluídos nesta abertura da tela (controla a pausa longa)
  const endAt = useRef(0);                          // horário-alvo: o tempo é calculado pelo relógio, não por contagem (não "perde" segundos em segundo plano)
  const notifId = useRef<string | null>(null);

  const total = secsOf(mode, focusMin);
  const today = iso(new Date());
  const todayCount = sessions.filter(s => iso(new Date(s.created_at)) === today).length;

  const arm = async (seconds: number) => {
    await cancelNotification(notifId.current);
    notifId.current = await scheduleTimerEnd(mode === 'foco' ? 'Foco concluído! 🎉' : 'Pausa terminou', mode === 'foco' ? 'Hora de descansar um pouco.' : 'Vamos voltar ao foco?', seconds);
  };
  const disarm = async () => { await cancelNotification(notifId.current); notifId.current = null; };

  const start = async () => {
    endAt.current = Date.now() + left * 1000;
    setRunning(true);
    await arm(left);
  };
  const pause = async () => {
    setLeft(Math.max(1, Math.ceil((endAt.current - Date.now()) / 1000)));
    setRunning(false);
    await disarm();
  };
  const reset = async (m: Mode = mode, fm = focusMin) => { setRunning(false); await disarm(); setMode(m); setLeft(secsOf(m, fm)); };

  const finish = async () => {
    setRunning(false);
    await disarm();
    Vibration.vibrate([0, 400, 200, 400]);
    if (mode !== 'foco') {
      setMode('foco'); setLeft(secsOf('foco', focusMin));
      return Alert.alert('Pausa terminou', 'Pronto para o próximo ciclo de foco?');
    }
    const next = cycle + 1;
    const nextMode: Mode = next % CYCLES_BEFORE_LONG === 0 ? 'longa' : 'pausa';
    setCycle(next); setMode(nextMode); setLeft(secsOf(nextMode, focusMin));

    const { error } = await supabase.from('focus_sessions').insert({ task_id: task?.id ?? null, duration_min: Number(focusMin) });
    if (error) return Alert.alert('Ciclo concluído', `Mas não foi possível registrar: ${error.message}`);
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const { count } = await supabase.from('focus_sessions').select('id', { count: 'exact', head: true }).gte('created_at', startOfDay.toISOString());
    reload();
    if (count === FOCO_MESTRE_CICLOS) Alert.alert('🏆 Conquista desbloqueada!', `Foco mestre: ${FOCO_MESTRE_CICLOS} ciclos de foco hoje. Parabéns!`);
    else Alert.alert('Ciclo concluído! 🎉', 'Boa! Aproveite a pausa.');
  };

  // Atualiza a tela a cada 0,5 s a partir do relógio; ao voltar do segundo plano já mostra o valor certo.
  const finishRef = useRef(finish); finishRef.current = finish;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const rem = Math.ceil((endAt.current - Date.now()) / 1000);
      if (rem <= 0) { clearInterval(id); finishRef.current(); } else setLeft(rem);
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  // Sair com o timer rodando cancela o aviso agendado (senão tocaria sem a tela aberta)
  useEffect(() => navigation.addListener('beforeRemove', (e: any) => {
    if (!running) { cancelNotification(notifId.current); return; }
    e.preventDefault();
    Alert.alert('Sair do foco?', 'O temporizador em andamento será cancelado.', [
      { text: 'Continuar focando', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => { cancelNotification(notifId.current); navigation.dispatch(e.data.action); } },
    ]);
  }), [navigation, running]);

  const pct = total ? Math.min(100, Math.max(0, (1 - left / total) * 100)) : 0;

  return (
    <Screen title="Foco" subtitle="Técnica Pomodoro">
      {task ? <Card style={{ backgroundColor: c.soft }}><T muted style={{ fontSize: fs(12) }}>Focando em</T><T style={{ fontWeight: '800' }}>{task.title}</T></Card> : null}

      <T muted style={{ textAlign: 'center', marginTop: 8 }}>{LABEL[mode]}</T>
      <Text accessibilityLiveRegion="polite" style={{ textAlign: 'center', fontSize: fs(72), fontWeight: '800', color: mode === 'foco' ? c.primary : c.ok, marginVertical: 8 }}>{mmss(left)}</Text>
      <View style={{ height: 10, backgroundColor: c.soft, borderRadius: 5, overflow: 'hidden', marginBottom: 20 }}>
        <View style={{ width: `${pct}%`, height: 10, backgroundColor: mode === 'foco' ? c.primary : c.ok }} />
      </View>

      {!running && mode === 'foco' && left === total ? (
        <>
          <T muted style={{ marginBottom: 6 }}>Duração do foco</T>
          <Segment value={focusMin} onChange={k => { setFocusMin(k); setLeft(Number(k) * 60); }} options={[{ key: '15', label: '15 min' }, { key: '25', label: '25 min' }, { key: '45', label: '45 min' }]} />
        </>
      ) : null}

      {running
        ? <Btn title="Pausar" icon="pause" onPress={pause} />
        : <Btn title={left < total ? 'Continuar' : mode === 'foco' ? 'Iniciar foco' : 'Iniciar pausa'} icon="play" onPress={start} />}
      {left < total || running ? <Btn title="Reiniciar" variant="outline" icon="refresh" onPress={() => reset()} /> : null}
      {mode !== 'foco' && !running ? <Btn title="Pular pausa" variant="outline" onPress={() => reset('foco')} /> : null}

      <Card style={{ marginTop: 16 }}>
        <T style={{ fontWeight: '800' }}>Ciclos hoje: {todayCount}/{FOCO_MESTRE_CICLOS}</T>
        <T muted style={{ fontSize: fs(12), marginTop: 2 }}>
          {todayCount >= FOCO_MESTRE_CICLOS ? '🏆 Você é um Foco mestre hoje!' : `Complete ${FOCO_MESTRE_CICLOS} ciclos no mesmo dia para ganhar a conquista “Foco mestre”.`}
        </T>
      </Card>
      <T muted style={{ fontSize: fs(12), textAlign: 'center' }}>Foque, descanse 5 min e repita. A cada {CYCLES_BEFORE_LONG} ciclos, uma pausa longa de {LONG_MIN} min.</T>
    </Screen>
  );
}
