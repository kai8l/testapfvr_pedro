import React, { useState } from 'react';
import { Alert, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/SettingsContext';
import { Btn, Check, DateField, Field, Logo, Screen, T } from '../components/ui';
import { signInWithProvider, OAuthProvider } from '../lib/oauth';
import { toE164BR } from '../lib/br';

export function Splash() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Logo size={40} />
      <Text style={{ color: c.primary, marginTop: 24 }}>Carregando...</Text>
    </View>
  );
}

function AuthShell({ children, back }: any) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Logo />{children}
      </ScrollView>
    </SafeAreaView>
  );
}

function SocialButtons() {
  const { c } = useTheme();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const go = async (p: OAuthProvider) => {
    setBusy(p);
    try { await signInWithProvider(p); }
    catch (e: any) { Alert.alert('Não foi possível entrar', e?.message || 'Tente novamente.'); }
    setBusy(null);
  };
  return (
    <View style={{ marginTop: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        <T muted style={{ marginHorizontal: 10, fontSize: 12 }}>ou continue com</T>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      </View>
      <Btn title="Continuar com Google" variant="outline" icon="logo-google" onPress={() => go('google')} loading={busy === 'google'} />
      <Btn title="Continuar com Apple" variant="outline" icon="logo-apple" onPress={() => go('apple')} loading={busy === 'apple'} />
    </View>
  );
}

export function Login({ navigation }: any) {
  const { c } = useTheme();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!email || !pw) return Alert.alert('Atenção', 'Preencha e-mail e senha.');
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) Alert.alert('Não foi possível entrar', error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
  };
  return (
    <AuthShell>
      <Text style={{ fontSize: 26, fontWeight: '800', color: c.text, marginTop: 16 }}>Bem-vindo (a)!</Text>
      <T muted style={{ marginBottom: 16 }}>Faça login para continuar:</T>
      <Field placeholder="Digite seu e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field placeholder="Digite sua senha" value={pw} onChangeText={setPw} secure />
      <TouchableOpacity onPress={() => navigation.navigate('RecoverEmail')} style={{ alignSelf: 'flex-end' }}>
        <Text style={{ color: c.primary, fontSize: 12 }}>Esqueceu sua senha?</Text>
      </TouchableOpacity>
      <Btn title="Entrar" onPress={go} loading={busy} />
      <SocialButtons />
      <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ marginTop: 24, alignItems: 'center' }}>
        <T muted>Não tem uma conta? <Text style={{ color: c.primary, fontWeight: '700' }}>Cadastre-se</Text></T>
      </TouchableOpacity>
    </AuthShell>
  );
}

export function Register({ navigation }: any) {
  const { c } = useTheme();
  const [f, setF] = useState({ name: '', birth: '', diag: '', email: '', pw: '', pw2: '' });
  const [agree, setAgree] = useState(false); const [busy, setBusy] = useState(false);
  const up = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));
  const go = async () => {
    if (!f.name || !f.email || !f.pw) return Alert.alert('Atenção', 'Preencha nome, e-mail e senha.');
    if (f.pw.length < 6) return Alert.alert('Atenção', 'A senha precisa ter ao menos 6 caracteres.');
    if (f.pw !== f.pw2) return Alert.alert('Atenção', 'As senhas não conferem.');
    if (!agree) return Alert.alert('Atenção', 'Você precisa concordar com os Termos de Uso e a Política de Privacidade.');
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.pw,
      options: { data: { name: f.name, birth_date: f.birth, diagnosis: f.diag } },
    });
    setBusy(false);
    if (error) return Alert.alert('Erro no cadastro', error.message);
    if (!data.session) { Alert.alert('Quase lá!', 'Enviamos um e-mail de confirmação. Confirme e faça login.'); navigation.goBack(); }
  };
  return (
    <AuthShell>
      <Text style={{ fontSize: 26, fontWeight: '800', color: c.text, textAlign: 'center' }}>Criar sua conta</Text>
      <T muted style={{ textAlign: 'center', marginBottom: 16 }}>É rápido e fácil!</T>
      <Field placeholder="Nome completo" value={f.name} onChangeText={up('name')} autoCapitalize="words" />
      <DateField label="Data de nascimento" value={f.birth} onChange={up('birth')} />
      <Field placeholder="Qual o seu diagnóstico (opcional)" value={f.diag} onChangeText={up('diag')} />
      <Field placeholder="Digite seu e-mail" value={f.email} onChangeText={up('email')} keyboardType="email-address" />
      <Field placeholder="Digite sua senha" value={f.pw} onChangeText={up('pw')} secure />
      <Field placeholder="Confirme sua senha" value={f.pw2} onChangeText={up('pw2')} secure />
      <Check checked={agree} onPress={() => setAgree(!agree)}>
        Concordo com os <Text style={{ color: c.primary }} onPress={() => navigation.navigate('Legal', { type: 'terms' })}>Termos de Uso</Text> e a{' '}
        <Text style={{ color: c.primary }} onPress={() => navigation.navigate('Legal', { type: 'privacy' })}>Política de Privacidade</Text>
      </Check>
      <Btn title="Cadastrar" onPress={go} loading={busy} />
      <SocialButtons />
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16, alignItems: 'center' }}>
        <T muted>Já tem uma conta? <Text style={{ color: c.primary, fontWeight: '700' }}>Entrar</Text></T>
      </TouchableOpacity>
    </AuthShell>
  );
}

