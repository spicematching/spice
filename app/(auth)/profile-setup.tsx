import { useState, useEffect, useRef } from 'react';
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
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { setDocument, getCollection } from '../../src/config/firestoreApi';
import { uploadFile } from '../../src/config/storageApi';
import { useAuth } from '../../src/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TAG_OPTIONS = [
  'ハイボール', 'レモンサワー', 'ビール', 'ワイン', '日本酒', 'カクテル', 'テキーラ',
  'K-pop', 'BTS', 'TWICE', '洋楽', 'backnumber', '嵐', 'ジャズ',
  'Netflix', 'アニメ', '少年ジャンプ', 'ONE PIECE',
  '旅行', 'カフェ巡り', 'サウナ', 'ヨガ', 'カラオケ',
  '犬', '猫', 'コスメ', '韓国料理', '焼き鳥', 'ラーメン',
];

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEdit = edit === 'true';
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [idImageUri, setIdImageUri] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [originalUsername, setOriginalUsername] = useState('');

  // 編集モード: 既存データをプリフィル
  useEffect(() => {
    if (!isEdit || !user || loaded) return;
    AsyncStorage.getItem(`profile_data_${user.uid}`).then((data) => {
      if (data) {
        const profile = JSON.parse(data);
        setUsername(profile.username || '');
        setOriginalUsername(profile.username || '');
        setName(profile.name || '');
        setAge(profile.age ? String(profile.age) : '');
        setGender(profile.gender || '');
        setSelectedTags(profile.tags || []);
        if (profile.photoUrl) setPhotoUri(profile.photoUrl);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [isEdit, user, loaded]);

  const handleOpenCamera = async () => {
    if (!camPermission?.granted) {
      const result = await requestCamPermission();
      if (!result.granted) {
        Alert.alert('カメラの許可が必要です');
        return;
      }
    }
    setShowCamera(true);
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
    if (photo) {
      setPhotoUri(photo.uri);
      setShowCamera(false);
    }
  };

  const handlePickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handlePickId = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      setIdImageUri(result.assets[0].uri);
    }
  };

  const handlePhotoPress = () => {
    Alert.alert('プロフィール写真', '写真の設定方法を選んでください', [
      { text: 'カメラで撮影', onPress: handleOpenCamera },
      { text: 'ライブラリから選ぶ', onPress: handlePickFromLibrary },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length < 5
          ? [...prev, tag]
          : prev
    );
  };

  const validateUsername = (value: string): string => {
    if (!value.trim()) return 'ユーザーネームを入力してください';
    if (value.length < 3) return '3文字以上で入力してください';
    if (value.length > 20) return '20文字以内で入力してください';
    if (!/^[a-zA-Z0-9._-]+$/.test(value)) return '英数字と . _ - のみ使用できます';
    return '';
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value.toLowerCase());
    const err = validateUsername(value.toLowerCase());
    setUsernameError(err);
  };

  const checkUsernameTaken = async (uname: string): Promise<boolean> => {
    if (!user) return true;
    if (uname === originalUsername) return false;
    const users = await getCollection('users');
    return users.some((doc) => doc.id !== user.uid && doc.data.username === uname);
  };

  const handleSave = async () => {
    const unameError = validateUsername(username);
    if (unameError) {
      Alert.alert('入力エラー', unameError);
      return;
    }
    if (!name.trim()) {
      Alert.alert('入力エラー', '名前を入力してください');
      return;
    }
    const ageNum = parseInt(age, 10);
    if (!ageNum || ageNum < 18 || ageNum > 99) {
      Alert.alert('入力エラー', '年齢を正しく入力してください（18〜99歳）');
      return;
    }
    if (!gender) {
      Alert.alert('入力エラー', '性別を選択してください');
      return;
    }
    if (selectedTags.length === 0) {
      Alert.alert('入力エラー', 'タグを1つ以上選んでください');
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      // ユーザーネーム重複チェック
      const taken = await checkUsernameTaken(username);
      if (taken) {
        Alert.alert('入力エラー', 'このユーザーネームは既に使われています');
        setSaving(false);
        return;
      }

      // アイコン写真をアップロード
      let photoUrl = '';
      if (photoUri) {
        if (photoUri.startsWith('http')) {
          photoUrl = photoUri; // 既存のURL（変更なし）
        } else {
          photoUrl = await uploadFile(photoUri, `icons/${user.uid}.jpg`);
        }
      }

      // ローカルに保存（即座）
      const profileData = {
        username,
        name: name.trim(),
        age: ageNum,
        gender,
        photoUrl,
        tags: selectedTags,
        email: user.email,
      };
      await AsyncStorage.setItem(`profile_${user.uid}`, 'true');
      await AsyncStorage.setItem(`profile_data_${user.uid}`, JSON.stringify(profileData));

      // 公開プロフィール（emailは含めない）
      const { email: _emailIgnored, ...publicProfile } = profileData;
      const firestoreData: any = {
        ...publicProfile,
        createdAt: new Date(),
      };
      if (!isEdit) {
        firestoreData.ageVerificationStatus = 'not_submitted';
      }
      await setDocument('users', user.uid, firestoreData);

      // 機密情報（メール）は usersPrivate に分離保存
      await setDocument('usersPrivate', user.uid, {
        email: user.email,
        updatedAt: new Date(),
      });

      // 既存ストーリーのプロフィール情報も更新
      if (isEdit) {
        try {
          const stories = await getCollection('stories');
          const myStories = stories.filter((s: any) => s.data.userId === user.uid);
          await Promise.all(
            myStories.map((s: any) =>
              setDocument('stories', s.id, {
                ...s.data,
                userName: name.trim(),
                userAge: ageNum,
                userGender: gender,
                userPhotoUrl: photoUrl,
                userTags: selectedTags,
              })
            )
          );
        } catch {}
      }

      if (isEdit) {
        router.back();
      } else {
        router.replace('/verify-intro');
      }
    } catch (error: any) {
      console.error('Profile save error:', error);
      Alert.alert('エラー', `保存に失敗しました: ${error.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  if (showCamera) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front">
          <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', padding: 20 }}>
            <TouchableOpacity
              onPress={() => setShowCamera(false)}
              style={{ alignSelf: 'flex-start', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
            <View style={{ alignItems: 'center', paddingBottom: 20 }}>
              <TouchableOpacity onPress={handleTakePhoto} style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' }} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {isEdit && (
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← 戻る</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.title}>{isEdit ? 'プロフィール編集' : 'プロフィール設定'}</Text>
          <Text style={styles.subtitle}>
            {isEdit ? '変更したい項目を編集してください' : 'あなたの情報を教えてください'}
          </Text>

          <View style={styles.photoSection}>
            <TouchableOpacity onPress={handlePhotoPress} style={styles.photoBtn}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderIcon}>📷</Text>
                  <Text style={styles.photoPlaceholderText}>顔写真</Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.photoHint}>タップして選択</Text>
          </View>

          <Text style={styles.label}>ユーザーネーム</Text>
          <TextInput
            style={[styles.input, usernameError && username.length > 0 ? styles.inputError : null]}
            placeholder="例：yuki_123"
            placeholderTextColor="#666"
            value={username}
            onChangeText={handleUsernameChange}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {usernameError && username.length > 0 ? (
            <Text style={styles.errorText}>{usernameError}</Text>
          ) : username.length >= 3 ? (
            <Text style={styles.validText}>@{username}</Text>
          ) : (
            <Text style={styles.hintText}>英数字と . _ - が使えます（3〜20文字）</Text>
          )}

          <Text style={styles.label}>名前（ニックネーム）</Text>
          <TextInput
            style={styles.input}
            placeholder="例：ゆき"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
            maxLength={10}
          />

          <Text style={styles.label}>年齢</Text>
          <TextInput
            style={styles.input}
            placeholder="例：24"
            placeholderTextColor="#666"
            keyboardType="number-pad"
            value={age}
            onChangeText={setAge}
            maxLength={2}
          />

          <Text style={styles.label}>性別</Text>
          <View style={styles.genderRow}>
            <TouchableOpacity
              style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]}
              onPress={() => setGender('male')}
            >
              <Text style={[styles.genderText, gender === 'male' && styles.genderTextActive]}>
                男性
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]}
              onPress={() => setGender('female')}
            >
              <Text style={[styles.genderText, gender === 'female' && styles.genderTextActive]}>
                女性
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>タグ（最大5つ選択）</Text>
          <Text style={styles.tagHint}>{selectedTags.length}/5 選択中</Text>
          <View style={styles.tagGrid}>
            {TAG_OPTIONS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tagBtn,
                  selectedTags.includes(tag) && styles.tagBtnActive,
                ]}
                onPress={() => toggleTag(tag)}
              >
                <Text
                  style={[
                    styles.tagText,
                    selectedTags.includes(tag) && styles.tagTextActive,
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {!isEdit && (
            <View style={styles.termsSection}>
              <TouchableOpacity
                style={styles.termsCheckRow}
                onPress={() => setAgreedToTerms(!agreedToTerms)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, agreedToTerms && styles.checkboxActive]}>
                  {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.termsText}>
                  <Text
                    style={styles.termsLink}
                    onPress={() => router.push('/terms')}
                  >
                    利用規約
                  </Text>
                  {' と '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => router.push('/privacy')}
                  >
                    プライバシーポリシー
                  </Text>
                  に同意する
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, (saving || (!isEdit && !agreedToTerms)) && { opacity: 0.4 }]}
            onPress={handleSave}
            activeOpacity={0.8}
            disabled={saving || (!isEdit && !agreedToTerms)}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>{isEdit ? '保存する' : 'はじめる'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  scroll: {
    padding: 24,
    paddingBottom: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 32,
  },
  label: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 20,
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
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  validText: {
    color: '#4CD964',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  hintText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderBtn: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  genderBtnActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  genderText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  genderTextActive: {
    color: '#fff',
  },
  tagHint: {
    color: '#FF6B35',
    fontSize: 12,
    marginBottom: 10,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagBtn: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  tagBtnActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  tagText: {
    color: '#888',
    fontSize: 14,
  },
  tagTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#FF6B35',
    paddingVertical: 18,
    borderRadius: 50,
    alignItems: 'center',
    marginTop: 36,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  photoBtn: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FF6B35',
  },
  photoPreview: {
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
  photoPlaceholderIcon: {
    fontSize: 32,
  },
  photoPlaceholderText: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  photoHint: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
  },
  backBtn: {
    marginBottom: 12,
  },
  backBtnText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
  },
  idSection: {
    marginTop: 24,
  },
  idHint: {
    color: '#888',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  idUploadBtn: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  idPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  idPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idPlaceholderIcon: {
    fontSize: 40,
  },
  idPlaceholderText: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
  },
  idNote: {
    color: '#666',
    fontSize: 11,
    marginTop: 8,
    lineHeight: 16,
  },
  termsSection: {
    marginTop: 24,
  },
  termsCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  termsText: {
    color: '#999',
    fontSize: 14,
    flex: 1,
  },
  termsLink: {
    color: '#FF6B35',
    textDecorationLine: 'underline',
  },
});
