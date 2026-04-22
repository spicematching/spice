import { Platform } from 'react-native';

// Expo Goでは動作しない（EASビルドのみ）
let Purchases: any = null;
try {
  Purchases = require('react-native-purchases').default;
} catch {}

// RevenueCat API Keys（RevenueCatダッシュボードで取得）
const REVENUECAT_IOS_KEY = 'test_GKVUUNGkVcKafIqAqKVuRqbISEr';
const REVENUECAT_ANDROID_KEY = 'YOUR_REVENUECAT_ANDROID_API_KEY';

// 商品ID
export const PRODUCT_IDS = {
  FLICK_BACK: 'spice_flick_back_190',
};

let isInitialized = false;

// RevenueCat初期化
export async function initPurchases(userId: string): Promise<void> {
  if (isInitialized || !Purchases) return;
  try {
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
    if (apiKey.startsWith('YOUR_')) return;
    Purchases.configure({ apiKey, appUserID: userId });
    isInitialized = true;
  } catch (error) {
    console.error('[Purchases] 初期化エラー:', error);
  }
}

// フリックバック（消耗型）を購入
export async function purchaseFlickBack(): Promise<boolean> {
  // Expo Go or APIキー未設定の場合はサンドボックスモード（常に成功）
  if (!isInitialized || !Purchases) {
    return true;
  }

  try {
    const offerings = await Purchases.getOfferings();
    const flickBackPackage = offerings.current?.availablePackages.find(
      (pkg: PurchasesPackage) => pkg.product.identifier === PRODUCT_IDS.FLICK_BACK
    );

    if (!flickBackPackage) {
      // パッケージが見つからない場合、直接商品IDで購入を試みる
      const products = await Purchases.getProducts([PRODUCT_IDS.FLICK_BACK]);
      if (products.length === 0) {
        throw new Error('商品が見つかりません');
      }
      const { customerInfo } = await Purchases.purchaseStoreProduct(products[0]);
      return true;
    }

    const { customerInfo } = await Purchases.purchasePackage(flickBackPackage);
    return true;
  } catch (error: any) {
    if (error.userCancelled) {
      return false; // ユーザーがキャンセル
    }
    console.error('[Purchases] 購入エラー:', error);
    throw error;
  }
}

// 購入履歴を復元
export async function restorePurchases(): Promise<any | null> {
  if (!isInitialized || !Purchases) return null;
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (error) {
    console.error('[Purchases] 復元エラー:', error);
    return null;
  }
}
