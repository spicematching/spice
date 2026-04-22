import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Image,
  Vibration,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { setDocument, getDocument } from '../src/config/firestoreApi';
import { useAuth } from '../src/contexts/AuthContext';
import { ensureAgeVerified, ensurePeerAgeVerified } from '../src/utils/ageVerification';

export default function IncomingCallScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { callId, callerName, callerPhoto } = useLocalSearchParams<{
    callId: string;
    callerName: string;
    callerPhoto?: string;
  }>();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  // パルスアニメーション + バイブレーション
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    const ring = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    );
    pulse.start();
    ring.start();

    // バイブレーション（繰り返し）
    const vibrationInterval = setInterval(() => {
      Vibration.vibrate(Platform.OS === 'ios' ? 1000 : [0, 500, 200, 500]);
    }, 2000);

    // 30秒で自動不在処理
    const timeout = setTimeout(() => {
      handleDecline();
    }, 30000);

    return () => {
      pulse.stop();
      ring.stop();
      clearInterval(vibrationInterval);
      clearTimeout(timeout);
      Vibration.cancel();
    };
  }, []);

  // コール状態をポーリング（発信者がキャンセルしたら閉じる）
  useEffect(() => {
    if (!callId) return;
    const interval = setInterval(async () => {
      try {
        const doc = await getDocument('calls', callId);
        if (!doc || doc.status === 'cancelled' || doc.status === 'ended') {
          Vibration.cancel();
          router.dismiss();
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [callId]);

  const handleAccept = async () => {
    Vibration.cancel();
    if (user) {
      const verified = await ensureAgeVerified(user.uid);
      if (!verified) {
        try {
          await setDocument('calls', callId!, { status: 'ended', endedAt: new Date() });
        } catch {}
        router.dismiss();
        return;
      }
    }
    let realMatchId = callId || '';
    try {
      // callドキュメントからmatchIdを取得（発信者と同じルームに入る）
      const callDoc = await getDocument('calls', callId!);
      if (callDoc?.matchId) {
        realMatchId = callDoc.matchId;
      }
      // 発信者（相手）も承認済みかチェック
      const callerUid = callDoc?.callerId;
      if (callerUid) {
        const peerVerified = await ensurePeerAgeVerified(callerUid);
        if (!peerVerified) {
          try {
            await setDocument('calls', callId!, { status: 'ended', endedAt: new Date() });
          } catch {}
          router.dismiss();
          return;
        }
      }
      await setDocument('calls', callId!, {
        status: 'accepted',
        answeredAt: new Date(),
      });
    } catch {}
    // 通話画面へ
    router.replace({
      pathname: '/call-screen',
      params: {
        name: callerName,
        matchId: realMatchId,
        photoUrl: callerPhoto || '',
        callId,
      },
    });
  };

  const handleDecline = async () => {
    Vibration.cancel();
    try {
      await setDocument('calls', callId!, {
        status: 'declined',
        declinedAt: new Date(),
      });
    } catch {}
    router.dismiss();
  };

  const ringRotate = ringAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ['0deg', '15deg', '0deg', '-15deg', '0deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* 発信者アバター */}
        <Animated.View style={[styles.avatarWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarInnerRing}>
              {callerPhoto ? (
                <Image source={{ uri: callerPhoto }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarEmoji}>👤</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* 発信者名 */}
        <Animated.Text style={[styles.phoneIcon, { transform: [{ rotate: ringRotate }] }]}>
          📹
        </Animated.Text>
        <Text style={styles.callerName}>{callerName || 'ゲスト'}さん</Text>
        <Text style={styles.callLabel}>からのビデオ通話</Text>
      </View>

      {/* アクションボタン */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} activeOpacity={0.8}>
          <Text style={styles.declineBtnIcon}>✕</Text>
          <Text style={styles.declineBtnText}>拒否</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.8}>
          <Text style={styles.acceptBtnIcon}>📹</Text>
          <Text style={styles.acceptBtnText}>応答</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrapper: {
    marginBottom: 24,
  },
  avatarRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: 'rgba(76, 217, 100, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInnerRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: 'rgba(76, 217, 100, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  avatarPlaceholder: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 56,
  },
  phoneIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  callerName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  callLabel: {
    color: '#999',
    fontSize: 16,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
    paddingBottom: 60,
  },
  declineBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  declineBtnText: {
    color: '#fff',
    fontSize: 11,
    marginTop: 2,
  },
  acceptBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#4CD964',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnIcon: {
    fontSize: 24,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 11,
    marginTop: 2,
  },
});
