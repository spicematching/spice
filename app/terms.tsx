import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>利用規約</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.updated}>最終更新日: 2026年4月12日</Text>

        <Text style={styles.sectionTitle}>第1条（適用）</Text>
        <Text style={styles.body}>
          本規約は、spice（以下「本アプリ」）が提供するすべてのサービス（以下「本サービス」）の利用条件を定めるものです。ユーザーは本規約に同意の上、本サービスを利用するものとします。
        </Text>

        <Text style={styles.sectionTitle}>第2条（利用資格）</Text>
        <Text style={styles.body}>
          1. 本サービスは18歳以上の方のみ利用できます。{'\n'}
          2. ユーザーは登録時に正確な情報を提供する義務を負います。{'\n'}
          3. 既婚者の利用は禁止します。
        </Text>

        <Text style={styles.sectionTitle}>第3条（アカウント）</Text>
        <Text style={styles.body}>
          1. ユーザーは自身のアカウント情報を適切に管理する責任を負います。{'\n'}
          2. アカウントの第三者への譲渡・貸与は禁止します。{'\n'}
          3. 不正利用が発覚した場合、事前通知なくアカウントを停止できるものとします。
        </Text>

        <Text style={styles.sectionTitle}>第4条（禁止事項）</Text>
        <Text style={styles.body}>
          ユーザーは以下の行為を行ってはなりません。{'\n\n'}
          1. 虚偽の情報を登録する行為{'\n'}
          2. 他のユーザーへの嫌がらせ、脅迫、ストーキング行為{'\n'}
          3. わいせつな画像・動画の投稿{'\n'}
          4. 営業・宣伝・勧誘目的での利用{'\n'}
          5. 他のユーザーの個人情報を無断で収集・公開する行為{'\n'}
          6. 本サービスの運営を妨害する行為{'\n'}
          7. 未成年者との出会いを目的とする行為{'\n'}
          8. 法令または公序良俗に反する行為{'\n'}
          9. 反社会的勢力への利益供与
        </Text>

        <Text style={styles.sectionTitle}>第5条（コンテンツ）</Text>
        <Text style={styles.body}>
          1. ユーザーが投稿したコンテンツの著作権はユーザーに帰属します。{'\n'}
          2. ユーザーは、投稿コンテンツを本サービスの運営に必要な範囲で利用することを許諾します。{'\n'}
          3. 投稿コンテンツは24時間後に自動的に削除されます。
        </Text>

        <Text style={styles.sectionTitle}>第6条（有料サービス）</Text>
        <Text style={styles.body}>
          1. 本サービスには有料オプション（フリックバック等）があります。{'\n'}
          2. 決済はApple In-App Purchaseを通じて行われます。{'\n'}
          3. 購入完了後の返金は、Apple社の規定に従います。{'\n'}
          4. 消耗型アイテムは購入後に使用した場合、返金対象外となります。
        </Text>

        <Text style={styles.sectionTitle}>第7条（免責事項）</Text>
        <Text style={styles.body}>
          1. 本サービスは現状有姿で提供されます。{'\n'}
          2. ユーザー間のトラブルについて、運営は一切の責任を負いません。{'\n'}
          3. 本サービスの中断・停止による損害について、運営は責任を負いません。{'\n'}
          4. ユーザーが本サービスを通じて出会った相手との間で生じた問題について、運営は責任を負いません。
        </Text>

        <Text style={styles.sectionTitle}>第8条（退会）</Text>
        <Text style={styles.body}>
          1. ユーザーはいつでもアカウントを削除し退会できます。{'\n'}
          2. 退会時、ユーザーのデータは速やかに削除されます。{'\n'}
          3. 未使用の有料アイテムは退会時に失効します。
        </Text>

        <Text style={styles.sectionTitle}>第9条（規約の変更）</Text>
        <Text style={styles.body}>
          運営は必要に応じて本規約を変更できるものとします。変更後の規約はアプリ内での告知をもって効力を生じます。
        </Text>

        <Text style={styles.sectionTitle}>第10条（準拠法・管轄）</Text>
        <Text style={styles.body}>
          本規約の解釈は日本法に準拠し、紛争が生じた場合は東京地方裁判所を第一審の専属的合意管轄裁判所とします。
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
});
