// デモ用ダミーデータ投入スクリプト。
// 実行日から直近14日分のダミーデータ(食事・睡眠・体重・歩数・排便・疾患/症状)を
// 「追加のみ」で投入する。既存データの削除・上書きは一切行わない(profileテーブルも触らない)。
//
// 安全のため、実行前に接続先ホストがデモ用DB(health-manager-demo)であることを
// 確認し、一致しない場合・判定できない場合は必ず中断する(scripts/_db-guard.ts)。
//
// 使い方:
//   npx tsx --env-file=.env.local scripts/seed.ts        # 対話確認あり
//   npx tsx --env-file=.env.local scripts/seed.ts --yes   # 確認をスキップ(CI等)
import { randomUUID } from 'node:crypto';
import { connectToDemoDatabase, confirm } from './_db-guard.ts';
import { getNutrientTargets, type TargetSpec } from '../src/data/nutritionReference.ts';
import type { Profile } from '../src/types.ts';

const { sql, host } = connectToDemoDatabase();

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function rand(min: number, max: number, decimals = 0): number {
  const v = Math.random() * (max - min) + min;
  return decimals ? Number(v.toFixed(decimals)) : Math.round(v);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// カロリー配分などと同じ考え方で、日別合計値を各食事のカロリー比率に応じて
// ばらつきを持たせつつ配分する(合計は dailyTotal に一致するよう正規化する)。
function distribute(dailyTotal: number, mealCalories: number[], decimals: number): number[] {
  const totalCal = mealCalories.reduce((a, b) => a + b, 0);
  const raw = mealCalories.map((c) => (c / totalCal) * dailyTotal * (rand(85, 115) / 100));
  const rawSum = raw.reduce((a, b) => a + b, 0);
  const scale = rawSum === 0 ? 0 : dailyTotal / rawSum;
  return raw.map((v) => {
    const scaled = v * scale;
    return decimals ? Number(scaled.toFixed(decimals)) : Math.round(scaled);
  });
}

function specMidpoint(spec: TargetSpec): number {
  return spec.kind === 'range' ? (spec.min + spec.max) / 2 : spec.value;
}

// ---- 食事 ----
const mealNames: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', string[]> = {
  breakfast: ['ご飯と味噌汁、焼き鮭', 'トーストと卵', 'ヨーグルトとバナナ', '納豆ご飯', 'オートミールとフルーツ'],
  lunch: ['鶏むね肉の定食', 'パスタ', 'そば', '鮭弁当', '野菜たっぷりうどん'],
  dinner: ['野菜炒めと豆腐', '鮭の塩焼き定食', '鍋料理', '豚しゃぶサラダ', '麻婆豆腐と雑穀米'],
  snack: ['ナッツ少々', 'プロテインバー', 'みかん', 'ヨーグルト', '小さめおにぎり'],
};
const CALORIE_RATIO: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', number> = {
  breakfast: 0.22,
  lunch: 0.32,
  dinner: 0.33,
  snack: 0.13,
};

interface MealRow {
  id: string;
  date: string;
  time: string;
  name: string;
  calories: number;
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  protein: number;
  fat: number;
  carbs: number;
  calcium: number;
  iron: number;
  vitaminA: number;
  vitaminB1: number;
  vitaminB2: number;
  vitaminC: number;
  vitaminE: number;
  fiber: number;
  salt: number;
}

const meals: MealRow[] = [];
const sleepEntries: { id: string; date: string; bedtime: string; wakeTime: string; duration: number; quality: number }[] = [];
const weightEntries: { id: string; date: string; weight: number; bodyFat: number; note: string }[] = [];
const stepEntries: { id: string; date: string; steps: number }[] = [];
const bowelEntries: { id: string; date: string; time: string; bristol: number; amount: string; count: number }[] = [];

// 実際のプロフィール(年齢・性別)に基づいて、アプリと同じ推奨摂取量ロジックから
// 栄養素の目安値を取得する。プロフィール未設定の場合は30歳・女性を仮定する。
const profileRows = (await sql`select payload from profile where id = 1`) as unknown as { payload: Partial<Profile> }[];
const profile = profileRows[0]?.payload ?? {};
const profileForTargets: Profile = profile.age && profile.gender ? (profile as Profile) : { age: 30, gender: 'female' };
const targets = getNutrientTargets(profileForTargets);
if (!targets) {
  throw new Error('栄養素の目安値を算出できませんでした(想定外のプロフィール値)');
}

const DAYS = 14;

// 体重は日々の急変を避けるため、古い日付から順に「前日比±0.5kg以内」の
// ランダムウォークで生成する(64.0〜66.9kg台に収める)。1日1件のみ。
let walkingWeight = rand(640, 660, 1) / 10; // 64.0〜66.0kg からスタート
const weightByDaysAgo = new Map<number, number>();
for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
  walkingWeight += rand(-5, 5, 1) / 10; // 前日比 ±0.5kg 以内
  walkingWeight = Math.min(66.9, Math.max(64.0, Number(walkingWeight.toFixed(1))));
  weightByDaysAgo.set(daysAgo, walkingWeight);
}

