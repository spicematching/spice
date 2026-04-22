import { auth } from './firebase';

const BUCKET = 'spice-app-7ca98.firebasestorage.app';

async function getToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

// ファイルをFirebase Storageにアップロードし、ダウンロードURLを返す
export async function uploadFile(
  localUri: string,
  storagePath: string
): Promise<string> {
  const token = await getToken();

  // ローカルファイルをBlobとして読み込み
  const response = await fetch(localUri);
  const blob = await response.blob();

  // Firebase Storage REST APIにアップロード
  const encodedPath = encodeURIComponent(storagePath);
  const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?uploadType=media&name=${encodedPath}`;

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': blob.type || 'application/octet-stream',
    },
    body: blob,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Storage upload failed: ${uploadRes.status} ${err}`);
  }

  const uploadData = await uploadRes.json();

  // ダウンロードURLを生成
  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}?alt=media&token=${uploadData.downloadTokens}`;
  return downloadUrl;
}
