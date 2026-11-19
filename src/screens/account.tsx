import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, View, Text, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { supabase, uploadImage } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/SettingsContext';
import { money } from '../lib/dates';
import { maskCPF, maskCard, maskExp, isValidCPF, onlyDigits, toE164BR } from '../lib/br';
import { tokenizeCard } from '../lib/mercadopago';
import { PLANS, PlanKey, PaymentResult, PixData, createPayment, checkPayment, rejectMessage } from '../lib/payments';
import { Avatar, Btn, Card, DateField, Field, H, Icon, Row, Screen, Segment, T, ToggleRow } from '../components/ui';

async function pickImage(square = true) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) { Alert.alert('Permissão necessária', 'Autorize o acesso à galeria nas configurações do aparelho.'); return null; }
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] as any, allowsEditing: square, aspect: square ? [1, 1] : undefined, quality: 0.7 });
  return r.canceled ? null : r.assets[0].uri;
}

export function Settings({ navigation }: any) {
  const items = [
    ['person', 'Perfil', undefined, 'Profile'], ['star', 'Preferências', 'Ajustes do app', 'Preferences'],
    ['notifications', 'Notificações', undefined, 'Notifications'], ['accessibility', 'Acessibilidade', 'Recursos de acessibilidade', 'Accessibility'],
    ['stats-chart', 'Estatísticas', 'Seu desempenho', 'Stats'], ['diamond', 'Premium', 'Conheça os planos', 'Premium'],
    ['warning', 'Reportar problema', undefined, 'ReportProblem'], ['help-buoy', 'Como usar o app', 'Veja um guia passo a passo', 'HowTo'],
    ['shield-checkmark', 'Política de privacidade', 'Como protegemos seus dados', 'Legal', { type: 'privacy' }],
    ['document-text', 'Termos de uso', undefined, 'Legal', { type: 'terms' }],
    ['help-circle', 'Perguntas frequentes', 'Tire suas dúvidas', 'FAQ'],
  ] as any[];
  return (
    <Screen title="Configurações">
      {items.map(i => <Row key={i[1]} icon={i[0]} label={i[1]} sub={i[2]} onPress={() => navigation.navigate(i[3], i[4])} />)}
      <Btn title="Sair" variant="outline" icon="log-out-outline" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}

export function Profile({ navigation }: any) {
  const { profile, session } = useAuth();
  const { c } = useTheme();
  const del = () => Alert.alert('Sair da conta', 'Para excluir seus dados definitivamente, solicite pelo "Reportar problema". Deseja apenas sair?', [
    { text: 'Cancelar', style: 'cancel' }, { text: 'Sair', onPress: () => supabase.auth.signOut() },
  ]);
  return (
    <Screen title="Perfil">
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Avatar url={profile?.avatar_url} size={110} />
        <T style={{ fontWeight: '800', fontSize: 20, marginTop: 8 }}>{profile?.name || 'Pessoa'}</T>
        <T muted>{session?.user.email}</T>
      </View>
      <Row icon="person" label="Dados da conta" onPress={() => navigation.navigate('AccountData')} />
      <Row icon="mail" label="Alterar E-mail" onPress={() => navigation.navigate('ChangeEmail')} />
      <Row icon="lock-closed" label="Alterar senha" onPress={() => navigation.navigate('ChangePassword')} />
      <Row icon="close" label="Sair da conta" color={c.danger} onPress={del} />
    </Screen>
  );
}

export function AccountData({ navigation }: any) {
  const { profile, session, refreshProfile } = useAuth();
  const { c } = useTheme();
  const [f, setF] = useState({ name: profile?.name || '', username: profile?.username || '', phone: profile?.phone || '', birth: profile?.birth_date || '' });
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url || null);
  const [busy, setBusy] = useState(false);
  const up = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const phoneOk = !!session?.user.phone_confirmed_at && onlyDigits(toE164BR(f.phone) || '') === session.user.phone;
  const change = async () => {
    const uri = await pickImage(); if (!uri) return;
    try { setAvatar(await uploadImage(session!.user.id, uri, 'avatar.jpg')); } catch (e: any) { Alert.alert('Erro ao enviar foto', e.message); }
  };
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ name: f.name, username: f.username, phone: f.phone, birth_date: f.birth || null, avatar_url: avatar }).eq('id', session!.user.id);
    setBusy(false);
    if (error) return Alert.alert('Erro', error.message);
    await refreshProfile(); navigation.goBack();
  };
  return (
    <Screen title="Dados da conta">
      <TouchableOpacity onPress={change} style={{ alignItems: 'center', marginBottom: 16 }}>
        <Avatar url={avatar} size={110} />
        <T style={{ color: '#7A00FF', marginTop: 6 }}>Alterar foto</T>
      </TouchableOpacity>
      <Field label="Nome" value={f.name} onChangeText={up('name')} autoCapitalize="words" />
      <Field label="Nome de usuário" value={f.username} onChangeText={up('username')} />
      <Field label="Telefone" placeholder="(00) 00000-0000" value={f.phone} onChangeText={up('phone')} keyboardType="phone-pad" />
      <TouchableOpacity onPress={() => navigation.navigate('VerifyPhone', { phone: f.phone })} style={{ marginTop: -6, marginBottom: 14 }}>
        <T style={{ color: c.primary, fontSize: 13 }}>{phoneOk ? '✓ Telefone verificado (usado para recuperar a senha por SMS)' : 'Verificar telefone para recuperar a senha por SMS'}</T>
      </TouchableOpacity>
      <DateField label="Data de nascimento" value={f.birth} onChange={up('birth')} />
      <Btn title="Salvar" onPress={save} loading={busy} />
    </Screen>
  );
}

