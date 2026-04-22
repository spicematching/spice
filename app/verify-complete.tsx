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

export default function VerifyCompleteScreen() {
  const router = useRouter();
  const scale = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, tension: 80, friction: 5, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(rotate, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.emojiWrap, { transform: [{ scale }, { rotate: spin }] }]}>
          <Text style={styles.emoji}>🎊</Text>
        </Animated.View>

        <Animated.View style={{ opacity: fade, alignItems: 'center' }}>
          <Text style={styles.title}>提出完了！</Text>
          <Text style={styles.subtitle}>
            お疲れさまでした 👏
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardEmoji}>⏳</Text>
            <Text style={styles.cardTitle}>審査中です</Text>
            <Text style={styles.cardText}>
              運営が内容を確認しています。{'\n'}
              通常<Text style={styles.highlight}>24時間以内</Text>に承認され、{'\n'}
              アプリが使えるようになります。
            </Text>
          </View>

          <Text style={styles.note}>
            承認されると通知が届きます 🔔
          </Text>
        </Animated.View>
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.btn}
          activeOpacity={0.8}
          onPress={() => router.replace('/(tabs)/feed')}
        >
          <Text style={styles.btnText}>アプリを始める 🚀</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  emojiWrap: { marginBottom: 24 },
  emoji: { fontSize: 100 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#FF6B35', textAlign: 'center', marginTop: 8, marginBottom: 32, fontWeight: '600' },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    width: '100%',
  },
  cardEmoji: { fontSize: 40, marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  cardText: { fontSize: 13, color: '#bbb', lineHeight: 22, textAlign: 'center' },
  highlight: { color: '#FF6B35', fontWeight: 'bold' },
  note: { color: '#666', fontSize: 12, marginTop: 20 },
  bottom: { padding: 24 },
  btn: { backgroundColor: '#FF6B35', paddingVertical: 18, borderRadius: 50, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
});
