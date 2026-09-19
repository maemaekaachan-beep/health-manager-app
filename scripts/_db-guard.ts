// scripts/seed.ts と scripts/reset-demo-data.ts で共有する安全チェック。
// 接続先ホストが health-manager-demo のものと一致するかを検証し、
// 一致しない・判定できない場合は必ず中断する。
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

// health-manager-demo (Vercel) の Neon エンドポイントID。
// .env.local を `vercel env pull` で取得した際のホスト名から採取したもの。
const EXPECTED_DEMO_HOST_FRAGMENT = 'ep-crimson-voice-avwwl5bj';

export function connectToDemoDatabase(): { sql: NeonQueryFunction<false, false>; host: string } {
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('DATABASE_URL (or POSTGRES_URL) environment variable is not set');
    process.exit(1);
  }

  let host: string;
  try {
    host = new URL(connectionString).hostname;
  } catch {
    console.error('DATABASE_URL の形式が不正で接続先ホストを判定できません。安全のため中断します。');
    process.exit(1);
  }

  if (!host.includes(EXPECTED_DEMO_HOST_FRAGMENT)) {
    console.error(
      `接続先ホスト "${host}" がデモ用DB (${EXPECTED_DEMO_HOST_FRAGMENT} を含むはず) と一致しません。\n` +
        '本番など別環境のDATABASE_URLを読み込んでいないか確認してください。安全のため中断します。'
    );
    process.exit(1);
  }

  return { sql: neon(connectionString), host };
}

export async function confirm(message: string): Promise<boolean> {
  if (process.argv.includes('--yes') || process.argv.includes('-y')) return true;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(message);
    return answer.trim().toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}
