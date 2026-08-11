"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { RestaurantMatch } from "./restaurant-types";

type RequestState = "idle" | "loading" | "success" | "error";

function address(restaurant: RestaurantMatch) {
  return [restaurant.building, restaurant.street, restaurant.borough, restaurant.zipcode]
    .filter(Boolean)
    .join(", ");
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "The request failed.");
  return payload;
}

export default function RestaurantPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState<RequestState>("idle");
  const [results, setResults] = useState<RestaurantMatch[]>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [openingCamis, setOpeningCamis] = useState<string | null>(null);

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
    setOpeningCamis(null);
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

  function chooseRestaurant(restaurant: RestaurantMatch) {
    setOpeningCamis(restaurant.camis);
    router.push(`/restaurant/${restaurant.camis}`);
  }

  return (
    <main className="restaurant-tool restaurant-search-page">
      <header className="tool-topbar">
        <Link className="wordmark" href="/"><span>NYC</span> Pest Prep</Link>
        <Link className="story-link" href="/">← Return to the data story</Link>
      </header>

      <section className="tool-hero">
        <div>
          <p className="eyebrow">A practical next step</p>
          <h1>What does NYC inspection data say about your restaurant?</h1>
          <p>Find the correct location first. Its verified pest-related inspection history will open on a separate results page.</p>
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
            <div className="results-label"><strong>{results.length} possible location{results.length === 1 ? "" : "s"}</strong><span>Confirm the address before opening the inspection results.</span></div>
            {results.map((restaurant) => (
              <button
                key={restaurant.camis}
                className={openingCamis === restaurant.camis ? "selected" : ""}
                onClick={() => chooseRestaurant(restaurant)}
                disabled={openingCamis !== null}
              >
                <span><strong>{restaurant.name}</strong><small>{address(restaurant)}</small></span>
                <span>{openingCamis === restaurant.camis ? "Opening…" : restaurant.borough}<b>→</b></span>
              </button>
            ))}
          </div>
        )}
      </section>

      <footer className="tool-footer"><strong>NYC Pest Prep</strong><span>Selecting a restaurant opens a separate page matched by its unique CAMIS identifier.</span></footer>
    </main>
  );
}
