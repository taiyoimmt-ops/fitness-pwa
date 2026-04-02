# 筋トレPWA 完全要件定義書 v2.0
> Antigravity バイブコーディング用。このファイルを読み込んだら **Phase 1 から順番に** 着手せよ。勝手に先のフェーズに進むな。

---

## 0. プロジェクト概要

| 項目 | 内容 |
|---|---|
| 目的 | 62kg → 72kg 増量 / BIG3 各+20kg を1年で達成 |
| 対象ユーザー | 開発者本人のみ（シングルユーザー前提） |
| デバイス | iPhone Safari PWA（ホーム画面追加） |
| インフラ | React(Vite) + Vercel / Google Apps Script(API) / Google Sheets(DB) |
| 費用 | 完全無料（Gemini API 無料枠内） |

---

## 1. Google Sheets スキーマ（DB設計）

### シート①: `Meals`
| 列 | 型 | 例 |
|---|---|---|
| A: timestamp | datetime | 2025-06-01 12:34 |
| B: meal_label | string | 昼食 |
| C: image_url | string | https://... （省略可） |
| D: calories | number | 680 |
| E: protein_g | number | 42 |
| F: fat_g | number | 18 |
| G: carb_g | number | 76 |
| H: memo | string | チキン定食 |

### シート②: `Workouts`
| 列 | 型 | 例 |
|---|---|---|
| A: timestamp | datetime | 2025-06-01 19:00 |
| B: exercise | string | ベンチプレス |
| C: body_part | string | 胸 |
| D: set_number | number | 1 |
| E: weight_kg | number | 80 |
| F: reps | number | 8 |
| G: volume | number | 640 （=weight×reps 自動計算） |

### シート③: `BodyMetrics`
| 列 | 型 | 例 |
|---|---|---|
| A: date | date | 2025-06-01 |
| B: body_weight_kg | number | 63.2 |
| C: note | string | 前日夜遅め |

### シート④: `Goals`
| 列 | 型 | 例 |
|---|---|---|
| A: goal_id | string | bench_1rm |
| B: target_value | number | 100 |
| C: current_value | number | 80 |
| D: deadline | date | 2026-06-01 |
| E: monthly_kpi | number | 1.67 （自動計算） |
| F: last_updated | datetime | 2025-06-01 |

### シート⑤: `DailyGoals`
| 列 | 型 | 例 |
|---|---|---|
| A: date | date | 2025-06-01 |
| B: goal_text | string | ベンチプレス82.5kg×8rep達成 |
| C: achieved | boolean | TRUE |

---

## 2. GAS API エンドポイント設計

GAS は単一の `doPost(e)` / `doGet(e)` で全エンドポイントを処理する。
`action` パラメータでルーティングする。

### 実装するアクション一覧

```
GET  ?action=getMealsToday          → 今日のMealsレコード全件
POST action=addMeal                 → Mealsに1行追加
GET  ?action=getLastWorkout&exercise=ベンチプレス → 指定種目の直近レコード
POST action=addWorkout              → Workoutsに複数行追加（セット分）
GET  ?action=getBodyParts7days      → 直近7日の部位別セット数集計
GET  ?action=getGoals               → Goals全件
POST action=updateGoalProgress      → Goals の current_value を更新し monthly_kpi を再計算
GET  ?action=getSummary7days        → 直近7日の体重推移・PFC達成率・ボリューム集計（アドバイス用）
POST action=addBodyWeight           → BodyMetrics に追加
```

### GAS レスポンス形式（全エンドポイント共通）
```json
{
  "status": "ok",
  "data": { ... }
}
```
エラー時:
```json
{
  "status": "error",
  "message": "..."
}
```

---

## 3. 機能詳細と具体的な処理ロジック

---

### A. 食事管理機能

#### UI フロー
```
トップ画面
 └─ [🍽 食事を記録] ボタン（大きく中央配置）
      └─ カメラ起動 or ライブラリ選択
           └─ 画像選択後 → "解析中..." スピナー（3秒想定）
                └─ 解析結果カード表示
                     ├─ 品名・推定カロリー・PFC
                     ├─ [✅ 保存] [✏️ 修正] ボタン
                     └─ 保存後 → トップへ戻る（今日のPFC残量を更新）
```

#### Gemini Vision API 呼び出し仕様
- モデル: `gemini-1.5-flash`（無料枠）
- 画像: base64エンコードしてリクエストに含める
- プロンプト（固定文・そのまま使え）:
```
以下の食事画像を分析し、必ずJSON形式のみで回答せよ。前置きや説明は不要。
{
  "meal_label": "食事名（例：チキン定食）",
  "calories": 数値,
  "protein_g": 数値,
  "fat_g": 数値,
  "carb_g": 数値,
  "confidence": "high|medium|low"
}
複数品がある場合は合算値を返せ。不明な場合は推測値を入れ confidence を low にせよ。
```

