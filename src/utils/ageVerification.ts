import { Alert } from 'react-native';
import { router } from 'expo-router';
import { getDocument, addDocument } from '../config/firestoreApi';

async function nudgeAdmin(uid: string, userName?: string) {
  try {
    await addDocument('admin_notifications', {
      type: 'verification_nudge',
      userId: uid,
      userName: userName || '',
      message: `${userName || uid} さんが承認を急かしています`,
      createdAt: new Date(),
      read: false,
    });
    Alert.alert('送信しました', '運営に通知が届きました。少々お待ちください 🙏');
  } catch (e: any) {
    Alert.alert('エラー', '通知の送信に失敗しました');
  }
}

/**
 * 相手ユーザーの年齢確認が承認済みかチェック。未承認ならアラート表示して false を返す。
 */
export async function ensurePeerAgeVerified(peerUid: string): Promise<boolean> {
  try {
    const doc = await getDocument('users', peerUid);
    const status = doc?.ageVerificationStatus;
    if (status === 'approved') return true;
    const peerName = doc?.name || peerUid;
    Alert.alert(
      '相手がまだ年齢確認中です',
      'お相手の年齢確認が完了していないため、通話を開始できません。\n承認が完了するまでお待ちください。',
      [
        { text: 'OK', style: 'cancel' },
        {
          text: '運営に承認を促す 📣',
          onPress: () => nudgePeerApproval(peerUid, peerName),
        },
      ],
    );
    return false;
  } catch {
    Alert.alert('エラー', '相手の年齢確認状態を取得できませんでした');
    return false;
  }
}

async function nudgePeerApproval(peerUid: string, peerName: string) {
  try {
    await addDocument('admin_notifications', {
      type: 'peer_verification_nudge',
      userId: peerUid,
      userName: peerName,
      message: `${peerName} さんの年齢確認承認を他のユーザーが待っています`,
      createdAt: new Date(),
      read: false,
    });
    Alert.alert('送信しました', '運営に承認を促す通知を送りました 🙏');
  } catch {
    Alert.alert('エラー', '通知の送信に失敗しました');
  }
}

/**
 * 年齢確認が承認済みかチェック。未承認ならアラート表示して false を返す。
 */
export async function ensureAgeVerified(uid: string): Promise<boolean> {
  try {
    const doc = await getDocument('users', uid);
    const status = doc?.ageVerificationStatus;
    const userName = doc?.name;
    if (status === 'approved') return true;

    if (status === 'pending') {
      Alert.alert(
        '年齢確認中です',
        '提出いただいた身分証を運営が確認しています。\n承認されるまで通話はご利用いただけません。',
        [
          { text: 'OK', style: 'cancel' },
          {
            text: '承認を急かす 📣',
            onPress: () => nudgeAdmin(uid, userName),
          },
        ],
      );
    } else if (status === 'rejected') {
      Alert.alert(
        '年齢確認が承認されませんでした',
        '提出いただいた身分証では年齢確認ができませんでした。\nお手数ですが再度ご提出ください。',
        [
          { text: 'あとで', style: 'cancel' },
          { text: '再提出する', onPress: () => router.push('/verify-intro') },
        ],
      );
    } else {
      // idImageUrl がある = 提出済みだが status 未設定（古いアカウントの可能性）
      // usersPrivate（本人のみアクセス可）から判定
      let hasSubmitted = false;
      try {
        const priv = await getDocument('usersPrivate', uid);
        hasSubmitted = !!priv?.idImageUrl;
      } catch {}
      if (hasSubmitted) {
        Alert.alert(
          '年齢確認中です',
          '提出いただいた身分証を運営が確認しています。\n承認されるまで通話はご利用いただけません。',
          [
            { text: 'OK', style: 'cancel' },
            { text: '承認を急かす 📣', onPress: () => nudgeAdmin(uid, userName) },
          ],
        );
      } else {
        Alert.alert(
          '年齢確認が必要です',
          '通話機能を利用するには、身分証による年齢確認が必要です。',
          [
            { text: 'あとで', style: 'cancel' },
            { text: '今すぐ確認する', onPress: () => router.push('/verify-intro') },
          ],
        );
      }
    }
    return false;
  } catch (e) {
    Alert.alert('エラー', '年齢確認の状態を取得できませんでした');
    return false;
  }
}
