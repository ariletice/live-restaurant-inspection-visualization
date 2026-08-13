"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ProviderSearchResponse, RestaurantMatch } from "../../restaurant-types";

type ProviderPageState = "loading" | "success" | "error";
type ProviderRadius = 5 | 15;

function restaurantAddress(restaurant: RestaurantMatch) {
  return [restaurant.building, restaurant.street, restaurant.borough, restaurant.zipcode]
    .filter(Boolean)
    .join(", ");
}

function formatExpiration(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatRetrievedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function PestProvidersPage() {
  const { camis } = useParams<{ camis: string }>();
  const [radiusMiles, setRadiusMiles] = useState<ProviderRadius>(5);
  const [pageState, setPageState] = useState<ProviderPageState>("loading");
  const [response, setResponse] = useState<ProviderSearchResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/restaurants/${camis}/providers?radius=${radiusMiles}`, { signal: controller.signal })
      .then(async (providerResponse) => {
        const payload = (await providerResponse.json()) as ProviderSearchResponse & { error?: string };
        if (!providerResponse.ok) throw new Error(payload.error || "The provider search failed.");
        return payload;
      })
      .then((payload) => {
        setResponse(payload);
        setPageState("success");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : "We couldn't retrieve provider records.");
        setPageState("error");
      });
    return () => controller.abort();
  }, [camis, radiusMiles, requestVersion]);

  function loadRadius(radius: ProviderRadius) {
    setRadiusMiles(radius);
    setResponse(null);
    setErrorMessage("");
    setPageState("loading");
  }

  function retry() {
    setErrorMessage("");
    setPageState("loading");
    setRequestVersion((current) => current + 1);
  }

  const noProviders = pageState === "success" && response?.providers.length === 0;

  return (
    <main className="restaurant-tool provider-page">
      <header className="tool-topbar">
        <Link className="wordmark" href="/"><span>NYC</span> Pest Prep</Link>
        <Link className="story-link" href={`/restaurant/${camis}`}>← Back to inspection record</Link>
      </header>

      <section className="provider-hero" aria-labelledby="provider-page-heading">
        <div>
          <p className="eyebrow">A practical next step</p>
          <h1 id="provider-page-heading">Find registered pest-control help.</h1>
          <p>Compare New York State pesticide businesses registered for food-processing work near this restaurant.</p>
        </div>
        <aside>
          <span>NYS CATEGORY</span>
          <strong>7F</strong>
          <p>Food Processing covers pesticide work where exposed food is prepared, packaged, or held.</p>
        </aside>
      </section>

      <section className="provider-results" aria-labelledby="provider-results-heading">
        <div className="provider-results-heading">
          <div>
            <p className="eyebrow">State registration records</p>
            <h2 id="provider-results-heading">Providers near the restaurant</h2>
          </div>
          <div className="radius-control" aria-label="Provider search radius">
            <span>SEARCH AREA</span>
            <button type="button" className={radiusMiles === 5 ? "selected" : ""} aria-pressed={radiusMiles === 5} onClick={() => loadRadius(5)}>5 miles</button>
            <button type="button" className={radiusMiles === 15 ? "selected" : ""} aria-pressed={radiusMiles === 15} onClick={() => loadRadius(15)}>15 miles</button>
          </div>
        </div>

        {pageState === "loading" && (
          <div className="provider-state" role="status">
            <i />
            <strong>Searching current New York State registrations…</strong>
            <span>Checking Category 7F businesses within {radiusMiles} miles.</span>
          </div>
        )}

        {pageState === "error" && (
          <div className="provider-state provider-error" role="alert">
            <strong>{errorMessage}</strong>
            <p>You can retry the search or use the official state directory.</p>
            <div><button type="button" onClick={retry}>Try again</button><a href="https://extapps.dec.ny.gov/nyspad/find?1" target="_blank" rel="noreferrer">Open official directory ↗</a></div>
          </div>
        )}

        {pageState === "success" && response && (
          <div className="provider-content">
            <article className="provider-restaurant-context">
              <span>SEARCHING NEAR</span>
              <strong>{response.restaurant.name}</strong>
              <p>{restaurantAddress(response.restaurant)}</p>
            </article>

            <div className="provider-order-note">
              <strong>How these results are ordered</strong>
              <p>{response.orderingExplanation}</p>
            </div>

            {noProviders ? (
              <div className="provider-empty" role="status">
                <span aria-hidden="true">⌖</span>
                <h3>We could not find a registered Category 7F provider within {radiusMiles} miles.</h3>
                <p>{radiusMiles === 5 ? "Try expanding the search area or use the official state directory." : "Use the official state directory to search by business name, county, or registration number."}</p>
                <div>
                  {radiusMiles === 5 && <button type="button" onClick={() => loadRadius(15)}>Expand to 15 miles</button>}
                  <a href="https://extapps.dec.ny.gov/nyspad/find?1" target="_blank" rel="noreferrer">Open official directory ↗</a>
                </div>
              </div>
            ) : (
              <>
                <div className="provider-count" role="status"><strong>{response.providers.length}</strong><span>current registration{response.providers.length === 1 ? "" : "s"} found within {radiusMiles} miles</span></div>
                <ol className="provider-list">
                  {response.providers.map((provider, index) => (
                    <li key={provider.registrationNumber}>
                      <article className="provider-card">
                        <div className="provider-rank" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
                        <div className="provider-card-main">
                          <div className="provider-card-heading">
                            <div><span className="registration-chip">● {provider.registrationStatus}</span><h3>{provider.businessName}</h3></div>
                            <div className="provider-distance"><strong>{provider.approximateDistanceMiles.toFixed(1)}</strong><span>approx. miles</span></div>
                          </div>
                          <dl>
                            <div><dt>Registration</dt><dd>#{provider.registrationNumber}</dd></div>
                            <div><dt>Category</dt><dd>{provider.categoryCode} — {provider.categoryDescription}</dd></div>
                            <div><dt>Expires</dt><dd>{formatExpiration(provider.expirationDate)}</dd></div>
                            <div><dt>Registered location</dt><dd>{provider.city}, {provider.state} {provider.zipcode}</dd></div>
                          </dl>
                          <p className="provider-distance-note">Approximate distance uses the registered city/ZIP location. It does not confirm the provider&apos;s street address or service area.</p>
                          <div className="provider-actions">
                            <a href={provider.googleMapsSearchUrl} target="_blank" rel="noreferrer">Search on Google Maps ↗</a>
                            <a href={provider.officialVerificationUrl} target="_blank" rel="noreferrer">Verify Registration ↗</a>
                          </div>
                          <p className="verification-instruction">In the state directory, choose “Pesticides Business/Agencies” and search registration #{provider.registrationNumber}.</p>
                        </div>
                      </article>
                    </li>
                  ))}
                </ol>
                {radiusMiles === 5 && <button className="expand-provider-search" type="button" onClick={() => loadRadius(15)}>Expand search to 15 miles →</button>}
              </>
            )}

            <aside className="provider-trust-note">
              <div><span>STATE SOURCE</span><strong>Registration information</strong><p>Registration data is published by New York State and updated monthly. Verify a provider&apos;s current status before hiring.</p><a href={response.source.url} target="_blank" rel="noreferrer">View the state dataset ↗</a></div>
              <div><span>IMPORTANT CONTEXT</span><strong>Information, not endorsement</strong><p>Appearance here is informational and is not an endorsement by NYC, New York State, or NYC Pest Prep.</p><small>State records retrieved {formatRetrievedAt(response.source.retrievedAt)}.</small></div>
            </aside>
          </div>
        )}
      </section>

      <footer className="tool-footer"><strong>NYC Pest Prep</strong><span>Provider registration information comes from New York State Open Data and remains separate from NYC restaurant inspection records.</span></footer>
    </main>
  );
}
