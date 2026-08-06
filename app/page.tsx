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

function SeasonalResultCard({ pest, analysis, prediction }: { pest: PestType; analysis: PestAnalysis; prediction?: Season }) {
  const values = analysis.seasonal[pest];
  const peak = peakSeason(values);
  const max = Math.max(...seasons.map((season) => values[season]));
  const config = pestConfig[pest];

  return (
    <article className={`multi-result-card pest-${pest}`} style={{ "--pest-color": config.color, "--pest-soft": config.soft } as React.CSSProperties}>
      <div className="result-card-heading">
        <PestMark pest={pest} />
        <div>
          <p>{prediction ? `You predicted ${prediction}` : "Your result"}</p>
          <h3>{config.name} peak in <em>{peak}</em>.</h3>
        </div>
      </div>
      <div className="mini-season-bars" aria-label={`${config.name} critical violation rates by season`}>
        {seasons.map((season) => {
          const isPeak = season === peak;
          return (
            <div className={`mini-season-row ${isPeak ? "peak" : ""}`} key={season}>
              <span>{season}</span>
              <div><i style={{ width: `${(values[season] / max) * 100}%` }} /></div>
              <strong>{formatRate(values[season])}</strong>
            </div>
          );
        })}
      </div>
    </article>
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
  const [selectedPests, setSelectedPests] = useState<PestType[]>([]);
  const [predictions, setPredictions] = useState<Partial<Record<PestType, Season>>>({});
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

  const togglePest = useCallback((pest: PestType) => {
    setSelectedPests((current) => current.includes(pest) ? current.filter((item) => item !== pest) : [...current, pest]);
    setPredictions((current) => {
      if (!(pest in current)) return current;
      const next = { ...current };
      delete next[pest];
      return next;
    });
  }, []);

  const canAdvance = useMemo(() => {
    if (chapter === 2) return selectedPests.length > 0;
    if (chapter === 3) return selectedPests.length > 0 && selectedPests.every((pest) => predictions[pest]);
    return true;
  }, [chapter, predictions, selectedPests]);

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
          <div className="scene pest-picker-scene">
            <div className="scene-heading centered"><p className="eyebrow">Start with your concerns</p><h2>Which pests are you preparing for?</h2><p className="instruction">Select every pest that concerns you. Choose at least one.</p></div>
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

        {chapter === 3 && (
          <div className="scene prediction-scene multi-prediction-scene">
            <div className="scene-heading centered"><p className="eyebrow">Make your predictions</p><h2>When do you think each pest peaks?</h2><p className="instruction">Choose one season for every pest on your list.</p></div>
            <div className="prediction-grid">
              {selectedPests.map((pest) => {
                const config = pestConfig[pest];
                return (
                  <article className="prediction-card" key={pest} style={{ "--pest-color": config.color, "--pest-soft": config.soft } as React.CSSProperties}>
                    <div className="prediction-card-heading"><PestMark pest={pest} /><strong>{config.name}</strong></div>
                    <div className="compact-season-choices" role="group" aria-label={`Choose a season for ${config.name}`}>
                      {seasons.map((season) => (
                        <button key={season} className={predictions[pest] === season ? "selected" : ""} onClick={() => setPredictions((current) => ({ ...current, [pest]: season }))} aria-pressed={predictions[pest] === season}>
                          <SeasonMark season={season} /><strong>{season}</strong><small>{seasonMonths[season]}</small>
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="choice-confirmation">{canAdvance ? "Predictions locked. Continue to compare them with the data." : `${selectedPests.filter((pest) => !predictions[pest]).length} prediction${selectedPests.filter((pest) => !predictions[pest]).length === 1 ? "" : "s"} remaining.`}</p>
          </div>
        )}

        {chapter === 4 && (
          <div className="scene multi-result-scene">
            <div className="scene-heading centered"><p className="eyebrow">Your seasonal results</p><h2>Here’s how your selected pests compare.</h2><p>Each percentage is the share of unique 2025 initial inspections containing that specific critical pest violation.</p></div>
            <div className="selected-results">
              {selectedPests.map((pest) => <SeasonalResultCard pest={pest} analysis={analysis} prediction={predictions[pest]} key={pest} />)}
            </div>
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
      {chapter > 0 && chapter < chapters.length - 1 && <p className="continue-label">{canAdvance ? "Continue" : chapter === 2 ? "Choose at least one pest" : "Complete every prediction"}<span>Arrow keys work, too</span></p>}
    </main>
  );
}
