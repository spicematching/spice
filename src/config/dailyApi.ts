import { auth } from './firebase';

const PROJECT_ID = 'spice-app-7ca98';

// Cloud Function経由でDaily.coルームを作成（APIキーはサーバー側で管理）
export async function createDailyRoom(matchId: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const token = await user.getIdToken();

  // v2 Cloud Functionは run.app ドメインになる場合がある
  const urls = [
    `https://us-central1-${PROJECT_ID}.cloudfunctions.net/createDailyRoom`,
    `https://createdailyroom-920954597322.us-central1.run.app`,
  ];

  let lastError = '';
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: { matchId } }),
      });

      if (res.status === 401 || res.status === 403) {
        lastError = `Auth error at ${url}`;
        continue; // 次のURLを試す
      }

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`ルーム作成に失敗しました: ${err}`);
      }

      const result = await res.json();
      return result.url || result.result?.url;
    } catch (e: any) {
      lastError = e.message;
      continue;
    }
  }

  throw new Error(`ルーム作成に失敗しました: ${lastError}`);
}
