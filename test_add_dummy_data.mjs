import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function injectDummyData() {
  console.log("🛠 Injecting dummy data into Supabase...");
  
  const now = new Date().toISOString();

  // 1. Add a Meal
  console.log("-> Adding Meal...");
  const { error: mealError } = await supabase.from('meals').insert([{
    timestamp: now,
    meal_label: 'ダミー定食（テスト）',
    calories: 750,
    protein_g: 45,
    fat_g: 20,
    carb_g: 80,
    is_analyzed: true
  }]);
  if (mealError) console.error("Meal Insert Error:", mealError);

  // 2. Add a Workout Set
  console.log("-> Adding Workout...");
  const { error: workoutError } = await supabase.from('workout_logs').insert([{
    timestamp: now,
    exercise: 'ベンチプレス',
    body_part: '胸',
    set_number: 1,
    weight_kg: 85,
    reps: 8
  }]);
  if (workoutError) console.error("Workout Insert Error:", workoutError);

  // 3. Add a Goal (or Upsert)
  console.log("-> Upserting Goal...");
  const { error: goalError } = await supabase.from('goals').upsert([{
    goal_id: 'bench_1rm',
    target_value: 100,
    current_value: 85
  }], { onConflict: 'goal_id' });
  if (goalError) console.error("Goal Upsert Error:", goalError);

  console.log("✅ Dummy data injection finished!");
}

injectDummyData();