export function VerifyPhone({ route, navigation }: any) {
  const { session, refreshProfile } = useAuth();
  const [phone, setPhone] = useState<string>(route.params?.phone || '');
  const [e164, setE164] = useState(''); const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone'); const [busy, setBusy] = useState(false);
  const send = async () => {
    const n = toE164BR(phone);
    if (!n) return Alert.alert('Atenção', 'Digite o telefone com DDD. Ex.: (14) 99999-9999');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ phone: n }); // envia o SMS de confirmação
    setBusy(false);
    if (error) return Alert.alert('Não foi possível enviar o SMS', error.message);
    setE164(n); setStep('code');
  };
  const confirm = async () => {
    if (!code.trim()) return Alert.alert('Atenção', 'Digite o código recebido por SMS.');
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code.trim(), type: 'phone_change' });
    if (error) { setBusy(false); return Alert.alert('Código inválido ou expirado', error.message); }
    await supabase.from('profiles').update({ phone }).eq('id', session!.user.id);
    await refreshProfile(); setBusy(false);
    navigation.navigate('Thanks', { message: 'Telefone verificado! Agora você pode recuperar sua senha por SMS.' });
  };
  return (
    <Screen title="Verificar telefone">
      {step === 'phone' ? (
        <>
          <T muted style={{ marginBottom: 12 }}>Enviaremos um código por SMS. Com o telefone verificado, você poderá recuperar a senha por SMS caso esqueça.</T>
          <Field label="Telefone" placeholder="(00) 00000-0000" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Btn title="Enviar código" onPress={send} loading={busy} />
        </>
      ) : (
        <>
          <T muted style={{ marginBottom: 12 }}>Digite o código enviado para {e164}.</T>
          <Field label="Código" placeholder="000000" value={code} onChangeText={setCode} keyboardType="number-pad" />
          <Btn title="Confirmar" onPress={confirm} loading={busy} />
          <Btn title="Trocar número" variant="outline" onPress={() => setStep('phone')} />
        </>
      )}
    </Screen>
  );
}

