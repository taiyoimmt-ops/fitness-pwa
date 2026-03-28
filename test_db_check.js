import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// .env から直接読み込み
const envPath = '/Users/saru/Desktop/Antig/.env';
const content = fs.readFileSync(envPath, 'utf8');
const env = {};
content.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) env[k.trim()] = v.trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function test() {
  console.log('--- ESM Supabase 接続テスト開始 ---');
  console.log('URL:', env.VITE_SUPABASE_URL);

  const { data, error } = await supabase.from('meals').select('*').limit(1);
  
  if (error) {
    console.error('❌ バックエンド接続エラー:', error.message);
  } else {
    console.log('✅ 接続成功！バックエンドは正常に稼働しています。');
    console.log('Mealsテーブルからのデータ取得:', data);
    console.log('\n--- 結論 ---');
    console.log('システム（DB/APIキー）は正常です。');
    console.log('もしiPhoneで開けない場合は「セーフエリアの設定」か「Vercelの再ビルド」が原因です。');
  }
}

test();
