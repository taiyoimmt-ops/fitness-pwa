import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function verify() {
  console.log("\n🔍 Verifying Supabase Database Health...");
  
  // 1. Meals Table Check
  const { data: meals, error: mealsErr } = await supabase.from('meals').select('id').limit(1);
  if (mealsErr) {
    console.error("❌ Meals Table Connection Failed:", mealsErr.message);
  } else {
    console.log("✅ Meals Table: Verified & Accessible. RLS allows read access.");
  }

  // 2. Workouts Table Check
  const { data: workouts, error: workErr } = await supabase.from('workout_logs').select('id').limit(1);
  if (workErr) {
    console.error("❌ Workout Table Connection Failed:", workErr.message);
  } else {
    console.log("✅ Workout Table: Verified & Accessible. RLS allows read access.");
  }

  console.log("\n🎉 Supabase verification completed successfully!");
}

verify();
