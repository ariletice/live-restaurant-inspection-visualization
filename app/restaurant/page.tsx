"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import type { RestaurantMatch } from "./restaurant-types";

type RequestState = "idle" | "loading" | "success" | "empty" | "error";

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
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [openingCamis, setOpeningCamis] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const listboxId = "restaurant-suggestions";

  const runSearch = useCallback(async (cleaned: string) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setSearchState("loading");
    setIsOpen(true);
    setActiveIndex(-1);
    setOpeningCamis(null);
    try {
      const response = await fetch(`/api/restaurants/search?query=${encodeURIComponent(cleaned)}`, {
        signal: controller.signal,
      });
      const payload = await readJson<{ restaurants: RestaurantMatch[] }>(response);
      if (controller.signal.aborted) return;
      setResults(payload.restaurants);
      setSearchState(payload.restaurants.length ? "success" : "empty");
      setIsOpen(true);
    } catch (error) {
      if (controller.signal.aborted) return;
      setResults([]);
      setSearchState("error");
      setIsOpen(true);
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }, []);

  useEffect(() => {
    const cleaned = query.trim();
    activeRequest.current?.abort();
    setResults([]);
    setActiveIndex(-1);
    setSearchState("idle");
    setIsOpen(false);

    if (cleaned.length < 3) return;

    const debounceTimer = window.setTimeout(() => {
      void runSearch(cleaned);
    }, 400);

    return () => {
      window.clearTimeout(debounceTimer);
      activeRequest.current?.abort();
    };
  }, [query, runSearch]);

  function chooseRestaurant(restaurant: RestaurantMatch) {
    setOpeningCamis(restaurant.camis);
    setIsOpen(false);
    router.push(`/restaurant/${restaurant.camis}`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (isOpen) event.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === "Tab") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (!results.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => current >= results.length - 1 ? 0 : current + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => current <= 0 ? results.length - 1 : current - 1);
    } else if (event.key === "Enter" && isOpen && activeIndex >= 0) {
      event.preventDefault();
      chooseRestaurant(results[activeIndex]);
    }
  }

  const activeOptionId = activeIndex >= 0 && results[activeIndex]
    ? `restaurant-option-${results[activeIndex].camis}-${activeIndex}`
    : undefined;

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
        <div
          className="autocomplete-shell"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setIsOpen(false);
              setActiveIndex(-1);
            }
          }}
        >
          <label htmlFor="restaurant-query">Restaurant name</label>
          <p className="search-help" id="restaurant-search-help">Type at least three letters of the restaurant name.</p>
          <div className="search-controls" aria-busy={searchState === "loading"}>
            <input
              id="restaurant-query"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpeningCamis(null);
              }}
              onFocus={() => {
                if (query.trim().length >= 3 && (results.length || searchState !== "idle")) setIsOpen(true);
              }}
              onClick={() => {
                if (query.trim().length >= 3 && (results.length || searchState !== "idle")) setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Try Burger Bhai"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={isOpen && results.length > 0}
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              aria-describedby="restaurant-search-help restaurant-search-status"
            />
          </div>
          <div id="restaurant-search-status" className="search-feedback">
            {isOpen && searchState === "loading" && <p role="status">Searching NYC restaurant records…</p>}
            {isOpen && searchState === "empty" && <p className="empty-message" role="status">No restaurants found. Check the official name or try another spelling.</p>}
            {isOpen && searchState === "error" && (
              <div className="error-message" role="alert">
                <p>We couldn&apos;t search NYC records right now.</p>
                <button type="button" onClick={() => void runSearch(query.trim())}>Retry</button>
              </div>
            )}
          </div>

          {isOpen && searchState === "success" && results.length > 0 && (
            <div className="autocomplete-dropdown">
              <p><strong>{results.length} matching location{results.length === 1 ? "" : "s"}</strong><span>Choose the correct address.</span></p>
              <ul id={listboxId} role="listbox" aria-label="Matching NYC restaurants">
                {results.map((restaurant, index) => {
                  const optionId = `restaurant-option-${restaurant.camis}-${index}`;
                  const streetAddress = [restaurant.building, restaurant.street].filter(Boolean).join(" ") || "Address unavailable";
                  return (
                    <li
                      id={optionId}
                      role="option"
                      aria-selected={activeIndex === index}
                      tabIndex={-1}
                      key={optionId}
                      className={activeIndex === index ? "active" : ""}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => chooseRestaurant(restaurant)}
                    >
                      <span><strong>{restaurant.name}</strong><small>{streetAddress}</small></span>
                      <span>{openingCamis === restaurant.camis ? "Opening…" : restaurant.borough}<b>→</b></span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </section>

      <footer className="tool-footer"><strong>NYC Pest Prep</strong><span>Selecting a restaurant opens a separate page matched by its unique CAMIS identifier.</span></footer>
    </main>
  );
}
