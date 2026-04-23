import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/contexts/AuthContext';
import { getDocument } from '../src/config/firestoreApi';

export default function Index() {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setChecking(false);
      return;
    }
    (async () => {
      try {
        const val = await AsyncStorage.getItem(`profile_${user.uid}`);
        const profileExists = val === 'true';
        setHasProfile(profileExists);
        if (profileExists) {
          try {
            const doc = await getDocument('users', user.uid);
            setVerificationStatus(doc?.ageVerificationStatus || null);
            // 提出済みかは usersPrivate（本人のみアクセス可）から判定
            try {
              const priv = await getDocument('usersPrivate', user.uid);
              setHasSubmitted(!!priv?.idImageUrl);
            } catch {}
          } catch {}
        }
      } finally {
        setChecking(false);
      }
    })();
  }, [user, loading]);

  if (loading || checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // メール認証が完了していない場合は確認画面へ
  if (!user.emailVerified) {
    return <Redirect href="/(auth)/verify-email" />;
  }

  if (!hasProfile) {
    return <Redirect href="/(auth)/profile-setup" />;
  }

  // 未提出（身分証画像なし）かつ明示的に not_submitted → 提出フローへ
  if (!hasSubmitted && verificationStatus === 'not_submitted') {
    return <Redirect href="/verify-intro" />;
  }

  // 却下された場合は専用画面で気づけるように
  if (verificationStatus === 'rejected') {
    return <Redirect href="/age-verification-pending" />;
  }

  return <Redirect href="/(tabs)/feed" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
