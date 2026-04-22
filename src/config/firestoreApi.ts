import { auth } from './firebase';

const PROJECT_ID = 'spice-app-7ca98';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/default/documents`;

// Firebase Auth のIDトークンを取得
async function getToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

// Firestoreの値をREST APIフォーマットに変換
function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: any = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// REST APIからの値をJSに変換
function fromFirestoreValue(val: any): any {
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return new Date(val.timestampValue);
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in val) {
    const obj: any = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      obj[k] = fromFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

// ドキュメントをセット（上書き）
export async function setDocument(collectionPath: string, docId: string, data: Record<string, any>) {
  const token = await getToken();
  const fields: any = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v);
  }

  const res = await fetch(`${BASE_URL}/${collectionPath}/${docId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore set failed: ${res.status} ${err}`);
  }
  return await res.json();
}

// ドキュメントを部分更新（指定フィールドのみ更新、他はそのまま）
export async function updateDocument(collectionPath: string, docId: string, data: Record<string, any>) {
  const token = await getToken();
  const fields: any = {};
  const fieldPaths: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v);
    fieldPaths.push(k);
  }

  const mask = fieldPaths.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const res = await fetch(`${BASE_URL}/${collectionPath}/${docId}?${mask}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore update failed: ${res.status} ${err}`);
  }
  return await res.json();
}

// ドキュメントを削除
export async function deleteDocument(collectionPath: string, docId: string) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/${collectionPath}/${docId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore delete failed: ${res.status} ${err}`);
  }
}

// ドキュメントを追加（自動ID）
export async function addDocument(collectionPath: string, data: Record<string, any>) {
  const token = await getToken();
  const fields: any = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v);
  }

  const res = await fetch(`${BASE_URL}/${collectionPath}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore add failed: ${res.status} ${err}`);
  }
  const doc = await res.json();
  // nameからドキュメントIDを抽出: "projects/.../documents/collection/DOC_ID"
  const nameParts = (doc.name || '').split('/');
  const id = nameParts[nameParts.length - 1] || '';
  return { ...doc, id };
}

// コレクション内の全ドキュメントを取得
export async function getCollection(collectionPath: string): Promise<{ id: string; data: any }[]> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/${collectionPath}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore get failed: ${res.status} ${err}`);
  }

  const json = await res.json();
  if (!json.documents) return [];

  return json.documents.map((doc: any) => {
    const pathParts = doc.name.split('/');
    const id = pathParts[pathParts.length - 1];
    const data: any = {};
    for (const [k, v] of Object.entries(doc.fields || {})) {
      data[k] = fromFirestoreValue(v);
    }
    return { id, data };
  });
}

// 特定のドキュメントを取得
export async function getDocument(collectionPath: string, docId: string): Promise<any | null> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/${collectionPath}/${docId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore get failed: ${res.status} ${err}`);
  }

  const json = await res.json();
  const data: any = {};
  for (const [k, v] of Object.entries(json.fields || {})) {
    data[k] = fromFirestoreValue(v);
  }
  return data;
}
