import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { getDocument } from '../src/config/firestoreApi';

export default function AgeVerificationPendingScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<'pending' | 'rejected' | 'approved'>('pending');

  const checkStatus = async () => {
    if (!user) return;
    setChecking(true);
    try {
      const doc = await getDocument('users', user.uid);
      const s = doc?.ageVerificationStatus || 'pending';
      setStatus(s);
      if (s === 'approved') {
        router.replace('/(tabs)/feed');
      }
    } catch (e: any) {
      Alert.alert('エラー', e.message || '確認に失敗しました');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>
          {status === 'rejected' ? '❌' : '⏳'}
        </Text>
        <Text style={styles.title}>
          {status === 'rejected' ? '年齢確認が承認されませんでした' : '年齢確認中'}
        </Text>
        <Text style={styles.message}>
          {status === 'rejected'
            ? '提出いただいた身分証では年齢確認ができませんでした。\nお手数ですが再度ご提出ください。'
            : 'ご提出いただいた身分証を運営が確認しています。\n通常24時間以内に承認されます。\n\n承認されるまでしばらくお待ちください。'}
        </Text>

        {status === 'rejected' ? (
          <TouchableOpacity
            style={styles.btn}
            onPress={() => router.replace('/verify-intro')}
          >
            <Text style={styles.btnText}>再提出する</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.replace('/(tabs)/feed')}
            >
              <Text style={styles.btnText}>アプリを使う</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: 'transparent', marginTop: 12 }]}
              onPress={checkStatus}
              disabled={checking}
            >
              {checking ? (
                <ActivityIndicator color="#FF6B35" />
              ) : (
                <Text style={[styles.btnText, { color: '#FF6B35' }]}>承認状況を確認</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>ログアウト</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  content: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  btn: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 50,
    minWidth: 220,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutBtn: {
    marginTop: 24,
    padding: 12,
  },
  logoutText: {
    color: '#666',
    fontSize: 14,
  },
});
