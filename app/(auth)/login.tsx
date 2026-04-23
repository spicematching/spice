import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('入力エラー', 'メールアドレスとパスワードを入力してください');
      return;
    }
    if (password.length < 6) {
      Alert.alert('入力エラー', 'パスワードは6文字以上で入力してください');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password);
        // 確認メール送信済み → メール認証待ち画面へ
        router.replace('/(auth)/verify-email');
      } else {
        const cred = await signIn(email.trim(), password);
        // メール未認証なら認証画面へ
        if (!cred.user.emailVerified) {
          router.replace('/(auth)/verify-email');
          return;
        }
        // ローカルでプロフィール存在チェック
        const hasProfile = await AsyncStorage.getItem(`profile_${cred.user.uid}`);
        if (hasProfile === 'true') {
          router.replace('/(tabs)/feed');
        } else {
          router.replace('/(auth)/profile-setup');
        }
      }
    } catch (error: any) {
      let message = 'エラーが発生しました';
      if (error.code === 'auth/email-already-in-use') {
        message = 'このメールアドレスは既に使われています';
      } else if (error.code === 'auth/invalid-email') {
        message = 'メールアドレスの形式が正しくありません';
      } else if (error.code === 'auth/invalid-credential') {
        message = 'メールアドレスまたはパスワードが正しくありません';
      } else if (error.code === 'auth/weak-password') {
        message = 'パスワードが弱すぎます。6文字以上にしてください';
      }
      Alert.alert('エラー', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ロゴ */}
        <View style={styles.logoArea}>
          <Text style={styles.logoEmoji}>🌶️</Text>
          <Text style={styles.logoText}>spice</Text>
          <Text style={styles.tagline}>今夜の飲みに、刺激を。</Text>
        </View>

        {/* フォーム */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="メールアドレス"
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="パスワード（6文字以上）"
            placeholderTextColor="#666"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isSignUp ? '新規登録' : 'ログイン'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 切り替えリンク */}
        <TouchableOpacity
          style={styles.switchBtn}
          onPress={() => setIsSignUp(!isSignUp)}
        >
          <Text style={styles.switchText}>
            {isSignUp
              ? 'すでにアカウントをお持ちの方 → ログイン'
              : 'アカウントをお持ちでない方 → 新規登録'}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  // ── ロゴ ──
  logoArea: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FF6B35',
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  // ── フォーム ──
  form: {
    gap: 14,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  submitBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // ── 切り替え ──
  switchBtn: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    color: '#888',
    fontSize: 14,
  },
});
