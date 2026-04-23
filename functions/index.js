const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');

const gmailUser = defineSecret('GMAIL_USER');
const gmailPass = defineSecret('GMAIL_PASS');
const adminEmail = defineSecret('ADMIN_EMAIL');

admin.initializeApp();

function categoryLabel(id) {
  const map = {
    inappropriate: '🚫 不適切なコンテンツ・画像',
    harassment: '😡 嫌がらせ・暴言',
    spam: '📧 スパム・宣伝行為',
    impersonation: '🎭 なりすまし・偽プロフィール',
    underage: '⚠️ 未成年の疑い',
    illegal: '🚨 違法行為・犯罪行為',
    other: '📝 その他',
  };
  return map[id] || id || '未分類';
}

const dailyApiKey = defineSecret('DAILY_API_KEY');

// ==========================================
// アカウント完全削除（Firestore + Storage + Auth を全て削除）
// ==========================================
exports.deleteUserAccount = onRequest(
  { cors: true, region: 'asia-northeast1' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: '認証が必要です' });
      return;
    }

    let uid;
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      res.status(401).json({ error: '無効な認証トークンです' });
      return;
    }

    const db = getFirestore(admin.app(), 'default');
    const bucket = admin.storage().bucket('spice-app-7ca98.firebasestorage.app');
    const deletedLog = {};

    try {
      // ---- Firestore削除 ----
      // 自分のuserドキュメントから画像URLを先に取得（Storageパス抽出用）
      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.exists ? userDoc.data() : {};

      // 単純な「userIdフィールド」で持ってるコレクションを一括削除
      const simpleCollections = ['stories', 'pushTokens', 'locationShares'];
      for (const col of simpleCollections) {
        const snap = await db.collection(col).where('userId', '==', uid).get();
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        if (snap.size > 0) await batch.commit();
        deletedLog[col] = snap.size;
      }
      // pushTokensはドキュメントID = uidの場合もあるので追加で削除
      try {
        await db.collection('pushTokens').doc(uid).delete();
      } catch {}

      // swipes: fromUserId or toUserId
      for (const field of ['fromUserId', 'toUserId']) {
        const snap = await db.collection('swipes').where(field, '==', uid).get();
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        if (snap.size > 0) await batch.commit();
        deletedLog[`swipes_${field}`] = snap.size;
      }

      // likes: fromUserId or toUserId
      for (const field of ['fromUserId', 'toUserId']) {
        const snap = await db.collection('likes').where(field, '==', uid).get();
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        if (snap.size > 0) await batch.commit();
        deletedLog[`likes_${field}`] = snap.size;
      }

      // matches: users配列にuidが含まれる
      const matchSnap = await db
        .collection('matches')
        .where('users', 'array-contains', uid)
        .get();
      const matchBatch = db.batch();
      matchSnap.docs.forEach((d) => matchBatch.delete(d.ref));
      if (matchSnap.size > 0) await matchBatch.commit();
      deletedLog['matches'] = matchSnap.size;

      // calls: callerId or receiverId
      for (const field of ['callerId', 'receiverId']) {
        const snap = await db.collection('calls').where(field, '==', uid).get();
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        if (snap.size > 0) await batch.commit();
        deletedLog[`calls_${field}`] = snap.size;
      }

      // friends: users配列 or fromUserId/toUserId 両方対応
      try {
        const snap = await db
          .collection('friends')
          .where('users', 'array-contains', uid)
          .get();
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        if (snap.size > 0) await batch.commit();
        deletedLog['friends'] = snap.size;
      } catch {}

      // blocks: fromUserId or toUserId
      for (const field of ['fromUserId', 'toUserId']) {
        try {
          const snap = await db.collection('blocks').where(field, '==', uid).get();
          const batch = db.batch();
          snap.docs.forEach((d) => batch.delete(d.ref));
          if (snap.size > 0) await batch.commit();
          deletedLog[`blocks_${field}`] = snap.size;
        } catch {}
      }

      // userドキュメント本体を削除
      await db.collection('users').doc(uid).delete();
      deletedLog['users'] = 1;

      // ---- Storage削除 ----
      // icons/{uid}.jpg
      // id-verification/{uid}_id.jpg, {uid}_selfie.jpg
      // stories/{uid}/ 以下すべて
      const prefixes = [
        `icons/${uid}`,
        `id-verification/${uid}`,
        `stories/${uid}/`,
      ];
      for (const prefix of prefixes) {
        try {
          const [files] = await bucket.getFiles({ prefix });
          await Promise.all(files.map((f) => f.delete().catch(() => null)));
          deletedLog[`storage_${prefix}`] = files.length;
        } catch (e) {
          console.error(`Storage delete failed for ${prefix}:`, e.message);
        }
      }

      // ---- Firebase Auth 削除 ----
      try {
        await admin.auth().deleteUser(uid);
        deletedLog['auth'] = 1;
      } catch (e) {
        console.error('Auth delete failed:', e.message);
      }

      console.log('User deletion complete:', uid, deletedLog);
      res.json({ success: true, deleted: deletedLog });
    } catch (error) {
      console.error('User deletion error:', error);
      res.status(500).json({ error: error.message, partial: deletedLog });
    }
  }
);

