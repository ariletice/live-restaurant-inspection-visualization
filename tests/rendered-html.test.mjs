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

test("serves the connected restaurant-owner MVP", async () => {
  const response = await render("/restaurant");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /What does NYC inspection data say about your restaurant\?/i);
  assert.match(html, /Find your restaurant/i);
  assert.match(html, /Live NYC records/i);
});

test("connects the story and MVP with the required customer states", async () => {
  const [story, restaurant, searchRoute, historyRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/restaurant/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/restaurants/search/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/restaurants/[camis]/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(story, /href="\/restaurant"/);
  assert.match(story, /Find My Restaurant/);
  assert.match(restaurant, /Loading .*inspection history/);
  assert.match(restaurant, /No pest-related violations were found/);
  assert.match(restaurant, /Try again/);
  assert.match(restaurant, /Official NYC record/);
  assert.match(restaurant, /Plain-language product guidance/);
  assert.match(searchRoute, /camis,dba,boro,building,street,zipcode/);
  assert.match(historyRoute, /\["04K", "04L", "04M", "04N"\]/);
  assert.match(historyRoute, /camis='\$\{camis\}'/);
});
