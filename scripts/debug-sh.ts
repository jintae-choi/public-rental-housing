/**
 * SH 사이트 셀렉터 디버그 — 0건 0에러로 silent fail 원인 확인
 */

import { chromium } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const URL =
  "https://www.i-sh.co.kr/main/lay2/program/S1T294C297/www/brd/m_247/list.do?multi_itm_seq=2";

const TMP = os.tmpdir();
const p = (name: string): string => path.join(TMP, name);

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "ko-KR",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  page.on("console", (msg) => console.log(`[browser ${msg.type()}]`, msg.text()));
  page.on("pageerror", (err) => console.log("[browser pageerror]", err.message));

  try {
    console.log("[goto]", URL);
    const res = await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log("[response]", res?.status(), res?.headers()["content-type"]);

    await page.waitForTimeout(3000);

    const html = await page.content();
    await fs.writeFile(p("sh-list.html"), html);
    console.log("[saved]", p("sh-list.html"), html.length, "bytes");

    await page.screenshot({ path: p("sh-list.png"), fullPage: true });

    // 셀렉터 카운트
    const counts = await page.evaluate(() => {
      const sels = [
        'a[href*="view.do?seq="]',
        'a[href*="view.do"]',
        "a.title",
        "table.bbs_list",
        "table.brd_list",
        "table tbody tr",
        ".board-list",
        ".bbs-list",
        "ul.list",
        "[onclick*=fnView]",
        "[href*=fnView]",
      ];
      const result: Record<string, number> = {};
      for (const s of sels) {
        try {
          result[s] = document.querySelectorAll(s).length;
        } catch {
          result[s] = -1;
        }
      }
      // 모든 a 태그 href 패턴
      const hrefs = Array.from(document.querySelectorAll("a"))
        .map((a) => a.getAttribute("href"))
        .filter((h): h is string => !!h && (h.includes("view") || h.includes("seq") || h.includes("fnView")))
        .slice(0, 10);
      console.log("[probe] view-like hrefs:", JSON.stringify(hrefs));
      // 모든 onclick
      const clicks = Array.from(document.querySelectorAll("[onclick]"))
        .map((el) => el.getAttribute("onclick"))
        .filter((c): c is string => !!c)
        .slice(0, 5);
      console.log("[probe] onclick patterns:", JSON.stringify(clicks));
      // 테이블 클래스
      const tables = Array.from(document.querySelectorAll("table"))
        .map((t) => t.className || "(no class)");
      console.log("[probe] table classes:", JSON.stringify(tables));
      return result;
    });

    console.log("\n=== 셀렉터 카운트 ===");
    for (const [sel, n] of Object.entries(counts)) {
      console.log(`  ${n}  ${sel}`);
    }

    console.log("\n[page title]", await page.title());
    console.log("[page url]", page.url());
  } catch (e) {
    console.error("디버그 에러:", e);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main().then(() => process.exit(process.exitCode ?? 0));