// Daily.co ルーム作成（認証トークンを手動検証）
exports.createDailyRoom = onRequest(
  { secrets: [dailyApiKey], cors: true },
  async (req, res) => {
    // POST以外は拒否
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Firebase Auth トークン検証
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: '認証が必要です' });
      return;
    }

    try {
      await admin.auth().verifyIdToken(token);
    } catch {
      res.status(401).json({ error: '無効な認証トークンです' });
      return;
    }

    // matchId取得
    const matchId = req.body?.data?.matchId || req.body?.matchId;
    if (!matchId) {
      res.status(400).json({ error: 'matchIdが必要です' });
      return;
    }

    const roomName = `spice-${matchId.slice(0, 20)}`;
    const fetch = require('node-fetch');

    try {
      const apiRes = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${dailyApiKey.value()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: roomName,
          properties: {
            max_participants: 8,
            enable_chat: true,
            exp: Math.floor(Date.now() / 1000) + 3600,
            eject_after_elapsed: 180,
          },
        }),
      });

      // ルームが既に存在する場合
      if (apiRes.status === 400) {
        res.json({ url: `https://spice-app.daily.co/${roomName}` });
        return;
      }

      if (!apiRes.ok) {
        const err = await apiRes.text();
        res.status(500).json({ error: `Daily room creation failed: ${err}` });
        return;
      }

      const data = await apiRes.json();
      res.json({ url: data.url });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// 朝5時に前日のストーリーを一括削除（日本時間 JST = UTC+9 → UTC 20:00）
exports.deleteExpiredStories = onSchedule('every day 20:00', async () => {
  const db = admin.firestore();
  const now = new Date();

  // 現在時刻より前のexpiresAtを持つストーリーを削除
  const expired = await db
    .collection('stories')
    .where('expiresAt', '<=', now)
    .get();

  if (expired.empty) {
    console.log('No expired stories found');
    return;
  }

  const batch = db.batch();
  expired.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`Deleted ${expired.size} expired stories`);
});

