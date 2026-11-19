import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../context/SettingsContext';
import { br, fromISO, iso, hhmm } from '../lib/dates';
import { icons, logo } from '../assets';

/** Ícone do app: usa a imagem do Figma (src/assets/index.ts) se existir; senão cai no Ionicons de mesmo nome. */
export function Icon({ name, size = 24, color, style }: { name: string; size?: number; color?: string; style?: any }) {
  const img = icons[name];
  if (img) return <Image source={img} style={[{ width: size, height: size, resizeMode: 'contain' }, style]} accessible={false} />;
  return <Ionicons name={name as any} size={size} color={color} style={style} />;
}

export function Screen({ title, subtitle, children, back = true, fab, scroll = true, footer }: any) {
  const { c, fs } = useTheme();
  const nav = useNavigation<any>();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ backgroundColor: c.header, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 16, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, flexDirection: 'row', alignItems: 'center' }}>
        {back ? (
          <TouchableOpacity onPress={() => nav.goBack()} style={{ padding: 6 }} accessibilityLabel="Voltar">
            <Icon name="chevron-back" size={26} color={c.text} />
          </TouchableOpacity>
        ) : <View style={{ width: 38 }} />}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: fs(22), fontWeight: '800', color: c.text, textAlign: 'center' }}>{title}</Text>
          {subtitle ? <Text style={{ fontSize: fs(13), color: c.muted }}>{subtitle}</Text> : null}
        </View>
        <View style={{ width: 38 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        ) : <View style={{ flex: 1, padding: 20 }}>{children}</View>}
      </KeyboardAvoidingView>
      {footer ? <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>{footer}</View> : null}
      {fab ? (
        <TouchableOpacity onPress={fab} accessibilityLabel="Adicionar" style={{ position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', elevation: 5 }}>
          <Icon name="add" size={30} color="#fff" />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

export const Logo = ({ size = 32 }: { size?: number }) => {
  if (logo) {
    const a = Image.resolveAssetSource(logo);
    const h = size * 3.2;
    return (
      <View style={{ alignItems: 'center', marginVertical: 8 }}>
        <Image source={logo} style={{ width: h * (a.width / a.height), height: h }} resizeMode="contain" accessibilityLabel="NeuroConecta" />
      </View>
    );
  }
  const cols = ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#1E88E5', '#8E24AA'];
  return (
    <View style={{ alignItems: 'center', marginVertical: 8 }}>
      <Text style={{ fontSize: size * 1.8, color: '#8E24AA', lineHeight: size * 2 }}>∞</Text>
      <Text style={{ fontSize: size, fontWeight: '800' }}>
        {'NeuroConecta'.split('').map((ch, i) => <Text key={i} style={{ color: cols[i % cols.length] }}>{ch}</Text>)}
      </Text>
      <Text style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>Conectando mentes, construindo possibilidades!</Text>
    </View>
  );
};

export function Field({ label, secure, multiline, ...p }: any) {
  const { c, fs } = useTheme();
  const [hide, setHide] = useState(!!secure);
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={{ color: c.text, fontSize: fs(14), marginBottom: 6, fontWeight: '600' }}>{label}</Text> : null}
      <View style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
        <TextInput
          placeholderTextColor={c.muted} secureTextEntry={hide} multiline={multiline} autoCapitalize="none" {...p}
          style={{ flex: 1, color: c.text, fontSize: fs(15), paddingVertical: 12, minHeight: multiline ? 90 : undefined, textAlignVertical: multiline ? 'top' : 'center' }}
        />
        {secure ? (
          <TouchableOpacity onPress={() => setHide(!hide)}><Icon name={hide ? 'eye-off' : 'eye'} size={20} color={c.muted} /></TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function DateField({ label, value, onChange, mode = 'date' }: { label: string; value: string; onChange: (v: string) => void; mode?: 'date' | 'time' }) {
  const { c, fs } = useTheme();
  const [show, setShow] = useState(false);
  let d = new Date();
  if (value) {
    if (mode === 'date') d = fromISO(value);
    else { const [h, m] = value.split(':').map(Number); d.setHours(h, m, 0, 0); }
  }
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: c.text, fontSize: fs(14), marginBottom: 6, fontWeight: '600' }}>{label}</Text>
      <TouchableOpacity onPress={() => setShow(true)} style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: value ? c.text : c.muted, fontSize: fs(15) }}>{value ? (mode === 'date' ? br(value) : value.slice(0, 5)) : mode === 'date' ? 'Selecionar data' : 'Selecionar horário'}</Text>
        <Icon name={mode === 'date' ? 'calendar' : 'time'} size={20} color={c.primary} />
      </TouchableOpacity>
      {show ? (
        <DateTimePicker value={d} mode={mode} is24Hour onChange={(e: any, sel?: Date) => {
          setShow(false);
          if (e.type === 'set' && sel) onChange(mode === 'date' ? iso(sel) : hhmm(sel));
        }} />
      ) : null}
    </View>
  );
}

export function Btn({ title, onPress, loading, variant = 'primary', icon, style }: any) {
  const { c, fs } = useTheme();
  const bg = variant === 'primary' ? c.primary : variant === 'danger' ? c.danger : 'transparent';
  const col = variant === 'outline' ? c.primary : '#fff';
  return (
    <TouchableOpacity onPress={onPress} disabled={loading} activeOpacity={0.8}
      style={[{ backgroundColor: bg, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginTop: 8, borderWidth: variant === 'outline' ? 2 : 0, borderColor: c.primary }, style]}>
      {loading ? <ActivityIndicator color={col} /> : (
        <>{icon ? <Icon name={icon} size={18} color={col} style={{ marginRight: 6 }} /> : null}
          <Text style={{ color: col, fontSize: fs(16), fontWeight: '700' }}>{title}</Text></>
      )}
    </TouchableOpacity>
  );
}

export const Card = ({ children, style, onPress, onLongPress }: any) => {
  const { c } = useTheme();
  const base = [{ backgroundColor: c.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: c.border }, style];
  return onPress || onLongPress
    ? <TouchableOpacity activeOpacity={0.8} onPress={onPress} onLongPress={onLongPress} style={base}>{children}</TouchableOpacity>
    : <View style={base}>{children}</View>;
};

export function Row({ icon, label, sub, onPress, color }: any) {
  const { c, fs } = useTheme();
  return (
    <Card onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Icon name={icon} size={24} color={color || c.primary} style={{ width: 34 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: fs(16), fontWeight: '700' }}>{label}</Text>
        {sub ? <Text style={{ color: c.muted, fontSize: fs(12) }}>{sub}</Text> : null}
      </View>
      <Icon name="chevron-forward" size={20} color={c.muted} />
    </Card>
  );
}

export function ToggleRow({ label, value, onChange }: any) {
  const { c, fs } = useTheme();
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: c.text, fontSize: fs(15), flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.primary, false: '#bbb' }} thumbColor="#fff" />
    </Card>
  );
}

