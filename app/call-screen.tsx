import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { createDailyRoom } from '../src/config/dailyApi';
import { getDocument, setDocument } from '../src/config/firestoreApi';

type CallState = 'ringing' | 'connecting' | 'connected' | 'declined' | 'error';

export default function CallScreen() {
  const router = useRouter();
  const { name, matchId, photoUrl, callId } = useLocalSearchParams<{
    name: string;
    matchId: string;
    photoUrl?: string;
    callId?: string;
  }>();

  const [callState, setCallState] = useState<CallState>(callId ? 'connecting' : 'ringing');
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  // パルスアニメーション（呼び出し中）
  useEffect(() => {
    if (callState !== 'ringing') return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    const dots = Animated.loop(
      Animated.timing(dotAnim, { toValue: 3, duration: 1500, useNativeDriver: false })
    );
    pulse.start();
    dots.start();
    return () => { pulse.stop(); dots.stop(); };
  }, [callState]);

  // 発信者：相手の応答をポーリング
  useEffect(() => {
    if (!callId || callState !== 'ringing') return;

    const interval = setInterval(async () => {
      try {
        const doc = await getDocument('calls', callId);
        if (!doc) return;
        if (doc.status === 'accepted') {
          setCallState('connecting');
          clearInterval(interval);
        } else if (doc.status === 'declined') {
          setCallState('declined');
          clearInterval(interval);
        }
      } catch {}
    }, 1500);

    // 30秒タイムアウト
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setDocument('calls', callId, { status: 'timeout' }).catch(() => {});
      setCallState('declined');
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [callId, callState]);

  // connecting → Daily.coルーム作成
  useEffect(() => {
    if (callState !== 'connecting') return;
    const setup = async () => {
      try {
        // matchIdをルーム名に使う（両者が同じルームに入る）
        const roomName = matchId || callId || 'default';
        const url = await createDailyRoom(roomName);
        setRoomUrl(url);
        setCallState('connected');
      } catch (e: any) {
        setError(e.message || 'ルーム作成に失敗しました');
        setCallState('error');
      }
    };
    setup();
  }, [callState]);

  const handleEndCall = () => {
    if (callState === 'ringing' && callId) {
      // 発信キャンセル
      setDocument('calls', callId, { status: 'cancelled' }).catch(() => {});
      router.dismiss();
    } else if (callState === 'connected') {
      Alert.alert('通話を終了しますか？', '', [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '終了する',
          style: 'destructive',
          onPress: () => {
            if (callId) setDocument('calls', callId, { status: 'ended' }).catch(() => {});
            router.dismiss();
          },
        },
      ]);
    } else {
      router.dismiss();
    }
  };

  // === 拒否された / タイムアウト ===
  if (callState === 'declined') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.avatarRing}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}><Text style={styles.avatarEmoji}>👤</Text></View>
            )}
          </View>
          <Text style={styles.declinedText}>{name}さんは応答しませんでした</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.dismiss()}>
            <Text style={styles.backBtnText}>戻る</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // === エラー ===
  if (callState === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorEmoji}>😵</Text>
          <Text style={styles.errorText}>通話の接続に失敗しました</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.dismiss()}>
            <Text style={styles.backBtnText}>戻る</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // === 呼び出し中 ===
  if (callState === 'ringing') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={styles.callingRing}>
              <View style={styles.callingInnerRing}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.callingAvatar} />
                ) : (
                  <View style={[styles.callingAvatar, { backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 48 }}>👤</Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
          <Text style={styles.callingName}>{name}さん</Text>
          <Text style={styles.callingLabel}>呼び出し中...</Text>
        </View>
        <View style={styles.callingActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleEndCall} activeOpacity={0.8}>
            <Text style={styles.cancelBtnIcon}>✕</Text>
            <Text style={styles.cancelBtnText}>キャンセル</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // === 接続中 ===
  if (callState === 'connecting') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.avatarRing}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}><Text style={styles.avatarEmoji}>👤</Text></View>
            )}
          </View>
          <Text style={styles.connectingText}>{name}さんと接続中...</Text>
          <ActivityIndicator size="large" color="#FF6B35" style={{ marginTop: 20 }} />
        </View>
      </SafeAreaView>
    );
  }

  // === 通話中（Daily.co WebView） ===
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: roomUrl! }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.webviewLoading}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={{ color: '#888', marginTop: 12 }}>ビデオ通話を準備中...</Text>
          </View>
        )}
      />
      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <Text style={styles.topBarName}>{name}さん</Text>
          <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall} activeOpacity={0.7}>
            <Text style={styles.endCallText}>✕ 終了</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  webview: { flex: 1 },
  webviewLoading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center',
  },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  topBarName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  endCallBtn: { backgroundColor: '#FF3B30', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  endCallText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // 共通
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  avatarRing: {
    width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#FF6B35',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  avatar: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: '#2a2a2a',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 48 },
  avatarImage: { width: 100, height: 100, borderRadius: 50 },
  connectingText: { color: '#fff', fontSize: 20, fontWeight: '600' },

  // 呼び出し中
  callingRing: {
    width: 160, height: 160, borderRadius: 80, borderWidth: 3,
    borderColor: 'rgba(76, 217, 100, 0.4)', alignItems: 'center', justifyContent: 'center',
  },
  callingInnerRing: {
    width: 140, height: 140, borderRadius: 70, borderWidth: 3,
    borderColor: 'rgba(76, 217, 100, 0.7)', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  callingAvatar: { width: 130, height: 130, borderRadius: 65 },
  callingName: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginTop: 24 },
  callingLabel: { color: '#4CD964', fontSize: 16, marginTop: 8 },
  callingActions: { alignItems: 'center', paddingBottom: 60 },
  cancelBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#FF3B30',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnIcon: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  cancelBtnText: { color: '#fff', fontSize: 11, marginTop: 2 },

  // 拒否
  declinedText: { color: '#999', fontSize: 18, marginTop: 20, marginBottom: 24 },
  backBtn: { backgroundColor: '#FF6B35', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 50 },
  backBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // エラー
  errorEmoji: { fontSize: 64, marginBottom: 16 },
  errorText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  errorDetail: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 24 },
});