for (let daysAgo = 0; daysAgo < DAYS; daysAgo++) {
  const date = dateStr(daysAgo);

  // 食事: 毎日3食+間食、日別合計カロリーを1600〜2200kcalの範囲でばらつかせる
  const dailyTarget = rand(1600, 2200);
  const categories: Array<'breakfast' | 'lunch' | 'dinner' | 'snack'> = ['breakfast', 'lunch', 'dinner', 'snack'];
  const rawCalories = categories.map((c) => CALORIE_RATIO[c] * dailyTarget * (rand(85, 115) / 100));
  const rawSum = rawCalories.reduce((a, b) => a + b, 0);
  const scale = dailyTarget / rawSum;
  const mealCalories = rawCalories.map((v) => Math.round(v * scale));

  // 栄養素の日別合計値(アプリの推奨摂取量ロジックに合わせて算出)。
  // たんぱく質は目安の1.05〜1.3倍程度(平均して約1.2倍)、塩分は6.0〜8.0gに収め、
  // 赤(過剰)表示が常時にならないようにする。他の栄養素は目安の80〜120%でばらつかせる。
  const dailyProtein = targets.protein.kind === 'target' ? targets.protein.value * (rand(105, 130) / 100) : 60;
  const dailyFat = (dailyTarget * (rand(22, 28) / 100)) / 9;
  const dailyCarbs = (dailyTarget * (rand(53, 62) / 100)) / 4;
  const dailySalt = rand(60, 80) / 10;
  const dailyCalcium = specMidpoint(targets.calcium) * (rand(80, 120) / 100);
  const dailyIron = specMidpoint(targets.iron) * (rand(80, 120) / 100);
  const dailyVitaminA = specMidpoint(targets.vitaminA) * (rand(80, 120) / 100);
  const dailyVitaminB1 = specMidpoint(targets.vitaminB1) * (rand(80, 120) / 100);
  const dailyVitaminB2 = specMidpoint(targets.vitaminB2) * (rand(80, 120) / 100);
  const dailyVitaminC = specMidpoint(targets.vitaminC) * (rand(80, 130) / 100);
  const dailyVitaminE = specMidpoint(targets.vitaminE) * (rand(80, 120) / 100);
  const dailyFiber = specMidpoint(targets.fiber) * (rand(80, 115) / 100);

  const proteinPerMeal = distribute(dailyProtein, mealCalories, 0);
  const fatPerMeal = distribute(dailyFat, mealCalories, 0);
  const carbsPerMeal = distribute(dailyCarbs, mealCalories, 0);
  const saltPerMeal = distribute(dailySalt, mealCalories, 1);
  const calciumPerMeal = distribute(dailyCalcium, mealCalories, 0);
  const ironPerMeal = distribute(dailyIron, mealCalories, 1);
  const vitaminAPerMeal = distribute(dailyVitaminA, mealCalories, 0);
  const vitaminB1PerMeal = distribute(dailyVitaminB1, mealCalories, 2);
  const vitaminB2PerMeal = distribute(dailyVitaminB2, mealCalories, 2);
  const vitaminCPerMeal = distribute(dailyVitaminC, mealCalories, 0);
  const vitaminEPerMeal = distribute(dailyVitaminE, mealCalories, 1);
  const fiberPerMeal = distribute(dailyFiber, mealCalories, 1);

  categories.forEach((category, idx) => {
    const names = mealNames[category];
    const baseTime =
      category === 'breakfast' ? [7, 0] : category === 'lunch' ? [12, 30] : category === 'dinner' ? [19, 0] : [15, 0];
    const hour = Math.min(23, Math.max(0, baseTime[0] + rand(-1, 1)));
    const minute = Math.min(59, Math.max(0, baseTime[1] + rand(-20, 20)));

    meals.push({
      id: randomUUID(),
      date,
      time: `${pad2(hour)}:${pad2(minute)}`,
      name: names[Math.floor(Math.random() * names.length)],
      calories: mealCalories[idx],
      category,
      protein: proteinPerMeal[idx],
      fat: fatPerMeal[idx],
      carbs: carbsPerMeal[idx],
      calcium: calciumPerMeal[idx],
      iron: ironPerMeal[idx],
      vitaminA: vitaminAPerMeal[idx],
      vitaminB1: vitaminB1PerMeal[idx],
      vitaminB2: vitaminB2PerMeal[idx],
      vitaminC: vitaminCPerMeal[idx],
      vitaminE: vitaminEPerMeal[idx],
      fiber: fiberPerMeal[idx],
      salt: saltPerMeal[idx],
    });
  });

  // 睡眠: 6〜9時間。今日(daysAgo=0)は就寝時刻が未来になり得るため作らない。1日1件のみ。
  if (daysAgo > 0) {
    const durationMin = rand(360, 540);
    const wakeHour = rand(6, 8);
    const wakeMinute = rand(0, 59);
    const wakeTotalMin = wakeHour * 60 + wakeMinute;
    const bedTotalMin = (wakeTotalMin - durationMin + 24 * 60) % (24 * 60);
    sleepEntries.push({
      id: randomUUID(),
      date,
      bedtime: `${pad2(Math.floor(bedTotalMin / 60))}:${pad2(bedTotalMin % 60)}`,
      wakeTime: `${pad2(wakeHour)}:${pad2(wakeMinute)}`,
      duration: durationMin,
      quality: rand(2, 5),
    });
  }

  // 体重: 64〜66kg台で前日比±0.5kg以内のランダムウォーク。1日1件のみ。
  weightEntries.push({
    id: randomUUID(),
    date,
    weight: weightByDaysAgo.get(daysAgo)!,
    bodyFat: rand(180, 220, 1) / 10,
    note: '',
  });

  // 歩数。1日1件のみ。
  stepEntries.push({
    id: randomUUID(),
    date,
    steps: rand(3000, 12000),
  });

  // 排便(毎日ではない)
  if (Math.random() > 0.15) {
    bowelEntries.push({
      id: randomUUID(),
      date,
      time: `${pad2(rand(7, 9))}:00`,
      bristol: rand(3, 5),
      amount: ['small', 'medium', 'large'][rand(0, 2)],
      count: 1,
    });
  }
}