export function ChangeEmail({ navigation }: any) {
  const { session } = useAuth();
  const [email, setEmail] = useState(''); const [email2, setEmail2] = useState(''); const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!email.includes('@') || email !== email2) return Alert.alert('Atenção', 'Os e-mails não conferem.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setBusy(false);
    if (error) return Alert.alert('Erro', error.message);
    navigation.navigate('Thanks', { message: 'Enviamos um link de confirmação para o novo e-mail. A alteração vale após confirmar.' });
  };
  return (
    <Screen title="Alterar E-mail">
      <T muted style={{ marginBottom: 12 }}>E-mail atual: {session?.user.email}{'\n'}Enviaremos um link de confirmação para o novo endereço.</T>
      <Field placeholder="Digite seu novo email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field placeholder="Confirme seu email" value={email2} onChangeText={setEmail2} keyboardType="email-address" />
      <Btn title="Confirmar" onPress={save} loading={busy} />
    </Screen>
  );
}

export function ChangePassword({ navigation }: any) {
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [busy, setBusy] = useState(false);
  const save = async () => {
    if (pw.length < 6) return Alert.alert('Atenção', 'A senha precisa ter ao menos 6 caracteres.');
    if (pw !== pw2) return Alert.alert('Atenção', 'As senhas não conferem.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return Alert.alert('Erro', error.message);
    navigation.navigate('Thanks', { message: 'Seus dados de acesso foram atualizados com sucesso.' });
  };
  return (
    <Screen title="Alterar senha">
      <T style={{ marginBottom: 12 }}>Insira a nova senha a ser utilizada</T>
      <Field placeholder="Digite sua senha" value={pw} onChangeText={setPw} secure />
      <Field placeholder="Confirmar senha" value={pw2} onChangeText={setPw2} secure />
      <Btn title="Confirmar" onPress={save} loading={busy} />
    </Screen>
  );
}

export function Preferences({ navigation }: any) {
  const { s, set } = useTheme();
  return (
    <Screen title="Preferências">
      <H>Aparência</H>
      <T muted style={{ marginBottom: 6 }}>Tema</T>
      <Segment value={s.themeName} onChange={k => set({ themeName: k as any })} options={[{ key: 'claro', label: 'Claro' }, { key: 'escuro', label: 'Escuro' }]} />
      <H>Conteúdo</H>
      <ToggleRow label="Linguagem simples" value={s.simpleLanguage} onChange={(v: boolean) => set({ simpleLanguage: v })} />
      <ToggleRow label="Exibir dicas" value={s.showTips} onChange={(v: boolean) => set({ showTips: v })} />
      <Btn title="Salvar alterações" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

export function Accessibility({ navigation }: any) {
  const { s, set, c } = useTheme();
  const sizes = [0.9, 1, 1.25];
  return (
    <Screen title="Acessibilidade">
      <T style={{ fontWeight: '700', marginBottom: 8 }}>Tamanho da fonte</T>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {sizes.map((z, i) => (
          <TouchableOpacity key={z} onPress={() => set({ fontScale: z })} style={{ flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 2, borderColor: s.fontScale === z ? c.primary : c.border, backgroundColor: s.fontScale === z ? c.soft : c.card }}>
            <Text style={{ color: c.text, fontSize: 12 + i * 6, fontWeight: '700' }}>A</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ToggleRow label="Tons de cinza" value={s.grayscale} onChange={(v: boolean) => set({ grayscale: v })} />
      <ToggleRow label="Alto contraste" value={s.highContrast} onChange={(v: boolean) => set({ highContrast: v })} />
      <ToggleRow label="Fundo claro" value={s.themeName === 'claro'} onChange={(v: boolean) => set({ themeName: v ? 'claro' : 'escuro' })} />
      <ToggleRow label="Sublinhado de link" value={s.linkUnderline} onChange={(v: boolean) => set({ linkUnderline: v })} />
      <Btn title="Salvar" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

export function Notifications({ navigation }: any) {
  const { s, set } = useTheme();
  const rows: [string, string][] = [['tarefas', 'Lembretes de tarefas'], ['novidades', 'Novidades do app'], ['atividades', 'Avisos de atividades'], ['emails', 'E-mails'], ['vibracao', 'Vibrações'], ['prazos', 'Lembretes de prazos']];
  return (
    <Screen title="Notificações">
      {rows.map(([k, l]) => <ToggleRow key={k} label={l} value={s.notif[k]} onChange={(v: boolean) => set({ notif: { ...s.notif, [k]: v } })} />)}
      <Btn title="Salvar" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

export function ReportProblem({ navigation }: any) {
  const { c } = useTheme();
  const { session } = useAuth();
  const [problem, setProblem] = useState(''); const [opinion, setOpinion] = useState(''); const [img, setImg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!problem.trim()) return Alert.alert('Atenção', 'Descreva o problema.');
    setBusy(true);
    try {
      let url: string | null = null;
      if (img) url = await uploadImage(session!.user.id, img, `reports/${Date.now()}.jpg`);
      const { error } = await supabase.from('problem_reports').insert({ problem, opinion, image_url: url });
      if (error) throw error;
      navigation.replace('Thanks', { message: 'Agradecemos pela sua sugestão e por nos avisar sobre o problema! 💜 Vamos analisar a situação e buscar a melhor solução.' });
    } catch (e: any) { Alert.alert('Erro', e.message); }
    setBusy(false);
  };
  return (
    <Screen title="Reportar problema" subtitle="Nos ajude a melhorar o app">
      <View style={{ alignItems: 'center', marginBottom: 12 }}><Icon name="warning" size={72} color={c.danger} /></View>
      <Field label="Qual é o problema??" placeholder="Escreva aqui..." value={problem} onChangeText={setProblem} />
      <Field label="Sua opinião (opcional)" placeholder="O que e como podemos melhorar?" value={opinion} onChangeText={setOpinion} multiline />
      <Btn title={img ? 'Imagem anexada ✓ (trocar)' : 'Adicionar imagem'} variant="outline" icon="image" onPress={async () => { const u = await pickImage(false); if (u) setImg(u); }} />
      <Btn title="Enviar relatório" onPress={send} loading={busy} />
    </Screen>
  );
}

const FREE = ['Tarefas limitadas', 'Lembretes básicos', 'Metas limitadas', 'Calendário simples'];
const PREMIUM = ['Tarefas ilimitadas e subtarefas', 'Lembretes ilimitados e personalizados', 'Metas ilimitadas + etapas', 'Finanças avançadas e relatórios', 'Estatísticas e relatórios completos', 'Personalização da experiência', 'Suporte prioritário'];

export function Premium({ navigation }: any) {
  const { c } = useTheme();
  const { profile } = useAuth();
  const [plan, setPlan] = useState<'mensal' | 'anual'>('mensal');
  const price = PLANS[plan].price;
  return (
    <Screen title="Assinar Premium" subtitle="Escolha o plano ideal para você 💜">
      {profile?.is_premium ? <Card style={{ backgroundColor: c.soft }}><T style={{ fontWeight: '800' }}>✨ Você já é Premium. Obrigado por apoiar o NeuroConecta!</T></Card> : null}
      <Segment value={plan} onChange={k => setPlan(k as any)} options={[{ key: 'mensal', label: 'Mensal' }, { key: 'anual', label: 'Anual (-24%)' }]} />
      <Card style={{ borderColor: c.primary, borderWidth: 2 }}>
        <T style={{ fontWeight: '800', fontSize: 18 }}>👑 Premium {plan}</T>
        <Text style={{ color: c.primary, fontSize: 28, fontWeight: '800', marginVertical: 6 }}>{money(price)}<Text style={{ fontSize: 14 }}> /{plan === 'mensal' ? 'mês' : 'ano'}</Text></Text>
        {PREMIUM.map(f => <T key={f} style={{ marginVertical: 2 }}>✔️ {f}</T>)}
      </Card>
      <Card><T style={{ fontWeight: '800', marginBottom: 4 }}>Plano gratuito inclui:</T>{FREE.map(f => <T key={f} muted>• {f}</T>)}</Card>
      <Btn title="Continuar para o pagamento" onPress={() => navigation.navigate('Payment', { plan })} />
    </Screen>
  );
}

export function Payment({ route, navigation }: any) {
  const { c } = useTheme();
  const { refreshProfile } = useAuth();
  const plan: PlanKey = route.params.plan;
  const price = PLANS[plan].price; // só exibição: quem define o valor cobrado é a Edge Function
  const [method, setMethod] = useState<'cartao' | 'pix'>('cartao'); const [busy, setBusy] = useState(false);
  const [cpf, setCpf] = useState('');
  const [card, setCard] = useState({ n: '', v: '', cvv: '', name: '' });
  const [pix, setPix] = useState<{ id: string; data: PixData } | null>(null);
  const finished = useRef(false);
  const methods = [['cartao', 'Cartão de crédito', 'card'], ['pix', 'PIX', 'qr-code']];

  const success = async () => {
    if (finished.current) return; finished.current = true;
    await refreshProfile();
    navigation.replace('Thanks', { message: 'Pagamento confirmado! Você agora é Premium. 👑' });
  };

  // PIX: consulta o status a cada 5s por até 15 min (o webhook também libera o Premium; isto é só para o app reagir rápido)
  const poll = async () => {
    if (!pix || finished.current) return;
    try {
      const r = await checkPayment(pix.id);
      if (r.status === 'approved') await success();
      else if (r.status === 'rejected' || r.status === 'cancelled') { setPix(null); Alert.alert('Pagamento não concluído', 'O PIX foi cancelado ou expirou. Gere um novo código.'); }
    } catch {}
  };
  const pollRef = useRef(poll); pollRef.current = poll;
  useEffect(() => {
    if (!pix) return;
    const t = setInterval(() => pollRef.current(), 5000);
    const stop = setTimeout(() => clearInterval(t), 15 * 60 * 1000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [pix?.id]);

  const pay = async () => {
    if (!isValidCPF(cpf)) return Alert.alert('Atenção', 'Informe um CPF válido.');
    if (method === 'cartao') {
      const [mm, yy] = card.v.split('/').map(Number);
      if (onlyDigits(card.n).length < 13) return Alert.alert('Atenção', 'Número do cartão inválido.');
      if (!mm || mm < 1 || mm > 12 || !yy || new Date(2000 + yy, mm, 0, 23, 59) < new Date()) return Alert.alert('Atenção', 'Validade do cartão inválida.');
      if (onlyDigits(card.cvv).length < 3) return Alert.alert('Atenção', 'Código de segurança inválido.');
      if (card.name.trim().length < 3) return Alert.alert('Atenção', 'Informe o nome impresso no cartão.');
    }
    setBusy(true);
    try {
      const tk = method === 'cartao' ? await tokenizeCard({ number: card.n, cvv: card.cvv, exp: card.v, holder: card.name, cpf }) : undefined;
      const res: PaymentResult = await createPayment({ plan, method, cpf: onlyDigits(cpf), card: tk });
      if (method === 'pix') {
        if (!res.pix?.qr_code) throw new Error('Não foi possível gerar o PIX. Tente novamente.');
        setPix({ id: res.payment_id, data: res.pix });
      } else if (res.status === 'approved') await success();
      else if (res.status === 'in_process' || res.status === 'pending') {
        navigation.replace('Thanks', { message: 'Seu pagamento está em análise. Assim que for aprovado, o Premium é liberado automaticamente. 💜' });
      } else Alert.alert('Pagamento recusado', rejectMessage(res.status_detail));
    } catch (e: any) { Alert.alert('Pagamento não concluído', e?.message || 'Tente novamente.'); }
    setBusy(false);
  };

  const copy = async () => { if (pix) { await Clipboard.setStringAsync(pix.data.qr_code); Alert.alert('Copiado!', 'Cole o código no app do seu banco, na opção PIX copia e cola.'); } };

  return (
    <Screen title="Pagamento" subtitle="🔒 Ambiente 100% seguro">
      <Card><T muted>Resumo do pedido</T><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T style={{ fontWeight: '700' }}>Plano Premium {plan}</T><T style={{ fontWeight: '800' }}>{money(price)}</T></View></Card>
      {pix ? (
        <>
          <H>Pague com PIX</H>
          <Card style={{ alignItems: 'center' }}>
            {pix.data.qr_code_base64 ? <Image source={{ uri: `data:image/png;base64,${pix.data.qr_code_base64}` }} style={{ width: 200, height: 200, backgroundColor: '#fff' }} accessibilityLabel="QR Code PIX" /> : null}
            <T muted style={{ textAlign: 'center', marginTop: 10, fontSize: 12 }}>Abra o app do seu banco, escolha PIX e leia o QR Code ou use o código copia e cola.</T>
            <Text selectable numberOfLines={3} style={{ color: c.text, fontSize: 11, marginTop: 8 }}>{pix.data.qr_code}</Text>
          </Card>
          <Btn title="Copiar código PIX" icon="copy" onPress={copy} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 }}>
            <ActivityIndicator color={c.primary} /><T muted style={{ marginLeft: 8 }}>Aguardando o pagamento...</T>
          </View>
          <Btn title="Já paguei, verificar agora" variant="outline" onPress={poll} />
          <Btn title="Trocar forma de pagamento" variant="outline" onPress={() => setPix(null)} />
        </>
      ) : (
        <>
          <H>Escolha a forma de pagamento</H>
          {methods.map(m => (
            <Card key={m[0]} onPress={() => setMethod(m[0] as any)} style={{ flexDirection: 'row', alignItems: 'center', borderColor: method === m[0] ? c.primary : c.border, borderWidth: method === m[0] ? 2 : 1 }}>
              <Icon name={m[2]} size={22} color={c.primary} style={{ width: 34 }} /><T style={{ flex: 1 }}>{m[1]}</T>
              <Icon name={method === m[0] ? 'radio-button-on' : 'radio-button-off'} size={20} color={c.primary} />
            </Card>
          ))}
          <View style={{ marginTop: 8 }}>
            {method === 'cartao' ? (
              <>
                <Field label="Número do cartão" placeholder="0000 0000 0000 0000" keyboardType="number-pad" value={card.n} onChangeText={(v: string) => setCard({ ...card, n: maskCard(v) })} />
                <Field label="Nome impresso no cartão" placeholder="Como está no cartão" autoCapitalize="characters" value={card.name} onChangeText={(v: string) => setCard({ ...card, name: v })} />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}><Field label="Validade" placeholder="MM/AA" keyboardType="number-pad" value={card.v} onChangeText={(v: string) => setCard({ ...card, v: maskExp(v) })} /></View>
                  <View style={{ flex: 1 }}><Field label="CVV" placeholder="123" keyboardType="number-pad" secure value={card.cvv} onChangeText={(v: string) => setCard({ ...card, cvv: onlyDigits(v).slice(0, 4) })} /></View>
                </View>
              </>
            ) : null}
            <Field label="CPF do titular" placeholder="000.000.000-00" keyboardType="number-pad" value={cpf} onChangeText={(v: string) => setCpf(maskCPF(v))} />
          </View>
          <Btn title={method === 'pix' ? `Gerar PIX de ${money(price)}` : `Pagar ${money(price)}`} icon="lock-closed" onPress={pay} loading={busy} />
          <T muted style={{ textAlign: 'center', fontSize: 12, marginTop: 10 }}>Pagamento processado pelo Mercado Pago. Os dados do cartão não passam pelos nossos servidores. O plano vale pelo período contratado e não renova sozinho.</T>
        </>
      )}
    </Screen>
  );
}
