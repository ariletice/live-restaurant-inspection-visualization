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
  return <span className={`pest-mark pest-${pest}`} aria-hidden="true">{pestConfig[pest].mark}</span>;
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
              <p className="eyebrow">A seasonal pest-readiness guide for NYC restaurants</p>
              <h1>Know what peaks before your next inspection.</h1>
              <p className="dek">Rats, mice, roaches, and flies do not follow the same calendar. Your prevention plan should not treat them as one problem.</p>
              <button className="primary-button" onClick={goNext}>Prepare your restaurant <span>→</span></button>
            </div>
            <div className="floating-pests" aria-hidden="true">
              {pestTypes.map((pest, index) => <div className={`floating-card float-${index + 1}`} key={pest}><PestMark pest={pest} /><span>{pestConfig[pest].name}</span></div>)}
            </div>
            <p className="cover-note">Based on {analysis.inspectionCount.toLocaleString()} unique initial inspections conducted in 2025</p>
          </div>
        )}

        {chapter === 1 && (
          <div className="scene context-scene">
            <div className="context-copy">
              <p className="eyebrow">Why timing matters</p>
              <h2>The fall pest peak is not really a rodent story.</h2>
              <p>When all pest violations are combined, fall looks like the riskiest season. Separating them reveals two different timelines—and more useful preparation windows for restaurant teams.</p>
            </div>
            <div className="split-pattern">
              <article className="pattern-card rodent-card"><span>Winter → Spring</span><h3>Rodent detections</h3><p>Rat and mouse violation rates are strongest during colder months and early spring.</p><div><PestMark pest="rats" /><PestMark pest="mice" /></div></article>
              <article className="pattern-card insect-card"><span>Summer → Fall</span><h3>Insect detections</h3><p>Roach and fly violation rates build later, with flies rising sharply into fall.</p><div><PestMark pest="roaches" /><PestMark pest="flies" /></div></article>
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
          <div className="scene method-scene">
            <div className="method-copy"><p className="eyebrow">Method and limits</p><h2>Inspection detections are a signal—not a pest forecast.</h2><p>This analysis groups unique NYC restaurant initial inspections from 2025 by month and season. Each rate is the percentage of those inspections containing the specified critical pest violation.</p><ul><li>Rows represent inspection results or violations, while the rates use unique inspections.</li><li>The results show when inspectors recorded violations, not the total pest population in NYC.</li><li>Seasonal association does not prove that weather or season caused a violation.</li><li>A specific restaurant’s current inspection record matters more than a citywide pattern.</li></ul><a href="https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j/about_data" target="_blank" rel="noreferrer">View the NYC Open Data source ↗</a></div>
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
