import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, StyleSheet, TouchableOpacity, View, Linking } from 'react-native';
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
        <Text style={styles.updated}>制定日: 2026年4月23日 / 最終更新日: 2026年4月23日</Text>

        <Text style={styles.body}>
          spice 運営事務局（以下「当方」といいます）は、当方が提供するモバイルアプリケーション「spice」（以下「本サービス」といいます）における、ユーザーの個人情報を含む利用者情報（以下「利用者情報」といいます）の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
        </Text>

        <Text style={styles.sectionTitle}>1. 取得する利用者情報</Text>
        <Text style={styles.body}>
          本サービスは、以下の利用者情報を取得します。{'\n\n'}
          <Text style={styles.bold}>(1) ユーザーが直接入力・アップロードする情報</Text>{'\n'}
          ・メールアドレス、パスワード（ハッシュ化して保存）{'\n'}
          ・ユーザーネーム、表示名、生年月日（または年齢）、性別{'\n'}
          ・プロフィール写真、自己紹介文、興味・タグ{'\n'}
          ・本サービス内で投稿する画像・動画（以下「投稿コンテンツ」）{'\n'}
          ・他のユーザーへのメッセージ、リアクション、通話内容のうちユーザーが入力する情報{'\n\n'}
          <Text style={styles.bold}>(2) 年齢確認のために取得する情報（機微情報）</Text>{'\n'}
          ・本人確認書類（運転免許証・マイナンバーカード（個人番号部分を除く）・パスポート等）の画像{'\n'}
          ・本人確認のためのセルフィー画像{'\n\n'}
          これらの情報は、年齢確認および本人確認のためにのみ使用し、当方および当方が委託する管理者以外はアクセスできないように厳格に管理します。マイナンバー（個人番号）が記載された面の画像をアップロードしないよう、ユーザーは注意するものとします。当方は個人番号を取得しません。{'\n\n'}
          <Text style={styles.bold}>(3) 自動的に取得される情報</Text>{'\n'}
          ・端末情報（端末モデル、OS バージョン、言語設定、タイムゾーン）{'\n'}
          ・本サービスの利用状況に関するログ情報{'\n'}
          ・プッシュ通知トークン{'\n'}
          ・IP アドレス（一時的な不正検知のため）{'\n\n'}
          <Text style={styles.bold}>(4) ユーザーの許諾を得て取得する情報</Text>{'\n'}
          ・位置情報（OS の位置情報許可がある場合のみ）{'\n'}
          ・カメラ・マイク・写真ライブラリへのアクセス（投稿・通話・本人確認のため）{'\n'}
          ・連絡先情報（友達招待機能を利用する場合のみ）
        </Text>

        <Text style={styles.sectionTitle}>2. 利用目的</Text>
        <Text style={styles.body}>
          1. ユーザーアカウントの作成、認証、管理{'\n'}
          2. マッチング、メッセージ、通話、ストーリー投稿等の機能提供{'\n'}
          3. 年齢確認および本人確認{'\n'}
          4. 位置情報を用いた近隣ユーザーの表示等の機能提供（許可がある場合）{'\n'}
          5. 不正利用、虚偽登録、嫌がらせ、犯罪行為等の防止および対応{'\n'}
          6. 通報・違反対応、紛争対応、法的対応{'\n'}
          7. 本サービスの保守、品質改善、新機能の開発、利用状況の分析{'\n'}
          8. 有料サービスの提供および課金処理{'\n'}
          9. ユーザーサポート、お問い合わせ対応{'\n'}
          10. 重要なお知らせ、規約・本ポリシー変更等の通知{'\n'}
          11. 法令または利用規約に基づく権利行使、義務履行
        </Text>

        <Text style={styles.sectionTitle}>3. 第三者への提供および業務委託</Text>
        <Text style={styles.body}>
          <Text style={styles.bold}>(1) 業務委託先</Text>{'\n'}
          当方は、本サービスの提供および運営に必要な範囲で、以下の事業者に利用者情報の処理を委託します。{'\n'}
          ・Google LLC（Firebase）— 認証、データベース、ストレージ、プッシュ通知等（米国）{'\n'}
          ・Daily.co Inc. — 音声・ビデオ通話の伝送（米国）{'\n'}
          ・RevenueCat, Inc. — アプリ内課金の処理および管理（米国）{'\n'}
          ・Apple Inc. / Google LLC — アプリ配信、決済処理、プッシュ通知配送（米国）{'\n'}
          ・Expo / Sentry 等の SDK 提供事業者（米国）{'\n\n'}
          上記事業者はいずれも日本国外（主に米国）に所在するため、本サービスの利用に伴い、利用者情報が国外へ移転されることがあります。ユーザーは、本サービスを利用することで、当該移転に同意したものとみなされます。{'\n\n'}
          <Text style={styles.bold}>(2) 第三者提供</Text>{'\n'}
          当方は、以下の場合を除き、ユーザーの同意なく利用者情報を第三者に提供しません。{'\n'}
          1. 法令に基づく場合{'\n'}
          2. 人の生命、身体または財産の保護のために必要な場合{'\n'}
          3. 公衆衛生の向上または児童の健全な育成の推進のために特に必要な場合{'\n'}
          4. 事業承継に伴って利用者情報が提供される場合{'\n'}
          5. 当方の権利、財産または安全を保護する必要がある場合{'\n\n'}
          <Text style={styles.bold}>(3) 他のユーザーに表示される情報</Text>{'\n'}
          プロフィール写真、ユーザーネーム、表示名、年齢、性別、自己紹介、興味・タグ、投稿コンテンツ、おおまかな位置（市区町村レベル）等は、本サービスの目的上、他のユーザーに公開されます。本人確認書類画像、メールアドレス、正確な位置情報、生年月日（年齢以外）は、他のユーザーには公開されません。
        </Text>

        <Text style={styles.sectionTitle}>4. 利用者情報の保管期間</Text>
        <Text style={styles.body}>
          ・アカウント情報、プロフィール: 退会または削除請求時まで{'\n'}
          ・本人確認書類画像: 確認完了後、原則90日以内に削除（不正調査・法令対応のため必要な場合を除く）{'\n'}
          ・投稿コンテンツ（ストーリー）: 投稿後 24 時間で自動削除{'\n'}
          ・マッチ情報、メッセージ履歴: 当事者の一方が退会または削除するまで{'\n'}
          ・通話履歴のメタデータ: 最長 1 年{'\n'}
          ・ログ情報: 最長 1 年{'\n'}
          ・不正利用記録、違反対応記録: 最長 5 年{'\n'}
          ・取引・課金に関する記録: 関連法令で定められた期間（最長 7 年）{'\n\n'}
          退会または削除請求を受けた場合、当方は遅滞なく該当する利用者情報を削除します。ただし、法令上の保存義務、不正利用への対応、紛争解決のために必要な情報については、上記期間まで保管することがあります。
        </Text>

        <Text style={styles.sectionTitle}>5. 安全管理措置</Text>
        <Text style={styles.body}>
          ・通信は SSL/TLS により暗号化しています。{'\n'}
          ・パスワードはハッシュ化された状態で保管され、当方を含め平文で参照することはできません。{'\n'}
          ・データベースおよびストレージへのアクセスは、サーバー側のセキュリティルールにより、本人または管理者以外のアクセスを拒否します。{'\n'}
          ・本人確認書類画像は、本人および当方の管理者以外がアクセスできないように制限しています。{'\n'}
          ・当方の管理者によるアクセスは、運営および違反対応の目的に必要な範囲に限定します。
        </Text>

        <Text style={styles.sectionTitle}>6. ユーザーの権利</Text>
        <Text style={styles.body}>
          ユーザーは、自己の利用者情報について、以下の権利を有します。{'\n'}
          ・開示請求{'\n'}
          ・訂正、追加、削除請求{'\n'}
          ・利用停止、第三者提供停止請求{'\n'}
          ・本サービスからの退会（アカウント削除）{'\n\n'}
          上記の権利を行使される場合は、第 12 条のお問い合わせ先までご連絡ください。本人確認のうえ、合理的な範囲で速やかに対応します。
        </Text>

        <Text style={styles.sectionTitle}>7. Cookie 等の利用について</Text>
        <Text style={styles.body}>
          本サービスは、現時点では広告配信を目的とした Cookie や IDFA／AAID 等の広告識別子を取得していません。将来、広告またはアクセス解析のためにこれらを利用する場合は、本ポリシーを改訂のうえ、ユーザーに通知し、必要な同意を取得します。
        </Text>

        <Text style={styles.sectionTitle}>8. 18歳未満の方の利用について</Text>
        <Text style={styles.body}>
          本サービスは、18 歳以上（高校生を除く）の方のみご利用いただけます。当方は、登録時およびその後の年齢確認プロセスにおいて、18 歳未満であることが判明した場合、直ちに当該アカウントを削除し、関連情報の利用を停止します。
        </Text>

        <Text style={styles.sectionTitle}>9. 投稿コンテンツの取扱い</Text>
        <Text style={styles.body}>
          ユーザーが本サービスに投稿したコンテンツの著作権はユーザーに帰属します。利用条件の詳細は利用規約をご参照ください。
        </Text>

        <Text style={styles.sectionTitle}>10. 法令、規範の遵守と見直し</Text>
        <Text style={styles.body}>
          当方は、本ポリシーに関して適用される日本の法令、その他の規範を遵守するとともに、本ポリシーの内容を適宜見直し、その改善に努めます。
        </Text>

        <Text style={styles.sectionTitle}>11. 本ポリシーの変更</Text>
        <Text style={styles.body}>
          当方は、必要に応じて本ポリシーを変更することがあります。変更後の本ポリシーは、本サービス上に掲示した時点から効力を生じるものとします。重要な変更を行う場合は、本サービス内での通知またはメールにより、事前にお知らせします。
        </Text>

        <Text style={styles.sectionTitle}>12. 事業者情報・お問い合わせ窓口</Text>
        <Text style={styles.body}>
          <Text style={styles.bold}>事業者名:</Text> spice 運営事務局{'\n'}
          <Text style={styles.bold}>連絡先:</Text>{' '}
          <Text
            style={styles.link}
            onPress={() => Linking.openURL('mailto:spice.matching@gmail.com')}
          >
            spice.matching@gmail.com
          </Text>
          {'\n'}
          <Text style={styles.bold}>事業者の所在地および代表者氏名:</Text> ご請求があれば遅滞なく開示します。上記メールアドレスまでご連絡ください。
        </Text>

        <Text style={[styles.body, { marginTop: 24, color: '#666', fontSize: 12 }]}>
          最新版はこちらでもご確認いただけます:{' '}
          <Text
            style={styles.link}
            onPress={() => Linking.openURL('https://spicematching.github.io/spice/privacy.html')}
          >
            spicematching.github.io/spice/privacy.html
          </Text>
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
  link: {
    color: '#FF6B35',
    textDecorationLine: 'underline',
  },
});
