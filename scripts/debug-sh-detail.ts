import { chromium } from "playwright";

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    locale: "ko-KR",
  });
  const page = await ctx.newPage();

  // Test 1: list page=2
  console.log("[TEST 1] list page=2");
  await page.goto(
    "https://www.i-sh.co.kr/main/lay2/program/S1T294C297/www/brd/m_247/list.do?multi_itm_seq=2&page=2",
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  const rows = await page.$$eval("#listTb table tbody tr", (trs) => trs.length);
  console.log("  page=2 rows:", rows);
  const onclicks = await page.$$eval(
    "#listTb table tbody tr td.txtL a",
    (as) => as.slice(0, 5).map((a) => a.getAttribute("onclick"))
  );
  console.log("  page=2 first 5 onclick samples:", onclicks);

  // Test 2: list page=160 (last)
  console.log("\n[TEST 2] list page=160");
  await page.goto(
    "https://www.i-sh.co.kr/main/lay2/program/S1T294C297/www/brd/m_247/list.do?multi_itm_seq=2&page=160",
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  const rows160 = await page.$$eval("#listTb table tbody tr", (trs) => trs.length);
  console.log("  page=160 rows:", rows160);

  // Test 3: detail direct GET
  console.log("\n[TEST 3] detail view.do?seq=302870");
  const res = await page.goto(
    "https://www.i-sh.co.kr/main/lay2/program/S1T294C297/www/brd/m_247/view.do?seq=302870&multi_itm_seq=2",
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  console.log("  status:", res?.status());
  console.log("  url after:", page.url());
  console.log("  title:", await page.title());
  const html = await page.content();
  console.log("  html length:", html.length);
  // Look for actual content markers
  const hasViewArea = await page.$("div.boardView, div.viewArea, table.bbs_view, .board_view");
  console.log("  view area selector matched:", !!hasViewArea);
  const titleText = await page.evaluate(() => {
    const sels = ["h3.title", ".board_view .title", ".viewArea .title", "td.txtL", ".bbs_view th"];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el?.textContent) return `${s}: ${el.textContent.trim().slice(0, 100)}`;
    }
    return "(none)";
  });
  console.log("  title-ish:", titleText);

  await browser.close();
}

main().then(() => process.exit(0));