#### 1日目標値（ハードコード・設定画面で変更可）
```js
const DAILY_TARGETS = {
  calories: 2800,
  protein_g: 140,
  fat_g: 60,
  carb_g: 420,
};
```

#### トップ画面の残量表示
- 4本のプログレスバー（カロリー/P/F/C）を色分けで表示
  - 達成率 0〜70%: グレー
  - 70〜100%: グリーン
  - 100%超: レッド（過多警告）
- 数値表示例: `タンパク質: 98g / 140g（残り42g）`

---

### B. 目標管理機能

#### 初期設定画面（初回起動時のみ表示）
入力項目:
- 現在体重（kg）
- 目標体重（kg）
- ベンチプレス現在MAX（kg）
- スクワット現在MAX（kg）
- デッドリフト現在MAX（kg）
- 各種目の1年後目標（kg）
- 目標期限（デフォルト: 今日から365日後）

#### 月間KPI自動計算ロジック
```js
// GAS側で計算・Goalsシートに書き込む
function calcMonthlyKPI(currentVal, targetVal, deadlineDate) {
  const monthsLeft = monthsBetween(today(), deadlineDate); // 小数点あり
  return (targetVal - currentVal) / monthsLeft;
}
```

#### KPI上方修正ロジック（月途中達成時）
- 条件: `current_value >= monthly_kpi × (今月経過日数/30) × 1.2` ならば「月間KPI達成ペースが20%超過」と判定
- 処理: `monthly_kpi = (target_value - current_value) / 残り月数` で再計算しGoalsシートを上書き
- UIでは「🎯 ペース超過中！KPIを更新しました」というトースト通知を表示

#### ダッシュボード表示
- 各目標をカード形式で表示
  - 達成率のリングゲージ（SVGで実装）
  - 「今月のペース: +1.2kg（目標+0.8kg）✅」

---

### C. トレーニング管理機能

#### UI フロー（外部アプリ不要で完結）
```
[🏋️ トレーニング開始] ボタン
 └─ 部位選択画面
      └─ 胸 / 背中 / 脚 / 肩 / 腕 / 体幹
           └─ 種目選択（部位別プリセットリスト）
                └─ セット入力画面
                     ├─ 重量(kg): [前回値+2.5をプレースホルダー表示]
                     ├─ 回数:     [前回値+1をプレースホルダー表示]
                     ├─ [+ セット追加] ボタン
                     └─ [✅ 保存してホームへ]
```

#### 前回データ取得と目標値表示
```js
// 種目選択時に呼ぶ
const last = await gasGet('getLastWorkout', { exercise: '選択種目名' });
// last = { weight_kg: 80, reps: 8 }

// プレースホルダーに自動入力
weightInput.placeholder = last.weight_kg + 2.5;  // 82.5
repsInput.placeholder = last.reps + 1;            // 9
```

#### 「筋トレメモ」アプリのUI再現方針
「筋トレメモ」（赤いマッチョアイコン）の操作感を踏襲する。
- 部位タブが横スクロール（胸/背中/脚/肩/腕/体幹）
- タブ選択 → その部位の種目リストが縦に並ぶ
- 種目タップ → セット入力モーダル（重量・回数のドラム式 or テンキー入力）
- 「+セット」ボタンで行追加、スワイプで削除
- 完了ボタンで一括保存

#### 種目プリセット（ハードコード）
```js
const EXERCISES = {
  胸: ['ベンチプレス', 'インクラインDB', 'ペックフライ', 'ディップス'],
  背中: ['デッドリフト', 'ラットプルダウン', 'ベントオーバーロー', 'シーテッドロー'],
  脚: ['スクワット', 'レッグプレス', 'ルーマニアンDL', 'レッグカール'],
  肩: ['ショルダープレス', 'サイドレイズ', 'フロントレイズ', 'フェイスプル'],
  腕: ['バーベルカール', 'ハンマーカール', 'トライセプスPD', 'スカルクラッシャー'],
  体幹: ['プランク', 'クランチ', 'レッグレイズ'],
};
```

#### ヒートマップ（部位別刺激頻度）
- 直近7日間の部位別セット数を `getBodyParts7days` で取得
- 横軸: 日付（7日分）、縦軸: 部位（6部位）
- セル色: 0セット=白、1-5=薄緑、6-10=緑、11+=濃緑
- 3日以上未刺激の部位は赤枠でハイライト