export function Check({ checked, onPress, children }: any) {
  const { c, fs } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
      <Icon name={checked ? 'checkbox' : 'square-outline'} size={24} color={c.primary} />
      <Text style={{ color: c.text, fontSize: fs(13), marginLeft: 8, flex: 1 }}>{children}</Text>
    </TouchableOpacity>
  );
}

export const H = ({ children }: any) => {
  const { c, fs } = useTheme();
  return <Text style={{ color: c.text, fontSize: fs(18), fontWeight: '800', marginTop: 8, marginBottom: 8 }}>{children}</Text>;
};
export const T = ({ children, muted, style }: any) => {
  const { c, fs } = useTheme();
  return <Text style={[{ color: muted ? c.muted : c.text, fontSize: fs(15) }, style]}>{children}</Text>;
};
export const Empty = ({ text }: { text: string }) => {
  const { c, fs } = useTheme();
  return <Text style={{ color: c.muted, textAlign: 'center', marginVertical: 30, fontSize: fs(14) }}>{text}</Text>;
};

export function Avatar({ url, size = 90 }: { url?: string | null; size?: number }) {
  const { c } = useTheme();
  return url ? (
    <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="person" size={size * 0.55} color={c.primary} />
    </View>
  );
}

export function Segment({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  const { c, fs } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, marginBottom: 14, overflow: 'hidden' }}>
      {options.map(o => (
        <TouchableOpacity key={o.key} onPress={() => onChange(o.key)} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: value === o.key ? c.primary : 'transparent' }}>
          <Text style={{ color: value === o.key ? '#fff' : c.text, fontWeight: '700', fontSize: fs(14) }}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
