import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { getCollection, addDocument } from '../../src/config/firestoreApi';
import { useAuth } from '../../src/contexts/AuthContext';
import { getLastResetTime } from '../../src/utils/resetTime';
import { sendPushNotification } from '../../src/utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 10;
const CARD_WIDTH = (SCREEN_WIDTH - 40 - CARD_GAP) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

type PopularUser = {
  userId: string;
  name: string;
  age: number;
  photoUrl: string;
  tags: string[];
  likeCount: number;
  storyId: string;
  alreadyInteracted: boolean;
};

export default function PopularScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [popularUsers, setPopularUsers] = useState<PopularUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMyStory, setHasMyStory] = useState(false);
  const [superLikeUsed, setSuperLikeUsed] = useState(false);
  const [targetUser, setTargetUser] = useState<PopularUser | null>(null);
  const [superLikeMessage, setSuperLikeMessage] = useState('');
  const [sending, setSending] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const resetTime = getLastResetTime();
      const [storiesDocs, likesDocs, blocksDocs, swipesDocs] = await Promise.all([
        getCollection('stories'),
        getCollection('likes'),
        getCollection('blocks'),
        getCollection('swipes'),
      ]);

      // 自分が今日ストーリーを投稿したか
      let myStoryPosted = false;
      storiesDocs.forEach((d) => {
        if (d.data.userId !== user.uid) return;
        const date = d.data.createdAt instanceof Date ? d.data.createdAt : new Date(d.data.createdAt || 0);
        if (date >= resetTime) myStoryPosted = true;
      });
      setHasMyStory(myStoryPosted);

      // 自分が今日スーパーライクを使ったか
      let superLikeSent = false;
      likesDocs.forEach((d) => {
        if (d.data.fromUserId !== user.uid) return;
        if (!d.data.isSuperLike) return;
        const date = d.data.createdAt instanceof Date ? d.data.createdAt : new Date(d.data.createdAt || 0);
        if (date >= resetTime) superLikeSent = true;
      });
      setSuperLikeUsed(superLikeSent);

      // ブロック関係のユーザーを除外
      const blockedIds = new Set<string>();
      blocksDocs.forEach((d) => {
        if (d.data.fromUserId === user.uid) blockedIds.add(d.data.toUserId);
        if (d.data.toUserId === user.uid) blockedIds.add(d.data.fromUserId);
      });

      // 自分が今日やり取りした相手
      const interactedToday = new Set<string>();
      swipesDocs.forEach((d) => {
        if (d.data.fromUserId !== user.uid) return;
        const date = d.data.createdAt instanceof Date ? d.data.createdAt : new Date(d.data.createdAt || 0);
        if (date >= resetTime) interactedToday.add(d.data.toUserId);
      });
      likesDocs.forEach((d) => {
        if (d.data.fromUserId !== user.uid) return;
        const date = d.data.createdAt instanceof Date ? d.data.createdAt : new Date(d.data.createdAt || 0);
        if (date >= resetTime) interactedToday.add(d.data.toUserId);
      });

      // 今日のアクティブストーリーがあるユーザー
      const activeStoryByUser = new Map<string, { storyId: string; userName: string; userAge: number; userPhotoUrl: string; userTags: string[] }>();
      storiesDocs.forEach((d) => {
        const s = d.data;
        if (!s.userId || s.userId === user.uid) return;
        if (blockedIds.has(s.userId)) return;
        const date = s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt || 0);
        if (date < resetTime) return;
        if (!activeStoryByUser.has(s.userId)) {
          activeStoryByUser.set(s.userId, {
            storyId: d.id,
            userName: s.userName || '',
            userAge: s.userAge || 0,
            userPhotoUrl: s.userPhotoUrl || '',
            userTags: s.userTags || [],
          });
        }
      });

      // 累計いいね数を集計
      const likeCountByUser = new Map<string, number>();
      likesDocs.forEach((d) => {
        const to = d.data.toUserId;
        if (!to) return;
        likeCountByUser.set(to, (likeCountByUser.get(to) || 0) + 1);
      });

      const users: PopularUser[] = [];
      activeStoryByUser.forEach((info, uid) => {
        users.push({
          userId: uid,
          name: info.userName || 'ゲスト',
          age: info.userAge || 0,
          photoUrl: info.userPhotoUrl || '',
          tags: info.userTags || [],
          likeCount: likeCountByUser.get(uid) || 0,
          storyId: info.storyId,
          alreadyInteracted: interactedToday.has(uid),
        });
      });

      users.sort((a, b) => b.likeCount - a.likeCount);
      setPopularUsers(users);
    } catch (e) {
      console.error('fetchPopular error', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleTapLike = (pu: PopularUser) => {
    if (!hasMyStory) {
      Alert.alert('投稿が必要です', 'スーパーライクを送るにはまず自分のストーリーを投稿してください', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '投稿する', onPress: () => router.push('/(tabs)/post') },
      ]);
      return;
    }
    if (superLikeUsed) {
      Alert.alert('本日は使用済み', 'スーパーライクは1日1回までです。明日の朝5時にリセットされます。');
      return;
    }
    if (pu.alreadyInteracted) return;
    setTargetUser(pu);
  };

  const handleSend = async () => {
    if (!user || !targetUser || sending) return;
    setSending(true);
    try {
      await addDocument('likes', {
        fromUserId: user.uid,
        toUserId: targetUser.userId,
        storyId: targetUser.storyId,
        isSuperLike: true,
        message: superLikeMessage.trim(),
        createdAt: new Date(),
      });
      addDocument('swipes', {
        fromUserId: user.uid,
        toUserId: targetUser.userId,
        storyId: targetUser.storyId,
        action: 'superlike',
        createdAt: new Date(),
      }).catch(() => {});

      setSuperLikeUsed(true);

      // プッシュ通知
      let myName = 'ゲスト';
      try {
        const pd = await AsyncStorage.getItem(`profile_data_${user.uid}`);
        if (pd) myName = JSON.parse(pd).name || 'ゲスト';
      } catch {}
      sendPushNotification(
        targetUser.userId,
        '⭐ スーパーライクが届きました！',
        `${myName}さんからスーパーライク！`,
        { type: 'superlike' },
      ).catch(() => {});

      // マッチ判定
      const resetTime = getLastResetTime();
      let isMatched = false;
      try {
        const likesDocs = await getCollection('likes');
        isMatched = likesDocs.some((d) => {
          if (d.data.fromUserId !== targetUser.userId || d.data.toUserId !== user.uid) return false;
          const date = d.data.createdAt instanceof Date ? d.data.createdAt : new Date(d.data.createdAt || 0);
          return date >= resetTime;
        });
      } catch {}

      if (isMatched) {
        await addDocument('matches', {
          users: [user.uid, targetUser.userId],
          createdAt: new Date(),
        }).catch(() => {});
        sendPushNotification(
          targetUser.userId,
          'マッチング成立!',
          `${myName}さんとマッチしました！`,
          { type: 'match' },
        ).catch(() => {});
      }

      // 状態更新
      const targetId = targetUser.userId;
      setPopularUsers((prev) => prev.map((u) => u.userId === targetId ? { ...u, alreadyInteracted: true } : u));
      setTargetUser(null);
      setSuperLikeMessage('');

      if (isMatched) {
        Alert.alert('マッチ成立！🎉', `${targetUser.name}さんとマッチしました！`);
      } else {
        Alert.alert('⭐ 送信完了', `${targetUser.name}さんにスーパーライクを送りました`);
      }
    } catch (e: any) {
      Alert.alert('エラー', e.message || 'スーパーライクに失敗しました');
    } finally {
      setSending(false);
    }
  };

  if (loading && popularUsers.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><Text style={styles.title}>人気</Text></View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>人気</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchData}
            tintColor="#FF6B35"
            colors={['#FF6B35']}
          />
        }
      >
        {popularUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>🏆</Text>
            <Text style={styles.emptyText}>まだ投稿がありません</Text>
            <Text style={styles.emptySubText}>今日ストーリーを投稿したユーザーがここに表示されます</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {popularUsers.map((pu, idx) => {
              const disabled = !hasMyStory || superLikeUsed || pu.alreadyInteracted;
              return (
                <View key={pu.userId} style={styles.card}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </Text>
                  </View>

                  {pu.photoUrl ? (
                    <Image source={{ uri: pu.photoUrl }} style={styles.cardPhoto} />
                  ) : (
                    <View style={[styles.cardPhoto, styles.cardPhotoPlaceholder]}>
                      <Text style={{ fontSize: 40, opacity: 0.3 }}>👤</Text>
                    </View>
                  )}

                  <View style={styles.likeBadge}>
                    <Text style={styles.likeBadgeText}>❤️ {pu.likeCount}</Text>
                  </View>

                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {pu.name}
                      {pu.age > 0 && <Text style={styles.cardAge}> {pu.age}</Text>}
                    </Text>
                    {pu.tags.length > 0 && (
                      <Text style={styles.cardTags} numberOfLines={1}>
                        {pu.tags.slice(0, 2).map((t) => `#${t}`).join(' ')}
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.superLikeBtn,
                      disabled && styles.superLikeBtnDisabled,
                    ]}
                    onPress={() => handleTapLike(pu)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.superLikeIcon,
                        disabled && styles.superLikeIconDim,
                      ]}
                    >
                      ⭐
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── スーパーライクモーダル ── */}
      <Modal visible={!!targetUser} transparent animationType="slide" onRequestClose={() => setTargetUser(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setTargetUser(null)}>
            <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>⭐ スーパーライク</Text>
              <Text style={styles.modalDesc}>1日1回限定。気になる相手にメッセージを添えて気持ちを伝えよう</Text>

              {targetUser && (
                <View style={styles.targetRow}>
                  {targetUser.photoUrl ? (
                    <Image source={{ uri: targetUser.photoUrl }} style={styles.targetAvatar} />
                  ) : (
                    <View style={[styles.targetAvatar, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 20 }}>👤</Text>
                    </View>
                  )}
                  <Text style={styles.targetName}>
                    {targetUser.name}
                    {targetUser.age > 0 && ` ${targetUser.age}歳`}
                  </Text>
                </View>
              )}

              <TextInput
                style={styles.input}
                placeholder="メッセージを入力（任意）"
                placeholderTextColor="#666"
                value={superLikeMessage}
                onChangeText={setSuperLikeMessage}
                maxLength={100}
                multiline
              />
              <Text style={styles.charCount}>{superLikeMessage.length}/100</Text>

              <TouchableOpacity
                style={[styles.sendBtn, sending && { opacity: 0.6 }]}
                onPress={handleSend}
                disabled={sending}
                activeOpacity={0.8}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.sendBtnText}>⭐ スーパーライクを送る</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setTargetUser(null)}>
                <Text style={styles.cancelBtnText}>やめる</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  header: {
    paddingTop: 4,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  emptyState: {
    padding: 80,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  emptySubText: {
    color: '#666',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  cardPhoto: {
    width: '100%',
    height: '100%',
  },
  cardPhotoPlaceholder: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 5,
  },
  rankText: {
    fontSize: 22,
  },
  likeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 5,
  },
  likeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    paddingBottom: 12,
  },
  cardName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  cardAge: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  cardTags: {
    color: '#fff',
    fontSize: 11,
    marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  // ── スーパーライクボタン（探す画面と同じ見た目） ──
  superLikeBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFC107',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 5,
  },
  superLikeBtnDisabled: {
    backgroundColor: '#444',
  },
  superLikeIcon: {
    fontSize: 22,
  },
  superLikeIconDim: {
    opacity: 0.3,
  },
  // ── モーダル ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDesc: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  targetAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  targetName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  sendBtn: {
    backgroundColor: '#FFC107',
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: 'center',
  },
  sendBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: '#888',
    fontSize: 14,
  },
});
