import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function setupNotifications() {
  try {
    if (Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Lembretes', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 250, 250],
      });
    await Notifications.requestPermissionsAsync();
  } catch {}
}

export async function scheduleReminder(title: string, body: string, date: string, time: string) {
  try {
    const when = new Date(`${date}T${(time || '09:00').slice(0, 5)}:00`);
    if (when.getTime() <= Date.now()) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body: body || 'Lembrete' },
      trigger: { type: 'date', date: when } as any,
    });
  } catch {}
}

/** Notificação para quando o temporizador de foco termina (funciona com o app em segundo plano). Devolve o id para cancelar. */
export async function scheduleTimerEnd(title: string, body: string, seconds: number): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: { type: 'timeInterval', seconds: Math.max(1, Math.round(seconds)), repeats: false, channelId: 'default' } as any,
    });
  } catch { return null; }
}

export async function cancelNotification(id?: string | null) {
  if (!id) return;
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
}
