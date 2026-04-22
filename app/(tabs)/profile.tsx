import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Image, Switch, ActivityIndicator } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { auth } from '../../src/config/firebase';
import { getCollection, setDocument } from '../../src/config/firestoreApi';
import * as Notifications from 'expo-notifications';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      AsyncStorage.getItem(`profile_data_${user.uid}`)
        .then((data) => {
          if (data) setProfile(JSON.parse(data));
        })
        .catch(() => {});
      // 通知設定を読み込み
      AsyncStorage.getItem(`notifications_enabled_${user.uid}`)
        .then((val) => {
          if (val !== null) setNotificationsEnabled(val === 'true');
        })
        .catch(() => {});
    }, [user])
  );

  const handleToggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    if (user) {
      await AsyncStorage.setItem(`notifications_enabled_${user.uid}`, value.toString());
    }
    if (!value) {
      // 通知トークンを削除してFirestoreからも消す
      if (user) {
        await setDocument('pushTokens', user.uid, {
          token: '',
          disabled: true,
          updatedAt: new Date(),
        });
      }
    } else {
      // 通知を再有効化
      const { registerForPushNotifications } = require('../../src/utils/notifications');
      if (user) {
        registerForPushNotifications(user.uid).catch(() => {});
      }
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'アカウント削除',
      'アカウントを完全に削除します。この操作は取り消せません。\n\n・プロフィール\n・投稿ストーリー\n・マッチ/ライク履歴\n・身分証画像\n・その他全データ\n\nが即座に完全削除されます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            setDeleting(true);
            try {
              const idToken = await auth.currentUser!.getIdToken();
              const res = await fetch(
                'https://asia-northeast1-spice-app-7ca98.cloudfunctions.net/deleteUserAccount',
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({}),
                }
              );
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `削除API失敗: ${res.status}`);
              }

              // ローカルデータ削除
              await AsyncStorage.multiRemove([
                `profile_${user.uid}`,
                `profile_data_${user.uid}`,
                `last_post_${user.uid}`,
                `notifications_enabled_${user.uid}`,
              ]);

              // セッション終了（Authはサーバー側で削除済み）
              try { await signOut(); } catch {}
              router.replace('/(auth)/login');
            } catch (error: any) {
              Alert.alert('エラー', `削除に失敗しました: ${error.message || error}`);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('ログアウト', '本当にログアウトしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>プロフィール</Text>

        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            {profile?.photoUrl ? (
              <Image source={{ uri: profile.photoUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>👤</Text>
            )}
          </View>
          <Text style={styles.userName}>{profile?.name || user?.email || 'ゲスト'}</Text>
          <Text style={styles.userAge}>
            {profile?.age ? `${profile.age}歳` : ''}
          </Text>
          {profile?.tags && profile.tags.length > 0 && (
            <View style={styles.tagRow}>
              {profile.tags.map((tag: string) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>プラン</Text>
          <View style={styles.planCard}>
            <Text style={styles.planName}>フリープラン</Text>
            <TouchableOpacity style={styles.upgradeBtn}>
              <Text style={styles.upgradeBtnText}>アップグレード</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>設定</Text>
          <View style={styles.optionList}>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => router.push('/(auth)/profile-setup?edit=true')}
            >
              <Text style={styles.optionText}>プロフィール編集</Text>
              <Text style={styles.optionArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => router.push('/friends')}
            >
              <Text style={styles.optionText}>フレンド管理</Text>
              <Text style={styles.optionArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.optionRow}>
              <Text style={styles.optionText}>プッシュ通知</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: '#333', true: '#FF6B35' }}
                thumbColor="#fff"
              />
            </View>
            <TouchableOpacity style={styles.optionRow} onPress={handleLogout}>
              <Text style={[styles.optionText, { color: '#FF3B30' }]}>ログアウト</Text>
              <Text style={styles.optionArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アカウント</Text>
          <View style={styles.optionList}>
            <TouchableOpacity style={styles.optionRow} onPress={handleDeleteAccount} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator size="small" color="#FF3B30" />
              ) : (
                <Text style={[styles.optionText, { color: '#FF3B30' }]}>アカウントを削除</Text>
              )}
              <Text style={styles.optionArrow}>›</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.dangerHint}>削除すると全データが失われます</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>その他</Text>
          <View style={styles.optionList}>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => router.push('/terms')}
            >
              <Text style={styles.optionText}>利用規約</Text>
              <Text style={styles.optionArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => router.push('/privacy')}
            >
              <Text style={styles.optionText}>プライバシーポリシー</Text>
              <Text style={styles.optionArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  scroll: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
    marginBottom: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  avatarImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarText: {
    fontSize: 40,
  },
  userName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 20,
  },
  userAge: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  tag: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  planCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#333',
  },
  planName: {
    color: '#ccc',
    fontWeight: '600',
    fontSize: 15,
  },
  upgradeBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  upgradeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  optionList: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  optionText: {
    color: '#ddd',
    fontSize: 15,
  },
  optionArrow: {
    color: '#555',
    fontSize: 22,
    fontWeight: '300',
  },
  dangerHint: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
    marginLeft: 4,
  },
});
