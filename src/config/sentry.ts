import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * Sentry を初期化する。アプリ起動時に最初に呼び出すこと。
 * DSN が未設定の場合は何もせずに終了する（開発時の noise 抑制）。
 */
export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    if (__DEV__) {
      console.log('[Sentry] DSN not configured, skipping init');
    }
    return;
  }

  Sentry.init({
    dsn,
    // 開発中は送信しない（本番のみ）
    enabled: !__DEV__,
    // パフォーマンス計測サンプリング率（本番は0.1〜0.2推奨。多すぎるとquota消化）
    tracesSampleRate: 0.1,
    // エラー収集率（基本100%）
    sampleRate: 1.0,
    // セッションリプレイ（本番のみ、必要なら有効化）
    // replaysSessionSampleRate: 0,
    // replaysOnErrorSampleRate: 1.0,
    environment: __DEV__ ? 'development' : 'production',
    // アプリのバージョンをタグ付け（リリース管理に必須）
    release: `spice@${Constants.expoConfig?.version || 'unknown'}`,
    // ネイティブクラッシュも収集
    enableNative: true,
    // PII（個人情報）を自動送信しない
    sendDefaultPii: false,
    // ユーザー操作のブレッドクラム
    enableAutoPerformanceTracing: true,
  });
}

/**
 * 認証後にユーザーIDをSentryに紐付ける。
 * メールアドレス等の個人情報は送信しない（uid のみ）。
 */
export function setSentryUser(uid: string | null) {
  if (uid) {
    Sentry.setUser({ id: uid });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * 任意のエラーを手動でSentryに送信する。
 * try/catchで握りつぶしているがログは残したい箇所で使う。
 */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

export { Sentry };
