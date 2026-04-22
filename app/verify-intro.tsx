import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';

export default function VerifyIntroScreen() {
  const router = useRouter();
  const scale = useRef(new Animated.Value(0.6)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 60, friction: 6, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.emojiWrap, { transform: [{ scale }] }]}>
          <Text style={styles.emoji}>🎉</Text>
        </Animated.View>

        <Animated.View style={{ opacity: fade }}>
          <Text style={styles.title}>プロフィール完成！</Text>
          <Text style={styles.subtitle}>
            あと<Text style={styles.highlight}>1ステップ</Text>で始められます
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>✨ 年齢確認をしよう</Text>
            <Text style={styles.cardText}>
              spiceは18歳以上の方限定のアプリです。{'\n'}
              安心安全のため、かんたんな本人確認をお願いしています。
            </Text>

            <View style={styles.steps}>
              <View style={styles.step}>
                <Text style={styles.stepNum}>1</Text>
                <Text style={styles.stepLabel}>身分証を{'\n'}撮影</Text>
              </View>
              <View style={styles.stepLine} />
              <View style={styles.step}>
                <Text style={styles.stepNum}>2</Text>
                <Text style={styles.stepLabel}>身分証と一緒に{'\n'}自撮り</Text>
              </View>
              <View style={styles.stepLine} />
              <View style={styles.step}>
                <Text style={styles.stepEmoji}>🎊</Text>
                <Text style={styles.stepLabel}>完了！</Text>
              </View>
            </View>

            <Text style={styles.note}>
              所要時間:約30秒 ・ 画像は本人確認のみに使用します
            </Text>
          </View>
        </Animated.View>
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.btn}
          activeOpacity={0.8}
          onPress={() => router.push('/verify-id')}
        >
          <Text style={styles.btnText}>はじめる 🚀</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  emojiWrap: { alignItems: 'center', marginBottom: 20 },
  emoji: { fontSize: 72 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#aaa', textAlign: 'center', marginTop: 8, marginBottom: 28 },
  highlight: { color: '#FF6B35', fontWeight: 'bold' },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  cardText: { fontSize: 13, color: '#bbb', lineHeight: 20, marginBottom: 24 },
  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  step: { alignItems: 'center', width: 72 },
  stepNum: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FF6B35', color: '#fff',
    fontSize: 16, fontWeight: 'bold',
    textAlign: 'center', lineHeight: 36,
    marginBottom: 8,
  },
  stepEmoji: { fontSize: 32, marginBottom: 8 },
  stepLabel: { color: '#888', fontSize: 11, textAlign: 'center', lineHeight: 14 },
  stepLine: { flex: 1, height: 1, backgroundColor: '#333', marginHorizontal: 4, marginBottom: 24 },
  note: { color: '#666', fontSize: 11, textAlign: 'center' },
  bottom: { padding: 24 },
  btn: {
    backgroundColor: '#FF6B35',
    paddingVertical: 18,
    borderRadius: 50,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
});
