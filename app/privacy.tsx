import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>プライバシーポリシー</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.updated}>最終更新日: 2026年4月12日</Text>

        <Text style={styles.sectionTitle}>1. はじめに</Text>
        <Text style={styles.body}>
          spice（以下「本アプリ」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。本ポリシーは、本アプリが収集・利用・保護する個人情報について説明するものです。
        </Text>

        <Text style={styles.sectionTitle}>2. 収集する情報</Text>
        <Text style={styles.body}>
          本アプリは以下の情報を収集します。{'\n\n'}
          <Text style={styles.bold}>ユーザーが提供する情報:</Text>{'\n'}
          - メールアドレス（アカウント登録用）{'\n'}
          - ユーザーネーム、名前、年齢、性別{'\n'}
          - プロフィール写真{'\n'}
          - 投稿した動画コンテンツ{'\n'}
          - タグ・興味関心情報{'\n\n'}
          <Text style={styles.bold}>自動的に収集される情報:</Text>{'\n'}
          - デバイス情報（機種、OS）{'\n'}
          - プッシュ通知トークン{'\n'}
          - アプリの利用状況
        </Text>

        <Text style={styles.sectionTitle}>3. 情報の利用目的</Text>
        <Text style={styles.body}>
          収集した情報は以下の目的で利用します。{'\n\n'}
          1. アカウントの作成・管理{'\n'}
          2. マッチング機能の提供{'\n'}
          3. プッシュ通知の送信{'\n'}
          4. ビデオ通話機能の提供{'\n'}
          5. 不正利用の防止・安全性の確保{'\n'}
          6. サービスの改善・分析{'\n'}
          7. ユーザーサポートへの対応
        </Text>

        <Text style={styles.sectionTitle}>4. 情報の共有</Text>
        <Text style={styles.body}>
          本アプリは以下の場合を除き、個人情報を第三者に提供しません。{'\n\n'}
          1. ユーザーの同意がある場合{'\n'}
          2. 法令に基づく開示要求がある場合{'\n'}
          3. サービス提供に必要な業務委託先（Firebase、Daily.co等）への提供{'\n'}
          4. 人の生命・身体・財産の保護に必要な場合
        </Text>

        <Text style={styles.sectionTitle}>5. データの保管</Text>
        <Text style={styles.body}>
          1. ユーザーデータはGoogle Firebase（米国）に保管されます。{'\n'}
          2. 投稿コンテンツは24時間後に自動削除されます。{'\n'}
          3. アカウント削除時、関連する個人データは速やかに削除されます。
        </Text>

        <Text style={styles.sectionTitle}>6. データの安全管理</Text>
        <Text style={styles.body}>
          1. 通信はSSL/TLSにより暗号化されています。{'\n'}
          2. 認証にはFirebase Authenticationを使用し、パスワードは暗号化して保管されます。{'\n'}
          3. データベースへのアクセスはセキュリティルールにより制御されています。
        </Text>

        <Text style={styles.sectionTitle}>7. ユーザーの権利</Text>
        <Text style={styles.body}>
          ユーザーは以下の権利を有します。{'\n\n'}
          1. 個人情報の開示・訂正・削除を請求する権利{'\n'}
          2. アカウントをいつでも削除する権利{'\n'}
          3. プッシュ通知を無効にする権利{'\n'}
          4. プロフィール情報を変更する権利
        </Text>

        <Text style={styles.sectionTitle}>8. Cookie・トラッキング</Text>
        <Text style={styles.body}>
          本アプリはCookieを使用しません。広告トラッキングは行いません。
        </Text>

        <Text style={styles.sectionTitle}>9. 未成年者の保護</Text>
        <Text style={styles.body}>
          本アプリは18歳未満の方の利用を禁止しています。18歳未満と判明した場合、アカウントは直ちに削除されます。
        </Text>

        <Text style={styles.sectionTitle}>10. ポリシーの変更</Text>
        <Text style={styles.body}>
          本ポリシーは必要に応じて改定されることがあります。重要な変更がある場合は、アプリ内で通知します。
        </Text>

        <Text style={styles.sectionTitle}>11. お問い合わせ</Text>
        <Text style={styles.body}>
          個人情報の取り扱いに関するお問い合わせは、アプリ内のお問い合わせフォームまたは以下のメールアドレスまでご連絡ください。{'\n\n'}
          メール: support@spice-app.com
        </Text>
      </ScrollView>
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
  scroll: { padding: 20, paddingBottom: 60 },
  updated: { color: '#666', fontSize: 12, marginBottom: 20 },
  sectionTitle: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 8,
  },
  body: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 22,
  },
  bold: {
    fontWeight: 'bold',
    color: '#fff',
  },
});
