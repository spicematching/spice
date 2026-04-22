import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  Image,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { StoryVideo } from '../../src/components/StoryVideo';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { getCollection, addDocument, setDocument } from '../../src/config/firestoreApi';
import { useAuth } from '../../src/contexts/AuthContext';
import { getLastResetTime } from '../../src/utils/resetTime';
import { sendPushNotification } from '../../src/utils/notifications';
import { ensureAgeVerified, ensurePeerAgeVerified } from '../../src/utils/ageVerification';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STORY_HEIGHT = SCREEN_WIDTH * 1.3;

type Match = {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAge: number;
  otherGroupCount: number;
  otherPhotoUrl: string;
  storyMediaUrl: string;
  storyMediaType: string;
  storyTags: string[];
  sharedLocation: { lat: number; lng: number; address: string } | null;
  myLocationShared: boolean;
};

export default function MatchesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuMatch, setMenuMatch] = useState<Match | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportCategory, setReportCategory] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const matchesDocs = await getCollection('matches');
      const myMatches: Match[] = [];
      const otherUserIds: string[] = [];
      const resetTime = getLastResetTime();

      for (const doc of matchesDocs) {
        const matchDate = doc.data.createdAt instanceof Date
          ? doc.data.createdAt
          : new Date(doc.data.createdAt || 0);
        if (matchDate < resetTime) continue;
        // 解除済みスキップ
        if (doc.data.unmatched) continue;

        if (doc.data.users && doc.data.users.includes(user.uid)) {
          const otherUserId = doc.data.users.find((id: string) => id !== user.uid);
          if (otherUserId) {
            otherUserIds.push(otherUserId);
            myMatches.push({
              id: doc.id,
              otherUserId,
              otherUserName: '',
              otherUserAge: 0,
              otherGroupCount: 2,
              otherPhotoUrl: '',
              storyMediaUrl: '',
              storyMediaType: '',
              storyTags: [],
              sharedLocation: null,
              myLocationShared: false,
            });
          }
        }
      }

      // ブロックリスト取得
      let blockedIds = new Set<string>();
      try {
        const blockDocs = await getCollection('blocks');
        for (const doc of blockDocs) {
          if (doc.data.fromUserId === user.uid) {
            blockedIds.add(doc.data.toUserId);
          }
          if (doc.data.toUserId === user.uid) {
            blockedIds.add(doc.data.fromUserId);
          }
        }
      } catch {}

      // ブロックされたユーザーのマッチを除外
      const filteredMatches = myMatches.filter((m) => !blockedIds.has(m.otherUserId));

      // プロフィール取得
      if (filteredMatches.length > 0) {
        try {
          const usersDocs = await getCollection('users');
          const userProfiles: Record<string, any> = {};
          for (const doc of usersDocs) {
            userProfiles[doc.id] = doc.data;
          }
          for (const match of filteredMatches) {
            const profile = userProfiles[match.otherUserId];
            if (profile) {
              match.otherUserName = profile.name || 'ゲスト';
              match.otherUserAge = profile.age || 0;
              match.otherPhotoUrl = profile.photoUrl || '';
            }
          }
        } catch {}
      }

      // ストーリー取得
      if (filteredMatches.length > 0) {
        try {
          const storiesDocs = await getCollection('stories');
          const otherIds = new Set(filteredMatches.map((m) => m.otherUserId));
          const otherStories = storiesDocs
            .filter((s: any) => otherIds.has(s.data.userId))
            .sort((a: any, b: any) => {
              const aD = a.data.createdAt instanceof Date ? a.data.createdAt : new Date(a.data.createdAt || 0);
              const bD = b.data.createdAt instanceof Date ? b.data.createdAt : new Date(b.data.createdAt || 0);
              return bD.getTime() - aD.getTime();
            });
          for (const match of filteredMatches) {
            const story = otherStories.find((s: any) => s.data.userId === match.otherUserId);
            if (story) {
              match.storyMediaUrl = story.data.mediaUrl || '';
              match.storyMediaType = story.data.mediaType || '';
              match.storyTags = story.data.userTags || [];
            }
          }
        } catch {}
      }

      // 位置情報
      try {
        const locDocs = await getCollection('locationShares');
        for (const doc of locDocs) {
          for (const match of filteredMatches) {
            if (doc.data.fromUserId === match.otherUserId && doc.data.toUserId === user.uid) {
              match.sharedLocation = { lat: doc.data.lat, lng: doc.data.lng, address: doc.data.address || '' };
            }
            if (doc.data.fromUserId === user.uid && doc.data.toUserId === match.otherUserId) {
              match.myLocationShared = true;
            }
          }
        }
      } catch {}

      // プリフェッチ
      filteredMatches.forEach((m) => {
        if (m.otherPhotoUrl) Image.prefetch(m.otherPhotoUrl).catch(() => {});
        if (m.storyMediaUrl && m.storyMediaType === 'photo') Image.prefetch(m.storyMediaUrl).catch(() => {});
      });

      setMatches(filteredMatches);
    } catch (error) {
      console.error('Fetch matches error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleCall = async (match: Match) => {
    try {
      if (!user) return;
      const verified = await ensureAgeVerified(user.uid);
      if (!verified) return;
      const peerVerified = await ensurePeerAgeVerified(match.otherUserId);
      if (!peerVerified) return;
      // 自分の名前を取得
      let myName = 'ゲスト';
      let myPhoto = '';
      try {
        const pd = await AsyncStorage.getItem(`profile_data_${user!.uid}`);
        if (pd) {
          const p = JSON.parse(pd);
          myName = p.name || 'ゲスト';
          myPhoto = p.photoUrl || '';
        }
      } catch {}

      // callドキュメント作成（名前・写真も保存してポーリングで使う）
      const callDoc = await addDocument('calls', {
        callerId: user!.uid,
        receiverId: match.otherUserId,
        matchId: match.id,
        callerName: myName,
        callerPhoto: myPhoto,
        status: 'ringing',
        createdAt: new Date(),
      });

      // 相手にプッシュ通知
      sendPushNotification(
        match.otherUserId,
        '📹 着信',
        `${myName}さんからビデオ通話`,
        { type: 'call', callId: callDoc.id, callerName: myName, callerPhoto: myPhoto },
      ).catch(() => {});

      // 呼び出し中画面へ
      router.push({
        pathname: '/call-screen',
        params: {
          name: match.otherUserName,
          matchId: match.id,
          photoUrl: match.otherPhotoUrl,
          callId: callDoc.id,
        },
      });
    } catch (e: any) {
      Alert.alert('エラー', `通話の開始に失敗しました: ${e.message || e}`);
    }
  };

  const handleShareLocation = (match: Match) => {
    if (match.myLocationShared) {
      Alert.alert('送信済み', '既に位置情報を共有しています');
      return;
    }
    Alert.alert('位置情報を共有', `${match.otherUserName}さんに現在地を送りますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '共有する',
        onPress: async () => {
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('エラー', '位置情報の許可が必要です。設定から許可してください。');
              return;
            }
            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;
            let address = '';
            try {
              const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
              if (place) address = [place.city, place.district, place.street].filter(Boolean).join(' ');
            } catch {}
            await addDocument('locationShares', {
              fromUserId: user!.uid, toUserId: match.otherUserId, matchId: match.id,
              lat: latitude, lng: longitude,
              address: address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
              createdAt: new Date(),
            });
            setMatches((prev) => prev.map((m) => m.id === match.id ? { ...m, myLocationShared: true } : m));
            Alert.alert('共有完了', `現在地を${match.otherUserName}さんに送信しました`);
          } catch (e: any) {
            Alert.alert('エラー', `位置情報の取得に失敗しました: ${e.message || e}`);
          }
        },
      },
    ]);
  };

  const handleOpenMap = (match: Match) => {
    if (!match.sharedLocation) return;
    const { lat, lng } = match.sharedLocation;
    const url = Platform.select({ ios: `maps:?q=${lat},${lng}`, android: `geo:${lat},${lng}?q=${lat},${lng}` });
    if (url) Linking.openURL(url);
  };

  // --- マッチ解除 ---
  const handleUnmatch = (match: Match) => {
    Alert.alert(
      'マッチ解除',
      `${match.otherUserName}さんとのマッチを解除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '解除する',
          style: 'destructive',
          onPress: async () => {
            try {
              await setDocument('matches', match.id, {
                users: [user!.uid, match.otherUserId],
                unmatched: true,
                unmatchedBy: user!.uid,
                unmatchedAt: new Date(),
                createdAt: new Date(),
              });
              setMatches((prev) => prev.filter((m) => m.id !== match.id));
              setMenuMatch(null);
              Alert.alert('完了', 'マッチを解除しました');
            } catch (e: any) {
              Alert.alert('エラー', `マッチ解除に失敗しました: ${e.message || e}`);
            }
          },
        },
      ]
    );
  };

  // --- ブロック ---
  const handleBlock = (match: Match) => {
    Alert.alert(
      `${match.otherUserName}さんをブロック`,
      'お互いのストーリーが表示されなくなります。この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ブロックする',
          style: 'destructive',
          onPress: async () => {
            try {
              await addDocument('blocks', {
                fromUserId: user!.uid,
                toUserId: match.otherUserId,
                createdAt: new Date(),
              });
              // マッチも解除
              await setDocument('matches', match.id, {
                users: [user!.uid, match.otherUserId],
                unmatched: true,
                unmatchedBy: user!.uid,
                unmatchedAt: new Date(),
                createdAt: new Date(),
              });
              setMatches((prev) => prev.filter((m) => m.id !== match.id));
              setMenuMatch(null);
              Alert.alert('完了', `${match.otherUserName}さんをブロックしました`);
            } catch (e: any) {
              Alert.alert('エラー', `ブロックに失敗しました: ${e.message || e}`);
            }
          },
        },
      ]
    );
  };

  // --- 報告 ---
  const handleReport = async () => {
    if (!menuMatch) return;
    if (!reportCategory) {
      Alert.alert('入力エラー', '報告カテゴリを選択してください');
      return;
    }
    setSubmitting(true);
    try {
      // 自分の名前も通知に含める
      let reporterName = '(名前未設定)';
      try {
        const pd = await AsyncStorage.getItem(`profile_data_${user!.uid}`);
        if (pd) reporterName = JSON.parse(pd).name || reporterName;
      } catch {}

      await addDocument('reports', {
        reporterUserId: user!.uid,
        reporterName,
        reportedUserId: menuMatch.otherUserId,
        reportedUserName: menuMatch.otherUserName,
        matchId: menuMatch.id,
        category: reportCategory,
        reason: reportReason.trim(),
        createdAt: new Date(),
      });

      // 運営に通知
      await addDocument('admin_notifications', {
        type: 'user_report',
        userId: menuMatch.otherUserId,
        userName: menuMatch.otherUserName,
        reporterUserId: user!.uid,
        reporterName,
        category: reportCategory,
        reason: reportReason.trim(),
        message: `${reporterName} さんが ${menuMatch.otherUserName} さんを通報しました（${reportCategory}）`,
        createdAt: new Date(),
        read: false,
      });

      setShowReport(false);
      setReportReason('');
      setReportCategory('');
      setMenuMatch(null);
      Alert.alert('報告完了', '運営チームが24時間以内に確認し、適切に対応いたします。ご報告ありがとうございます。');
    } catch (e: any) {
      Alert.alert('エラー', `報告に失敗しました: ${e.message || e}`);
    } finally {
      setSubmitting(false);
    }
  };

  const REPORT_CATEGORIES = [
    { id: 'inappropriate', label: '不適切なコンテンツ・画像', icon: '🚫' },
    { id: 'harassment', label: '嫌がらせ・暴言', icon: '😡' },
    { id: 'spam', label: 'スパム・宣伝行為', icon: '📧' },
    { id: 'impersonation', label: 'なりすまし・偽プロフィール', icon: '🎭' },
    { id: 'underage', label: '未成年の疑い', icon: '⚠️' },
    { id: 'illegal', label: '違法行為・犯罪行為', icon: '🚨' },
    { id: 'other', label: 'その他', icon: '📝' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>マッチ</Text>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>マッチ</Text>

      {matches.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💭</Text>
          <Text style={styles.emptyText}>まだマッチがいません</Text>
          <Text style={styles.emptyHint}>フィードでグループにいいねしよう!</Text>
        </View>
      ) : (
        <ScrollView style={styles.list}>
          {matches.map((match) => (
            <View key={match.id} style={styles.matchCard}>
              {/* ストーリーメディア */}
              {match.storyMediaUrl ? (
                <View style={styles.storyMedia}>
                  {match.storyMediaType === 'video' ? (
                    <StoryVideo uri={match.storyMediaUrl} active />
                  ) : (
                    <Image source={{ uri: match.storyMediaUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  )}
                  <View style={styles.storyOverlay} />
                  <View style={styles.storyUserInfo}>
                    <View style={styles.avatar}>
                      {match.otherPhotoUrl ? (
                        <Image source={{ uri: match.otherPhotoUrl }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.avatarText}>👤</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.storyName}>
                        {match.otherUserName}
                        {match.otherUserAge > 0 && <Text style={styles.storyAge}> {match.otherUserAge}歳</Text>}
                      </Text>
                      {match.storyTags.length > 0 && (
                        <Text style={styles.storyTags} numberOfLines={1}>{match.storyTags.slice(0, 3).join(' / ')}</Text>
                      )}
                    </View>
                    {/* ・・・ボタン */}
                    <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuMatch(match)}>
                      <Text style={styles.menuBtnText}>・・・</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.storyEmpty}>
                  <View style={styles.avatar}>
                    {match.otherPhotoUrl ? (
                      <Image source={{ uri: match.otherPhotoUrl }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarText}>👤</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.storyEmptyName}>
                      {match.otherUserName}
                      {match.otherUserAge > 0 && <Text style={styles.storyAge}> {match.otherUserAge}歳</Text>}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuMatch(match)}>
                    <Text style={styles.menuBtnText}>・・・</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 下部バー */}
              <View style={styles.cardBottom}>
                <View style={styles.cardBottomLeft}>
                  {match.sharedLocation && (
                    <TouchableOpacity onPress={() => handleOpenMap(match)}>
                      <Text style={styles.locationInfo}>📍 {match.sharedLocation.address}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.actionBtns}>
                  <TouchableOpacity
                    style={[styles.locationBtn, match.myLocationShared && styles.locationBtnSent]}
                    onPress={() => handleShareLocation(match)}
                  >
                    <Text style={styles.locationBtnText}>{match.myLocationShared ? '✅' : '📍'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(match)}>
                    <Text style={styles.callBtnText}>📹 通話</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* === メニューモーダル === */}
      <Modal visible={!!menuMatch && !showReport} transparent animationType="slide" onRequestClose={() => setMenuMatch(null)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setMenuMatch(null)}>
          <View style={styles.modalSheet}>
            {/* ハンドル */}
            <View style={styles.modalHandle} />

            {/* ヘッダー */}
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setMenuMatch(null)}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>安全のためのオプション</Text>
            </View>

            {/* メニュー項目 */}
            <View style={styles.menuList}>
              {/* マッチ解除 */}
              <TouchableOpacity style={styles.menuItem} onPress={() => menuMatch && handleUnmatch(menuMatch)}>
                <View style={styles.menuIcon}>
                  <Text style={styles.menuIconText}>✕</Text>
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>マッチ解除</Text>
                  <Text style={styles.menuItemDesc}>このユーザーとのマッチを解除できます</Text>
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              {/* ブロック */}
              <TouchableOpacity style={styles.menuItem} onPress={() => menuMatch && handleBlock(menuMatch)}>
                <View style={styles.menuIcon}>
                  <Text style={styles.menuIconText}>🚫</Text>
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>{menuMatch?.otherUserName}さんをブロックする</Text>
                  <Text style={styles.menuItemDesc}>今後お互いにストーリーが表示されなくなります</Text>
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              {/* 報告 */}
              <TouchableOpacity style={styles.menuItem} onPress={() => setShowReport(true)}>
                <View style={styles.menuIcon}>
                  <Text style={styles.menuIconText}>🚩</Text>
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>{menuMatch?.otherUserName}さんを報告する</Text>
                  <Text style={styles.menuItemDesc}>当該ユーザーには通知されません</Text>
                </View>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* === 報告入力モーダル === */}
      <Modal visible={showReport} transparent animationType="slide" onRequestClose={() => setShowReport(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowReport(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.reportSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowReport(false)}>
                  <Text style={styles.modalCloseBtnText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>ユーザーを報告</Text>
              </View>

              <Text style={styles.reportLabel}>報告カテゴリを選択してください</Text>
              <View style={{ marginBottom: 16 }}>
                {REPORT_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryBtn,
                      reportCategory === cat.id && styles.categoryBtnActive,
                    ]}
                    onPress={() => setReportCategory(cat.id)}
                  >
                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                    <Text
                      style={[
                        styles.categoryLabel,
                        reportCategory === cat.id && { color: '#fff', fontWeight: 'bold' },
                      ]}
                    >
                      {cat.label}
                    </Text>
                    {reportCategory === cat.id && <Text style={styles.categoryCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.reportLabel}>詳細（任意）</Text>
              <TextInput
                style={styles.reportInput}
                placeholder="具体的な状況があればご記入ください..."
                placeholderTextColor="#666"
                value={reportReason}
                onChangeText={setReportReason}
                multiline
                maxLength={500}
              />
              <Text style={styles.reportHint}>運営チームが24時間以内に確認し、適切に対応いたします。</Text>

              <TouchableOpacity
                style={[styles.reportSubmitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleReport}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.reportSubmitText}>報告を送信</Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 8, marginBottom: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { color: '#888', fontSize: 18, fontWeight: '600' },
  emptyHint: { color: '#555', fontSize: 14, marginTop: 8 },
  list: { flex: 1 },

  matchCard: { backgroundColor: '#1a1a1a', borderRadius: 16, marginBottom: 16, overflow: 'hidden' },
  storyMedia: { width: '100%', height: STORY_HEIGHT, backgroundColor: '#2a2a2a' },
  storyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
  storyUserInfo: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  storyName: { color: '#fff', fontWeight: '700', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  storyAge: { color: '#ddd', fontWeight: '400', fontSize: 14 },
  storyTags: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  storyEmpty: { width: '100%', height: 80, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  storyEmptyName: { color: '#fff', fontWeight: '700', fontSize: 16 },

  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#fff' },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { fontSize: 20 },

  // ・・・ボタン
  menuBtn: { backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  menuBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold', letterSpacing: 2 },

  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingHorizontal: 16 },
  cardBottomLeft: { flex: 1, marginRight: 8 },
  actionBtns: { flexDirection: 'row', gap: 8 },
  locationInfo: { color: '#4A9EFF', fontSize: 12 },
  locationBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  locationBtnSent: { backgroundColor: '#1a3a1a' },
  locationBtnText: { fontSize: 18 },
  callBtn: { backgroundColor: '#FF6B35', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  callBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // === モーダル ===
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
  reportSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#ccc', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  modalCloseBtnText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#000' },

  menuList: { backgroundColor: '#f5f5f5', marginHorizontal: 20, borderRadius: 16, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  menuIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e8e8e8', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuIconText: { fontSize: 16 },
  menuItemContent: { flex: 1 },
  menuItemTitle: { fontSize: 15, fontWeight: '700', color: '#000', marginBottom: 2 },
  menuItemDesc: { fontSize: 12, color: '#888' },
  menuArrow: { fontSize: 24, color: '#ccc', fontWeight: '300' },
  menuDivider: { height: 1, backgroundColor: '#e0e0e0', marginHorizontal: 16 },

  // 報告モーダル
  reportLabel: { fontSize: 15, fontWeight: '600', color: '#333', marginHorizontal: 20, marginBottom: 10 },
  reportInput: { backgroundColor: '#f5f5f5', marginHorizontal: 20, borderRadius: 14, padding: 16, fontSize: 15, color: '#000', minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#e0e0e0' },
  reportHint: { color: '#888', fontSize: 12, marginHorizontal: 20, marginTop: 8 },
  reportSubmitBtn: { backgroundColor: '#FF3B30', marginHorizontal: 20, marginTop: 20, paddingVertical: 16, borderRadius: 50, alignItems: 'center' },
  reportSubmitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  categoryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', marginHorizontal: 20, marginBottom: 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  categoryBtnActive: { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  categoryIcon: { fontSize: 20, marginRight: 12 },
  categoryLabel: { flex: 1, fontSize: 14, color: '#333' },
  categoryCheck: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
