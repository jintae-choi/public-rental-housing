/**
 * 마이홈 사이트 셀렉터 디버그 — 실제 페이지를 열고 어떤 구조인지 덤프
 *
 * 왜 필요한가:
 *   2026-04-13 cron run에서 `table.tb-list tbody tr a.li-title` 셀렉터가 30s 타임아웃.
 *   사이트 구조가 바뀌었거나 fnSearch()가 더 이상 호출되지 않는지 확인 필요.
 *
 * 출력:
 *   - /tmp/myhome-before.html  (fnSearch 전)
 *   - /tmp/myhome-after.html   (fnSearch 후)
 *   - /tmp/myhome-after.png    (스크린샷)
 *   - 콘솔에 후보 셀렉터 카운트
 *
 * 실행: npx tsx scripts/debug-myhome.ts
 */

import { chromium } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const LIST_URL =
  "https://www.myhome.go.kr/hws/portal/sch/selectRsdtRcritNtcView.do";

const TMP = os.tmpdir();
const p = (name: string): string => path.join(TMP, name);

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "ko-KR",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  page.on("console", (msg) => console.log(`[browser ${msg.type()}]`, msg.text()));
  page.on("pageerror", (err) => console.log("[browser pageerror]", err.message));
  page.on("request", (req) => {
    const url = req.url();
    // 정적 자원(이미지/CSS/JS/font)만 제외
    if (/\.(png|jpg|jpeg|gif|svg|css|woff2?|ttf|ico)(\?|$)/i.test(url)) return;
    if (url.includes(".js") && !url.includes("nf.")) return;
    console.log(`[req ${req.method()}]`, url);
    if (req.method() === "POST") {
      const data = req.postData();
      if (data) console.log(`  body:`, data.slice(0, 300));
    }
  });
  page.on("response", async (res) => {
    const url = res.url();
    if (/\.(png|jpg|jpeg|gif|svg|css|woff2?|ttf|ico)(\?|$)/i.test(url)) return;
    if (url.includes(".js") && !url.includes("nf.")) return;
    {
      const ct = res.headers()["content-type"] ?? "";
      console.log(`[res ${res.status()}]`, url, `(${ct})`);
      if (ct.includes("json") || ct.includes("html") || ct.includes("text")) {
        try {
          const text = await res.text();
          if (url.includes("selectRsdtRcritNtcList")) {
            await fs.writeFile(p("myhome-list-response.html"), text);
            console.log(`  saved list response (${text.length} bytes)`);
          }
          console.log(`  body[0..800]:`, text.slice(0, 800));
        } catch (e) {
          console.log(`  (body read failed)`);
        }
      }
    }
  });

  try {
    console.log("[goto]", LIST_URL);
    await page.goto(LIST_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

    const beforeHtml = await page.content();
    await fs.writeFile(p("myhome-before.html"), beforeHtml);
    console.log("[saved] /tmp/myhome-before.html bytes=", beforeHtml.length);

    // fnSearch 함수 존재 여부
    const hasFnSearch = await page.evaluate(() => {
      const win = window as Window & { fnSearch?: unknown };
      return typeof win.fnSearch === "function";
    });
    console.log("[fnSearch exists?]", hasFnSearch);

    if (hasFnSearch) {
      // 실제 검색 버튼 클릭 시뮬레이션 (필터 없이)
      const searchBtn = await page.$("button.btn-road-search-requirement, button.btn.lg:has(i.icon-search)");
      console.log("[search btn found?]", !!searchBtn);

      // 진행상태=모집중 라디오 강제 선택 후 검색 → 빈 쿼리 회피
      await page.evaluate(() => {
        const radio = document.querySelector<HTMLInputElement>(
          'input[name="srchPrgrStts"][value="1"]'
        );
        if (radio) radio.checked = true;
      });
      console.log("[set] srchPrgrStts=1 (모집중)");

      console.log("[call] fnSearch('1')");
      await page.evaluate(() => {
        const win = window as Window & { fnSearch?: (p: string) => void };
        win.fnSearch?.("1");
      });
      // NetFunnel + AJAX 충분 대기
      await page.waitForTimeout(15000);
    }

    const afterHtml = await page.content();
    await fs.writeFile(p("myhome-after.html"), afterHtml);
    console.log("[saved] /tmp/myhome-after.html bytes=", afterHtml.length);

    await page.screenshot({ path: p("myhome-after.png"), fullPage: true });
    console.log("[saved]", p("myhome-after.png"));

    // 후보 셀렉터 카운트
    const counts = await page.evaluate(() => {
      const sels = [
        "table.tb-list",
        "table.tb-list tbody tr",
        "table.tb-list tbody tr a.li-title",
        "a.li-title",
        "table tbody tr",
        ".tb-list",
        "[class*=li-title]",
        "[class*=tb-list]",
        ".board-list",
        ".list-area",
        "ul.list",
        "ul.list li",
        "div.bbs-list",
        "div.bbs-list tbody tr",
        ".lst-tbl",
        ".lst-tbl tbody tr",
      ];
      const result: Record<string, number> = {};
      for (const s of sels) {
        try {
          result[s] = document.querySelectorAll(s).length;
        } catch {
          result[s] = -1;
        }
      }
      // body 내 모든 table의 class 목록
      const tableClasses = Array.from(document.querySelectorAll("table"))
        .map((t) => t.className)
        .filter((c) => c);
      result["__all_table_classes"] = tableClasses.length as unknown as number;
      console.log("[probe] table classes:", JSON.stringify(tableClasses));
      // 모든 li-title 비슷한 a 태그
      const anchors = Array.from(document.querySelectorAll("a"))
        .filter((a) => a.className && a.className.includes("title"))
        .slice(0, 5)
        .map((a) => `${a.tagName}.${a.className}: ${a.textContent?.trim().slice(0, 40)}`);
      console.log("[probe] title-ish anchors:", JSON.stringify(anchors));
      return result;
    });

    console.log("\n=== 셀렉터 카운트 ===");
    for (const [sel, count] of Object.entries(counts)) {
      console.log(`  ${count}  ${sel}`);
    }

    // 페이지 타이틀과 URL
    console.log("\n[page title]", await page.title());
    console.log("[page url]", page.url());
  } catch (e) {
    console.error("디버그 실행 중 에러:", e);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main().then(() => process.exit(process.exitCode ?? 0));
