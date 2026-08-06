"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildPestDataUrl,
  calculatePestAnalysis,
  fallbackPestAnalysis,
  monthNames,
  peakMonth,
  peakSeason,
  pestConfig,
  pestTypes,
  seasons,
  type PestAnalysis,
  type PestApiRow,
  type PestType,
  type Season,
} from "./pest-data";

const chapters = [
  "Opening",
  "Why timing matters",
  "Make one prediction",
  "Overall result",
  "Choose your pests",
  "Compare pest types",
  "Monthly timing",
  "Action plan",
  "Method",
];

const seasonMonths: Record<Season, string> = {
  Winter: "Dec–Feb",
  Spring: "Mar–May",
  Summer: "Jun–Aug",
  Fall: "Sep–Nov",
};

type AudiencePollResults = { counts: Record<Season, number>; total: number };

const emptyAudiencePoll: AudiencePollResults = {
  counts: { Winter: 0, Spring: 0, Summer: 0, Fall: 0 },
  total: 0,
};

function formatRate(value: number) {
  return `${value.toFixed(1)}%`;
}

function SeasonMark({ season }: { season: Season }) {
  const marks: Record<Season, string> = { Winter: "✳", Spring: "✿", Summer: "☀", Fall: "◆" };
  return <span aria-hidden="true">{marks[season]}</span>;
}

function PestMark({ pest }: { pest: PestType }) {
  return <span className={`pest-mark pest-${pest}`} aria-hidden="true"><span className="pest-silhouette">{pestConfig[pest].mark}</span></span>;
}

function PestComparison({ analysis }: { analysis: PestAnalysis }) {
  return (
    <div className="comparison-table" role="table" aria-label="Pest violation rates by season">
      <div className="comparison-header" role="row">
        <span role="columnheader">Critical violation</span>
        {seasons.map((season) => <span role="columnheader" key={season}>{season}<small>{seasonMonths[season]}</small></span>)}
        <span role="columnheader">Peak month</span>
      </div>
      {pestTypes.map((pest) => {
        const peak = peakSeason(analysis.seasonal[pest]);
        const month = peakMonth(analysis.monthly[pest]);
        return (
          <div className={`comparison-row pest-${pest}`} role="row" key={pest}>
            <span role="cell"><PestMark pest={pest} /><strong>{pestConfig[pest].name}</strong></span>
            {seasons.map((season) => (
              <span role="cell" className={season === peak ? "cell-peak" : ""} key={season}>
                {formatRate(analysis.seasonal[pest][season])}
              </span>
            ))}
            <span role="cell"><strong>{monthNames[month]}</strong></span>
          </div>
        );
      })}
    </div>
  );
}

