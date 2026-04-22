import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDocument } from '../src/config/firestoreApi';

export default function MatchModal() {
  const router = useRouter();
  const { name, age, count, photoUrl, matchUserId } = useLocalSearchParams<{
    name: string;
    age: string;
    count: string;
    photoUrl?: string;
    matchUserId?: string;
  }>();

  const [resolvedPhoto, setResolvedPhoto] = useState(photoUrl || '');

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // photoUrlが空ならFirestoreから取得
  useEffect(() => {
    if (photoUrl) {
      setResolvedPhoto(photoUrl);
      return;
    }
    if (!matchUserId) return;
    getDocument('users', matchUserId)
      .then((doc) => {
        if (doc?.photoUrl) setResolvedPhoto(doc.photoUrl);
      })
      .catch(() => {});
  }, [photoUrl, matchUserId]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleGoToMatches = () => {
    router.dismiss();
    setTimeout(() => {
      router.push('/(tabs)/matches');
    }, 300);
  };

  return (
    <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
      <Animated.View
        style={[styles.container, { transform: [{ scale: scaleAnim }] }]}
      >
        {/* 装飾 */}
        <View style={styles.sparkles}>
          <Text style={styles.sparkle1}>✨</Text>
          <Text style={styles.sparkle2}>🎉</Text>
          <Text style={styles.sparkle3}>✨</Text>
          <Text style={styles.sparkle4}>🎊</Text>
        </View>

        {/* 相手のアイコン */}
        <Animated.View
          style={[styles.photoContainer, { transform: [{ scale: heartScale }] }]}
        >
          {resolvedPhoto ? (
            <Image source={{ uri: resolvedPhoto }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoEmoji}>💖</Text>
            </View>
          )}
        </Animated.View>

        <Text style={styles.title}>マッチング成立!</Text>
        <Text style={styles.subtitle}>
          {name}さん（{age}歳）の{count}人組
        </Text>

        <View style={styles.divider} />

        <Text style={styles.callLabel}>マッチ画面からビデオ通話できます</Text>
        <Text style={styles.callDesc}>
          ビデオ通話で「今のノリ」を確かめよう!
        </Text>

        {/* マッチ画面へ */}
        <TouchableOpacity
          style={styles.callBtn}
          onPress={handleGoToMatches}
          activeOpacity={0.8}
        >
          <Text style={styles.callBtnText}>マッチ画面へ</Text>
        </TouchableOpacity>

        {/* 閉じるボタン */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.dismiss()}
          activeOpacity={0.7}
        >
          <Text style={styles.closeBtnText}>あとで</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  sparkles: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sparkle1: {
    position: 'absolute',
    top: 16,
    left: 24,
    fontSize: 24,
  },
  sparkle2: {
    position: 'absolute',
    top: 12,
    right: 28,
    fontSize: 28,
  },
  sparkle3: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    fontSize: 20,
  },
  sparkle4: {
    position: 'absolute',
    bottom: 80,
    right: 24,
    fontSize: 22,
  },
  photoContainer: {
    marginBottom: 16,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#FF6B35',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: '#333',
    marginVertical: 20,
  },
  callLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  callDesc: {
    fontSize: 13,
    color: '#888',
    marginBottom: 20,
  },
  callBtn: {
    width: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  callBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  closeBtnText: {
    color: '#666',
    fontSize: 15,
  },
});
