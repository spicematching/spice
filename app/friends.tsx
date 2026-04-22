import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { getCollection, addDocument, setDocument, deleteDocument, getDocument, updateDocument } from '../src/config/firestoreApi';

type FriendItem = {
  docId: string;
  userId: string;
  name: string;
  age: number;
  photoUrl: string;
  status: 'pending_sent' | 'pending_received' | 'accepted';
};

type UserResult = {
  userId: string;
  username: string;
  name: string;
  age: number;
  photoUrl: string;
};

export default function FriendsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [requests, setRequests] = useState<FriendItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [friendUserIds, setFriendUserIds] = useState<Set<string>>(new Set());
  const [pendingUserIds, setPendingUserIds] = useState<Set<string>>(new Set());

  const fetchFriends = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [friendDocs, userDocs] = await Promise.all([
        getCollection('friends'),
        getCollection('users'),
      ]);

      const userMap: Record<string, any> = {};
      for (const doc of userDocs) {
        userMap[doc.id] = doc.data;
      }

      const friendList: FriendItem[] = [];
      const requestList: FriendItem[] = [];
      const fIds = new Set<string>();
      const pIds = new Set<string>();

      for (const doc of friendDocs) {
        const d = doc.data;
        if (d.fromUserId !== user.uid && d.toUserId !== user.uid) continue;

        const otherId = d.fromUserId === user.uid ? d.toUserId : d.fromUserId;
        const otherProfile = userMap[otherId] || {};

        const item: FriendItem = {
          docId: doc.id,
          userId: otherId,
          name: otherProfile.name || 'ゲスト',
          age: otherProfile.age || 0,
          photoUrl: otherProfile.photoUrl || '',
          status: d.status === 'accepted'
            ? 'accepted'
            : d.fromUserId === user.uid
              ? 'pending_sent'
              : 'pending_received',
        };

        if (d.status === 'accepted') {
          friendList.push(item);
          fIds.add(otherId);
        } else if (d.status === 'pending') {
          if (d.toUserId === user.uid) {
            requestList.push(item);
          }
          pIds.add(otherId);
        }
      }

      setFriends(friendList);
      setRequests(requestList);
      setFriendUserIds(fIds);
      setPendingUserIds(pIds);
    } catch (error) {
      console.error('Fetch friends error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchFriends();
    }, [fetchFriends])
  );

  const handleSearch = async () => {
    if (!user || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const userDocs = await getCollection('users');
      const query = searchQuery.trim().toLowerCase().replace(/^@/, '');
      const results: UserResult[] = [];

      for (const doc of userDocs) {
        if (doc.id === user.uid) continue;
        if (doc.data.deleted) continue;
        const uname = (doc.data.username || '').toLowerCase();
        if (uname === query || uname.includes(query)) {
          results.push({
            userId: doc.id,
            username: doc.data.username || '',
            name: doc.data.name || 'ゲスト',
            age: doc.data.age || 0,
            photoUrl: doc.data.photoUrl || '',
          });
        }
      }

      setSearchResults(results);
      if (results.length === 0 && query.length > 0) {
        Alert.alert('見つかりません', `@${query} に一致するユーザーはいません`);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (toUserId: string) => {
    if (!user) return;
    try {
      await addDocument('friends', {
        fromUserId: user.uid,
        toUserId,
        status: 'pending',
        createdAt: new Date(),
      });
      setPendingUserIds((prev) => new Set(prev).add(toUserId));
      Alert.alert('送信しました', 'フレンド申請を送りました');
    } catch (error) {
      Alert.alert('エラー', 'フレンド申請に失敗しました');
    }
  };

  const handleAccept = async (item: FriendItem) => {
    try {
      await updateDocument('friends', item.docId, {
        status: 'accepted',
        acceptedAt: new Date(),
      });
      await fetchFriends();
    } catch (e) {
      console.error('Accept error:', e);
      Alert.alert('エラー', '承認に失敗しました');
    }
  };

  const handleReject = async (item: FriendItem) => {
    try {
      await deleteDocument('friends', item.docId);
      await fetchFriends();
    } catch {
      Alert.alert('エラー', '拒否に失敗しました');
    }
  };

  const handleRemoveFriend = (item: FriendItem) => {
    Alert.alert('フレンド解除', `${item.name}さんをフレンドから外しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '解除する',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDocument('friends', item.docId);
            await fetchFriends();
          } catch {
            Alert.alert('エラー', '解除に失敗しました');
          }
        },
      },
    ]);
  };

  const renderFriend = ({ item }: { item: FriendItem }) => (
    <TouchableOpacity
      style={styles.userRow}
      onLongPress={() => handleRemoveFriend(item)}
      activeOpacity={0.7}
    >
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={styles.userAvatar} />
      ) : (
        <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
          <Text style={{ fontSize: 20 }}>👤</Text>
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        {item.age > 0 && <Text style={styles.userAge}>{item.age}歳</Text>}
      </View>
    </TouchableOpacity>
  );

  const renderRequest = ({ item }: { item: FriendItem }) => (
    <View style={styles.userRow}>
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={styles.userAvatar} />
      ) : (
        <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
          <Text style={{ fontSize: 20 }}>👤</Text>
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        {item.age > 0 && <Text style={styles.userAge}>{item.age}歳</Text>}
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item)}>
          <Text style={styles.acceptBtnText}>承認</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
          <Text style={styles.rejectBtnText}>拒否</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchResult = ({ item }: { item: UserResult }) => {
    const isFriend = friendUserIds.has(item.userId);
    const isPending = pendingUserIds.has(item.userId);

    return (
      <View style={styles.userRow}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.userAvatar} />
        ) : (
          <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
            <Text style={{ fontSize: 20 }}>👤</Text>
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userHandle}>@{item.username}</Text>
        </View>
        {isFriend ? (
          <View style={styles.friendBadge}>
            <Text style={styles.friendBadgeText}>フレンド</Text>
          </View>
        ) : isPending ? (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>申請中</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.addBtn} onPress={() => handleSendRequest(item.userId)}>
            <Text style={styles.addBtnText}>追加</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>フレンド</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* タブ */}
      <View style={styles.tabRow}>
        {(['friends', 'requests', 'search'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <View style={styles.tabContent}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'friends' ? `フレンド${friends.length > 0 ? ` ${friends.length}` : ''}` :
                 tab === 'requests' ? '申請' : '検索'}
              </Text>
              {tab === 'requests' && requests.length > 0 && (
                <View style={styles.requestBadge}>
                  <Text style={styles.requestBadgeText}>{requests.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* コンテンツ */}
      {activeTab === 'search' && (
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="@ユーザーネームで検索"
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchBtnText}>検索</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : activeTab === 'friends' ? (
        friends.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyText}>まだフレンドがいません</Text>
            <Text style={styles.emptyHint}>「検索」タブからフレンドを追加しよう</Text>
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.docId}
            renderItem={renderFriend}
            contentContainerStyle={styles.list}
          />
        )
      ) : activeTab === 'requests' ? (
        requests.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyEmoji}>📩</Text>
            <Text style={styles.emptyText}>フレンド申請はありません</Text>
          </View>
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(item) => item.docId}
            renderItem={renderRequest}
            contentContainerStyle={styles.list}
          />
        )
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.userId}
          renderItem={renderSearchResult}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            searchQuery.trim() && !searching ? (
              <View style={styles.center}>
                <Text style={styles.emptyText}>見つかりませんでした</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { paddingVertical: 4 },
  backBtnText: { color: '#FF6B35', fontSize: 16, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#FF6B35' },
  tabContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { color: '#888', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  requestBadge: {
    backgroundColor: '#FF3B30',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  requestBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  list: { paddingHorizontal: 16 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  userAvatarPlaceholder: {
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: { flex: 1 },
  userName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  userHandle: { color: '#FF6B35', fontSize: 13, marginTop: 2 },
  userAge: { color: '#888', fontSize: 13, marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  acceptBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  rejectBtn: {
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rejectBtnText: { color: '#999', fontWeight: '600', fontSize: 13 },
  addBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  friendBadge: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  friendBadgeText: { color: '#4CD964', fontSize: 13, fontWeight: '600' },
  pendingBadge: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pendingBadgeText: { color: '#FFC107', fontSize: 13, fontWeight: '600' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 16, fontWeight: '600' },
  emptyHint: { color: '#555', fontSize: 13, marginTop: 8 },
});
