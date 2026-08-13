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
  assert.match(html, /Is there one pest season for every NYC restaurant\?/i);
  assert.match(html, /NYC Pest Prep/i);
});

test("adds a gated, session-based audience step before the prediction quiz", async () => {
  const story = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(story, /"Why timing matters",\s+"Who you are",\s+"Make one prediction"/);
  assert.match(story, /Before We Continue, Tell Us Who You Are/);
  assert.match(story, /Which option best describes you\?/);
  assert.match(story, /Restaurant owner or manager/);
  assert.match(story, /Pest-control professional/);
  assert.match(story, /Other or just exploring/);
  assert.match(story, /nyc-pest-prep-audience-role/);
  assert.match(story, /window\.sessionStorage\.setItem\(audienceStorageKey, draftAudienceRole\)/);
  assert.match(story, /type="radio" name="audience-role"/);
  assert.match(story, /disabled=\{!draftAudienceRole\}>Continue to Quiz/);
  assert.match(story, /disabled=\{!audienceRole && index > 2\}/);
});

test("personalizes only the shared story language for each audience role", async () => {
  const story = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(story, /Add a reminder to review prevention steps/);
  assert.match(story, /plan timely education or outreach/);
  assert.match(story, /Learn when recorded pest violations have historically increased/);
  assert.match(story, /season alone does not cause a violation/);
  assert.match(story, /activeAudienceCopy\.insight/);
});

test("condenses the post-quiz story into a historical pest calendar and MVP bridge", async () => {
  const story = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(story, /"Overall result",\s+"Your pest calendar"/);
  assert.doesNotMatch(story, /"Compare pest types"/);
  assert.doesNotMatch(story, /"Monthly timing"/);
  assert.doesNotMatch(story, /"Action plan"/);
  assert.match(story, /What pest should we put on your calendar\?/);
  assert.match(story, /HISTORICAL INSPECTION PATTERN — NOT A FORECAST/);
  assert.match(story, /recorded at their highest inspection rate during/);
  assert.match(story, /Seasonal patterns show when pest violations appeared more often/);
  assert.match(story, /Check My Inspection Record →/);
});

test("restores monthly and seasonal visual comparisons inside the final calendar chapter", async () => {
  const [story, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(story, /useState<ChartView>\("monthly"\)/);
  assert.match(story, /role="tablist" aria-label="Choose a pest data comparison"/);
  assert.match(story, /role="tab" aria-selected=\{chartView === "monthly"\}/);
  assert.match(story, /role="tab" aria-selected=\{chartView === "seasonal"\}/);
  assert.match(story, /event\.key === "ArrowRight"/);
  assert.match(story, /event\.key === "ArrowLeft"/);
  assert.match(story, /analysis\.monthly\[pest\]/);
  assert.match(story, /analysis\.seasonal\[pest\]\[season\]/);
  assert.match(story, /Highest recorded rate/);
  assert.match(story, /the share of unique initial inspections in that month or season/);
  assert.match(styles, /\.compact-monthly-chart/);
  assert.match(styles, /\.seasonal-pest-chart/);
  assert.match(styles, /align-items: end/);
  assert.match(styles, /overflow-x: auto/);
});

test("supports the final CTA with scored inspection evidence", async () => {
  const [story, pestData] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pest-data.ts", import.meta.url), "utf8"),
  ]);

  assert.match(story, /"Your pest calendar",\s+"Why this matters"/);
  assert.match(story, /Pest findings and inspection scores move together/);
  assert.match(story, /outsideARiskRatio\.toFixed\(1\)/);
  assert.match(story, /Check My Inspection Record →/);
  assert.match(pestData, /critical_flag,score/);
  assert.match(pestData, /inspection\.score >= 14/);
});

test("compares one latest initial inspection per nearby restaurant", async () => {
  const [historyRoute, resultsPage] = await Promise.all([
    readFile(new URL("../app/api/restaurants/[camis]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/restaurant/[camis]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(historyRoute, /within_circle\(location/);
  assert.match(historyRoute, /radiusMeters = 500/);
  assert.match(historyRoute, /latestInspectionPerRestaurant/);
  assert.match(historyRoute, /medianScore/);
  assert.match(historyRoute, /comparisonYear/);
  assert.match(historyRoute, /targetInspection/);
  assert.match(historyRoute, /nearbyRestaurantCount/);
  assert.doesNotMatch(historyRoute, /averageScore/);
  assert.doesNotMatch(historyRoute, /outsideARate/);
  assert.match(resultsPage, /How does this restaurant compare nearby\?/);
  assert.match(resultsPage, /latest initial score was/);
  assert.match(resultsPage, /Typical nearby score/);
  assert.match(resultsPage, /Lower inspection scores are better/);
  assert.match(resultsPage, /one latest scored initial inspection/);
  assert.match(resultsPage, /Reinspections remain visible in the timeline but are not included/);
});

test("separates the latest result, pest summary, and full inspection timeline", async () => {
  const resultsPage = await readFile(new URL("../app/restaurant/[camis]/page.tsx", import.meta.url), "utf8");

  assert.match(resultsPage, /LATEST OFFICIAL RESULT · NYC OPEN DATA/);
  assert.match(resultsPage, /latestInspection = history\?\.inspections\.find/);
  assert.match(resultsPage, /Pest findings appeared in/);
  assert.match(resultsPage, /pestInitialCount/);
  assert.match(resultsPage, /pestReinspectionCount/);
  assert.match(resultsPage, /How the record changed over time/);
  assert.match(resultsPage, /timelineInspections\.map/);
  assert.match(resultsPage, /this score \{scoreChange < 0 \? "decreased" : "increased"\}/);
  assert.match(resultsPage, /A later result is not automatically the result of the preceding reinspection/);
});

test("renders inspection history as a compact accessible timeline", async () => {
  const [resultsPage, styles] = await Promise.all([
    readFile(new URL("../app/restaurant/[camis]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(resultsPage, /<details className=\{`timeline-disclosure/);
  assert.match(resultsPage, /const inspectionOpen = expandedInspections\[inspection\.key\] \?\? isLatest/);
  assert.match(resultsPage, /open=\{inspectionOpen\}/);
  assert.match(resultsPage, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(resultsPage, /timeline-year-label/);
  assert.match(resultsPage, /compactDate\(inspection\.date\)/);
  assert.match(resultsPage, /findingHeadline/);
  assert.match(resultsPage, /inspectionKind\(inspection\.type\)/);
  assert.match(resultsPage, /the sequence alone does not show what caused the change/);
  assert.match(styles, /\.timeline-entry::before/);
  assert.match(styles, /\.timeline-date-anchor strong/);
  assert.match(styles, /\.timeline-disclosure summary:focus-visible/);
  assert.doesNotMatch(styles, /\.timeline-marker/);
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
  assert.match(html, /What does NYC inspection data say about your restaurant\?/i);
  assert.match(html, /Find your restaurant/i);
  assert.match(html, /Live NYC records/i);
  assert.doesNotMatch(html, /Understand the record/i);
});

test("serves inspection history on a separate CAMIS results page", async () => {
  const response = await render("/restaurant/40732665");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Understand the record/i);
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
  assert.match(story, /Check My Inspection Record/);
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
