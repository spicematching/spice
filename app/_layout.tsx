import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { getCollection, setDocument } from '../src/config/firestoreApi';
import * as Notifications from 'expo-notifications';
import { initPurchases } from '../src/utils/purchases';
import { initSentry, setSentryUser, Sentry } from '../src/config/sentry';

// Sentry を一番最初に初期化（コンポーネント外で1回だけ）
initSentry();

// 着信として有効と見なす最大経過時間（秒）。これを超えた ringing コールは古いので無視＆timeout化
const CALL_FRESH_WINDOW_MS = 60 * 1000;

// 着信ポーリング + 通知ハンドラ（AuthProvider内で使う）
function CallListener() {
  const router = useRouter();
  const { user } = useAuth();
  const handlingCallId = useRef<string | null>(null);

  // RevenueCat初期化 + Sentryユーザー紐付け
  useEffect(() => {
    if (!user) {
      setSentryUser(null);
      return;
    }
    setSentryUser(user.uid);
    initPurchases(user.uid).catch(() => {});
  }, [user]);

  // 着信ポーリング（3秒毎にcallsをチェック）
  useEffect(() => {
    if (!user) return;

    // マッチ一覧をキャッシュ（発信者とのマッチを検証するため）
    let validMatchUserIds: Set<string> = new Set();
    let matchesLastFetched = 0;

    const refreshMatches = async () => {
      try {
        const matches = await getCollection('matches');
        const ids = new Set<string>();
        for (const m of matches) {
          const users: string[] = m.data.users || [];
          if (users.includes(user.uid)) {
            for (const u of users) if (u !== user.uid) ids.add(u);
          }
        }
        validMatchUserIds = ids;
        matchesLastFetched = Date.now();
      } catch {}
    };

    const interval = setInterval(async () => {
      try {
        // 30秒ごとにマッチ一覧を更新
        if (Date.now() - matchesLastFetched > 30_000) {
          await refreshMatches();
        }

        const calls = await getCollection('calls');
        const now = Date.now();
        for (const doc of calls) {
          const d = doc.data;
          if (d.receiverId !== user.uid) continue;
          if (d.status !== 'ringing') continue;
          if (doc.id === handlingCallId.current) continue;

          // createdAt を取得
          const createdAt = d.createdAt instanceof Date
            ? d.createdAt
            : d.createdAt?.toDate?.() || new Date(d.createdAt || 0);
          const age = now - createdAt.getTime();

          // 古すぎる ringing コールは timeout にして無視（ゾンビ着信防止）
          if (age > CALL_FRESH_WINDOW_MS) {
            setDocument('calls', doc.id, { status: 'timeout' }).catch(() => {});
            continue;
          }

          // 発信者が自分のマッチ相手であることを検証（マッチしてない人からの着信を拒否）
          if (!validMatchUserIds.has(d.callerId)) {
            // 未マッチ相手からの着信は無視（異常または古いデータ）
            continue;
          }

          // 新しい着信を検知
          handlingCallId.current = doc.id;
          router.push({
            pathname: '/incoming-call',
            params: {
              callId: doc.id,
              callerName: String(d.callerName || ''),
              callerPhoto: String(d.callerPhoto || ''),
            },
          });
          break;
        }
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [user, router]);

  // 着信ポーリングで名前が取れないケースがあるので、callsに名前を保存する
  return null;
}

function RootLayout() {
  const router = useRouter();

  // 通知タップ/受信でアプリ内遷移
  useEffect(() => {
    const handleCallData = (data: Record<string, unknown>) => {
      router.push({
        pathname: '/incoming-call',
        params: {
          callId: String(data.callId || ''),
          callerName: String(data.callerName || ''),
          callerPhoto: String(data.callerPhoto || ''),
        },
      });
    };

    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.type === 'call') {
        handleCallData(data);
      } else if (data?.type === 'match') {
        router.push('/(tabs)/matches');
      } else if (data?.type === 'superlike') {
        router.push('/(tabs)/feed');
      }
    });

    const receiveSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown>;
      if (data?.type === 'call') {
        handleCallData(data);
      }
    });

    return () => {
      tapSub.remove();
      receiveSub.remove();
    };
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <CallListener />
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen
            name="match-modal"
            options={{
              presentation: 'transparentModal',
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="call-screen"
            options={{
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="incoming-call"
            options={{
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="friends"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="terms"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="privacy"
            options={{
              animation: 'slide_from_right',
            }}
          />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap でアンキャッチ例外・パフォーマンス計測を自動収集
export default Sentry.wrap(RootLayout);
