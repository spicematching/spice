import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { setDocument, getDocument } from '../config/firestoreApi';

// フォアグラウンドでも通知を表示
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Expo Push Tokenを取得してFirestoreに保存
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // projectIdを取得（複数のソースから試行）
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    undefined;

  let token: string;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    token = tokenData.data;
  } catch {
    // projectIdが見つからない場合（Expoログイン未済）→ 静かにスキップ
    // 通話着信はポーリングで動作するので問題なし
    return null;
  }

  // Firestoreにトークンを保存
  await setDocument('pushTokens', userId, {
    token,
    platform: Platform.OS,
    updatedAt: new Date(),
  });

  // Android用チャンネル設定
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return token;
}

// 相手にプッシュ通知を送信
export async function sendPushNotification(
  toUserId: string,
  title: string,
  body: string,
  data?: Record<string, any>,
) {
  try {
    const tokenDoc = await getDocument('pushTokens', toUserId);
    if (!tokenDoc?.token || tokenDoc.disabled) {
      return;
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: tokenDoc.token,
        title,
        body,
        sound: 'default',
        priority: 'high',
        data: data || {},
      }),
    });

    const result = await response.json();

    if (result.data?.status === 'error') {
      console.error('Push send error:', result.data.message);
    }
  } catch (error) {
    console.error('Push notification send error:', error);
  }
}

// ローカル通知をスケジュール（プッシュ通知が使えない場合のテスト用）
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: data || {},
    },
    trigger: null, // 即座に表示
  });
}
