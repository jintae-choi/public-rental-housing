/**
 * 커스텀 마이그레이션 러너
 *
 * 왜 drizzle-kit migrate 대신 이걸 쓰는가:
 *   CI에서 `drizzle-kit migrate`가 에러 메시지 없이 exit 1로 조용히 실패.
 *   drizzle-orm/migrator를 직접 호출하면 postgres.js 드라이버의 에러를 그대로 볼 수 있어 디버깅이 쉽다.
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL 누락");
  process.exit(1);
}

async function main(): Promise<void> {
  console.log("[migrate] connecting...");
  const client = postgres(DATABASE_URL!, {
    max: 1,
    connect_timeout: 30,
    onnotice: (n) => console.log("[notice]", n.message),
  });
  const db = drizzle(client);

  try {
    console.log("[migrate] applying migrations from ./drizzle");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("[migrate] ✅ done");
  } catch (e) {
    console.error("[migrate] ❌ 실패:", e);
    if (e instanceof Error) {
      console.error("message:", e.message);
      console.error("stack:", e.stack);
      // postgres.js PostgresError 확장 필드
      const pgErr = e as unknown as {
        code?: string;
        detail?: string;
        hint?: string;
        position?: string;
        where?: string;
        file?: string;
        line?: string;
        routine?: string;
      };
      if (pgErr.code) {
        console.error("pg code:", pgErr.code);
        console.error("pg detail:", pgErr.detail);
        console.error("pg hint:", pgErr.hint);
        console.error("pg position:", pgErr.position);
        console.error("pg where:", pgErr.where);
      }
    }
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
