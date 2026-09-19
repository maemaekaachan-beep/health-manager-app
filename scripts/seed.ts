// デモ用ダミーデータ投入スクリプト。
// 実行日から直近14日分のダミーデータ(食事・睡眠・体重・歩数・排便・疾患/症状)を
// 「追加のみ」で投入する。既存データの削除・上書きは一切行わない(profileテーブルも触らない)。
//
// 安全のため、実行前に接続先ホストがデモ用DB(health-manager-demo)であることを
// 確認し、一致しない場合・判定できない場合は必ず中断する。
//
// 使い方:
//   npx tsx --env-file=.env.local scripts/seed.ts        # 対話確認あり
//   npx tsx --env-file=.env.local scripts/seed.ts --yes   # 確認をスキップ(CI等)
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL (or POSTGRES_URL) environment variable is not set');
}

let host: string;
try {
  host = new URL(connectionString).hostname;
} catch {
  console.error('DATABASE_URL の形式が不正で接続先ホストを判定できません。安全のため中断します。');
  process.exit(1);
}

// health-manager-demo (Vercel) の Neon エンドポイントID。
// .env.local を `vercel env pull` で取得した際のホスト名から採取したもので、
// このスクリプトは接続先がここと一致する場合にのみ実行を続ける。
const EXPECTED_DEMO_HOST_FRAGMENT = 'ep-crimson-voice-avwwl5bj';

if (!host.includes(EXPECTED_DEMO_HOST_FRAGMENT)) {
  console.error(
    `接続先ホスト "${host}" がデモ用DB (${EXPECTED_DEMO_HOST_FRAGMENT} を含むはず) と一致しません。\n` +
      '本番など別環境のDATABASE_URLを読み込んでいないか確認してください。安全のため中断します。'
  );
  process.exit(1);
}

const sql = neon(connectionString);

async function confirm(message: string): Promise<boolean> {
  if (process.argv.includes('--yes') || process.argv.includes('-y')) return true;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(message);
    return answer.trim().toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

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
  salt: number;
}

const meals: MealRow[] = [];
const sleepEntries: { id: string; date: string; bedtime: string; wakeTime: string; duration: number; quality: number }[] = [];
const weightEntries: { id: string; date: string; weight: number; bodyFat: number; note: string }[] = [];
const stepEntries: { id: string; date: string; steps: number }[] = [];
const bowelEntries: { id: string; date: string; time: string; bristol: number; amount: string; count: number }[] = [];

const DAYS = 14;

// 体重は日々の急変を避けるため、古い日付から順にランダムウォークで生成する。
let walkingWeight = rand(640, 660, 1) / 10; // 64.0〜66.0kg からスタート
const weightByDaysAgo = new Map<number, number>();
for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
  walkingWeight += rand(-20, 20, 1) / 10; // 1日あたり最大±2.0kg... ではなく±0.2kg
  walkingWeight = Math.min(66.5, Math.max(64.0, Number(walkingWeight.toFixed(1))));
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

  categories.forEach((category, idx) => {
    const calories = Math.round(rawCalories[idx] * scale);
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
      calories,
      category,
      protein: rand(10, 35),
      fat: rand(5, 20),
      carbs: rand(20, 80),
      salt: rand(10, 45, 1) / 10,
    });
  });

  // 睡眠: 6〜9時間
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

  // 体重: 64〜66kg台でゆるく増減(ランダムウォーク)
  weightEntries.push({
    id: randomUUID(),
    date,
    weight: weightByDaysAgo.get(daysAgo)!,
    bodyFat: rand(180, 220, 1) / 10,
    note: '',
  });

  // 歩数
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