// ---- 疾患・症状(明らかに架空のもの) ----
const conditions = [
  {
    id: randomUUID(),
    name: '第三月曜日限定腰重症候群',
    status: 'monitoring' as const,
    note: '月曜日の午前中だけ腰が重くなる謎の症状。原因不明、経過観察中(デモデータ)。',
  },
  {
    id: randomUUID(),
    name: '深夜ラーメン誘発性満腹感',
    status: 'remission' as const,
    note: '深夜0時以降にラーメンを欲する症状。最近は落ち着いている(デモデータ)。',
  },
  {
    id: randomUUID(),
    name: '猫カフェ帰り謎くしゃみ症',
    status: 'new' as const,
    note: '猫カフェから帰った日だけくしゃみが増える気がする。要経過観察(デモデータ)。',
  },
];

async function insertAll(
  table: string,
  rows: Array<{ id: string; date: string; [key: string]: unknown }>
): Promise<void> {
  for (const row of rows) {
    await sql.query(`insert into ${table} (id, date, payload) values ($1, $2, $3) on conflict (id) do nothing`, [
      row.id,
      row.date,
      JSON.stringify(row),
    ]);
  }
  console.log(`inserted: ${table} (${rows.length}件)`);
}

async function insertNoDate(table: string, rows: Array<{ id: string; [key: string]: unknown }>): Promise<void> {
  for (const row of rows) {
    await sql.query(`insert into ${table} (id, payload) values ($1, $2) on conflict (id) do nothing`, [
      row.id,
      JSON.stringify(row),
    ]);
  }
  console.log(`inserted: ${table} (${rows.length}件)`);
}

async function currentCount(table: string): Promise<number> {
  const rows = (await sql.query(`select count(*)::int as count from ${table}`)) as unknown as { count: number }[];
  return rows[0]?.count ?? 0;
}

async function main() {
  console.log('接続先ホスト:', host, '(デモ用DBであることを確認しました)');

  const tables = ['meals', 'sleep_entries', 'weight_entries', 'step_entries', 'bowel_entries', 'conditions'];
  console.log('\n現在の既存件数:');
  for (const t of tables) {
    console.log(`  ${t}: ${await currentCount(t)}件`);
  }

  console.log(`\n以下を追加投入します(既存データは削除・変更しません):`);
  console.log(`  meals: ${meals.length}件 / sleep_entries: ${sleepEntries.length}件 / weight_entries: ${weightEntries.length}件`);
  console.log(`  step_entries: ${stepEntries.length}件 / bowel_entries: ${bowelEntries.length}件 / conditions: ${conditions.length}件`);

  const ok = await confirm('\n続行してよろしいですか? (yes と入力): ');
  if (!ok) {
    console.log('中断しました。');
    process.exit(1);
  }

  await insertAll('meals', meals);
  await insertAll('sleep_entries', sleepEntries);
  await insertAll('weight_entries', weightEntries);
  await insertAll('step_entries', stepEntries);
  await insertAll('bowel_entries', bowelEntries);
  await insertNoDate('conditions', conditions);

  console.log('\nダミーデータの投入が完了しました。');
}

main().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});