// admin_notifications にドキュメントが作成されたら運営にメール送信
exports.onAdminNotification = onDocumentCreated(
  {
    document: 'admin_notifications/{id}',
    database: 'default',
    region: 'asia-northeast1',
    secrets: [gmailUser, gmailPass, adminEmail],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser.value(),
        pass: gmailPass.value(),
      },
    });

    const subject =
      data.type === 'verification_nudge'
        ? '【spice】ユーザーが年齢確認の承認を急かしています'
        : data.type === 'peer_verification_nudge'
        ? '【spice】通話したい相手の年齢確認が未承認です（承認依頼）'
        : data.type === 'verification_submitted'
        ? '【spice】新しい年齢確認の申請が届きました'
        : data.type === 'user_report'
        ? `【spice】⚠️ ユーザー通報: ${categoryLabel(data.category)}`
        : `【spice】通知: ${data.type}`;

    const userUrl = (uid) => `https://console.firebase.google.com/project/spice-app-7ca98/firestore/databases/default/data/~2Fusers~2F${uid}`;

    // ==========================================
    // 通報メールは専用のフォーマットで送信
    // ==========================================
    if (data.type === 'user_report') {
      const reportedUrl = userUrl(data.userId);
      const reporterUrl = userUrl(data.reporterUserId);
      const cat = categoryLabel(data.category);
      const reasonText = data.reason || '（詳細記入なし）';

      const reportText = `
⚠️ ユーザー通報が届きました

カテゴリ: ${cat}
詳細: ${reasonText}

━━━━━━━━━━━━━━━━━━━━
【通報された人】
名前: ${data.userName || '不明'}
ID: ${data.userId || '不明'}
詳細: ${reportedUrl}

【通報した人】
名前: ${data.reporterName || '不明'}
ID: ${data.reporterUserId || '不明'}
詳細: ${reporterUrl}
━━━━━━━━━━━━━━━━━━━━

発生時刻: ${new Date().toLocaleString('ja-JP')}

SLA: 24時間以内に確認・対応してください。
      `.trim();

      const reportHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#fafafa;border-radius:12px;">
  <div style="background:#FF3B30;color:#fff;padding:16px 20px;border-radius:12px;margin-bottom:20px;">
    <div style="font-size:13px;opacity:0.9;">⚠️ USER REPORT</div>
    <div style="font-size:20px;font-weight:bold;margin-top:4px;">${cat}</div>
  </div>

  <div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;border:2px solid #FFE5E3;">
    <div style="font-size:12px;color:#888;margin-bottom:8px;font-weight:bold;">📝 通報内容の詳細</div>
    <div style="font-size:15px;line-height:1.6;color:#333;white-space:pre-wrap;">${String(reasonText).replace(/</g, '&lt;')}</div>
  </div>

  <div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;">
    <div style="font-size:12px;color:#888;margin-bottom:12px;font-weight:bold;">🚨 通報された人</div>
    <div style="font-size:17px;font-weight:bold;color:#222;margin-bottom:4px;">${String(data.userName || '不明').replace(/</g, '&lt;')}</div>
    <div style="font-size:11px;color:#aaa;font-family:monospace;margin-bottom:14px;">${data.userId || '不明'}</div>
    <a href="${reportedUrl}" style="display:inline-block;background:#FF3B30;color:#fff;text-decoration:none;padding:12px 24px;border-radius:50px;font-weight:bold;font-size:14px;">通報された人の詳細を開く →</a>
  </div>

  <div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;">
    <div style="font-size:12px;color:#888;margin-bottom:12px;font-weight:bold;">📣 通報した人</div>
    <div style="font-size:15px;color:#333;margin-bottom:4px;">${String(data.reporterName || '不明').replace(/</g, '&lt;')}</div>
    <div style="font-size:11px;color:#aaa;font-family:monospace;margin-bottom:14px;">${data.reporterUserId || '不明'}</div>
    <a href="${reporterUrl}" style="display:inline-block;background:#666;color:#fff;text-decoration:none;padding:10px 20px;border-radius:50px;font-size:13px;">通報した人の詳細を開く →</a>
  </div>

  <div style="background:#FFF3CD;border-left:4px solid #FFC107;padding:14px 16px;border-radius:6px;margin-bottom:16px;">
    <div style="font-size:13px;color:#856404;font-weight:bold;margin-bottom:4px;">⏰ 対応SLA: 24時間以内</div>
    <div style="font-size:12px;color:#856404;line-height:1.5;">内容を確認し、必要に応じて対象ユーザーに警告・アカウント停止・削除等の処置を行ってください。</div>
  </div>

  <p style="font-size:11px;color:#ccc;margin-top:16px;">発生時刻: ${new Date().toLocaleString('ja-JP')}</p>
</div>
      `.trim();

      try {
        await transporter.sendMail({
          from: `"spice運営通知" <${gmailUser.value()}>`,
          to: adminEmail.value(),
          subject,
          text: reportText,
          html: reportHtml,
        });
        console.log('Report email sent:', subject);
      } catch (err) {
        console.error('Report mail send failed:', err);
      }
      return;
    }


    // 承認待ち全員を取得
    let pendingUsers = [];
    try {
      const db = getFirestore(admin.app(), 'default');
      const snap = await db
        .collection('users')
        .where('ageVerificationStatus', '==', 'pending')
        .get();
      pendingUsers = snap.docs.map((d) => {
        const u = d.data();
        return {
          uid: d.id,
          name: u.name || '(名前未設定)',
          age: u.age || '?',
          gender: u.gender || '?',
          idImageUrl: u.idImageUrl || '',
          selfieImageUrl: u.selfieImageUrl || '',
          createdAt: u.createdAt?.toDate?.() || null,
        };
      });
      // 古い順
      pendingUsers.sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
    } catch (e) {
      console.error('Failed to fetch pending users:', e);
    }

    const pendingCount = pendingUsers.length;

    const text = `
${data.message || '通知が届きました'}

種別: ${data.type || '不明'}
発生時刻: ${new Date().toLocaleString('ja-JP')}

━━━━━━━━━━━━━━━━━━━━
承認待ちユーザー: ${pendingCount}名
━━━━━━━━━━━━━━━━━━━━

${pendingUsers
  .map(
    (u, i) =>
      `${i + 1}. ${u.name}（${u.age}歳 / ${u.gender}）\n   ${userUrl(u.uid)}`
  )
  .join('\n\n')}
    `.trim();

    const pendingRows = pendingUsers
      .map((u, i) => {
        const triggered = u.uid === data.userId;
        const bg = triggered ? '#FFF3E6' : '#fff';
        const badge = triggered
          ? '<span style="display:inline-block;background:#FF6B35;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:8px;">今回の通知対象</span>'
          : '';
        const created = u.createdAt
          ? u.createdAt.toLocaleString('ja-JP')
          : '-';
        return `
      <tr style="background:${bg};">
        <td style="padding:12px;border-bottom:1px solid #eee;vertical-align:top;">
          <div style="font-weight:600;color:#222;">${i + 1}. ${String(u.name).replace(/</g, '&lt;')}${badge}</div>
          <div style="font-size:12px;color:#888;margin-top:4px;">${u.age}歳 / ${u.gender} ・ 申請: ${created}</div>
          <div style="font-size:11px;color:#aaa;font-family:monospace;margin-top:2px;">${u.uid}</div>
        </td>
        <td style="padding:12px;border-bottom:1px solid #eee;vertical-align:top;text-align:right;white-space:nowrap;">
          <a href="${userUrl(u.uid)}" style="display:inline-block;background:#FF6B35;color:#fff;text-decoration:none;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:bold;">承認画面を開く →</a>
        </td>
      </tr>`;
      })
      .join('');

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#fafafa;border-radius:12px;">
  <h2 style="color:#FF6B35;margin:0 0 12px;">${subject}</h2>
  <p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 20px;">${(data.message || '通知が届きました').replace(/</g, '&lt;')}</p>
  <div style="background:#fff;border-radius:8px;padding:4px 0;">
    <div style="padding:12px 16px;background:#0d0d0d;color:#fff;border-radius:8px 8px 0 0;font-weight:bold;">
      📋 承認待ちユーザー一覧（${pendingCount}名）
    </div>
    ${pendingCount === 0
      ? '<div style="padding:24px;text-align:center;color:#888;">承認待ちのユーザーはいません</div>'
      : `<table style="width:100%;border-collapse:collapse;">${pendingRows}</table>`}
  </div>
  <p style="font-size:12px;color:#aaa;margin-top:20px;line-height:1.6;">
    各行の「承認画面を開く」から Firebase Console でそのユーザーのドキュメントが直接開きます。<br>
    身分証画像を確認後、<code style="background:#eee;padding:2px 6px;border-radius:4px;">ageVerificationStatus</code> を <code style="background:#eee;padding:2px 6px;border-radius:4px;">approved</code> に変更してください。
  </p>
  <p style="font-size:11px;color:#ccc;margin-top:16px;">発生時刻: ${new Date().toLocaleString('ja-JP')}</p>
</div>
    `.trim();

    try {
      await transporter.sendMail({
        from: `"spice運営通知" <${gmailUser.value()}>`,
        to: adminEmail.value(),
        subject,
        text,
        html,
      });
      console.log('Admin email sent:', subject);
    } catch (err) {
      console.error('Mail send failed:', err);
    }
  }
);

