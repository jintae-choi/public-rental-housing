// ⚠️ "server-only" 임포트 금지 — scripts/{scrape,analyze,match}.ts가 이 모듈을 직접 import 하기 때문.
// server-only 패키지는 Next.js RSC 환경 밖에서는 throw 하므로 cron 스크립트가 즉시 실패한다.
// 이 모듈은 사실상 server-only이지만 가드는 호출자(supabase/admin.ts 등)에서 처리.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);

export const db = drizzle(client, { schema });
