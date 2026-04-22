import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { StoryVideo } from '../../src/components/StoryVideo';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { getCollection, addDocument, deleteDocument, setDocument } from '../../src/config/firestoreApi';
import { useAuth } from '../../src/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLastResetTime } from '../../src/utils/resetTime';
import { sendPushNotification } from '../../src/utils/notifications';
import { purchaseFlickBack } from '../../src/utils/purchases';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const CARD_WIDTH = SCREEN_WIDTH - 40;

const BG_COLORS = ['#2c2c3e', '#3e2c2c', '#2c3e2c', '#3e2c3e', '#2c3e3e', '#3e3e2c', '#2c2c2c'];

type GroupMember = {
  userId: string;
  name: string;
  photoUrl: string;
};

type Story = {
  id: string;
  userId: string;
  userName: string;
  userAge: number;
  userGender: string;
  userPhotoUrl: string;
  userTags: string[];
  groupCount: number;
  groupMembers: GroupMember[];
  mediaType: string;
  mediaUrl: string;
  bgColor: string;
  isSuperLike?: boolean;
  superLikeMessage?: string;
};

type TabType = 'recommend' | 'likedMe';

export default function FeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('recommend');
  const [stories, setStories] = useState<Story[]>([]);
  const [likedMeStories, setLikedMeStories] = useState<Story[]>([]);
  const [recommendIndex, setRecommendIndex] = useState(0);
  const [likedMeIndex, setLikedMeIndex] = useState(0);
  const [loadingStories, setLoadingStories] = useState(true);
  const [hasMyStory, setHasMyStory] = useState(false);
  const [showPostPrompt, setShowPostPrompt] = useState(false);
  const postPromptOpacity = useRef(new Animated.Value(0)).current;
  const [superLikeUsed, setSuperLikeUsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSuperLikeModal, setShowSuperLikeModal] = useState(false);
  const [superLikeMessage, setSuperLikeMessage] = useState('');
  const [sendingSuperLike, setSendingSuperLike] = useState(false);
  const [flickBackCount, setFlickBackCount] = useState(0);
  const [showFlickBackModal, setShowFlickBackModal] = useState(false);
  const lastSwipedRef = useRef<{
    tab: TabType;
    index: number;
    story: Story;
    direction: 'right' | 'left';
    swipeDocId?: string;
    likeDocId?: string;
    matchDocId?: string;
  } | null>(null);

  const [friendRequestCount, setFriendRequestCount] = useState(0);
  // 通報・ブロック（ストーリー視聴中）
  const [menuStory, setMenuStory] = useState<Story | null>(null);
  const [showStoryReport, setShowStoryReport] = useState(false);
  const [storyReportCategory, setStoryReportCategory] = useState<string>('');
  const [storyReportReason, setStoryReportReason] = useState('');
  const [submittingStoryReport, setSubmittingStoryReport] = useState(false);

  const REPORT_CATEGORIES = [
    { id: 'inappropriate', label: '不適切なコンテンツ・画像', icon: '🚫' },
    { id: 'harassment', label: '嫌がらせ・暴言', icon: '😡' },
    { id: 'spam', label: 'スパム・宣伝行為', icon: '📧' },
    { id: 'impersonation', label: 'なりすまし・偽プロフィール', icon: '🎭' },
    { id: 'underage', label: '未成年の疑い', icon: '⚠️' },
    { id: 'illegal', label: '違法行為・犯罪行為', icon: '🚨' },
    { id: 'other', label: 'その他', icon: '📝' },
  ];

  const handleBlockStory = (story: Story) => {
    Alert.alert(
      `${story.userName}さんをブロック`,
      'このユーザーのストーリーは今後表示されなくなります。この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ブロックする',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            try {
              await addDocument('blocks', {
                fromUserId: user.uid,
                toUserId: story.userId,
                createdAt: new Date(),
              });
              setMenuStory(null);
              // リストから該当ストーリーを除外
              setStories((prev) => prev.filter((s) => s.userId !== story.userId));
              setLikedMeStories((prev) => prev.filter((s) => s.userId !== story.userId));
              Alert.alert('完了', `${story.userName}さんをブロックしました`);
            } catch (e: any) {
              Alert.alert('エラー', `ブロックに失敗しました: ${e.message || e}`);
            }
          },
        },
      ]
    );
  };

  const handleStoryReport = async () => {
    if (!menuStory || !user) return;
    if (!storyReportCategory) {
      Alert.alert('入力エラー', '報告カテゴリを選択してください');
      return;
    }
    setSubmittingStoryReport(true);
    try {
      let reporterName = '(名前未設定)';
      try {
        const pd = await AsyncStorage.getItem(`profile_data_${user.uid}`);
        if (pd) reporterName = JSON.parse(pd).name || reporterName;
      } catch {}

      await addDocument('reports', {
        reporterUserId: user.uid,
        reporterName,
        reportedUserId: menuStory.userId,
        reportedUserName: menuStory.userName,
        storyId: menuStory.id,
        category: storyReportCategory,
        reason: storyReportReason.trim(),
        createdAt: new Date(),
      });
      await addDocument('admin_notifications', {
        type: 'user_report',
        userId: menuStory.userId,
        userName: menuStory.userName,
        reporterUserId: user.uid,
        reporterName,
        category: storyReportCategory,
        reason: storyReportReason.trim(),
        message: `${reporterName} さんが ${menuStory.userName} さんを通報しました（${storyReportCategory}）`,
        createdAt: new Date(),
        read: false,
      });
      setShowStoryReport(false);
      setStoryReportReason('');
      setStoryReportCategory('');
      setMenuStory(null);
      Alert.alert('報告完了', '運営チームが24時間以内に確認し、適切に対応いたします。ご報告ありがとうございます。');
    } catch (e: any) {
      Alert.alert('エラー', `報告に失敗しました: ${e.message || e}`);
    } finally {
      setSubmittingStoryReport(false);
    }
  };

  const position = useRef(new Animated.ValueXY()).current;

  const fetchRef = useRef(0);

  // フリックバック残数を読み込み
  useEffect(() => {
    if (!user) return;
    AsyncStorage.getItem(`flickback_count_${user.uid}`)
      .then((val) => setFlickBackCount(val ? parseInt(val, 10) : 0))
      .catch(() => {});
  }, [user]);

  const doFetch = useCallback(async () => {
    if (!user) return;
    const fetchId = ++fetchRef.current;

    const fetchStories = async () => {
        try {
          // 自分の性別を取得
          let myGender = '';
          try {
            const profileData = await AsyncStorage.getItem(`profile_data_${user.uid}`);
            if (profileData) {
              const profile = JSON.parse(profileData);
              myGender = profile.gender || '';
            }
          } catch {}
          const oppositeGender = myGender === 'male' ? 'female' : myGender === 'female' ? 'male' : '';

          // 全データを並列取得（ブロックも含む）
          const [storiesDocs, likesDocs, swipesDocs, usersDocs, blockDocs, friendDocs] = await Promise.all([
            getCollection('stories'),
            getCollection('likes'),
            getCollection('swipes'),
            getCollection('users'),
            getCollection('blocks').catch(() => []),
            getCollection('friends').catch(() => []),
          ]);

          // フレンド申請数をカウント
          const pendingCount = friendDocs.filter(
            (d: any) => d.data.toUserId === user.uid && d.data.status === 'pending'
          ).length;
          setFriendRequestCount(pendingCount);
          if (fetchId !== fetchRef.current) return; // 古いリクエストは無視

          const blockedIds = new Set<string>();
          for (const doc of blockDocs) {
            if (doc.data.fromUserId === user.uid) blockedIds.add(doc.data.toUserId);
            if (doc.data.toUserId === user.uid) blockedIds.add(doc.data.fromUserId);
          }

          const resetTime = getLastResetTime();

          // --- 自分のストーリーが今日のサイクルにあるか ---
          const myStoryExists = storiesDocs.some((doc: any) => {
            if (doc.data.userId !== user.uid) return false;
            const created = doc.data.createdAt instanceof Date
              ? doc.data.createdAt : new Date(doc.data.createdAt || 0);
            return created >= resetTime;
          });

          // --- ストーリーをパース ---
          const seenUsers = new Set<string>();
          const allStories: Story[] = [];
          const sorted = storiesDocs
            .filter((doc: any) => doc.data.userId !== user.uid)
            .sort((a: any, b: any) => {
              const aDate = a.data.createdAt instanceof Date ? a.data.createdAt : new Date(a.data.createdAt || 0);
              const bDate = b.data.createdAt instanceof Date ? b.data.createdAt : new Date(b.data.createdAt || 0);
              return bDate.getTime() - aDate.getTime();
            });

          for (const doc of sorted) {
            const created = doc.data.createdAt instanceof Date
              ? doc.data.createdAt : new Date(doc.data.createdAt || 0);
            if (created < resetTime) continue;
            if (blockedIds.has(doc.data.userId)) continue;
            if (oppositeGender && doc.data.userGender && doc.data.userGender !== oppositeGender) continue;
            if (seenUsers.has(doc.data.userId)) continue;
            seenUsers.add(doc.data.userId);

            allStories.push({
              id: doc.id,
              userId: doc.data.userId,
              userName: doc.data.userName || 'ゲスト',
              userAge: doc.data.userAge || 0,
              userGender: doc.data.userGender || '',
              userPhotoUrl: doc.data.userPhotoUrl || '',
              userTags: doc.data.userTags || [],
              groupCount: doc.data.groupCount || 1,
              groupMembers: doc.data.groupMembers || [],
              mediaType: doc.data.mediaType || 'photo',
              mediaUrl: doc.data.mediaUrl || '',
              bgColor: BG_COLORS[allStories.length % BG_COLORS.length],
            });
          }

          // --- 自分にLikeしてくれた人（今日のサイクル） ---
          const likerIds = new Set<string>();
          const superLikerInfo: Record<string, string> = {}; // userId -> message
          let mySuperLikeUsed = false;
          for (const doc of likesDocs) {
            const likeDate = doc.data.createdAt instanceof Date
              ? doc.data.createdAt : new Date(doc.data.createdAt || 0);
            if (likeDate < resetTime) continue;

            if (doc.data.toUserId === user.uid) {
              likerIds.add(doc.data.fromUserId);
              if (doc.data.isSuperLike) {
                superLikerInfo[doc.data.fromUserId] = doc.data.message || '';
              }
            }
            if (doc.data.fromUserId === user.uid && doc.data.isSuperLike) {
              mySuperLikeUsed = true;
            }
          }

          // --- 自分が既にスワイプ済み（今日のサイクル） ---
          const swipedStoryIds = new Set<string>();
          const swipedUserIds = new Set<string>();
          for (const doc of swipesDocs) {
            if (doc.data.fromUserId === user.uid) {
              const swipeDate = doc.data.createdAt instanceof Date
                ? doc.data.createdAt : new Date(doc.data.createdAt || 0);
              if (swipeDate >= resetTime) {
                swipedStoryIds.add(doc.data.storyId);
                swipedUserIds.add(doc.data.toUserId);
              }
            }
          }

          // --- ストーリーがあるユーザーの振り分け ---
          const unswiped = allStories.filter((s) => !swipedStoryIds.has(s.id));
          const fromLikers: Story[] = unswiped
            .filter((s) => likerIds.has(s.userId))
            .map((s) => ({
              ...s,
              isSuperLike: !!superLikerInfo[s.userId],
              superLikeMessage: superLikerInfo[s.userId] || '',
            }));
          const recommend = unswiped.filter((s) => !likerIds.has(s.userId));

          // --- ストーリーがないがLikeしてくれた人をプロフィールから補完 ---
          const storyUserIds = new Set(allStories.map((s) => s.userId));
          const userProfiles: Record<string, any> = {};
          for (const doc of usersDocs) {
            userProfiles[doc.id] = doc.data;
          }

          for (const likerId of likerIds) {
            // 既にストーリーがある or ブロック済み or 既にスワイプ済みならスキップ
            if (storyUserIds.has(likerId) || blockedIds.has(likerId) || swipedUserIds.has(likerId)) continue;
            const profile = userProfiles[likerId];
            if (!profile) continue;
            // 異性チェック
            if (oppositeGender && profile.gender && profile.gender !== oppositeGender) continue;

            fromLikers.push({
              id: `profile-${likerId}`,
              userId: likerId,
              userName: profile.name || 'ゲスト',
              userAge: profile.age || 0,
              userGender: profile.gender || '',
              userPhotoUrl: profile.photoUrl || '',
              userTags: profile.tags || [],
              groupCount: 1,
              groupMembers: [],
              mediaType: 'none',
              mediaUrl: '',
              bgColor: BG_COLORS[fromLikers.length % BG_COLORS.length],
              isSuperLike: !!superLikerInfo[likerId],
              superLikeMessage: superLikerInfo[likerId] || '',
            });
          }

          // 画像プリフェッチ
          [...recommend, ...fromLikers].forEach((s) => {
            if (s.mediaUrl && s.mediaUrl.startsWith('http') && s.mediaType === 'photo') {
              Image.prefetch(s.mediaUrl).catch(() => {});
            }
            if (s.userPhotoUrl && s.userPhotoUrl.startsWith('http')) {
              Image.prefetch(s.userPhotoUrl).catch(() => {});
            }
          });

          // スーパーライクを先頭に優先表示
          fromLikers.sort((a, b) => (b.isSuperLike ? 1 : 0) - (a.isSuperLike ? 1 : 0));

          if (fetchId === fetchRef.current) {
            setStories(recommend);
            setLikedMeStories(fromLikers);
            setRecommendIndex(0);
            setLikedMeIndex(0);
            setHasMyStory(myStoryExists);
            setSuperLikeUsed(mySuperLikeUsed);
            setLoadingStories(false);
          }
        } catch (error) {
          console.error('Fetch stories error:', error);
          if (fetchId === fetchRef.current) {
            setLoadingStories(false);
          }
        }
      };

    setLoadingStories(true);
    await fetchStories();
  }, [user]);

  // タブに戻るたびに最新データを取得
  useFocusEffect(
    useCallback(() => {
      doFetch();
    }, [doFetch])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await doFetch();
    setRefreshing(false);
  }, [doFetch]);

  const handleFlickBack = useCallback(async () => {
    if (!user || !lastSwipedRef.current) return;
    const last = lastSwipedRef.current;

    // スワイプ・ライク・マッチのドキュメントを削除
    const deletions: Promise<void>[] = [];
    if (last.swipeDocId) deletions.push(deleteDocument('swipes', last.swipeDocId).catch(() => {}));
    if (last.likeDocId) deletions.push(deleteDocument('likes', last.likeDocId).catch(() => {}));
    if (last.matchDocId) deletions.push(deleteDocument('matches', last.matchDocId).catch(() => {}));
    await Promise.all(deletions);

    // インデックスを戻す
    const setIdx = last.tab === 'recommend' ? setRecommendIndex : setLikedMeIndex;
    setIdx((prev: number) => Math.max(prev - 1, 0));

    // 残数を減らして保存
    const newCount = flickBackCount - 1;
    setFlickBackCount(newCount);
    AsyncStorage.setItem(`flickback_count_${user.uid}`, String(newCount)).catch(() => {});

    lastSwipedRef.current = null;
    setShowFlickBackModal(false);
    position.setValue({ x: 0, y: 0 });
  }, [user, activeTab, flickBackCount, position]);

  const [purchasing, setPurchasing] = useState(false);

  const handlePurchaseFlickBack = useCallback(async () => {
    if (!user || purchasing) return;
    setPurchasing(true);
    try {
      const success = await purchaseFlickBack();
      if (!success) {
        // ユーザーがキャンセル
        setPurchasing(false);
        return;
      }
      const newCount = flickBackCount + 1;
      setFlickBackCount(newCount);
      await AsyncStorage.setItem(`flickback_count_${user.uid}`, String(newCount));
    } catch (error: any) {
      Alert.alert('購入エラー', error.message || '購入に失敗しました');
    } finally {
      setPurchasing(false);
    }
  }, [user, flickBackCount, purchasing]);

  const handleSendSuperLike = useCallback(async () => {
    if (!user || sendingSuperLike) return;
    const story = (activeTab === 'recommend' ? stories : likedMeStories)[
      activeTab === 'recommend' ? recommendIndex : likedMeIndex
    ];
    if (!story) return;

    setSendingSuperLike(true);
    try {
      await addDocument('likes', {
        fromUserId: user.uid,
        toUserId: story.userId,
        storyId: story.id,
        isSuperLike: true,
        message: superLikeMessage.trim(),
        createdAt: new Date(),
      });

      // スワイプ記録
      addDocument('swipes', {
        fromUserId: user.uid,
        toUserId: story.userId,
        storyId: story.id,
        action: 'superlike',
        createdAt: new Date(),
      }).catch(() => {});

      setSuperLikeUsed(true);
      setShowSuperLikeModal(false);
      setSuperLikeMessage('');

      // スーパーライク通知を相手に送信
      let myName = 'ゲスト';
      try {
        const pd = await AsyncStorage.getItem(`profile_data_${user.uid}`);
        if (pd) myName = JSON.parse(pd).name || 'ゲスト';
      } catch {}
      sendPushNotification(
        story.userId,
        '⭐ スーパーライクが届きました！',
        `${myName}さんからスーパーライク！`,
        { type: 'superlike' },
      ).catch(() => {});

      // マッチ判定（相手からタブ or 相手が既にLike済み）
      let isMatch = false;
      const resetTime = getLastResetTime();

      if (activeTab === 'likedMe') {
        isMatch = true;
      } else {
        try {
          const likesDocs = await getCollection('likes');
          isMatch = likesDocs.some((d) => {
            if (d.data.fromUserId !== story.userId || d.data.toUserId !== user.uid) return false;
            const likeDate = d.data.createdAt instanceof Date
              ? d.data.createdAt : new Date(d.data.createdAt || 0);
            return likeDate >= resetTime;
          });
        } catch {}
      }

      if (isMatch) {
        let alreadyMatched = false;
        try {
          const matchesDocs = await getCollection('matches');
          alreadyMatched = matchesDocs.some((d) => {
            if (!d.data.users || d.data.unmatched) return false;
            const hasMe = d.data.users.includes(user.uid);
            const hasOther = d.data.users.includes(story.userId);
            if (!hasMe || !hasOther) return false;
            const matchDate = d.data.createdAt instanceof Date
              ? d.data.createdAt : new Date(d.data.createdAt || 0);
            return matchDate >= resetTime;
          });
        } catch {}

        if (!alreadyMatched) {
          await addDocument('matches', {
            users: [user.uid, story.userId],
            createdAt: new Date(),
          });

          sendPushNotification(
            story.userId,
            'マッチング成立!',
            `${myName}さんとマッチしました！`,
            { type: 'match' },
          ).catch(() => {});

          setTimeout(() => {
            router.push({
              pathname: '/match-modal',
              params: {
                name: story.userName,
                age: story.userAge.toString(),
                count: story.groupCount.toString(),
                area: '',
                photoUrl: story.userPhotoUrl,
                matchUserId: story.userId,
              },
            });
          }, 300);
        }
      }

      // カードを進める
      const setIdx = activeTab === 'recommend' ? setRecommendIndex : setLikedMeIndex;
      setIdx((prev: number) => prev + 1);
      position.setValue({ x: 0, y: 0 });
    } catch (error) {
      console.error('Super like error:', error);
    } finally {
      setSendingSuperLike(false);
    }
  }, [user, activeTab, stories, likedMeStories, recommendIndex, likedMeIndex, superLikeMessage, sendingSuperLike, router, position]);

  const groups = activeTab === 'recommend' ? stories : likedMeStories;
  const currentIndex = activeTab === 'recommend' ? recommendIndex : likedMeIndex;
  const setCurrentIndex = activeTab === 'recommend' ? setRecommendIndex : setLikedMeIndex;

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-8deg', '0deg', '8deg'],
    extrapolate: 'clamp',
  });
  const likeOpacity = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH / 6],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const skipOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 6, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const nextScale = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: [1, 0.95, 1],
    extrapolate: 'clamp',
  });
  const superLikeOpacity = position.y.interpolate({
    inputRange: [-80, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const handleSwipeComplete = useCallback(
    async (direction: 'right' | 'left') => {
      if (!user || currentIndex >= groups.length) {
        setCurrentIndex((prev: number) => prev + 1);
        position.setValue({ x: 0, y: 0 });
        return;
      }

      const story = groups[currentIndex];
      const action = direction === 'right' ? 'like' : 'skip';
      let swipeDocId: string | undefined;
      let likeDocId: string | undefined;
      let matchDocId: string | undefined;

      // スワイプ記録をREST APIで保存
      try {
        // スワイプ記録
        const swipeDoc = await addDocument('swipes', {
          fromUserId: user.uid,
          toUserId: story.userId,
          storyId: story.id,
          action,
          createdAt: new Date(),
        });
        swipeDocId = swipeDoc?.id;

        if (direction === 'right') {
          // Likeを保存（awaitで確実に保存してからマッチ判定）
          const likeDoc = await addDocument('likes', {
            fromUserId: user.uid,
            toUserId: story.userId,
            storyId: story.id,
            createdAt: new Date(),
          });
          likeDocId = likeDoc?.id;

          // マッチング判定：相手が今日のサイクルで自分にLikeしているか
          let isMatch = false;
          const resetTime = getLastResetTime();

          if (activeTab === 'likedMe') {
            // 「相手から」タブ = 相手は既に自分にLike済み → 自分がLikeしたら即マッチ
            isMatch = true;
          } else {
            // 「おすすめ」タブ = 相手のLikeを今日のサイクルでチェック
            try {
              const likesDocs = await getCollection('likes');
              isMatch = likesDocs.some((d) => {
                if (d.data.fromUserId !== story.userId || d.data.toUserId !== user.uid) return false;
                const likeDate = d.data.createdAt instanceof Date
                  ? d.data.createdAt
                  : new Date(d.data.createdAt || 0);
                return likeDate >= resetTime;
              });
            } catch {}
          }

          if (isMatch) {
            // 既にマッチ済みか確認（重複防止）
            let alreadyMatched = false;
            try {
              const matchesDocs = await getCollection('matches');
              alreadyMatched = matchesDocs.some((d) => {
                if (!d.data.users || d.data.unmatched) return false;
                const hasMe = d.data.users.includes(user.uid);
                const hasOther = d.data.users.includes(story.userId);
                if (!hasMe || !hasOther) return false;
                const matchDate = d.data.createdAt instanceof Date
                  ? d.data.createdAt
                  : new Date(d.data.createdAt || 0);
                return matchDate >= resetTime;
              });
            } catch {}

            if (!alreadyMatched) {
              const matchDoc = await addDocument('matches', {
                users: [user.uid, story.userId],
                createdAt: new Date(),
              });
              matchDocId = matchDoc?.id;

              // マッチ通知を相手に送信
              let myName = 'ゲスト';
              try {
                const pd = await AsyncStorage.getItem(`profile_data_${user.uid}`);
                if (pd) myName = JSON.parse(pd).name || 'ゲスト';
              } catch {}
              sendPushNotification(
                story.userId,
                'マッチング成立!',
                `${myName}さんとマッチしました！`,
                { type: 'match' },
              ).catch(() => {});

              setTimeout(() => {
                router.push({
                  pathname: '/match-modal',
                  params: {
                    name: story.userName,
                    age: story.userAge.toString(),
                    count: story.groupCount.toString(),
                    area: '',
                    photoUrl: story.userPhotoUrl,
                    matchUserId: story.userId,
                  },
                });
              }, 300);
            }
          }
        }
      } catch (error) {
        console.error('Swipe record error:', error);
      }

      // フリックバック用に最後のスワイプを記録（パス[左]のみ対象。ライク・マッチはバック不可）
      if (direction === 'left') {
        lastSwipedRef.current = {
          tab: activeTab,
          index: currentIndex,
          story,
          direction,
          swipeDocId,
          likeDocId,
          matchDocId,
        };
      } else {
        lastSwipedRef.current = null;
      }

      setCurrentIndex((prev: number) => prev + 1);
      position.setValue({ x: 0, y: 0 });
    },
    [currentIndex, groups, activeTab, router, position, setCurrentIndex, user],
  );

  const showPostPromptBanner = useCallback(() => {
    setShowPostPrompt(true);
    postPromptOpacity.setValue(0);
    Animated.timing(postPromptOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    // 3秒後に自動で消す
    setTimeout(() => {
      Animated.timing(postPromptOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowPostPrompt(false));
    }, 3000);
  }, [postPromptOpacity]);

  const swipeCard = useCallback(
    (direction: 'right' | 'left') => {
      // 未投稿→ バウンスバックして促す
      if (!hasMyStory) {
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          friction: 6,
        }).start();
        showPostPromptBanner();
        return;
      }
      const toX = direction === 'right' ? SCREEN_WIDTH + 100 : -SCREEN_WIDTH - 100;
      Animated.timing(position, {
        toValue: { x: toX, y: 0 },
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        handleSwipeComplete(direction);
      });
    },
    [position, handleSwipeComplete, hasMyStory, showPostPromptBanner],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
        onPanResponderMove: (_, gesture) => {
          if (!hasMyStory) {
            position.setValue({ x: gesture.dx * 0.3, y: gesture.dy * 0.1 });
          } else {
            position.setValue({ x: gesture.dx, y: Math.min(gesture.dy * 0.5, 0) + Math.max(gesture.dy * 0.2, 0) });
          }
        },
        onPanResponderRelease: (_, gesture) => {
          const SWIPE_UP_THRESHOLD = 120;
          if (gesture.dy < -SWIPE_UP_THRESHOLD && hasMyStory && !superLikeUsed) {
            // 上スワイプ → スーパーライクモーダル
            Animated.spring(position, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
              friction: 6,
            }).start();
            setShowSuperLikeModal(true);
          } else if (gesture.dx > SWIPE_THRESHOLD) {
            swipeCard('right');
          } else if (gesture.dx < -SWIPE_THRESHOLD) {
            swipeCard('left');
          } else {
            Animated.spring(position, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
              friction: 6,
            }).start();
          }
        },
      }),
    [position, swipeCard, hasMyStory, superLikeUsed],
  );

  const handleTabChange = (tab: TabType) => {
    if (tab === activeTab) return;
    position.setValue({ x: 0, y: 0 });
    setActiveTab(tab);
  };

  const renderCard = (story: Story, isTop: boolean) => {
    const animatedStyle = isTop
      ? {
          transform: [
            { translateX: position.x },
            { translateY: position.y },
            { rotate },
          ],
          zIndex: 2,
        }
      : {
          transform: [{ scale: nextScale }],
          zIndex: 1,
        };

    return (
      <Animated.View
        key={story.id}
        style={[styles.card, animatedStyle]}
        {...(isTop ? panResponder.panHandlers : {})}
      >
        <View style={[styles.cardBg, { backgroundColor: story.bgColor }]}>
          {story.mediaUrl && story.mediaUrl.startsWith('http') ? (
            story.mediaType === 'video' ? (
              <StoryVideo uri={story.mediaUrl} active={isTop} />
            ) : (
              <Image
                source={{ uri: story.mediaUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                fadeDuration={200}
              />
            )
          ) : (
            <View style={styles.videoArea}>
              <Text style={styles.videoEmoji}>
                {story.mediaType === 'video' ? '🎬' : '📸'}
              </Text>
            </View>
          )}
        </View>

        {isTop && user && story.userId !== user.uid && (
          <TouchableOpacity
            style={styles.storyMenuBtn}
            onPress={() => setMenuStory(story)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.storyMenuIcon}>⋯</Text>
          </TouchableOpacity>
        )}

        {activeTab === 'likedMe' && (
          <View style={story.isSuperLike ? styles.superLikeBadge : styles.likedBadge}>
            <Text style={styles.likedBadgeText}>
              {story.isSuperLike ? '⭐ スーパーライク！' : '❤️ あなたにLike中！'}
            </Text>
          </View>
        )}

        {activeTab === 'likedMe' && story.isSuperLike && story.superLikeMessage ? (
          <View style={styles.superLikeMessageBox}>
            <Text style={styles.superLikeMessageText} numberOfLines={3}>
              "{story.superLikeMessage}"
            </Text>
          </View>
        ) : null}

        {isTop && (
          <>
            <Animated.View
              style={[styles.overlay, styles.likeOverlay, { opacity: likeOpacity }]}
            >
              <Text style={styles.overlayIcon}>❤️</Text>
              <Text style={styles.overlayText}>いいかも！</Text>
            </Animated.View>
            <Animated.View
              style={[styles.overlay, styles.skipOverlay, { opacity: skipOpacity }]}
            >
              <Text style={styles.overlayIcon}>🌀</Text>
              <Text style={styles.overlayText}>イマイチ...</Text>
            </Animated.View>
            {!superLikeUsed && hasMyStory && (
              <Animated.View
                style={[styles.overlay, styles.superLikeOverlay, { opacity: superLikeOpacity }]}
              >
                <Text style={styles.overlayIcon}>⭐</Text>
                <Text style={styles.overlayText}>スーパーライク！</Text>
              </Animated.View>
            )}
          </>
        )}

        <View style={styles.cardBottom}>
          <View style={styles.cardInfoRow}>
            <View style={styles.cardInfoLeft}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {story.userPhotoUrl ? (
                  <Image source={{ uri: story.userPhotoUrl }} style={styles.cardAvatar} />
                ) : (
                  <View style={[styles.cardAvatar, { backgroundColor: '#555', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 16 }}>👤</Text>
                  </View>
                )}
                <Text style={styles.nameText}>
                  {story.userName}
                  {story.userAge > 0 && (
                    <Text style={styles.ageText}> {story.userAge}</Text>
                  )}
                </Text>
              </View>
            </View>
            <View style={styles.groupBadge}>
              <Text style={styles.groupBadgeText}>👥 {story.groupCount}人</Text>
              {story.groupMembers.length > 0 && (
                <View style={styles.groupMemberAvatars}>
                  {story.groupMembers.slice(0, 3).map((m) => (
                    m.photoUrl ? (
                      <Image key={m.userId} source={{ uri: m.photoUrl }} style={styles.groupMemberAvatar} />
                    ) : (
                      <View key={m.userId} style={[styles.groupMemberAvatar, { backgroundColor: '#555', alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 8 }}>👤</Text>
                      </View>
                    )
                  ))}
                </View>
              )}
            </View>
          </View>
          {story.userTags.length > 0 && (
            <View style={styles.tagRow}>
              {story.userTags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  const isFinished = currentIndex >= groups.length;
  const likedMeRemaining = likedMeStories.length - likedMeIndex;

  if (loadingStories) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={{ color: '#888', marginTop: 12 }}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ── ヘッダー：タブ切り替え ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
        <View style={styles.headerSpacer} />
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={styles.tabBtn}
            onPress={() => handleTabChange('recommend')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'recommend' && styles.tabTextActive,
              ]}
            >
              おすすめ
            </Text>
            {activeTab === 'recommend' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>

          <View style={styles.tabDivider} />

          <TouchableOpacity
            style={styles.tabBtn}
            onPress={() => handleTabChange('likedMe')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'likedMe' && styles.tabTextActive,
              ]}
            >
              相手から
            </Text>
            {likedMeRemaining > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{likedMeRemaining}</Text>
              </View>
            )}
            {activeTab === 'likedMe' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>

        </View>
        <TouchableOpacity
          style={styles.friendIconBtn}
          onPress={() => router.push('/friends')}
          activeOpacity={0.7}
        >
          <Text style={styles.friendIconEmoji}>👥+</Text>
          {friendRequestCount > 0 && (
            <View style={styles.friendRequestBadge}>
              <Text style={styles.friendRequestBadgeText}>{friendRequestCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.cardArea}
        contentContainerStyle={isFinished ? styles.cardAreaEmpty : styles.cardAreaFull}
        scrollEnabled={isFinished}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FF6B35"
            colors={['#FF6B35']}
          />
        }
      >
        {isFinished ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>
              {activeTab === 'recommend' ? '🌶️' : '💌'}
            </Text>
            <Text style={styles.emptyTitle}>
              {groups.length === 0 && currentIndex === 0
                ? activeTab === 'recommend'
                  ? 'まだ投稿がありません'
                  : 'まだLikeはありません'
                : activeTab === 'recommend'
                  ? '今夜のグループは以上！'
                  : 'Likeしてくれた人は以上！'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {groups.length === 0 && currentIndex === 0
                ? '友達を招待してストーリーを投稿してもらおう'
                : '下に引っ張って新しい投稿をチェック'}
            </Text>
          </View>
        ) : (
          <View style={styles.cardStack}>
            {currentIndex + 1 < groups.length &&
              renderCard(groups[currentIndex + 1], false)}
            {renderCard(groups[currentIndex], true)}
          </View>
        )}
      </ScrollView>

      {/* ── 投稿促進バナー ── */}
      {showPostPrompt && (
        <Animated.View style={[styles.postPromptBanner, { opacity: postPromptOpacity }]}>
          <View style={styles.postPromptContent}>
            <Text style={styles.postPromptText}>
              ライクするにはまず自分のストーリーを投稿しよう!
            </Text>
            <TouchableOpacity
              style={styles.postPromptBtn}
              onPress={() => {
                setShowPostPrompt(false);
                router.push('/(tabs)/post');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.postPromptBtnText}>投稿する</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* ── アクションボタン ── */}
      <View style={styles.actionsWrapper}>
        {/* フリックバック（小さめ・左端） */}
        <TouchableOpacity
          style={[styles.flickBackBtnSmall, lastSwipedRef.current ? styles.flickBackBtn : styles.flickBackBtnDisabled]}
          onPress={() => {
            if (!lastSwipedRef.current) return;
            setShowFlickBackModal(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.flickBackIcon, !lastSwipedRef.current && styles.actionBtnIconDim]}>↩️</Text>
          {flickBackCount > 0 && (
            <View style={styles.flickBackBadge}>
              <Text style={styles.flickBackBadgeText}>{flickBackCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* メインボタン（スキップ・スーパーライク・ライク） */}
        {!isFinished && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, !hasMyStory ? styles.skipActionBtnDisabled : styles.skipActionBtn]}
              onPress={() => {
                if (!hasMyStory) { showPostPromptBanner(); return; }
                swipeCard('left');
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionBtnIcon, !hasMyStory && styles.actionBtnIconDim]}>🌀</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                !hasMyStory || superLikeUsed ? styles.superLikeBtnDisabled : styles.superLikeBtn,
              ]}
              onPress={() => {
                if (!hasMyStory) { showPostPromptBanner(); return; }
                if (superLikeUsed) return;
                setShowSuperLikeModal(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionBtnIcon, (!hasMyStory || superLikeUsed) && styles.actionBtnIconDim]}>⭐</Text>
              {hasMyStory && !superLikeUsed && <View style={styles.superLikeDot} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, !hasMyStory ? styles.likeActionBtnDisabled : styles.likeActionBtn]}
              onPress={() => {
                if (!hasMyStory) { showPostPromptBanner(); return; }
                swipeCard('right');
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionBtnIcon, !hasMyStory && styles.actionBtnIconDim]}>❤️</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 右側スペーサー（フリックバックボタンと対称にする） */}
        <View style={styles.flickBackSpacer} />
      </View>

      {/* ── スーパーライクモーダル ── */}
      <Modal visible={showSuperLikeModal} transparent animationType="slide" onRequestClose={() => setShowSuperLikeModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.slModalBackdrop} activeOpacity={1} onPress={() => setShowSuperLikeModal(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.slModalSheet}>
              <View style={styles.slModalHandle} />
              <Text style={styles.slModalTitle}>⭐ スーパーライク</Text>
              <Text style={styles.slModalDesc}>
                特別な相手にメッセージ付きでアピール!{'\n'}1日1回だけ送れます
              </Text>

              {currentIndex < groups.length && (
                <View style={styles.slTargetRow}>
                  {groups[currentIndex].userPhotoUrl ? (
                    <Image source={{ uri: groups[currentIndex].userPhotoUrl }} style={styles.slTargetAvatar} />
                  ) : (
                    <View style={[styles.slTargetAvatar, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 20 }}>👤</Text>
                    </View>
                  )}
                  <Text style={styles.slTargetName}>
                    {groups[currentIndex].userName}
                    {groups[currentIndex].userAge > 0 && ` ${groups[currentIndex].userAge}歳`}
                  </Text>
                </View>
              )}

              <TextInput
                style={styles.slInput}
                placeholder="メッセージを入力（任意）"
                placeholderTextColor="#666"
                value={superLikeMessage}
                onChangeText={setSuperLikeMessage}
                maxLength={100}
                multiline
              />
              <Text style={styles.slCharCount}>{superLikeMessage.length}/100</Text>

              <TouchableOpacity
                style={[styles.slSendBtn, sendingSuperLike && { opacity: 0.6 }]}
                onPress={handleSendSuperLike}
                disabled={sendingSuperLike}
                activeOpacity={0.8}
              >
                {sendingSuperLike ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.slSendBtnText}>⭐ スーパーライクを送る</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.slCancelBtn} onPress={() => setShowSuperLikeModal(false)}>
                <Text style={styles.slCancelBtnText}>やめる</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── フリックバックモーダル ── */}
      <Modal visible={showFlickBackModal} transparent animationType="fade" onRequestClose={() => setShowFlickBackModal(false)}>
        <TouchableOpacity style={styles.fbModalBackdrop} activeOpacity={1} onPress={() => setShowFlickBackModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.fbModalSheet}>
            <View style={styles.slModalHandle} />
            <Text style={styles.fbModalTitle}>↩️ フリックバック</Text>
            <Text style={styles.fbModalDesc}>
              直前にスワイプした相手をもう一度見ることができます
            </Text>

            {lastSwipedRef.current && (
              <View style={styles.slTargetRow}>
                {lastSwipedRef.current.story.userPhotoUrl ? (
                  <Image source={{ uri: lastSwipedRef.current.story.userPhotoUrl }} style={styles.slTargetAvatar} />
                ) : (
                  <View style={[styles.slTargetAvatar, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 20 }}>👤</Text>
                  </View>
                )}
                <Text style={styles.slTargetName}>{lastSwipedRef.current.story.userName}</Text>
              </View>
            )}

            {flickBackCount > 0 ? (
              <>
                <Text style={styles.fbCountText}>残り {flickBackCount} 回</Text>
                <TouchableOpacity style={styles.fbUseBtn} onPress={handleFlickBack} activeOpacity={0.8}>
                  <Text style={styles.fbUseBtnText}>↩️ フリックバックする</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.fbPriceBox}>
                  <Text style={styles.fbPriceLabel}>フリックバック</Text>
                  <Text style={styles.fbPrice}>¥190</Text>
                  <Text style={styles.fbPriceSub}>1回分</Text>
                </View>
                <TouchableOpacity
                  style={[styles.fbPurchaseBtn, purchasing && { opacity: 0.6 }]}
                  onPress={async () => {
                    await handlePurchaseFlickBack();
                    if (!purchasing) handleFlickBack();
                  }}
                  activeOpacity={0.8}
                  disabled={purchasing}
                >
                  {purchasing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.fbPurchaseBtnText}>¥190で購入してフリックバック</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.slCancelBtn} onPress={() => setShowFlickBackModal(false)}>
              <Text style={styles.slCancelBtnText}>やめる</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* === ストーリー視聴中メニュー === */}
      <Modal visible={!!menuStory && !showStoryReport} transparent animationType="slide" onRequestClose={() => setMenuStory(null)}>
        <TouchableOpacity style={styles.storyMenuBackdrop} activeOpacity={1} onPress={() => setMenuStory(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.storyMenuSheet}>
            <View style={styles.storyMenuHandle} />
            <Text style={styles.storyMenuTitle}>{menuStory?.userName}さん</Text>
            <TouchableOpacity
              style={styles.storyMenuItem}
              onPress={() => setShowStoryReport(true)}
            >
              <Text style={styles.storyMenuItemIcon}>⚠️</Text>
              <Text style={styles.storyMenuItemText}>このユーザーを通報する</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.storyMenuItem}
              onPress={() => menuStory && handleBlockStory(menuStory)}
            >
              <Text style={styles.storyMenuItemIcon}>🚫</Text>
              <Text style={[styles.storyMenuItemText, { color: '#FF3B30' }]}>このユーザーをブロックする</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.storyMenuCancel} onPress={() => setMenuStory(null)}>
              <Text style={styles.storyMenuCancelText}>キャンセル</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* === ストーリー通報入力モーダル === */}
      <Modal visible={showStoryReport} transparent animationType="slide" onRequestClose={() => setShowStoryReport(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.storyMenuBackdrop} activeOpacity={1} onPress={() => setShowStoryReport(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.storyReportSheet}>
              <View style={styles.storyMenuHandle} />
              <Text style={styles.storyMenuTitle}>ユーザーを報告</Text>
              <ScrollView style={{ maxHeight: 500 }}>
                <Text style={styles.storyReportLabel}>報告カテゴリを選択してください</Text>
                <View style={{ marginBottom: 16 }}>
                  {REPORT_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.storyCategoryBtn,
                        storyReportCategory === cat.id && styles.storyCategoryBtnActive,
                      ]}
                      onPress={() => setStoryReportCategory(cat.id)}
                    >
                      <Text style={styles.storyCategoryIcon}>{cat.icon}</Text>
                      <Text
                        style={[
                          styles.storyCategoryLabel,
                          storyReportCategory === cat.id && { color: '#fff', fontWeight: 'bold' },
                        ]}
                      >
                        {cat.label}
                      </Text>
                      {storyReportCategory === cat.id && <Text style={styles.storyCategoryCheck}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.storyReportLabel}>詳細（任意）</Text>
                <TextInput
                  style={styles.storyReportInput}
                  placeholder="具体的な状況があればご記入ください..."
                  placeholderTextColor="#666"
                  value={storyReportReason}
                  onChangeText={setStoryReportReason}
                  multiline
                  maxLength={500}
                />
              </ScrollView>
              <TouchableOpacity
                style={[styles.storyReportSubmitBtn, submittingStoryReport && { opacity: 0.6 }]}
                onPress={handleStoryReport}
                disabled={submittingStoryReport}
              >
                {submittingStoryReport ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.storyReportSubmitText}>報告を送信</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  header: {
    paddingTop: Platform.OS === 'android' ? 40 : 4,
    paddingBottom: 4,
    paddingHorizontal: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 44,
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 0,
  },
  friendIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendIconEmoji: {
    fontSize: 26,
    color: '#ccc',
  },
  friendRequestBadge: {
    position: 'absolute',
    top: 0,
    right: -2,
    backgroundColor: '#FF3B30',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  friendRequestBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tabBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 3,
    backgroundColor: '#FF6B35',
    borderRadius: 2,
  },
  tabDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#444',
    marginHorizontal: 4,
  },
  tabBadge: {
    position: 'absolute',
    top: 4,
    right: 2,
    backgroundColor: '#FF3B30',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardArea: {
    flex: 1,
  },
  cardAreaEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardAreaFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardStack: {
    width: CARD_WIDTH,
    aspectRatio: 0.65,
    maxHeight: '100%',
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoArea: {
    alignItems: 'center',
    opacity: 0.3,
  },
  videoEmoji: {
    fontSize: 64,
  },
  likedBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(255, 59, 48, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    zIndex: 5,
  },
  likedBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  superLikeBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    zIndex: 5,
  },
  superLikeMessageBox: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,193,7,0.5)',
    zIndex: 5,
  },
  superLikeMessageText: {
    color: '#fff',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  likeOverlay: {
    backgroundColor: 'rgba(255, 80, 80, 0.55)',
  },
  skipOverlay: {
    backgroundColor: 'rgba(80, 80, 120, 0.55)',
  },
  superLikeOverlay: {
    backgroundColor: 'rgba(255, 193, 7, 0.55)',
  },
  overlayIcon: {
    fontSize: 72,
  },
  overlayText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  cardBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardInfoLeft: {
    flex: 1,
    marginRight: 8,
  },
  cardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  nameText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  ageText: {
    color: '#ddd',
    fontSize: 18,
    fontWeight: '400',
  },
  groupBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  groupMemberAvatars: {
    flexDirection: 'row',
  },
  groupMemberAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fff',
    marginLeft: -6,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  actionsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  actions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  skipActionBtn: {
    backgroundColor: '#fff',
  },
  skipActionBtnDisabled: {
    backgroundColor: '#444',
  },
  likeActionBtn: {
    backgroundColor: '#fff',
  },
  likeActionBtnDisabled: {
    backgroundColor: '#444',
  },
  actionBtnIcon: {
    fontSize: 28,
  },
  actionBtnIconDim: {
    opacity: 0.3,
  },
  postPromptBanner: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  postPromptContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  postPromptText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  postPromptBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 50,
  },
  postPromptBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  // ── スーパーライクボタン ──
  superLikeBtn: {
    backgroundColor: '#FFC107',
  },
  superLikeBtnDisabled: {
    backgroundColor: '#444',
  },
  superLikeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    borderColor: '#FFC107',
  },
  // ── スーパーライクモーダル ──
  slModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  slModalSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  slModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    marginBottom: 16,
  },
  slModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFC107',
    marginBottom: 8,
  },
  slModalDesc: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  slTargetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    width: '100%',
    marginBottom: 16,
  },
  slTargetAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFC107',
    overflow: 'hidden',
  },
  slTargetName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  slInput: {
    width: '100%',
    backgroundColor: '#2a2a2a',
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    color: '#fff',
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#333',
  },
  slCharCount: {
    alignSelf: 'flex-end',
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  slSendBtn: {
    width: '100%',
    backgroundColor: '#FFC107',
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: 'center',
    marginBottom: 10,
  },
  slSendBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 17,
  },
  slCancelBtn: {
    paddingVertical: 10,
  },
  slCancelBtnText: {
    color: '#666',
    fontSize: 14,
  },
  // ── フリックバック ──
  flickBackBtnSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flickBackBtn: {
    backgroundColor: '#fff',
  },
  flickBackBtnDisabled: {
    backgroundColor: '#333',
  },
  flickBackSpacer: {
    width: 44,
    height: 44,
  },
  flickBackIcon: {
    fontSize: 20,
  },
  flickBackBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#4CD964',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  flickBackBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  fbModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fbModalSheet: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  fbModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  fbModalDesc: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  fbCountText: {
    color: '#4CD964',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  fbUseBtn: {
    width: '100%',
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: 'center',
    marginBottom: 10,
  },
  fbUseBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  fbPriceBox: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  fbPriceLabel: {
    color: '#999',
    fontSize: 13,
    marginBottom: 4,
  },
  fbPrice: {
    color: '#FF6B35',
    fontSize: 32,
    fontWeight: 'bold',
  },
  fbPriceSub: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  fbPurchaseBtn: {
    width: '100%',
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: 'center',
    marginBottom: 10,
  },
  fbPurchaseBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  // --- ストーリー視聴中 メニュー/通報 ---
  storyMenuBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  storyMenuIcon: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: -4,
  },
  storyMenuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  storyMenuSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  storyReportSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  storyMenuHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  storyMenuTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#222',
    marginBottom: 16,
  },
  storyMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  storyMenuItemIcon: {
    fontSize: 20,
    marginRight: 14,
  },
  storyMenuItemText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  storyMenuCancel: {
    marginTop: 8,
    marginHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
  },
  storyMenuCancelText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '600',
  },
  storyReportLabel: { fontSize: 15, fontWeight: '600', color: '#333', marginHorizontal: 20, marginBottom: 10 },
  storyReportInput: { backgroundColor: '#f5f5f5', marginHorizontal: 20, borderRadius: 14, padding: 16, fontSize: 15, color: '#000', minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#e0e0e0' },
  storyReportSubmitBtn: { backgroundColor: '#FF3B30', marginHorizontal: 20, marginTop: 16, paddingVertical: 16, borderRadius: 50, alignItems: 'center' },
  storyReportSubmitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  storyCategoryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', marginHorizontal: 20, marginBottom: 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  storyCategoryBtnActive: { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  storyCategoryIcon: { fontSize: 20, marginRight: 12 },
  storyCategoryLabel: { flex: 1, fontSize: 14, color: '#333' },
  storyCategoryCheck: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
