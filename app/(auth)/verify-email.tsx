import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { user, resendEmailVerification, reloadUser, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 一定間隔で自動的にメール認証完了をチェック（バックグラウンドで認証完了したケース対応）
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await reloadUser();
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [reloadUser]);

  // 認証済みになったら自動遷移
  useEffect(() => {
    if (user?.emailVerified) {
      router.replace('/');
    }
  }, [user?.emailVerified, router]);

  const startCooldown = (seconds: number) => {
    setCooldown(seconds);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await reloadUser();
      // useEffect 側で認証済みなら遷移するが、未認証だった場合の通知
      // 少し待ってから user 状態を見る
      setTimeout(() => {
        if (!user?.emailVerified) {
          Alert.alert(
            'まだ認証されていません',
            'メール内のリンクをタップしてから「確認した」をもう一度押してください。',
          );
        }
      }, 300);
    } catch {
      Alert.alert('エラー', '状態の取得に失敗しました');
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    try {
      await resendEmailVerification();
      Alert.alert('送信しました', '確認メールを再送しました。受信トレイをご確認ください。');
      startCooldown(60);
    } catch (e: any) {
      let message = '再送信に失敗しました';
      if (e?.code === 'auth/too-many-requests') {
        message = 'リクエストが多すぎます。少し時間を置いてからお試しください。';
        startCooldown(60);
      }
      Alert.alert('エラー', message);
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.emoji}>📩</Text>
        <Text style={styles.title}>メールを確認してください</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.body}>
          上記のアドレス宛に確認メールを送信しました。{'\n'}
          メール内のリンクをタップして認証を完了してください。
        </Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleCheck}
          disabled={checking}
          activeOpacity={0.8}
        >
          {checking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>確認した</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, (cooldown > 0 || resending) && styles.disabledBtn]}
          onPress={handleResend}
          disabled={cooldown > 0 || resending}
          activeOpacity={0.8}
        >
          {resending ? (
            <ActivityIndicator color="#FF6B35" />
          ) : (
            <Text style={styles.secondaryBtnText}>
              {cooldown > 0 ? `再送信 (${cooldown}秒)` : '確認メールを再送信'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>別のアカウントでログイン</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          ※ メールが届かない場合は迷惑メールフォルダもご確認ください。
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  email: {
    color: '#FF6B35',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  body: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  primaryBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#FF6B35',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  secondaryBtnText: {
    color: '#FF6B35',
    fontSize: 15,
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  signOutBtn: {
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
  },
  signOutText: {
    color: '#888',
    fontSize: 13,
  },
  hint: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
});
