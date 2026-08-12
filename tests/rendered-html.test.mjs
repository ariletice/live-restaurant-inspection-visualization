import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("keeps the seasonal data story as the homepage", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /pest season/i);
  assert.match(html, /NYC Pest Prep/i);
});

test("presents the seasonal prediction as an accessible multiple-choice question", async () => {
  const story = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(story, /Which season do you believe has the highest rate of critical pest violations in NYC restaurants\?/);
  assert.match(story, /Winter: "A"/);
  assert.match(story, /Spring: "B"/);
  assert.match(story, /Summer: "C"/);
  assert.match(story, /Fall: "D"/);
  assert.match(story, /December–February/);
  assert.match(story, /You chose \$\{seasonAnswerLetters\[overallPrediction\]\}\. \$\{overallPrediction\}\. Continue to reveal the result\./);
  assert.match(story, /aria-label=\{`\$\{seasonAnswerLetters\[season\]\}\. \$\{season\}, \$\{fullSeasonMonths\[season\]\}`\}/);
});

test("serves the connected restaurant-owner MVP", async () => {
  const response = await render("/restaurant");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /What does NYC inspection data say about/i);
  assert.match(html, /your restaurant/i);
  assert.match(html, /Find/i);
  assert.match(html, /Live NYC records/i);
  assert.doesNotMatch(html, /Understand the record/i);
});

test("serves inspection history on a separate CAMIS results page", async () => {
  const response = await render("/restaurant/40732665");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Understand/i);
  assert.match(html, /the record/i);
  assert.match(html, /Loading inspection history/i);
  assert.match(html, /Search another restaurant/i);
});

test("connects the story and MVP with the required customer states", async () => {
  const [story, searchPage, resultsPage, searchRoute, historyRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/restaurant/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/restaurant/[camis]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/restaurants/search/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/restaurants/[camis]/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(story, /href="\/restaurant"/);
  assert.match(story, /Find My Restaurant/);
  assert.match(searchPage, /router\.push\(`\/restaurant\/\$\{restaurant\.camis\}`\)/);
  assert.doesNotMatch(searchPage, /No pest-related violations were found/);
  assert.match(resultsPage, /Loading inspection history/);
  assert.match(resultsPage, /No pest-related violations were found/);
  assert.match(resultsPage, /Try again/);
  assert.match(resultsPage, /Official NYC record/);
  assert.match(resultsPage, /Summary/);
  assert.match(searchRoute, /camis,dba,boro,building,street,zipcode/);
  assert.match(searchRoute, /upper\(dba\) like/);
  assert.match(searchRoute, /"\$limit": "10"/);
  assert.doesNotMatch(searchRoute, /upper\(street\) like/);
  assert.match(historyRoute, /\["04K", "04L", "04M", "04N"\]/);
  assert.match(historyRoute, /camis='\$\{camis\}'/);
});

test("requires three characters before searching restaurant names", async () => {
  const response = await render("/api/restaurants/search?query=ab");
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Enter at least three characters." });
});

test("implements the restaurant autocomplete interaction contract", async () => {
  const searchPage = await readFile(new URL("../app/restaurant/page.tsx", import.meta.url), "utf8");
  assert.match(searchPage, /setTimeout\(\(\) =>/);
  assert.match(searchPage, /}, 400\)/);
  assert.match(searchPage, /AbortController/);
  assert.match(searchPage, /role="combobox"/);
  assert.match(searchPage, /role="listbox"/);
  assert.match(searchPage, /role="option"/);
  assert.match(searchPage, /aria-activedescendant/);
  assert.match(searchPage, /ArrowDown/);
  assert.match(searchPage, /ArrowUp/);
  assert.match(searchPage, /event\.key === "Enter"/);
  assert.match(searchPage, /event\.key === "Escape"/);
  assert.match(searchPage, /event\.key === "Tab"/);
  assert.match(searchPage, /router\.push\(`\/restaurant\/\$\{restaurant\.camis\}`\)/);
  assert.match(searchPage, /We couldn&apos;t search NYC records right now/);
  assert.match(searchPage, />Retry</);
});
