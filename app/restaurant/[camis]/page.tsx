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

function compactDate(value: string) {
  const date = new Date(value);
  return {
    month: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date).toUpperCase(),
    day: new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "UTC" }).format(date),
  };
}

function formatMetric(value: number | null, suffix = "") {
  return value === null ? "Not available" : `${value.toFixed(1)}${suffix}`;
}

function numericScore(value: string) {
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function scoreRange(score: number | null) {
  if (score === null) return "Score range unavailable";
  if (score <= 13) return "A-grade score range (0–13)";
  if (score <= 27) return "B-grade score range (14–27)";
  return "C-grade score range (28 or higher)";
}

function inspectionKind(type: string) {
  if (type.includes("Re-inspection")) return "Reinspection";
  if (type.includes("Initial Inspection")) return "Initial inspection";
  return "Other inspection";
}

export default function RestaurantResultsPage() {
  const { camis } = useParams<{ camis: string }>();
  const [historyState, setHistoryState] = useState<HistoryState>("loading");
  const [history, setHistory] = useState<RestaurantHistory | null>(null);
  const [historyMessage, setHistoryMessage] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  const [expandedInspections, setExpandedInspections] = useState<Record<string, boolean>>({});

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
  const timelineInspections = useMemo(() => [...(history?.inspections ?? [])].reverse(), [history]);
  const latestInspection = history?.inspections.find((inspection) => numericScore(inspection.score) !== null) ?? history?.inspections[0];
  const latestScore = latestInspection ? numericScore(latestInspection.score) : null;
  const pestInitialCount = pestInspections.filter((inspection) => inspection.type.includes("Initial Inspection")).length;
  const pestReinspectionCount = pestInspections.filter((inspection) => inspection.type.includes("Re-inspection")).length;
  const pestOtherCount = pestInspections.length - pestInitialCount - pestReinspectionCount;
  const pestDates = pestInspections.map((inspection) => inspection.date).sort();
  const pestLabels = [...new Set(pestInspections.flatMap((inspection) => inspection.pestViolations.map((violation) => pestGuidance[violation.code].label)))];
  const nearbyComparison = history?.nearbyComparison.status === "available" ? history.nearbyComparison : null;
  const nearbyScoreDifference = nearbyComparison
    ? nearbyComparison.targetInspection.score - nearbyComparison.nearbyMedianScore
    : null;
  const comparisonScaleMax = nearbyComparison
    ? Math.max(40, Math.ceil(Math.max(nearbyComparison.targetInspection.score, nearbyComparison.nearbyMedianScore) / 10) * 10)
    : 40;

  function retry() {
    setHistoryState("loading");
    setHistoryMessage("");
    setRequestVersion((current) => current + 1);
  }

  function setInspectionOpen(inspectionKey: string, open: boolean) {
    setExpandedInspections((current) => ({ ...current, [inspectionKey]: open }));
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
          <div><p className="eyebrow">Verified inspection history</p><h2 id="inspection-results-heading">Understand the record</h2></div>
        </div>

        {historyState === "loading" && <div className="history-state" role="status"><i /><strong>Loading inspection history…</strong><span>We are matching records using the restaurant&apos;s CAMIS identifier.</span></div>}
        {historyState === "error" && <div className="history-state error-state"><strong>{historyMessage}</strong><div className="error-actions"><button onClick={retry}>Try again</button><Link href="/restaurant">Return to search</Link></div></div>}

        {historyState === "success" && history && (
          <div className="history-content">
            <article className="restaurant-snapshot">
              <p className="record-label">LATEST OFFICIAL RESULT · NYC OPEN DATA</p>
              <h3>{history.restaurant.name}</h3>
              <p>{address(history.restaurant)}</p>
              {latestInspection && latestScore !== null ? (
                <>
                  <div className="latest-result-score"><span>SCORE</span><strong>{latestScore}</strong><b>{latestInspection.grade === "Not graded" ? "Grade not reported" : `Grade ${latestInspection.grade}`}</b></div>
                  <p className="latest-score-range">{scoreRange(latestScore)}</p>
                  <dl>
                    <div><dt>Inspection date</dt><dd>{formatDate(latestInspection.date)}</dd></div>
                    <div><dt>Inspection type</dt><dd>{inspectionKind(latestInspection.type)}</dd></div>
                    <div><dt>Official outcome</dt><dd>{latestInspection.action}</dd></div>
                  </dl>
                </>
              ) : <p className="latest-score-unavailable">No scored inspection is available for this restaurant.</p>}
              <a href={history.sourceUrl} target="_blank" rel="noreferrer">View the source records ↗</a>
            </article>

            <div className="inspection-story">
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
                <section className="pest-history-summary" aria-labelledby="pest-history-summary-heading">
                  <p className="eyebrow">Pest history</p>
                  <h3 id="pest-history-summary-heading">Pest findings appeared in {pestInspections.length} inspection{pestInspections.length === 1 ? "" : "s"}.</h3>
                  <p>Recorded between {formatDate(pestDates[0])} and {formatDate(pestDates[pestDates.length - 1])}: {pestInitialCount} initial inspection{pestInitialCount === 1 ? "" : "s"}, {pestReinspectionCount} reinspection{pestReinspectionCount === 1 ? "" : "s"}{pestOtherCount ? `, and ${pestOtherCount} other inspection${pestOtherCount === 1 ? "" : "s"}` : ""}.</p>
                  <div className="pest-history-labels">{pestLabels.map((label) => <span key={label}>{label}</span>)}</div>
                  <p className="history-caution">These are historical inspection findings, not a statement about the restaurant&apos;s current condition.</p>
                </section>
              )}

              <section className="inspection-timeline" aria-labelledby="inspection-timeline-heading">
                <div className="timeline-heading"><p className="eyebrow">Inspection timeline</p><h3 id="inspection-timeline-heading">How the record changed over time</h3><p>Every available inspection is shown in date order. A later result is not automatically the result of the preceding reinspection.</p></div>
                <ol className="timeline-list">
                  {timelineInspections.map((inspection, index) => {
                    const score = numericScore(inspection.score);
                    const previousScore = index > 0 ? numericScore(timelineInspections[index - 1].score) : null;
                    const scoreChange = score !== null && previousScore !== null ? score - previousScore : null;
                    const inspectionYear = new Date(inspection.date).getFullYear();
                    const previousInspectionYear = index > 0 ? new Date(timelineInspections[index - 1].date).getFullYear() : null;
                    const startsYear = inspectionYear !== previousInspectionYear;
                    const isLatest = index === timelineInspections.length - 1;
                    const hasPestFinding = inspection.pestViolations.length > 0;
                    const inspectionOpen = expandedInspections[inspection.key] ?? isLatest;
                    const inspectionDate = compactDate(inspection.date);
                    const inspectionPestLabels = [...new Set(inspection.pestViolations.map((violation) => pestGuidance[violation.code].label))];
                    const findingHeadline = hasPestFinding ? inspectionPestLabels.join(" and ") : "No critical pest finding";
                    return (
                      <li className="timeline-event" key={inspection.key}>
                        {startsYear && <p className="timeline-year-label">{inspectionYear}</p>}
                        <div className="timeline-entry">
                          <time className="timeline-date-anchor" dateTime={inspection.date} aria-label={formatDate(inspection.date)}>
                            <span>{inspectionDate.month}</span>
                            <strong>{inspectionDate.day}</strong>
                          </time>
                          <details className={`timeline-disclosure${isLatest ? " is-latest" : ""}`} open={inspectionOpen} onToggle={(event) => {
                            if (event.currentTarget.open !== inspectionOpen) setInspectionOpen(inspection.key, event.currentTarget.open);
                          }}>
                            <summary onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setInspectionOpen(inspection.key, !inspectionOpen);
                              }
                            }}>
                              <span className="timeline-summary-main">
                                <span className="timeline-state-row">
                                  <b>{inspectionKind(inspection.type)}</b>
                                  {isLatest && <em>Latest result</em>}
                                </span>
                                <strong>{findingHeadline}</strong>
                                <span className="timeline-status-row">
                                  <span>{score === null ? "Score unavailable" : `Score ${score}`}</span>
                                  <span>{inspection.grade === "Not graded" ? "Grade not reported" : `Grade ${inspection.grade}`}</span>
                                  {scoreChange !== null && scoreChange !== 0 && <span className={`timeline-change ${scoreChange < 0 ? "score-lower" : "score-higher"}`}>{scoreChange < 0 ? "↓" : "↑"} {Math.abs(scoreChange)} points · {scoreChange < 0 ? "lower score" : "higher score"}</span>}
                                </span>
                              </span>
                              <span className="timeline-toggle" aria-hidden="true"><i /> <b>Details</b></span>
                            </summary>
                            <div className="timeline-details">
                              <p className="timeline-range"><b>Inspection date:</b> {formatDate(inspection.date)}</p>
                              <p className="timeline-range"><b>Official outcome:</b> {inspection.action}</p>
                              <p className="timeline-score-range"><b>Score range:</b> {scoreRange(score)}</p>
                              {scoreChange !== null && scoreChange !== 0 && <p className="timeline-change-note">Compared with the previous available inspection, this score {scoreChange < 0 ? "decreased" : "increased"} by {Math.abs(scoreChange)} points. Lower scores are better; the sequence alone does not show what caused the change.</p>}
                              {hasPestFinding ? (
                                <div className="timeline-pest-findings">
                                  {inspection.pestViolations.map((violation) => {
                                    const guidance = pestGuidance[violation.code];
                                    return <div key={violation.code}><span>PEST FINDING · CODE {violation.code}</span><strong>{guidance.label}</strong><p>{violation.description}</p><small><b>Preventative next step:</b> {guidance.nextStep}</small></div>;
                                  })}
                                </div>
                              ) : <p className="no-timeline-pest">No critical rat, mouse, roach, or fly violation was recorded for this inspection.</p>}
                            </div>
                          </details>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>

            <section className="nearby-comparison" aria-labelledby="nearby-comparison-heading">
              <div className="nearby-comparison-heading">
                <p className="eyebrow">Nearby benchmark</p>
                <h3 id="nearby-comparison-heading">How does this restaurant compare nearby?</h3>
                <p>Comparing this restaurant&apos;s latest scored initial inspection with one latest scored initial inspection per nearby restaurant from the same year.</p>
              </div>
              {history.nearbyComparison.status === "available" ? (
                <>
                  <div className={`nearby-takeaway ${nearbyScoreDifference !== null && nearbyScoreDifference < 0 ? "is-lower" : nearbyScoreDifference && nearbyScoreDifference > 0 ? "is-higher" : "is-even"}`}>
                    <span>THE MAIN TAKEAWAY</span>
                    <strong>{nearbyScoreDifference === 0 ? "This restaurant matched the typical nearby score." : `This restaurant’s latest initial score was ${Math.abs(nearbyScoreDifference ?? 0).toFixed(1)} points ${nearbyScoreDifference !== null && nearbyScoreDifference < 0 ? "lower" : "higher"} than the typical nearby score.`}</strong>
                    <p>Lower inspection scores are better. “Typical nearby score” means the median—the middle score after nearby results are placed in order.</p>
                  </div>

                  <div className="nearby-score-cards">
                    <article><span>THIS RESTAURANT&apos;S LATEST INITIAL SCORE</span><strong>{history.nearbyComparison.targetInspection.score}</strong><small>{formatDate(history.nearbyComparison.targetInspection.date)} · {scoreRange(history.nearbyComparison.targetInspection.score)}</small></article>
                    <article><span>TYPICAL NEARBY SCORE</span><strong>{formatMetric(history.nearbyComparison.nearbyMedianScore)}</strong><small>Median of {history.nearbyComparison.nearbyRestaurantCount} nearby restaurants</small></article>
                  </div>

                  <div className="nearby-score-scale" role="img" aria-label={`This restaurant scored ${history.nearbyComparison.targetInspection.score}. The typical score among ${history.nearbyComparison.nearbyRestaurantCount} nearby restaurants was ${formatMetric(history.nearbyComparison.nearbyMedianScore)}. Lower scores are better.`}>
                    <div className="score-scale-labels"><span>A range · 0–13</span><span>B range · 14–27</span><span>C range · 28+</span></div>
                    <div className="score-scale-track">
                      <i className="score-band score-band-a" style={{ width: `${(14 / comparisonScaleMax) * 100}%` }} />
                      <i className="score-band score-band-b" style={{ left: `${(14 / comparisonScaleMax) * 100}%`, width: `${(14 / comparisonScaleMax) * 100}%` }} />
                      <i className="score-band score-band-c" style={{ left: `${(28 / comparisonScaleMax) * 100}%`, width: `${((comparisonScaleMax - 28) / comparisonScaleMax) * 100}%` }} />
                      <span className="score-marker target-marker" style={{ left: `${Math.min(100, (history.nearbyComparison.targetInspection.score / comparisonScaleMax) * 100)}%` }}><b>This restaurant</b></span>
                      <span className="score-marker nearby-marker" style={{ left: `${Math.min(100, (history.nearbyComparison.nearbyMedianScore / comparisonScaleMax) * 100)}%` }}><b>Nearby median</b></span>
                    </div>
                    <div className="score-scale-axis"><span>0</span><span>{comparisonScaleMax}+</span></div>
                  </div>

                  <p className="nearby-a-range"><strong>{history.nearbyComparison.nearbyARangeCount} of {history.nearbyComparison.nearbyRestaurantCount}</strong> nearby restaurants ({formatMetric(history.nearbyComparison.nearbyARangeRate, "%")}) had a latest initial score in the A-grade range.</p>
                  <p className="nearby-sample"><strong>What was compared:</strong> one latest scored initial inspection from {history.nearbyComparison.comparisonYear} for each restaurant within {history.nearbyComparison.radiusMeters} meters.</p>
                  {history.nearbyComparison.nearbyRestaurantCount < 10 && <p className="nearby-limited-sample">Limited nearby sample: fewer than 10 restaurants were available, so interpret this comparison cautiously.</p>}
                  <p className="nearby-method">This is historical context, not a current rating or forecast. Reinspections remain visible in the timeline but are not included in this comparison.</p>
                </>
              ) : (
                <div className="nearby-unavailable"><strong>Nearby comparison unavailable</strong><span>{history.nearbyComparison.reason}</span></div>
              )}
            </section>
          </div>
        )}
      </section>

      {historyState === "success" && (
        <section className="professional-help">
          {pestInspections.length ? (
            <div><p className="eyebrow">Need professional support?</p><h2>Turn the record into a prevention plan.</h2><p>A registered provider can inspect current conditions and help address the pest types recorded in this restaurant&apos;s history. A past finding does not confirm that a problem is still present.</p></div>
          ) : (
            <div><p className="eyebrow">Plan ahead</p><h2>Keep prevention on your schedule.</h2><p>No critical pest finding appears in the available history, but a registered provider can still assess entry points, sanitation risks, and monitoring practices.</p></div>
          )}
          <Link href={`/restaurant/${camis}/providers`}>Find Licensed Pest-Control Help →</Link>
        </section>
      )}

      <footer className="tool-footer"><strong>NYC Pest Prep</strong><span>Official records come from NYC Open Data. Explanations and recommendations are product-generated guidance, not an official NYC determination.</span></footer>
    </main>
  );
}
