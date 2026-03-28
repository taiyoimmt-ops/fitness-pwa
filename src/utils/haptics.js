/**
 * Taptic Engine (Haptics) ユーティリティ
 * iPhone ユーザー向け: 入力、決定、エラー時に脳にフィードバックを返す
 */

export const haptics = {
  /** 軽いタップ感 (数値入力、項目切り替え) */
  light: () => {
    if (navigator.vibrate) navigator.vibrate(10);
  },
  
  /** 中程度のタップ感 (ボタン押下、保存開始) */
  medium: () => {
    if (navigator.vibrate) navigator.vibrate(20);
  },
  
  /** 強い抵抗感 (警告、削除、エラー) */
  heavy: () => {
    if (navigator.vibrate) navigator.vibrate([40, 20, 40]);
  },
  
  /** 成功時のリズム (保存完了、目標達成) */
  success: () => {
    if (navigator.vibrate) navigator.vibrate([10, 40, 10]);
  },
  
  /** 失敗時のリズム (エラーダイアログ) */
  error: () => {
    if (navigator.vibrate) navigator.vibrate([50, 25, 50, 10]);
  }
};