// ==========================================
// メールアドレス確認メールを Gmail SMTP 経由で送信
// （Firebase 標準の sendEmailVerification は迷惑メール率が高いため自前送信に切り替え）
// ==========================================
exports.sendVerificationEmail = onCall(
  {
    region: 'asia-northeast1',
    secrets: [gmailUser, gmailPass],
    cors: true,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'ログインが必要です');
    }

    const userRecord = await admin.auth().getUser(uid);
    if (!userRecord.email) {
      throw new HttpsError('failed-precondition', 'メールアドレスが登録されていません');
    }
    if (userRecord.emailVerified) {
      return { ok: true, alreadyVerified: true };
    }

    // Firebase が生成する認証リンク（このリンクをタップで emailVerified=true になる）
    const link = await admin.auth().generateEmailVerificationLink(userRecord.email);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser.value(),
        pass: gmailPass.value(),
      },
    });

    const displayName = userRecord.displayName || 'spice ユーザー';
    const subject = '【spice】メールアドレスの確認をお願いします';

    const text = `${displayName} 様

spice にご登録いただきありがとうございます🌶️

メールアドレス（${userRecord.email}）の確認のため、下記のリンクをタップしてください。

${link}

このリンクには有効期限があります。
期限が切れた場合はアプリから再送信できます。

このメールに心当たりがない場合は、お手数ですが破棄してください。
他人があなたのメールアドレスを誤って入力した可能性があります。

──────────────
spice運営事務局
お問い合わせ: spice.matching@gmail.com
https://spicematching.github.io/spice/
──────────────`;

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #fff; color: #222;">
  <div style="text-align: center; margin-bottom: 24px;">
    <div style="font-size: 28px; font-weight: bold; color: #FF6B35; letter-spacing: 4px;">🌶️ spice</div>
    <div style="font-size: 12px; color: #888; margin-top: 4px;">今夜の飲みに、刺激を。</div>
  </div>
  <h1 style="font-size: 18px; color: #222; margin-bottom: 12px;">メールアドレスの確認をお願いします</h1>
  <p style="color: #555; font-size: 14px; line-height: 1.7;">
    ${displayName} 様<br><br>
    spice にご登録いただきありがとうございます。<br>
    下記のボタンをタップして、メールアドレスの確認を完了してください。
  </p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="${link}" style="display: inline-block; background: #FF6B35; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 30px; font-weight: bold; font-size: 14px;">
      メールアドレスを確認する
    </a>
  </div>
  <p style="color: #888; font-size: 12px; line-height: 1.6;">
    ボタンが押せない場合は、以下の URL をブラウザに貼り付けてください：<br>
    <span style="word-break: break-all; color: #FF6B35;">${link}</span>
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #999; font-size: 11px; line-height: 1.6;">
    このメールに心当たりがない場合は破棄してください。<br>
    他人があなたのメールアドレスを誤って入力した可能性があります。
  </p>
  <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; color: #aaa; font-size: 11px;">
    spice運営事務局<br>
    <a href="mailto:spice.matching@gmail.com" style="color: #FF6B35; text-decoration: none;">spice.matching@gmail.com</a>
    　|
    <a href="https://spicematching.github.io/spice/" style="color: #FF6B35; text-decoration: none;">spicematching.github.io/spice/</a>
  </div>
</div>`.trim();

    try {
      await transporter.sendMail({
        from: `"spice運営事務局" <${gmailUser.value()}>`,
        to: userRecord.email,
        subject,
        text,
        html,
      });
      console.log(`Verification email sent to ${userRecord.email}`);
      return { ok: true };
    } catch (err) {
      console.error('sendVerificationEmail failed:', err);
      throw new HttpsError('internal', 'メール送信に失敗しました');
    }
  }
);
