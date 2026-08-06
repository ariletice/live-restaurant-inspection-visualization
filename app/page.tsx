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
  "Choose a pest",
  "Make a prediction",
  "Seasonal result",
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

function SeasonalBars({ pest, analysis, prediction }: { pest: PestType; analysis: PestAnalysis; prediction: Season | null }) {
  const values = analysis.seasonal[pest];
  const peak = peakSeason(values);
  const max = Math.max(...seasons.map((season) => values[season]));
  const config = pestConfig[pest];

  return (
    <div className="result-layout" style={{ "--pest-color": config.color, "--pest-soft": config.soft } as React.CSSProperties}>
      <div className="result-copy">
        <p className="eyebrow">Your result</p>
        <PestMark pest={pest} />
        <h2>{config.name} peak in <em>{peak.toLowerCase()}</em>.</h2>
        <p>
          {prediction ? `You predicted ${prediction.toLowerCase()}. ` : ""}
          {pest === "rats" && "Rat detections are highest in spring, with March producing the strongest monthly rate."}
          {pest === "mice" && "Mouse detections remain common throughout the year and are highest in spring overall."}
          {pest === "roaches" && "Roach detections build during the warmer months and reach their highest seasonal rate in fall."}
          {pest === "flies" && "Fly and nuisance-pest detections rise sharply after spring and reach their highest rate in fall."}
        </p>
        <div className="definition-note">
          <strong>How to read this</strong>
          <span>Each percentage is the share of unique 2025 initial inspections containing this specific critical pest violation.</span>
        </div>
      </div>
      <div className="season-bar-chart" aria-label={`${config.name} critical violation rates by season`}>
        {seasons.map((season) => {
          const isPeak = season === peak;
          return (
            <div className={`season-bar-row ${isPeak ? "peak" : ""}`} key={season}>
              <div className="season-label"><SeasonMark season={season} /><span>{season}<small>{seasonMonths[season]}</small></span></div>
              <div className="season-track"><div className="season-fill" style={{ width: `${(values[season] / max) * 100}%` }} /></div>
              <strong>{formatRate(values[season])}</strong>
              {isPeak && <span className="highest-label">highest</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const [selectedPest, setSelectedPest] = useState<PestType | null>(null);
  const [prediction, setPrediction] = useState<Season | null>(null);
  const [analysis, setAnalysis] = useState<PestAnalysis>(fallbackPestAnalysis);
  const [dataStatus, setDataStatus] = useState<"loading" | "live" | "saved">("loading");
  const [lastChecked, setLastChecked] = useState("");

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

  const canAdvance = useMemo(() => {
    if (chapter === 2) return selectedPest !== null;
    if (chapter === 3) return selectedPest !== null && prediction !== null;
    return true;
  }, [chapter, prediction, selectedPest]);

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

  const activePest = selectedPest ?? "mice";
  const activeConfig = pestConfig[activePest];
  const activePeakMonth = peakMonth(analysis.monthly[activePest]);
  const preparationMonth = monthNames[(activePeakMonth + 11) % 12];

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
              <p className="eyebrow">What {analysis.inspectionCount.toLocaleString()} NYC initial inspections revealed</p>
              <h1>Is there one pest season for every NYC restaurant?</h1>
              <p className="dek">Every NYC restaurant is scheduled for at least one unannounced health inspection each year. We analyzed 2025 inspection data to find when inspectors recorded critical rat, mouse, roach, and fly violations most often.</p>
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
          <div className="scene pest-picker-scene">
            <div className="scene-heading centered"><p className="eyebrow">Start with your concern</p><h2>Which pest are you preparing for?</h2><p className="instruction">Choose one. You can return later to explore another.</p></div>
            <div className="pest-picker" role="group" aria-label="Choose a pest type">
              {pestTypes.map((pest) => (
                <button
                  key={pest}
                  className={`pest-choice pest-${pest} ${selectedPest === pest ? "selected" : ""}`}
                  onClick={() => { setSelectedPest(pest); setPrediction(null); }}
                  aria-pressed={selectedPest === pest}
                >
                  <PestMark pest={pest} /><strong>{pestConfig[pest].name}</strong><small>{pestConfig[pest].description}</small><span>Code {pestConfig[pest].code}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {chapter === 3 && (
          <div className="scene prediction-scene" style={{ "--pest-color": activeConfig.color, "--pest-soft": activeConfig.soft } as React.CSSProperties}>
            <div className="prediction-heading"><PestMark pest={activePest} /><p className="eyebrow">Make one prediction</p><h2>When do you think inspectors most often find critical {activeConfig.singular} violations?</h2></div>
            <div className="season-choices" role="group" aria-label="Choose a season">
              {seasons.map((season) => (
                <button key={season} className={prediction === season ? "selected" : ""} onClick={() => setPrediction(season)} aria-pressed={prediction === season}>
                  <SeasonMark season={season} /><strong>{season}</strong><small>{seasonMonths[season]}</small>
                </button>
              ))}
            </div>
            <p className="choice-confirmation">{prediction ? `Prediction locked: ${prediction}. Continue to see the data.` : "Choose one season to continue."}</p>
          </div>
        )}

        {chapter === 4 && <div className="scene"><SeasonalBars pest={activePest} analysis={analysis} prediction={prediction} /></div>}

        {chapter === 5 && (
          <div className="scene compare-scene">
            <div className="scene-heading"><p className="eyebrow">See the full pattern</p><h2>Different pests need different calendars.</h2><p>Rodent violations are strongest earlier in the year. Roaches and flies rise later—so one generic “pest season” can hide the preparation window that matters.</p></div>
            <PestComparison analysis={analysis} />
          </div>
        )}

        {chapter === 6 && (
          <div className="scene monthly-scene" style={{ "--pest-color": activeConfig.color, "--pest-soft": activeConfig.soft } as React.CSSProperties}>
            <div className="monthly-heading"><div><PestMark pest={activePest} /><p className="eyebrow">Plan before the peak</p><h2>{activeConfig.name} reach their highest monthly rate in {monthNames[activePeakMonth]}.</h2></div><p>The monthly view is more actionable than a broad season. Preparation should begin before the observed peak—not after a violation appears.</p></div>
            <MonthlyChart pest={activePest} analysis={analysis} />
          </div>
        )}

        {chapter === 7 && (
          <div className="scene action-scene" style={{ "--pest-color": activeConfig.color, "--pest-soft": activeConfig.soft } as React.CSSProperties}>
            <div className="action-copy">
              <PestMark pest={activePest} />
              <p className="eyebrow">Your preparation window</p>
              <h2>Start your {activeConfig.singular} check by {preparationMonth}.</h2>
              <p>The data does not predict what will happen at your restaurant. It gives you a practical moment to review the conditions that allow pests to enter, hide, find food, or access water.</p>
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
      {chapter > 0 && chapter < chapters.length - 1 && <p className="continue-label">{canAdvance ? "Continue" : chapter === 2 ? "Choose a pest" : "Make a prediction"}<span>Arrow keys work, too</span></p>}
    </main>
  );
}
