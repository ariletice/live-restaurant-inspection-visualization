"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  pestGuidance,
  type RestaurantHistory,
  type RestaurantMatch,
} from "./restaurant-types";

type RequestState = "idle" | "loading" | "success" | "error";

function address(restaurant: RestaurantMatch) {
  return [restaurant.building, restaurant.street, restaurant.borough, restaurant.zipcode]
    .filter(Boolean)
    .join(", ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "The request failed.");
  return payload;
}

export default function RestaurantPage() {
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState<RequestState>("idle");
  const [results, setResults] = useState<RestaurantMatch[]>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [selected, setSelected] = useState<RestaurantMatch | null>(null);
  const [historyState, setHistoryState] = useState<RequestState>("idle");
  const [history, setHistory] = useState<RestaurantHistory | null>(null);
  const [historyMessage, setHistoryMessage] = useState("");

  const pestInspections = useMemo(
    () => history?.inspections.filter((inspection) => inspection.pestViolations.length > 0) ?? [],
    [history],
  );
  const latestInspection = history?.inspections.find(
    (inspection) => inspection.grade !== "Not graded" || inspection.score !== "Not reported",
  ) ?? history?.inspections[0];

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = query.trim();
    if (cleaned.length < 2) {
      setSearchState("error");
      setSearchMessage("Enter at least two characters from the restaurant name or street.");
      return;
    }
    setSearchState("loading");
    setSearchMessage("");
    setSelected(null);
    setHistory(null);
    setHistoryState("idle");
    try {
      const response = await fetch(`/api/restaurants/search?query=${encodeURIComponent(cleaned)}`);
      const payload = await readJson<{ restaurants: RestaurantMatch[] }>(response);
      setResults(payload.restaurants);
      setSearchState("success");
      if (!payload.restaurants.length) {
        setSearchMessage("We couldn't find a restaurant matching that search. Try its street, borough, or another spelling.");
      }
    } catch (error) {
      setResults([]);
      setSearchState("error");
      setSearchMessage(error instanceof Error ? error.message : "We couldn't search right now.");
    }
  }

  async function chooseRestaurant(restaurant: RestaurantMatch) {
    setSelected(restaurant);
    setHistoryState("loading");
    setHistory(null);
    setHistoryMessage("");
    try {
      const response = await fetch(`/api/restaurants/${restaurant.camis}`);
      setHistory(await readJson<RestaurantHistory>(response));
      setHistoryState("success");
    } catch (error) {
      setHistoryState("error");
      setHistoryMessage(error instanceof Error ? error.message : "We couldn't retrieve this record.");
    }
  }

  return (
    <main className="restaurant-tool">
      <header className="tool-topbar">
        <Link className="wordmark" href="/"><span>NYC</span> Pest Prep</Link>
        <Link className="story-link" href="/">← Return to the data story</Link>
      </header>

      <section className="tool-hero">
        <div>
          <p className="eyebrow">A practical next step</p>
          <h1>What does NYC inspection data say about your restaurant?</h1>
          <p>Find your location, review its verified pest-related inspection history, and leave with a preventative action you can take next.</p>
        </div>
        <aside>
          <strong>Live NYC records</strong>
          <span>This tool retrieves current information from the NYC Department of Health restaurant inspection dataset.</span>
        </aside>
      </section>

      <section className="restaurant-search" aria-labelledby="restaurant-search-heading">
        <div className="search-heading">
          <span>01</span>
          <div><p className="eyebrow">Find the correct location</p><h2 id="restaurant-search-heading">Find your restaurant</h2></div>
        </div>
        <form onSubmit={search}>
          <label htmlFor="restaurant-query">Restaurant name or street</label>
          <div className="search-controls">
            <input
              id="restaurant-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try Katz's or East Houston Street"
              autoComplete="off"
            />
            <button type="submit" disabled={searchState === "loading"}>
              {searchState === "loading" ? "Searching…" : "Search NYC records"}
            </button>
          </div>
        </form>

        <div className="search-feedback" aria-live="polite">
          {searchState === "loading" && <p>Searching the live NYC inspection dataset…</p>}
          {searchMessage && <p className={searchState === "error" ? "error-message" : "empty-message"}>{searchMessage}</p>}
        </div>

        {results.length > 0 && (
          <div className="restaurant-results" aria-label="Matching restaurants">
            <div className="results-label"><strong>{results.length} possible location{results.length === 1 ? "" : "s"}</strong><span>Confirm the address before continuing.</span></div>
            {results.map((restaurant) => (
              <button
                key={restaurant.camis}
                className={selected?.camis === restaurant.camis ? "selected" : ""}
                onClick={() => void chooseRestaurant(restaurant)}
              >
                <span><strong>{restaurant.name}</strong><small>{address(restaurant)}</small></span>
                <span>{restaurant.borough}<b>→</b></span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <section className="inspection-results" aria-labelledby="inspection-results-heading">
          <div className="search-heading">
            <span>02</span>
            <div><p className="eyebrow">Verified inspection history</p><h2 id="inspection-results-heading">Understand the record</h2></div>
          </div>

          {historyState === "loading" && <div className="history-state" role="status"><i /><strong>Loading {selected.name}&apos;s inspection history…</strong><span>We are matching records using the restaurant&apos;s CAMIS identifier.</span></div>}
          {historyState === "error" && <div className="history-state error-state"><strong>{historyMessage}</strong><button onClick={() => void chooseRestaurant(selected)}>Try again</button></div>}

          {historyState === "success" && history && (
            <div className="history-content">
              <article className="restaurant-snapshot">
                <p className="record-label">OFFICIAL NYC OPEN DATA</p>
                <h3>{history.restaurant.name}</h3>
                <p>{address(history.restaurant)}</p>
                <dl>
                  <div><dt>Latest inspection</dt><dd>{latestInspection ? formatDate(latestInspection.date) : "Not available"}</dd></div>
                  <div><dt>Latest grade</dt><dd>{latestInspection?.grade || "Not available"}</dd></div>
                  <div><dt>Latest score</dt><dd>{latestInspection?.score || "Not available"}</dd></div>
                  <div><dt>Pest-related inspections found</dt><dd>{pestInspections.length}</dd></div>
                </dl>
                <a href={history.sourceUrl} target="_blank" rel="noreferrer">View the source records ↗</a>
              </article>

              <div className="pest-history">
                <div className="interpretation-key">
                  <span><i className="official-dot" />Official NYC record</span>
                  <span><i className="product-dot" />Plain-language product guidance</span>
                </div>

                {!pestInspections.length ? (
                  <div className="no-pest-state">
                    <span>✓</span>
                    <h3>No pest-related violations were found in this restaurant&apos;s available inspection history.</h3>
                    <p>This does not guarantee current conditions. Continue routine monitoring, sanitation, waste management, and entry-point checks.</p>
                    <a href="https://www.nyc.gov/site/doh/business/food-operators/operating-a-restaurant.page" target="_blank" rel="noreferrer">View preventative NYC pest guidance ↗</a>
                  </div>
                ) : (
                  <>
                    <p className="history-caution">These are historical inspection findings, not a statement about the restaurant&apos;s current condition.</p>
                    {pestInspections.map((inspection) => (
                      <article className="inspection-card" key={inspection.key}>
                        <header><div><span>INSPECTION RECORD</span><strong>{formatDate(inspection.date)}</strong></div><small>{inspection.type}</small></header>
                        {inspection.pestViolations.map((violation) => {
                          const guidance = pestGuidance[violation.code];
                          return (
                            <div className="violation-result" key={violation.code}>
                              <div className="official-record"><span>Official finding · Code {violation.code}</span><h3>{guidance.label}</h3><p>{violation.description}</p></div>
                              <div className="product-guidance"><span>What this means</span><p>{guidance.plainLanguage}</p><strong>Preventative next step</strong><p>{guidance.nextStep}</p></div>
                            </div>
                          );
                        })}
                      </article>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="professional-help">
        <div><p className="eyebrow">Need professional support?</p><h2>Bring the record to a licensed pest professional.</h2><p>A provider can inspect current conditions and help turn a historical finding into a prevention plan. A past inspection record does not confirm that a problem is still present.</p></div>
        <a href="https://extapps.dec.ny.gov/nyspad/find?1" target="_blank" rel="noreferrer">Search New York pesticide businesses ↗</a>
      </section>

      <footer className="tool-footer"><strong>NYC Pest Prep</strong><span>Official records come from NYC Open Data. Explanations and recommendations are product-generated guidance, not an official NYC determination.</span></footer>
    </main>
  );
}
