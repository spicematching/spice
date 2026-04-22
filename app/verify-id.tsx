import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function VerifyIdScreen() {
  const router = useRouter();
  const [uri, setUri] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setUri(result.assets[0].uri);
    }
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        Alert.alert('カメラの許可が必要です');
        return;
      }
    }
    setShowCamera(true);
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
      if (photo) {
        setUri(photo.uri);
        setShowCamera(false);
      }
    } catch {
      // カメラアンマウント時のエラーは無視
    }
  };

  const choose = () => {
    Alert.alert('身分証の撮影', '撮影方法を選んでください', [
      { text: 'カメラで撮影', onPress: openCamera },
      { text: 'アルバムから選ぶ', onPress: pick },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  };

  if (showCamera) {
    const { width, height } = Dimensions.get('window');
    // 身分証カード比率 85.6 x 54 mm ≒ 1.585:1
    const frameWidth = width * 0.85;
    const frameHeight = frameWidth / 1.585;

    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
          <SafeAreaView style={{ flex: 1 }}>
            {/* 上部マスク */}
            <View style={camStyles.mask}>
              <TouchableOpacity
                onPress={() => setShowCamera(false)}
                style={camStyles.closeBtn}
              >
                <Text style={{ color: '#fff', fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
              <Text style={camStyles.hint}>枠内に身分証を合わせてね 🪪</Text>
            </View>

            {/* 枠エリア */}
            <View style={camStyles.frameRow}>
              <View style={camStyles.sideMask} />
              <View style={[camStyles.frame, { width: frameWidth, height: frameHeight }]}>
                {/* コーナー装飾 */}
                <View style={[camStyles.corner, camStyles.cornerTL]} />
                <View style={[camStyles.corner, camStyles.cornerTR]} />
                <View style={[camStyles.corner, camStyles.cornerBL]} />
                <View style={[camStyles.corner, camStyles.cornerBR]} />
              </View>
              <View style={camStyles.sideMask} />
            </View>

            {/* 下部マスク＋シャッター */}
            <View style={camStyles.maskBottom}>
              <Text style={camStyles.note}>
                顔写真と生年月日がはっきり見えるように
              </Text>
              <TouchableOpacity onPress={takePhoto} style={camStyles.shutter}>
                <View style={camStyles.shutterInner} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </CameraView>
      </View>
    );
  }

  const next = async () => {
    if (!uri) return;
    await AsyncStorage.setItem('verify_id_uri', uri);
    router.push('/verify-selfie');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* プログレス */}
      <View style={styles.progress}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dotLine} />
        <View style={styles.dot} />
        <View style={styles.dotLine} />
        <View style={styles.dot} />
      </View>
      <Text style={styles.step}>STEP 1 / 2</Text>

      <View style={styles.content}>
        <Text style={styles.emoji}>🪪</Text>
        <Text style={styles.title}>身分証を撮影しよう</Text>
        <Text style={styles.subtitle}>
          顔写真と生年月日がはっきり見える状態で撮影してください
        </Text>

        <TouchableOpacity onPress={choose} style={styles.uploadBox} activeOpacity={0.8}>
          {uri ? (
            <Image source={{ uri }} style={styles.preview} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderIcon}>📸</Text>
              <Text style={styles.placeholderText}>タップして撮影・選択</Text>
            </View>
          )}
        </TouchableOpacity>

        {uri && (
          <TouchableOpacity onPress={choose}>
            <Text style={styles.retake}>撮り直す</Text>
          </TouchableOpacity>
        )}

        <View style={styles.tips}>
          <Text style={styles.tipTitle}>📝 使える身分証</Text>
          <Text style={styles.tip}>・運転免許証</Text>
          <Text style={styles.tip}>・パスポート</Text>
          <Text style={styles.tip}>・マイナンバーカード（表面のみ）</Text>
          <Text style={styles.tip}>・健康保険証</Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={[styles.btn, !uri && styles.btnDisabled]}
          disabled={!uri}
          activeOpacity={0.8}
          onPress={next}
        >
          <Text style={styles.btnText}>次へ進む →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingHorizontal: 40,
  },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#333' },
  dotActive: { backgroundColor: '#FF6B35' },
  dotLine: { flex: 1, height: 2, backgroundColor: '#333', marginHorizontal: 6 },
  step: { color: '#FF6B35', fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginTop: 8, letterSpacing: 2 },
  content: { flex: 1, padding: 24, alignItems: 'center' },
  emoji: { fontSize: 56, marginTop: 12, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#aaa', textAlign: 'center', marginTop: 8, marginBottom: 24, paddingHorizontal: 12 },
  uploadBox: {
    width: '100%',
    height: 200,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  placeholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { fontSize: 44 },
  placeholderText: { color: '#888', fontSize: 13, marginTop: 8 },
  preview: { width: '100%', height: '100%', resizeMode: 'cover' },
  retake: { color: '#FF6B35', fontSize: 13, marginTop: 12, textDecorationLine: 'underline' },
  tips: {
    marginTop: 20,
    backgroundColor: '#161616',
    padding: 16,
    borderRadius: 14,
    width: '100%',
  },
  tipTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginBottom: 8 },
  tip: { color: '#aaa', fontSize: 12, lineHeight: 20 },
  bottom: { padding: 24 },
  btn: { backgroundColor: '#FF6B35', paddingVertical: 18, borderRadius: 50, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
});

const camStyles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 20,
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  hint: {
    color: '#fff', fontSize: 14, textAlign: 'center',
    paddingBottom: 12, fontWeight: '600',
  },
  frameRow: { flexDirection: 'row' },
  sideMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  frame: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  corner: {
    position: 'absolute',
    width: 28, height: 28,
    borderColor: '#FF6B35',
  },
  cornerTL: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  cornerTR: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
  maskBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 40,
  },
  note: { color: '#fff', fontSize: 12, marginTop: 12 },
  shutter: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#fff',
  },
});