---

### D. アドバイス機能（データ駆動型）

#### Gemini APIへの送信データ構造
```js
const summary = await gasGet('getSummary7days');
// summary = {
//   avg_weight_kg: 63.8,
//   weight_trend: "+0.3kg",          // 7日前比
//   pfc_achievement_rate: {           // 目標対比%
//     calories: 88,
//     protein: 72,
//     fat: 105,
//     carb: 91,
//   },
//   volume_by_part: {                 // 部位別総セット数
//     胸: 12, 背中: 6, 脚: 0, 肩: 9, 腕: 6, 体幹: 3
//   }
// }
```

#### Gemini APIプロンプト（固定・そのまま使え）
```
あなたは容赦のないパーソナルトレーナーだ。以下のデータを分析し、お世辞なしで3点の具体的指摘をせよ。
日本語で回答し、各指摘は2文以内にまとめよ。

[データ]
直近7日の平均体重: {avg_weight_kg}kg（前週比{weight_trend}）
PFC達成率: カロリー{calories}% タンパク質{protein}% 脂質{fat}% 炭水化物{carb}%
部位別セット数: {volume_by_part}

回答形式:
1. [最重要課題] ...
2. [食事面] ...
3. [トレーニング面] ...
```

---

## 4. 画面構成（ルーティング）

```
/ (トップ・ダッシュボード)
  ├─ 今日の食事残量バー × 4
  ├─ 目標達成率リング（BIG3 + 体重）
  ├─ [🍽 食事記録] [🏋️ トレーニング] [📊 分析] ボタン
  └─ 直近のアドバイス（折りたたみ）

/meal      → 食事記録（撮影→解析→保存）
/workout   → トレーニング記録（部位→種目→セット入力）
/analysis  → アドバイス生成画面
/settings  → 初期設定・目標変更
```

---

## 5. PWA設定（`manifest.json`）

```json
{
  "name": "筋トレログ",
  "short_name": "TrainLog",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 6. 環境変数（`.env`）

```
VITE_GAS_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
VITE_GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

---

## 7. 開発フェーズ（この順番で着手せよ）

### Phase 1: バックエンド基盤（GAS + Sheets）
1. Google Sheetsを上記スキーマ通りに作成
2. GASで全エンドポイントを実装
3. curlでCRUDの動作確認

### Phase 2: React基盤 + ルーティング
1. `npm create vite@latest` でプロジェクト作成
2. React Router でルーティング設定
3. manifest.json でPWA化
4. 環境変数設定

### Phase 3: 食事管理機能
1. カメラ起動（`<input type="file" capture="environment">`）
2. Gemini Vision API呼び出し
3. 結果表示 + GASへの保存
4. トップ画面のPFC残量バー

### Phase 3.5: スクショインポート機能（筋トレメモ → Sheets 移行）
1. `/import` 画面を作成（設定画面からアクセス）
2. 「筋トレメモ」のスクショ画像をアップロード
3. Gemini Vision APIで以下のプロンプトで解析:
```
以下は「筋トレメモ」アプリのスクリーンショットだ。
トレーニング記録をJSON配列で抽出せよ。前置き不要。
[
  {
    "date": "YYYY-MM-DD",
    "exercise": "種目名（日本語）",
    "body_part": "胸|背中|脚|肩|腕|体幹",
    "sets": [
      { "set_number": 1, "weight_kg": 数値, "reps": 数値 }
    ]
  }
]
日付が読み取れない場合は "unknown" とせよ。
```
4. 解析結果をプレビュー表示 → ユーザーが確認 → [一括保存] でSheetsのWorkoutsシートへ書き込む
5. 毎回のトレ後送信も同じ画面・同じロジックで処理する（新規 or 追記を自動判定）

### Phase 4: トレーニング管理機能
1. 部位・種目選択UI
2. 前回データ取得とプレースホルダー自動入力
3. セット入力・保存
4. ヒートマップ表示

### Phase 5: 目標管理・アドバイス機能
1. 初期設定画面
2. KPI計算・表示
3. アドバイス生成（Gemini API）

---

## 8. UI/デザイン原則

- 背景: `#0a0a0a`（ほぼ黒）
- アクセントカラー: `#39FF14`（ネオングリーン）
- フォント: システムフォント（SF Pro）でOK、見出しのみ太字
- タップターゲット: 最小44px × 44px
- アニメーション: 最小限（スピナーとトースト通知のみ）
- 1画面に情報を詰めすぎない（スクロールより画面遷移を優先）
