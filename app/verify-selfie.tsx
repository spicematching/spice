import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/contexts/AuthContext';
import { uploadFile } from '../src/config/storageApi';
import { updateDocument, addDocument, getDocument, setDocument } from '../src/config/firestoreApi';

export default function VerifySelfieScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [uri, setUri] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [submitting, setSubmitting] = useState(false);

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
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, skipProcessing: true });
      if (photo) {
        setUri(photo.uri);
        setShowCamera(false);
      }
    } catch {
      // カメラアンマウント時のエラーは無視
    }
  };

  const submit = async () => {
    if (!uri || !user) return;
    setSubmitting(true);
    try {
      const idUri = await AsyncStorage.getItem('verify_id_uri');
      if (!idUri) {
        Alert.alert('エラー', '身分証画像が見つかりません。最初からやり直してください');
        router.replace('/verify-intro');
        return;
      }

      const idUrl = await uploadFile(idUri, `id-verification/${user.uid}_id.jpg`);
      const selfieUrl = await uploadFile(uri, `id-verification/${user.uid}_selfie.jpg`);

      // 公開: 状態のみ users に保存
      await updateDocument('users', user.uid, {
        ageVerificationStatus: 'pending',
      });
      // 機密: 身分証画像 URL は usersPrivate に分離保存
      await setDocument('usersPrivate', user.uid, {
        idImageUrl: idUrl,
        selfieImageUrl: selfieUrl,
        idSubmittedAt: new Date(),
      });

      // 運営に承認依頼の通知を送る
      try {
        const userDoc = await getDocument('users', user.uid);
        const userName = userDoc?.name || '(名前未設定)';
        await addDocument('admin_notifications', {
          type: 'verification_submitted',
          userId: user.uid,
          userName,
          message: `${userName} さんが年齢確認の身分証を提出しました`,
          createdAt: new Date(),
          read: false,
        });
      } catch {}

      await AsyncStorage.removeItem('verify_id_uri');
      router.replace('/verify-complete');
    } catch (e: any) {
      Alert.alert('エラー', e.message || '送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (showCamera) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front">
          <SafeAreaView style={{ flex: 1 }}>
            {/* 上部バー */}
            <View style={camStyles.topBar}>
              <TouchableOpacity
                onPress={() => setShowCamera(false)}
                style={camStyles.closeBtn}
              >
                <Text style={{ color: '#fff', fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
              <Text style={camStyles.hint}>枠に合わせて撮影してね 📸</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* ガイド枠エリア */}
            <View style={camStyles.guideArea}>
              <View style={camStyles.guideRow}>
                {/* 顔ガイド（左・楕円） */}
                <View style={camStyles.faceGuide}>
                  <Text style={camStyles.guideLabel}>顔</Text>
                </View>
                {/* 身分証ガイド（右・長方形） */}
                <View style={camStyles.idGuide}>
                  <View style={[camStyles.corner, camStyles.cornerTL]} />
                  <View style={[camStyles.corner, camStyles.cornerTR]} />
                  <View style={[camStyles.corner, camStyles.cornerBL]} />
                  <View style={[camStyles.corner, camStyles.cornerBR]} />
                  <Text style={camStyles.guideLabel}>身分証</Text>
                </View>
              </View>
            </View>

            {/* 下部 */}
            <View style={camStyles.bottomBar}>
              <Text style={camStyles.note}>顔と身分証の文字が両方はっきり写るように</Text>
              <TouchableOpacity onPress={takePhoto} style={camStyles.shutter}>
                <View style={camStyles.shutterInner} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progress}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={[styles.dotLine, styles.dotLineActive]} />
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dotLine} />
        <View style={styles.dot} />
      </View>
      <Text style={styles.step}>STEP 2 / 2</Text>

      <View style={styles.content}>
        <Text style={styles.emoji}>🤳</Text>
        <Text style={styles.title}>身分証と一緒に自撮り</Text>
        <Text style={styles.subtitle}>
          なりすまし防止のため、身分証を顔の横に持って{'\n'}自撮りしてください
        </Text>

        <TouchableOpacity onPress={openCamera} style={styles.uploadBox} activeOpacity={0.8}>
          {uri ? (
            <Image source={{ uri }} style={styles.preview} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderIcon}>📷</Text>
              <Text style={styles.placeholderText}>タップしてカメラを起動</Text>
            </View>
          )}
        </TouchableOpacity>

        {uri && (
          <TouchableOpacity onPress={openCamera}>
            <Text style={styles.retake}>撮り直す</Text>
          </TouchableOpacity>
        )}

        <View style={styles.example}>
          <Text style={styles.exampleTitle}>📸 撮影のコツ</Text>
          <Text style={styles.tip}>・顔と身分証の文字がはっきり見えること</Text>
          <Text style={styles.tip}>・明るい場所で撮影</Text>
          <Text style={styles.tip}>・マスク・サングラスは外してください</Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={[styles.btn, (!uri || submitting) && styles.btnDisabled]}
          disabled={!uri || submitting}
          activeOpacity={0.8}
          onPress={submit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>提出する 🎉</Text>
          )}
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
  dotLineActive: { backgroundColor: '#FF6B35' },
  step: { color: '#FF6B35', fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginTop: 8, letterSpacing: 2 },
  content: { flex: 1, padding: 24, alignItems: 'center' },
  emoji: { fontSize: 56, marginTop: 12, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#aaa', textAlign: 'center', marginTop: 8, marginBottom: 24, paddingHorizontal: 12, lineHeight: 20 },
  uploadBox: {
    width: '100%',
    height: 240,
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
  example: {
    marginTop: 20,
    backgroundColor: '#161616',
    padding: 16,
    borderRadius: 14,
    width: '100%',
  },
  exampleTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginBottom: 8 },
  tip: { color: '#aaa', fontSize: 12, lineHeight: 20 },
  bottom: { padding: 24 },
  btn: { backgroundColor: '#FF6B35', paddingVertical: 18, borderRadius: 50, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
});

const camStyles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  hint: {
    color: '#fff', fontSize: 14, fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14,
  },
  guideArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  faceGuide: {
    width: 220, height: 290,
    borderRadius: 145,
    borderWidth: 3,
    borderColor: '#FF6B35',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  idGuide: {
    width: 140,
    height: 88,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 20, height: 20,
    borderColor: '#FF6B35',
  },
  cornerTL: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  cornerTR: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  guideLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: 'rgba(255,107,53,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 30,
    paddingHorizontal: 20,
    gap: 16,
  },
  note: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14,
  },
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
