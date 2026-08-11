"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { pestGuidance, type RestaurantHistory, type RestaurantMatch } from "../restaurant-types";

type HistoryState = "loading" | "success" | "error";

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

export default function RestaurantResultsPage() {
  const { camis } = useParams<{ camis: string }>();
  const [historyState, setHistoryState] = useState<HistoryState>("loading");
  const [history, setHistory] = useState<RestaurantHistory | null>(null);
  const [historyMessage, setHistoryMessage] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    fetch(`/api/restaurants/${camis}`)
      .then(async (response) => {
        const payload = (await response.json()) as RestaurantHistory & { error?: string };
        if (!response.ok) throw new Error(payload.error || "The request failed.");
        return payload;
      })
      .then((payload) => {
        if (!active) return;
        setHistory(payload);
        setHistoryState("success");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setHistoryMessage(error instanceof Error ? error.message : "We couldn't retrieve this record.");
        setHistoryState("error");
      });
    return () => { active = false; };
  }, [camis, requestVersion]);

  const pestInspections = useMemo(
    () => history?.inspections.filter((inspection) => inspection.pestViolations.length > 0) ?? [],
    [history],
  );
  const latestInspection = history?.inspections.find(
    (inspection) => inspection.grade !== "Not graded" || inspection.score !== "Not reported",
  ) ?? history?.inspections[0];

  function retry() {
    setHistoryState("loading");
    setHistoryMessage("");
    setRequestVersion((current) => current + 1);
  }

  return (
    <main className="restaurant-tool restaurant-results-page">
      <header className="tool-topbar">
        <Link className="wordmark" href="/"><span>NYC</span> Pest Prep</Link>
        <Link className="story-link" href="/restaurant">← Search another restaurant</Link>
      </header>

      <section className="inspection-results standalone-results" aria-labelledby="inspection-results-heading">
        <div className="search-heading">
          <span>02</span>
          <div><p className="eyebrow">Verified inspection history</p><h2 id="inspection-results-heading">Understand <span className="text-emphasis emphasis-blue">the record</span></h2></div>
        </div>

        {historyState === "loading" && <div className="history-state" role="status"><i /><strong>Loading inspection history…</strong><span>We are matching records using the restaurant&apos;s CAMIS identifier.</span></div>}
        {historyState === "error" && <div className="history-state error-state"><strong>{historyMessage}</strong><div className="error-actions"><button onClick={retry}>Try again</button><Link href="/restaurant">Return to search</Link></div></div>}

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
                <span><i className="product-dot" />Summary</span>
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
                  <p className="history-caution">These are <strong>historical inspection findings</strong>, not a statement about the restaurant&apos;s current condition.</p>
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

      {historyState === "success" && (
        <section className="professional-help">
          <div><p className="eyebrow">Need professional support?</p><h2>Bring the record to a <span className="text-emphasis emphasis-green">licensed pest professional.</span></h2><p>A provider can inspect current conditions and help turn a historical finding into a prevention plan. A past inspection record does not confirm that a problem is still present.</p></div>
          <a href="https://extapps.dec.ny.gov/nyspad/find?1" target="_blank" rel="noreferrer">Search New York pesticide businesses ↗</a>
        </section>
      )}

      <footer className="tool-footer"><strong>NYC Pest Prep</strong><span>Official records come from NYC Open Data. Explanations and recommendations are product-generated guidance, not an official NYC determination.</span></footer>
    </main>
  );
}
