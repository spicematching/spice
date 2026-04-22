import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { setAudioModeAsync } from 'expo-audio';
import { StoryVideo } from '../../src/components/StoryVideo';
import { addDocument, getCollection } from '../../src/config/firestoreApi';
import { uploadFile } from '../../src/config/storageApi';
import { useAuth } from '../../src/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { isInCurrentCycle, getTimeUntilReset } from '../../src/utils/resetTime';

type FriendProfile = {
  userId: string;
  name: string;
  age: number;
  photoUrl: string;
};

export default function PostScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [recording, setRecording] = useState(false);
  const [posting, setPosting] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState('');
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [allFriends, setAllFriends] = useState<FriendProfile[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<FriendProfile[]>([]);
  const [showFriendPicker, setShowFriendPicker] = useState(false);

  // フレンド一覧を取得
  const fetchFriends = useCallback(async () => {
    if (!user) return;
    try {
      const [friendDocs, userDocs] = await Promise.all([
        getCollection('friends'),
        getCollection('users'),
      ]);
      const userMap: Record<string, any> = {};
      for (const doc of userDocs) userMap[doc.id] = doc.data;

      const list: FriendProfile[] = [];
      for (const doc of friendDocs) {
        const d = doc.data;
        if (d.status !== 'accepted') continue;
        if (d.fromUserId !== user.uid && d.toUserId !== user.uid) continue;
        const otherId = d.fromUserId === user.uid ? d.toUserId : d.fromUserId;
        const p = userMap[otherId];
        if (!p || p.deleted) continue;
        list.push({
          userId: otherId,
          name: p.name || 'ゲスト',
          age: p.age || 0,
          photoUrl: p.photoUrl || '',
        });
      }
      setAllFriends(list);
    } catch {}
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchFriends();
    }, [fetchFriends])
  );

  const toggleFriend = (friend: FriendProfile) => {
    setSelectedFriends((prev) => {
      const exists = prev.find((f) => f.userId === friend.userId);
      if (exists) return prev.filter((f) => f.userId !== friend.userId);
      return [...prev, friend];
    });
  };

  const groupCount = selectedFriends.length + 1;

  const checkCooldown = useCallback(async () => {
    if (!user) return;
    try {
      let lastPostTime: number | null = null;

      // まずローカルをチェック
      const local = await AsyncStorage.getItem(`last_post_${user.uid}`);
      if (local) lastPostTime = parseInt(local, 10);

      // ローカルになければFirestoreからチェック
      if (!lastPostTime) {
        try {
          const stories = await getCollection('stories');
          const myStories = stories
            .filter((s: any) => s.data.userId === user.uid)
            .map((s: any) => {
              const t = s.data.createdAt;
              return t instanceof Date ? t.getTime() : new Date(t).getTime();
            })
            .filter((t: number) => !isNaN(t));
          if (myStories.length > 0) {
            lastPostTime = Math.max(...myStories);
            await AsyncStorage.setItem(`last_post_${user.uid}`, lastPostTime.toString());
          }
        } catch {}
      }

      // 朝5時リセット: 最後の投稿が今日のサイクル内ならクールダウン中
      if (lastPostTime && isInCurrentCycle(lastPostTime)) {
        setCooldown(true);
        setCooldownRemaining(getTimeUntilReset());
      } else {
        setCooldown(false);
        setCooldownRemaining('');
      }
    } catch {}
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      checkCooldown();
    }, [checkCooldown])
  );

  useEffect(() => {
    if (!cooldown) return;
    const interval = setInterval(checkCooldown, 60000);
    return () => clearInterval(interval);
  }, [cooldown, checkCooldown]);



  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('カメラの許可が必要です', '設定からカメラへのアクセスを許可してください');
        return;
      }
    }
    if (!micPermission?.granted) {
      const result = await requestMicPermission();
      if (!result.granted) {
        Alert.alert('マイクの許可が必要です', '動画撮影のため、設定からマイクへのアクセスを許可してください');
        return;
      }
    }
    // カメラを開く前に audio session を録音モードに設定
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
      });
    } catch {}
    setShowCamera(true);
  };

  const handleStartRecording = async () => {
    if (!cameraRef.current || recording) return;
    setRecording(true);
    try {
      // カメラが完全に初期化されるまで少し待つ
      await new Promise((resolve) => setTimeout(resolve, 300));
      const video = await cameraRef.current.recordAsync({ maxDuration: 3 });
      if (video?.uri) {
        setMediaUri(video.uri);
        setIsVideo(true);
        setShowCamera(false);
      }
    } catch (e: any) {
      Alert.alert('撮影エラー', e?.message || '動画の撮影に失敗しました。マイク権限を確認してください。');
    } finally {
      setRecording(false);
    }
  };

  const handleStopRecording = () => {
    if (recording) {
      cameraRef.current?.stopRecording();
    }
  };

  const handlePost = async () => {
    if (!mediaUri) {
      Alert.alert('エラー', 'メディアがありません');
      return;
    }
    if (!user) {
      Alert.alert('エラー', 'ログインしてください');
      return;
    }
    if (posting) return;

    setPosting(true);
    try {
      // 今日のサイクル（朝5時〜）で投稿済みかチェック
      const stories = await getCollection('stories');
      const recentPost = stories.find((s: any) => {
        if (s.data.userId !== user.uid) return false;
        const created = s.data.createdAt instanceof Date
          ? s.data.createdAt
          : new Date(s.data.createdAt);
        return isInCurrentCycle(created);
      });
      if (recentPost) {
        Alert.alert('投稿制限', `1日1回のみ投稿できます。\n次回は朝5:00にリセットされます。`);
        setPosting(false);
        return;
      }

      // プロフィール情報をローカルから取得
      let profile: any = {};
      try {
        const data = await AsyncStorage.getItem(`profile_data_${user.uid}`);
        if (data) profile = JSON.parse(data);
      } catch {}

      // Firestoreにバックグラウンドで保存
      // Storageにアップロード
      const ext = isVideo ? 'mp4' : 'jpg';
      const storagePath = `stories/${user.uid}/${Date.now()}.${ext}`;
      const downloadUrl = await uploadFile(mediaUri, storagePath);

      await addDocument('stories', {
        userId: user.uid,
        userName: profile.name || 'ゲスト',
        userAge: profile.age || 0,
        userGender: profile.gender || '',
        userPhotoUrl: profile.photoUrl || '',
        userTags: profile.tags || [],
        mediaUrl: downloadUrl,
        mediaType: isVideo ? 'video' : 'photo',
        groupCount,
        groupMembers: selectedFriends.map((f) => ({
          userId: f.userId,
          name: f.name,
          photoUrl: f.photoUrl,
        })),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // クールダウン記録
      await AsyncStorage.setItem(`last_post_${user.uid}`, Date.now().toString());
      setCooldown(true);
      checkCooldown();

      Alert.alert('投稿完了！', '近くのグループに表示されます', [
        {
          text: 'OK',
          onPress: () => {
            setMediaUri(null);
            setIsVideo(false);
          },
        },
      ]);
    } catch (error: any) {
      console.error('Post error:', error);
      Alert.alert('エラー', `投稿に失敗しました: ${error.message || error}`);
    } finally {
      setPosting(false);
    }
  };

  // カメラ表示中
  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          mode="video"
          zoom={0}
        >
          <SafeAreaView style={styles.cameraUI}>
            <View style={styles.cameraTopRow}>
              <TouchableOpacity
                style={styles.cameraCloseBtn}
                onPress={() => {
                  if (recording) cameraRef.current?.stopRecording();
                  setShowCamera(false);
                  setRecording(false);
                  // audio session を通常モードに戻す
                  setAudioModeAsync({ allowsRecording: false }).catch(() => {});
                }}
              >
                <Text style={styles.cameraCloseBtnText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.flipBtn}
                onPress={() => setFacing((f) => f === 'front' ? 'back' : 'front')}
              >
                <Text style={styles.flipBtnText}>🔄</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.cameraBottom}>
              {recording && (
                <Text style={styles.recordingLabel}>🔴 録画中...（最大3秒）</Text>
              )}
              <TouchableOpacity
                style={[styles.recordBtn, recording && styles.recordBtnActive]}
                onPress={recording ? handleStopRecording : handleStartRecording}
                activeOpacity={0.7}
              >
                <View style={[styles.recordBtnInnerStyle, recording && styles.recordBtnInnerActive]} />
              </TouchableOpacity>
              <Text style={styles.cameraHint}>
                タップで録画開始/停止（最大3秒）
              </Text>
            </View>
          </SafeAreaView>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {mediaUri ? (
        <View style={styles.previewContainer}>
          {/* 動画 or 写真のプレビュー */}
          <View style={styles.previewMedia} pointerEvents="none">
            {isVideo ? (
              <StoryVideo uri={mediaUri!} active={true} style={StyleSheet.absoluteFill} />
            ) : (
              <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} />
            )}
          </View>

          {/* 動画/写真ラベル */}
          <View style={styles.mediaLabel}>
            <Text style={styles.mediaLabelText}>
              {isVideo ? '🎬 動画' : '📸 写真'}
            </Text>
          </View>

          {/* 上部：撮り直しボタン */}
          <SafeAreaView style={styles.previewTopBar}>
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={() => { setMediaUri(null); setIsVideo(false); }}
            >
              <Text style={styles.retakeBtnText}>✕ 撮り直す</Text>
            </TouchableOpacity>
          </SafeAreaView>

          {/* 下部：フレンド選択 + 投稿ボタン */}
          <View style={styles.previewBottomBar}>
            <Text style={styles.friendSectionLabel}>誰と一緒？</Text>
            <TouchableOpacity
              style={styles.friendSelectBtn}
              onPress={() => setShowFriendPicker(true)}
              activeOpacity={0.7}
            >
              {selectedFriends.length === 0 ? (
                <Text style={styles.friendSelectPlaceholder}>フレンドを選択 +</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.selectedFriendsRow}>
                    {selectedFriends.map((f) => (
                      <View key={f.userId} style={styles.selectedFriendChip}>
                        {f.photoUrl ? (
                          <Image source={{ uri: f.photoUrl }} style={styles.chipAvatar} />
                        ) : (
                          <View style={[styles.chipAvatar, { backgroundColor: '#555', alignItems: 'center', justifyContent: 'center' }]}>
                            <Text style={{ fontSize: 10 }}>👤</Text>
                          </View>
                        )}
                        <Text style={styles.chipName}>{f.name}</Text>
                      </View>
                    ))}
                    <View style={styles.addMoreChip}>
                      <Text style={styles.addMoreText}>+</Text>
                    </View>
                  </View>
                </ScrollView>
              )}
            </TouchableOpacity>
            <Text style={styles.groupCountLabel}>👥 {groupCount}人グループ</Text>
            <TouchableOpacity
              style={[styles.postBtn, posting && { opacity: 0.6 }]}
              onPress={handlePost}
              activeOpacity={0.8}
              disabled={posting}
            >
              {posting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.postBtnText}>🌶️ 投稿する</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyContent}>
            <Text style={styles.emptyEmoji}>{cooldown ? '⏳' : '📸'}</Text>
            <Text style={styles.emptyTitle}>
              {cooldown ? '投稿済み' : 'ストーリーを投稿'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {cooldown
                ? `朝5:00にリセット（あと${cooldownRemaining}）`
                : '今夜の盛り上がりを撮影してシェアしよう'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.openCameraBtn, cooldown && styles.openCameraBtnDisabled]}
            onPress={cooldown ? undefined : handleOpenCamera}
            activeOpacity={cooldown ? 1 : 0.8}
            disabled={cooldown}
          >
            <Text style={[styles.openCameraBtnText, cooldown && styles.openCameraBtnTextDisabled]}>
              {cooldown ? '1日1回投稿できます' : 'カメラを起動'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* フレンド選択モーダル */}
      <Modal visible={showFriendPicker} transparent animationType="slide" onRequestClose={() => setShowFriendPicker(false)}>
        <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={() => setShowFriendPicker(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>誰と一緒ですか？</Text>
            {allFriends.length === 0 ? (
              <View style={styles.pickerEmpty}>
                <Text style={styles.pickerEmptyText}>フレンドがいません</Text>
                <TouchableOpacity
                  style={styles.pickerAddFriendBtn}
                  onPress={() => {
                    setShowFriendPicker(false);
                    router.push('/friends');
                  }}
                >
                  <Text style={styles.pickerAddFriendBtnText}>フレンドを追加する</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={allFriends}
                keyExtractor={(item) => item.userId}
                style={styles.pickerList}
                renderItem={({ item }) => {
                  const selected = selectedFriends.some((f) => f.userId === item.userId);
                  return (
                    <TouchableOpacity
                      style={[styles.pickerRow, selected && styles.pickerRowSelected]}
                      onPress={() => toggleFriend(item)}
                      activeOpacity={0.7}
                    >
                      {item.photoUrl ? (
                        <Image source={{ uri: item.photoUrl }} style={styles.pickerAvatar} />
                      ) : (
                        <View style={[styles.pickerAvatar, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ fontSize: 18 }}>👤</Text>
                        </View>
                      )}
                      <Text style={styles.pickerName}>
                        {item.name}{item.age > 0 ? ` ${item.age}歳` : ''}
                      </Text>
                      <View style={[styles.pickerCheck, selected && styles.pickerCheckActive]}>
                        {selected && <Text style={styles.pickerCheckText}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <TouchableOpacity style={styles.pickerDoneBtn} onPress={() => setShowFriendPicker(false)}>
              <Text style={styles.pickerDoneBtnText}>完了（{groupCount}人グループ）</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  // ── 撮影前 ──
  emptyContainer: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 32,
  },
  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyEmoji: {
    fontSize: 72,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  openCameraBtn: {
    backgroundColor: '#FF6B35',
    paddingVertical: 18,
    borderRadius: 50,
    alignItems: 'center',
  },
  openCameraBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  openCameraBtnDisabled: {
    backgroundColor: '#3a3a3a',
  },
  openCameraBtnTextDisabled: {
    color: '#777',
  },
  // ── プレビュー（全画面） ──
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewMedia: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  mediaLabel: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    zIndex: 5,
  },
  mediaLabelText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  previewTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  retakeBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retakeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  previewBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  friendSectionLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  friendSelectBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 12,
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 8,
  },
  friendSelectPlaceholder: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
  },
  selectedFriendsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  selectedFriendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  chipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  chipName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  addMoreChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  groupCountLabel: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  postBtn: {
    backgroundColor: '#FF6B35',
    paddingVertical: 18,
    borderRadius: 50,
    alignItems: 'center',
  },
  postBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  // ── カメラ ──
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraUI: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  cameraTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cameraCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCloseBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  flipBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipBtnText: {
    fontSize: 20,
  },
  cameraBottom: {
    alignItems: 'center',
    paddingBottom: 20,
    gap: 12,
  },
  recordingLabel: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: 'bold',
  },
  recordBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtnActive: {
    borderColor: '#fff',
  },
  recordBtnInnerStyle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FF3B30',
  },
  recordBtnInnerActive: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  cameraHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  // ── フレンド選択モーダル ──
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  pickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: '#2a2a2a',
  },
  pickerRowSelected: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  pickerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  pickerName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCheckActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  pickerCheckText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pickerEmpty: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  pickerEmptyText: {
    color: '#888',
    fontSize: 16,
    marginBottom: 16,
  },
  pickerAddFriendBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 50,
  },
  pickerAddFriendBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  pickerDoneBtn: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: 'center',
    marginTop: 12,
  },
  pickerDoneBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
});