function MonthlyChart({ pest, analysis }: { pest: PestType; analysis: PestAnalysis }) {
  const values = analysis.monthly[pest];
  const max = Math.max(...values);
  const peak = peakMonth(values);
  const config = pestConfig[pest];
  return (
    <div className="monthly-chart" style={{ "--pest-color": config.color, "--pest-soft": config.soft } as React.CSSProperties} aria-label={`${config.name} critical violation rate by month`}>
      {values.map((value, index) => (
        <div className={`month-column ${index === peak ? "peak" : ""}`} key={monthNames[index]}>
          <div className="month-value">{formatRate(value)}</div>
          <div className="month-track"><div className="month-fill" style={{ height: `${(value / max) * 100}%` }} /></div>
          <strong>{monthNames[index]}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [chapter, setChapter] = useState(0);
  const [selectedPests, setSelectedPests] = useState<PestType[]>([]);
  const [overallPrediction, setOverallPrediction] = useState<Season | null>(null);
  const [analysis, setAnalysis] = useState<PestAnalysis>(fallbackPestAnalysis);
  const [dataStatus, setDataStatus] = useState<"loading" | "live" | "saved">("loading");
  const [lastChecked, setLastChecked] = useState("");
  const [audiencePoll, setAudiencePoll] = useState<AudiencePollResults>(emptyAudiencePoll);
  const [pollStatus, setPollStatus] = useState<"loading" | "connected" | "saving" | "unavailable">("loading");

  const fetchLiveData = useCallback(async () => {
    setDataStatus("loading");
    try {
      const response = await fetch(buildPestDataUrl());
      if (!response.ok) throw new Error("NYC Open Data did not respond");
      const rows: PestApiRow[] = await response.json();
      setAnalysis(calculatePestAnalysis(rows));
      setDataStatus("live");
      setLastChecked(new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date()));
    } catch {
      setAnalysis(fallbackPestAnalysis);
      setDataStatus("saved");
      setLastChecked("most recent saved 2025 analysis");
    }
  }, []);

  useEffect(() => { void fetchLiveData(); }, [fetchLiveData]);

  const fetchAudiencePoll = useCallback(async () => {
    try {
      const response = await fetch("/api/poll");
      if (!response.ok) throw new Error("Audience poll is unavailable");
      const results = (await response.json()) as AudiencePollResults;
      setAudiencePoll(results);
      setPollStatus("connected");
    } catch {
      setPollStatus("unavailable");
    }
  }, []);

  useEffect(() => {
    void fetchAudiencePoll();
    const pollInterval = window.setInterval(() => void fetchAudiencePoll(), 15000);
    return () => window.clearInterval(pollInterval);
  }, [fetchAudiencePoll]);

  const submitAudienceVote = useCallback(async (season: Season) => {
    setOverallPrediction(season);
    setPollStatus("saving");
    try {
      const storageKey = "nyc-pest-prep-voter-id";
      let voterId = window.localStorage.getItem(storageKey);
      if (!voterId) {
        voterId = window.crypto.randomUUID();
        window.localStorage.setItem(storageKey, voterId);
      }
      const response = await fetch("/api/poll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ season, voterId }),
      });
      if (!response.ok) throw new Error("Audience vote was not saved");
      setAudiencePoll((await response.json()) as AudiencePollResults);
      setPollStatus("connected");
    } catch {
      setPollStatus("unavailable");
    }
  }, []);

  const togglePest = useCallback((pest: PestType) => {
    setSelectedPests((current) => current.includes(pest) ? current.filter((item) => item !== pest) : [...current, pest]);
  }, []);

  const canAdvance = useMemo(() => {
    if (chapter === 2) return overallPrediction !== null;
    if (chapter === 4) return selectedPests.length > 0;
    return true;
  }, [chapter, overallPrediction, selectedPests]);

  const goNext = useCallback(() => {
    if (canAdvance) setChapter((current) => Math.min(chapters.length - 1, current + 1));
  }, [canAdvance]);
  const goBack = useCallback(() => setChapter((current) => Math.max(0, current - 1)), []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "Enter") goNext();
      if (event.key === "ArrowLeft") goBack();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goBack, goNext]);

  const primaryPest = selectedPests[0] ?? "mice";
  const primaryConfig = pestConfig[primaryPest];
  const overallPeak = peakSeason(analysis.overallSeasonal);
  const overallMax = Math.max(...seasons.map((season) => analysis.overallSeasonal[season]));
  const audienceMax = Math.max(1, ...seasons.map((season) => audiencePoll.counts[season]));

  return (
    <main className="story-shell">
      <div className="progress" aria-label={`Chapter ${chapter + 1} of ${chapters.length}`}>
        {chapters.map((label, index) => (
          <button key={label} className={index <= chapter ? "complete" : ""} onClick={() => setChapter(index)} aria-label={`Go to ${label}`} title={label} />
        ))}
      </div>

      <header className="topbar">
        <button className="wordmark" onClick={() => setChapter(0)} aria-label="Return to the beginning"><span>NYC</span> Pest Prep</button>
        <div className={`live-status ${dataStatus}`}><i />{dataStatus === "loading" ? "Checking NYC Open Data" : dataStatus === "live" ? "Live 2025 data" : "Saved 2025 data"}</div>
      </header>

      <section className="stage" aria-live="polite">
        {chapter === 0 && (
          <div className="scene cover-scene">
            <div className="cover-copy">
              <p className="eyebrow">What <span className="inspection-count-highlight">{analysis.inspectionCount.toLocaleString()}</span> NYC initial inspections revealed</p>
              <h1>Is there one pest season for every NYC restaurant?</h1>
              <p className="dek">Every NYC restaurant is scheduled for <mark className="inspection-fact-highlight">at least one unannounced health inspection each year</mark>. We analyzed 2025 inspection data to find when inspectors recorded critical rat, mouse, roach, and fly violations most often.</p>
              <button className="primary-button" onClick={goNext}>Explore the pattern <span>→</span></button>
            </div>
            <div className="pest-crawlers" aria-hidden="true">
              {pestTypes.map((pest, index) => (
                <span className={`pest-crawler crawler-${index + 1}`} key={pest}>
                  <span className="crawler-silhouette">{pestConfig[pest].mark}</span>
                </span>
              ))}
            </div>
            <p className="cover-note">Based on {analysis.inspectionCount.toLocaleString()} unique initial inspections conducted in 2025</p>
          </div>
        )}

        {chapter === 1 && (
          <div className="scene context-scene">
            <div className="context-copy">
              <p className="eyebrow">Why timing matters</p>
              <h2>Prevention starts before an inspector arrives.</h2>
              <p>Critical pest violations can affect a restaurant’s grade, reputation, and ability to operate safely. Understanding when inspectors most often record them can help restaurant teams decide when to strengthen prevention—without predicting any individual inspection.</p>
            </div>
            <div className="split-pattern">
              <article className="pattern-card rodent-card"><span>Inspection schedule</span><h3>Unannounced</h3><p>Every NYC restaurant is scheduled for at least one unannounced health inspection each year.</p></article>
              <article className="pattern-card insect-card"><span>Analysis scope</span><h3>Four critical pest violations</h3><p>We followed rat, mouse, roach, and fly violations across {analysis.inspectionCount.toLocaleString()} unique initial inspections.</p><div>{pestTypes.map((pest) => <PestMark pest={pest} key={pest} />)}</div></article>
            </div>
          </div>
        )}

        {chapter === 2 && (
          <div className="scene prediction-scene" style={{ "--pest-color": "var(--orange)", "--pest-soft": "var(--orange-soft)" } as React.CSSProperties}>
            <div className="prediction-heading"><p className="eyebrow">Make one prediction</p><h2>Which season has the highest rate of critical pest violations?</h2><p className="instruction">Choose the season you think had the largest share of 2025 initial inspections with at least one critical rat, mouse, roach, or fly violation.</p></div>
            <div className="season-choices" role="group" aria-label="Choose the season with the highest overall critical pest violation rate">
              {seasons.map((season) => (
                <button key={season} className={overallPrediction === season ? "selected" : ""} onClick={() => void submitAudienceVote(season)} aria-pressed={overallPrediction === season}>
                  <SeasonMark season={season} /><strong>{season}</strong><small>{seasonMonths[season]}</small>
                </button>
              ))}
            </div>
            <p className="choice-confirmation">{!overallPrediction ? "Choose one season to continue." : pollStatus === "saving" ? `Saving your ${overallPrediction} prediction…` : pollStatus === "connected" ? `Your ${overallPrediction} prediction is in. Continue to compare it with the inspection data.` : `You predicted ${overallPrediction}. Community voting is not connected in this preview, but you can continue.`}</p>
          </div>
        )}

        {chapter === 3 && (
          <div className="scene overall-result-scene" style={{ "--pest-color": "var(--orange)", "--pest-soft": "var(--orange-soft)" } as React.CSSProperties}>
            <div className="result-copy">
              <p className="eyebrow">The overall result</p>
              <h2><em>{overallPeak}</em> leads overall.</h2>
              <p>{overallPrediction ? `You predicted ${overallPrediction}. ` : ""}{formatRate(analysis.overallSeasonal[overallPeak])} of unique initial inspections in {overallPeak.toLowerCase()} contained at least one of the four critical pest violations.</p>
              <div className="definition-note"><strong>How to read this</strong><span>Each inspection is counted once, even when inspectors recorded more than one pest violation during that visit.</span></div>
              <div className="deeper-insight"><strong>But the overall peak hides a second story.</strong><span>Fall does not mean every pest peaks in fall. Each violation type follows its own schedule.</span></div>
            </div>
            <div className="overall-result-data">
              <div className="season-bar-chart" aria-label="Overall critical pest violation rates by season">
                {seasons.map((season) => {
                  const isPeak = season === overallPeak;
                  return (
                    <div className={`season-bar-row ${isPeak ? "peak" : ""}`} key={season}>
                      <div className="season-label"><SeasonMark season={season} /><span>{season}<small>{seasonMonths[season]}</small></span></div>
                      <div className="season-track"><div className="season-fill" style={{ width: `${(analysis.overallSeasonal[season] / overallMax) * 100}%` }} /></div>
                      <strong>{formatRate(analysis.overallSeasonal[season])}</strong>
                      {isPeak && <span className="highest-label">highest</span>}
                    </div>
                  );
                })}
              </div>
              <div className="audience-poll-panel" aria-live="polite">
                <div className="audience-poll-heading"><span>LIVE AUDIENCE POLL</span><strong>What visitors predicted</strong></div>
                {audiencePoll.total > 0 ? (
                  <div className="audience-poll-bars">
                    {seasons.map((season) => {
                      const votes = audiencePoll.counts[season];
                      const percentage = (votes / audiencePoll.total) * 100;
                      return (
                        <div className={`audience-poll-row ${overallPrediction === season ? "your-vote" : ""}`} key={season}>
                          <span>{season}</span>
                          <div><i style={{ width: `${(votes / audienceMax) * 100}%` }} /></div>
                          <strong>{percentage.toFixed(0)}%</strong>
                        </div>
                      );
                    })}
                    <p>{audiencePoll.total.toLocaleString()} real response{audiencePoll.total === 1 ? "" : "s"}, including yours. Results refresh every 15 seconds.</p>
                  </div>
                ) : (
                  <div className="audience-poll-empty"><strong>{pollStatus === "unavailable" ? "Shared voting is not connected in this preview." : "Waiting for the first audience response."}</strong><p>No sample or invented responses are shown.</p></div>
                )}
              </div>
            </div>
          </div>
        )}

        {chapter === 4 && (
          <div className="scene pest-picker-scene">
            <div className="scene-heading centered"><p className="eyebrow">Look beyond the fall peak</p><h2>Which pests should we put on your calendar?</h2><p className="instruction">Select every pest that concerns you. Choose at least one.</p></div>
            <div className="pest-picker" role="group" aria-label="Choose one or more pest types">
              {pestTypes.map((pest) => (
                <button
                  key={pest}
                  className={`pest-choice pest-${pest} ${selectedPests.includes(pest) ? "selected" : ""}`}
                  onClick={() => togglePest(pest)}
                  aria-pressed={selectedPests.includes(pest)}
                >
                  <PestMark pest={pest} /><strong>{pestConfig[pest].name}</strong><small>{pestConfig[pest].description}</small><span>{selectedPests.includes(pest) ? "✓ Selected" : `Code ${pestConfig[pest].code}`}</span>
                </button>
              ))}
            </div>
            <p className="choice-confirmation">{selectedPests.length ? `${selectedPests.length} pest${selectedPests.length === 1 ? "" : "s"} selected. Continue when your list is complete.` : "Select at least one pest to continue."}</p>
          </div>
        )}

        {chapter === 5 && (
          <div className="scene compare-scene">
            <div className="scene-heading"><p className="eyebrow">See the full pattern</p><h2>Different pests need different calendars.</h2><p>Rodent violations are strongest earlier in the year. Roaches and flies rise later—so one generic “pest season” can hide the preparation window that matters.</p></div>
            <PestComparison analysis={analysis} />
          </div>
        )}

        {chapter === 6 && (
          <div className="scene monthly-scene multi-monthly-scene">
            <div className="scene-heading centered"><p className="eyebrow">Plan before each peak</p><h2>Turn the seasonal result into a preparation calendar.</h2><p>The monthly view shows when each selected pest reached its highest rate—and when a preventative check could begin.</p></div>
            <div className="multi-month-grid">
              {selectedPests.map((pest) => {
                const config = pestConfig[pest];
                const pestPeakMonth = peakMonth(analysis.monthly[pest]);
                const pestPreparationMonth = monthNames[(pestPeakMonth + 11) % 12];
                return (
                  <article className="multi-month-card" key={pest} style={{ "--pest-color": config.color, "--pest-soft": config.soft } as React.CSSProperties}>
                    <div className="multi-month-heading"><PestMark pest={pest} /><div><h3>{config.name} peak in {monthNames[pestPeakMonth]}</h3><p>Begin your check by <strong>{pestPreparationMonth}</strong>.</p></div></div>
                    <MonthlyChart pest={pest} analysis={analysis} />
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {chapter === 7 && (
          <div className="scene action-scene" style={{ "--pest-color": primaryConfig.color, "--pest-soft": primaryConfig.soft } as React.CSSProperties}>
            <div className="action-copy">
              <p className="eyebrow">Your preparation window</p>
              <h2>Build one plan around every selected risk.</h2>
              <p>The data does not predict what will happen at your restaurant. It gives you a practical moment to review the conditions that allow pests to enter, hide, find food, or access water.</p>
              <div className="preparation-windows" aria-label="Suggested preparation months">
                {selectedPests.map((pest) => {
                  const config = pestConfig[pest];
                  const pestPeakMonth = peakMonth(analysis.monthly[pest]);
                  const pestPreparationMonth = monthNames[(pestPeakMonth + 11) % 12];
                  return <article key={pest} style={{ "--pest-color": config.color, "--pest-soft": config.soft } as React.CSSProperties}><PestMark pest={pest} /><span><strong>{config.name}</strong>Begin by {pestPreparationMonth}</span></article>;
                })}
              </div>
              <div className="owner-checklist">
                <label><input type="checkbox" /><span><strong>Seal entry points</strong>Check cracks, holes, cabinets, doors, and exterior door sweeps.</span></label>
                <label><input type="checkbox" /><span><strong>Remove food and shelter</strong>Use pest-proof containers, manage garbage, reduce clutter, and inspect deliveries.</span></label>
                <label><input type="checkbox" /><span><strong>Clean hidden areas</strong>Remove grease and food particles from equipment, floors, and range hoods.</span></label>
                <label><input type="checkbox" /><span><strong>Review your monitoring plan</strong>Document problem areas and discuss findings with a licensed pest professional.</span></label>
              </div>
              <small className="guidance-source">Checklist adapted from NYC Health pest-proofing guidance and integrated pest management principles.</small>
            </div>

            <aside className="referral-panel" id="referrals">
              <span className="panel-label">REFERRAL-READY MVP</span>
              <h3>Need professional support?</h3>
              <p>NYC advises restaurants to work with a pest-management professional who is licensed to serve food establishments.</p>
              <a className="official-link" href="https://www.nyc.gov/site/doh/business/food-operators/operating-a-restaurant.page" target="_blank" rel="noreferrer">Find official NYC pest resources ↗</a>
              <div className="partner-placeholder">
                <strong>Verified provider links will live here.</strong>
                <p>Before activation, each provider should be licensed, serve NYC restaurants, address the selected pest, and agree to transparent referral terms.</p>
                <button disabled>Restaurant pest partners coming soon</button>
              </div>
              <small>Future referral or sponsored links must be labeled clearly. Provider inclusion will not represent NYC Health Department endorsement or guarantee an inspection result.</small>
            </aside>
          </div>
        )}

        {chapter === 8 && (
          <div className="scene method-scene">
            <div className="method-copy"><p className="eyebrow">Method and limits</p><h2>Inspection detections are a signal—not a pest forecast.</h2><p>This analysis groups unique NYC restaurant initial inspections from 2025 by month and season. Each rate is the percentage of those inspections containing the specified critical pest violation.</p><ul><li>Rows represent inspection results or violations, while the rates use unique inspections.</li><li>The results show when inspectors recorded violations, not the total pest population in NYC.</li><li>Seasonal association does not prove that weather or season caused a violation.</li><li>A specific restaurant’s current inspection record matters more than a citywide pattern.</li></ul><div className="method-links"><a href="https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j/about_data" target="_blank" rel="noreferrer">NYC inspection data ↗</a><a href="https://www.nyc.gov/site/doh/business/food-operators/operating-a-restaurant.page" target="_blank" rel="noreferrer">NYC restaurant pest guidance ↗</a><a href="https://www.epa.gov/ipm/introduction-integrated-pest-management" target="_blank" rel="noreferrer">EPA integrated pest management ↗</a></div></div>
            <div className="data-receipt"><span>DATA RECEIPT</span><dl><div><dt>Year</dt><dd>2025</dd></div><div><dt>Unique initial inspections</dt><dd>{analysis.inspectionCount.toLocaleString()}</dd></div><div><dt>Pest codes</dt><dd>04K–04N</dd></div><div><dt>Connection</dt><dd>{dataStatus === "live" ? "Live" : "Saved"}</dd></div><div><dt>Last checked</dt><dd>{lastChecked || "Checking now"}</dd></div></dl><button onClick={() => void fetchLiveData()} disabled={dataStatus === "loading"}>{dataStatus === "loading" ? "Refreshing…" : "Re-run the live fetch"}</button></div>
          </div>
        )}
      </section>

      {chapter > 0 && <button className="nav-button nav-back" onClick={goBack} aria-label="Previous chapter">←</button>}
      {chapter > 0 && chapter < chapters.length - 1 && <button className={`nav-button nav-next ${!canAdvance ? "disabled" : ""}`} onClick={goNext} disabled={!canAdvance} aria-label="Next chapter">→</button>}
      {chapter > 0 && chapter < chapters.length - 1 && <p className="continue-label">{canAdvance ? "Continue" : chapter === 2 ? "Make one prediction" : "Choose at least one pest"}<span>Arrow keys work, too</span></p>}
    </main>
  );
}