export function RecoverEmail({ navigation }: any) {
  const { c } = useTheme();
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!email) return Alert.alert('Atenção', 'Digite seu e-mail.');
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setBusy(false);
    if (error) return Alert.alert('Erro', error.message);
    navigation.navigate('RecoverCode', { email: email.trim() });
  };
  return (
    <AuthShell>
      <Text style={{ fontSize: 24, fontWeight: '800', marginTop: 12, color: c.text }}>Recuperar senha</Text>
      <T style={{ marginVertical: 12 }}>Digite o e-mail cadastrado para redefinir a senha:</T>
      <Field placeholder="Digite seu e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Btn title="Enviar" onPress={go} loading={busy} />
      <Btn title="Recuperar por telefone (SMS)" variant="outline" icon="chatbubble-ellipses" onPress={() => navigation.navigate('RecoverPhone')} />
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16, alignItems: 'center' }}><T muted>Lembrou sua senha? Entrar</T></TouchableOpacity>
    </AuthShell>
  );
}

export function RecoverCode({ route, navigation }: any) {
  const { c } = useTheme();
  const { setRecovering } = useAuth();
  const email = route.params.email;
  const [code, setCode] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!code || pw.length < 6) return Alert.alert('Atenção', 'Informe o código e uma senha de ao menos 6 caracteres.');
    if (pw !== pw2) return Alert.alert('Atenção', 'As senhas não conferem.');
    setBusy(true);
    setRecovering(true); // mantém a pilha de login enquanto o OTP loga o usuário
    const v = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'recovery' });
    if (v.error) { setRecovering(false); setBusy(false); return Alert.alert('Código inválido', v.error.message); }
    const u = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (u.error) { setRecovering(false); return Alert.alert('Erro', u.error.message); }
    setRecovering(false); // entra no app já logado
  };
  return (
    <AuthShell>
      <Text style={{ fontSize: 24, fontWeight: '800', marginTop: 12, color: c.text }}>Recuperar senha</Text>
      <T style={{ marginVertical: 12 }}>Insira o código enviado para {email} e escolha a nova senha.</T>
      <Field placeholder="Digite o código" value={code} onChangeText={setCode} keyboardType="number-pad" />
      <Field placeholder="Digite sua senha" value={pw} onChangeText={setPw} secure />
      <Field placeholder="Confirmar senha" value={pw2} onChangeText={setPw2} secure />
      <Btn title="Confirmar" onPress={go} loading={busy} />
    </AuthShell>
  );
}

/** Erro devolvido quando o telefone não existe (shouldCreateUser: false). Não revelamos isso ao usuário. */
const isUnknownPhone = (e: any) => e?.code === 'otp_disabled' || /signups? not allowed/i.test(e?.message || '');

export function RecoverPhone({ navigation }: any) {
  const { c } = useTheme();
  const [phone, setPhone] = useState(''); const [busy, setBusy] = useState(false);
  const go = async () => {
    const e164 = toE164BR(phone);
    if (!e164) return Alert.alert('Atenção', 'Digite o telefone com DDD. Ex.: (14) 99999-9999');
    setBusy(true);
    // shouldCreateUser:false => só envia SMS se o número já estiver verificado em alguma conta (não cria conta nova)
    const { error } = await supabase.auth.signInWithOtp({ phone: e164, options: { shouldCreateUser: false } });
    setBusy(false);
    if (error && !isUnknownPhone(error)) return Alert.alert('Não foi possível enviar o SMS', error.message);
    navigation.navigate('RecoverPhoneCode', { phone: e164 });
  };
  return (
    <AuthShell>
      <Text style={{ fontSize: 24, fontWeight: '800', marginTop: 12, color: c.text }}>Recuperar por telefone</Text>
      <T style={{ marginVertical: 12 }}>Digite o telefone verificado na sua conta. Enviaremos um código por SMS.</T>
      <Field placeholder="(00) 00000-0000" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Btn title="Enviar código" onPress={go} loading={busy} />
      <T muted style={{ fontSize: 12, marginTop: 10 }}>Só funciona se você já verificou seu telefone em Perfil › Dados da conta. Caso contrário, use a recuperação por e-mail.</T>
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16, alignItems: 'center' }}><T muted>Voltar</T></TouchableOpacity>
    </AuthShell>
  );
}

export function RecoverPhoneCode({ route }: any) {
  const { c } = useTheme();
  const { setRecovering } = useAuth();
  const phone: string = route.params.phone;
  const [code, setCode] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!code || pw.length < 6) return Alert.alert('Atenção', 'Informe o código e uma senha de ao menos 6 caracteres.');
    if (pw !== pw2) return Alert.alert('Atenção', 'As senhas não conferem.');
    setBusy(true);
    setRecovering(true); // mantém a pilha de login enquanto o OTP loga o usuário
    const v = await supabase.auth.verifyOtp({ phone, token: code.trim(), type: 'sms' });
    if (v.error) { setRecovering(false); setBusy(false); return Alert.alert('Código inválido ou expirado', v.error.message); }
    const u = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (u.error) { setRecovering(false); return Alert.alert('Erro', u.error.message); }
    setRecovering(false); // entra no app já logado
  };
  return (
    <AuthShell>
      <Text style={{ fontSize: 24, fontWeight: '800', marginTop: 12, color: c.text }}>Recuperar por telefone</Text>
      <T style={{ marginVertical: 12 }}>Se o número {phone} estiver cadastrado, você receberá um SMS. Digite o código e escolha a nova senha.</T>
      <Field placeholder="Código do SMS" value={code} onChangeText={setCode} keyboardType="number-pad" />
      <Field placeholder="Digite sua nova senha" value={pw} onChangeText={setPw} secure />
      <Field placeholder="Confirmar senha" value={pw2} onChangeText={setPw2} secure />
      <Btn title="Confirmar" onPress={go} loading={busy} />
    </AuthShell>
  );
}
