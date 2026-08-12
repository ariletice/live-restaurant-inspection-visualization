"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  "Who you are",
  "Make one prediction",
  "Overall result",
  "Your pest calendar",
];

const seasonMonths: Record<Season, string> = {
  Winter: "Dec–Feb",
  Spring: "Mar–May",
  Summer: "Jun–Aug",
  Fall: "Sep–Nov",
};

const seasonAnswerLetters: Record<Season, string> = {
  Winter: "A",
  Spring: "B",
  Summer: "C",
  Fall: "D",
};

const fullSeasonMonths: Record<Season, string> = {
  Winter: "December–February",
  Spring: "March–May",
  Summer: "June–August",
  Fall: "September–November",
};

type AudiencePollResults = { counts: Record<Season, number>; total: number };

type AudienceRole = "restaurant-owner" | "pest-professional" | "exploring";
type ChartView = "monthly" | "seasonal";

const audienceStorageKey = "nyc-pest-prep-audience-role";

const audienceRoles: { value: AudienceRole; label: string }[] = [
  { value: "restaurant-owner", label: "Restaurant owner or manager" },
  { value: "pest-professional", label: "Pest-control professional" },
  { value: "exploring", label: "Other or just exploring" },
];

const audienceCopy: Record<AudienceRole, {
  insight: string;
  calendarAction: string;
}> = {
  "restaurant-owner": {
    insight: "For restaurant owners and managers, this pattern can help time preventative checks before inspectors most often record critical pest violations.",
    calendarAction: "Add a reminder to review prevention steps before the historically higher-recording period.",
  },
  "pest-professional": {
    insight: "For pest-control professionals, this pattern can support proactive conversations with restaurant clients before seasonal inspection findings peak.",
    calendarAction: "Use the seasonal pattern to plan timely education or outreach with restaurant clients.",
  },
  exploring: {
    insight: "For anyone exploring the data, this pattern shows that critical pest findings vary by season, even though season alone does not cause a violation.",
    calendarAction: "Learn when recorded pest violations have historically increased across NYC inspections.",
  },
};

function isAudienceRole(value: string | null): value is AudienceRole {
  return audienceRoles.some((role) => role.value === value);
}

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

function MonthlyTimingChart({ pest, analysis }: { pest: PestType; analysis: PestAnalysis }) {
  const values = analysis.monthly[pest];
  const highestMonth = peakMonth(values);
  const reminderMonthIndex = (highestMonth + 11) % 12;
  const maxRate = Math.max(1, ...values);
  const config = pestConfig[pest];
  const summary = values.map((value, index) => `${monthNames[index]} ${formatRate(value)}`).join(", ");

  return (
    <div className="calendar-chart-view">
      <div className="chart-view-heading">
        <div><span>MONTHLY TIMING</span><h4>{config.name} violations by month</h4></div>
        <div className="chart-key"><i className="peak-key" /> Highest recorded rate <i className="reminder-key" /> Reminder</div>
      </div>
      <div className="compact-monthly-chart" role="img" aria-labelledby="monthly-chart-title" aria-describedby="monthly-chart-summary">
        <span id="monthly-chart-title" className="visually-hidden">{config.name} critical violation rates by month in 2025</span>
        {values.map((value, index) => {
          const isPeak = index === highestMonth;
          const isReminder = index === reminderMonthIndex;
          return (
            <div className={`compact-month ${isPeak ? "peak" : ""} ${isReminder ? "reminder" : ""}`} key={monthNames[index]}>
              <span className="compact-month-note" aria-hidden="true">{isPeak ? "highest" : isReminder ? "remind" : ""}</span>
              <span className="compact-month-rate" aria-hidden="true">{formatRate(value)}</span>
              <span className="compact-month-track" aria-hidden="true"><i style={{ height: `${(value / maxRate) * 100}%` }} /></span>
              <strong aria-hidden="true">{monthNames[index]}</strong>
            </div>
          );
        })}
      </div>
      <p id="monthly-chart-summary" className="visually-hidden">{summary}. {monthNames[highestMonth]} had the highest recorded rate. The suggested reminder month is {monthNames[reminderMonthIndex]}.</p>
    </div>
  );
}

function SeasonalPestComparison({ analysis }: { analysis: PestAnalysis }) {
  const maxRate = Math.max(1, ...pestTypes.flatMap((pest) => seasons.map((season) => analysis.seasonal[pest][season])));
  const summary = seasons.map((season) => (
    `${season}: ${pestTypes.map((pest) => `${pestConfig[pest].name} ${formatRate(analysis.seasonal[pest][season])}`).join(", ")}`
  )).join(". ");

  return (
    <div className="calendar-chart-view">
      <div className="chart-view-heading">
        <div><span>SEASONAL COMPARISON</span><h4>How all four pest types compare</h4></div>
        <div className="pest-chart-legend" aria-label="Pest color legend">
          {pestTypes.map((pest) => <span key={pest} style={{ "--series-color": pestConfig[pest].color } as React.CSSProperties}><i />{pestConfig[pest].name}</span>)}
        </div>
      </div>
      <div className="seasonal-pest-chart" role="img" aria-labelledby="seasonal-chart-title" aria-describedby="seasonal-chart-summary">
        <span id="seasonal-chart-title" className="visually-hidden">Critical pest violation rates by pest type and season in 2025</span>
        {seasons.map((season) => (
          <div className="seasonal-pest-group" key={season}>
            <div className="seasonal-pest-bars">
              {pestTypes.map((pest) => {
                const value = analysis.seasonal[pest][season];
                return (
                  <div className="seasonal-pest-bar" key={pest} style={{ "--series-color": pestConfig[pest].color } as React.CSSProperties}>
                    <span aria-hidden="true">{formatRate(value)}</span>
                    <div aria-hidden="true"><i style={{ height: `${(value / maxRate) * 100}%` }} /></div>
                  </div>
                );
              })}
            </div>
            <strong aria-hidden="true">{season}<small>{seasonMonths[season]}</small></strong>
          </div>
        ))}
      </div>
      <p id="seasonal-chart-summary" className="visually-hidden">{summary}.</p>
    </div>
  );
}

export default function Home() {
  const [chapter, setChapter] = useState(0);
  const [draftAudienceRole, setDraftAudienceRole] = useState<AudienceRole | null>(null);
  const [audienceRole, setAudienceRole] = useState<AudienceRole | null>(null);
  const [selectedPest, setSelectedPest] = useState<PestType | null>(null);
  const [chartView, setChartView] = useState<ChartView>("monthly");
  const [overallPrediction, setOverallPrediction] = useState<Season | null>(null);
  const [analysis, setAnalysis] = useState<PestAnalysis>(fallbackPestAnalysis);
  const [dataStatus, setDataStatus] = useState<"loading" | "live" | "saved">("loading");
  const [lastChecked, setLastChecked] = useState("");
  const [audiencePoll, setAudiencePoll] = useState<AudiencePollResults>(emptyAudiencePoll);
  const [pollStatus, setPollStatus] = useState<"loading" | "connected" | "saving" | "unavailable">("loading");

  const fetchLiveData = useCallback(async () => {
    setDataStatus("loading");
    try {
      const pageSize = 50000;
      const rows: PestApiRow[] = [];
      for (let offset = 0; offset < 250000; offset += pageSize) {
        const response = await fetch(buildPestDataUrl(offset, pageSize));
        if (!response.ok) throw new Error("NYC Open Data did not respond");
        const page = (await response.json()) as PestApiRow[];
        rows.push(...page);
        if (page.length < pageSize) break;
      }
      if (rows.length >= 250000) throw new Error("NYC Open Data exceeded the safe page limit");
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

  useEffect(() => {
    const savedRole = window.sessionStorage.getItem(audienceStorageKey);
    if (isAudienceRole(savedRole)) {
      window.queueMicrotask(() => {
        setDraftAudienceRole(savedRole);
        setAudienceRole(savedRole);
      });
    }
  }, []);

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

  const canAdvance = useMemo(() => {
    if (chapter === 2) return draftAudienceRole !== null;
    if (chapter === 3) return overallPrediction !== null;
    return true;
  }, [chapter, draftAudienceRole, overallPrediction]);

  const goNext = useCallback(() => {
    if (!canAdvance) return;
    if (chapter === 2 && draftAudienceRole) {
      window.sessionStorage.setItem(audienceStorageKey, draftAudienceRole);
      setAudienceRole(draftAudienceRole);
    }
    setChapter((current) => Math.min(chapters.length - 1, current + 1));
  }, [canAdvance, chapter, draftAudienceRole]);
  const goBack = useCallback(() => setChapter((current) => Math.max(0, current - 1)), []);

  const changeChartViewWithKeyboard = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, currentView: ChartView) => {
    const views: ChartView[] = ["monthly", "seasonal"];
    const currentIndex = views.indexOf(currentView);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % views.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex + views.length - 1) % views.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = views.length - 1;
    else return;
    event.preventDefault();
    const nextView = views[nextIndex];
    setChartView(nextView);
    window.requestAnimationFrame(() => document.getElementById(`calendar-chart-tab-${nextView}`)?.focus());
  }, []);

  const goToChapter = useCallback((nextChapter: number) => {
    if (!audienceRole && nextChapter > 2) return;
    setChapter(nextChapter);
  }, [audienceRole]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("button, input, a, select, textarea")) return;
      if (event.key === "ArrowRight" || event.key === "Enter") goNext();
      if (event.key === "ArrowLeft") goBack();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goBack, goNext]);

  const overallPeak = peakSeason(analysis.overallSeasonal);
  const overallMax = Math.max(...seasons.map((season) => analysis.overallSeasonal[season]));
  const audienceMax = Math.max(1, ...seasons.map((season) => audiencePoll.counts[season]));
  const activeAudienceCopy = audienceCopy[audienceRole ?? "exploring"];
  const selectedConfig = selectedPest ? pestConfig[selectedPest] : null;
  const selectedPeakMonth = selectedPest ? peakMonth(analysis.monthly[selectedPest]) : null;
  const selectedPeakSeason = selectedPest ? peakSeason(analysis.seasonal[selectedPest]) : null;
  const reminderMonth = selectedPeakMonth === null ? null : monthNames[(selectedPeakMonth + 11) % 12];

  return (
    <main className="story-shell">
      <div className="progress" aria-label={`Chapter ${chapter + 1} of ${chapters.length}`}>
        {chapters.map((label, index) => (
          <button key={label} className={index <= chapter ? "complete" : ""} onClick={() => goToChapter(index)} disabled={!audienceRole && index > 2} aria-label={`Go to ${label}`} title={label} />
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
              <h1>Is there one <span className="text-emphasis emphasis-orange">pest season</span> for every NYC restaurant?</h1>
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
              <h2>Prevention starts <span className="text-emphasis emphasis-green">before</span> an inspector arrives.</h2>
              <p>Critical pest violations can affect a restaurant’s grade, reputation, and ability to operate safely. Understanding when inspectors most often record them can help restaurant teams decide when to strengthen prevention—without predicting any individual inspection.</p>
            </div>
            <div className="split-pattern">
              <article className="pattern-card rodent-card"><span>Inspection schedule</span><h3>Unannounced</h3><p>Every NYC restaurant is scheduled for at least one unannounced health inspection each year.</p></article>
              <article className="pattern-card insect-card"><span>Analysis scope</span><h3>Four critical pest violations</h3><p>We followed rat, mouse, roach, and fly violations across {analysis.inspectionCount.toLocaleString()} unique initial inspections.</p><div>{pestTypes.map((pest) => <PestMark pest={pest} key={pest} />)}</div></article>
            </div>
          </div>
        )}

        {chapter === 2 && (
          <div className="scene audience-scene">
            <form className="audience-form" onSubmit={(event) => { event.preventDefault(); goNext(); }}>
              <div className="audience-heading">
                <p className="eyebrow">Before the quiz</p>
                <h2>Before We Continue, Tell Us Who You Are</h2>
                <fieldset>
                  <legend>Which option best describes you?</legend>
                  <p>Choose the role that best describes you so we can show why these findings matter to you.</p>
                  <div className="audience-options">
                    {audienceRoles.map((role) => (
                      <label className={`audience-option ${draftAudienceRole === role.value ? "selected" : ""}`} key={role.value}>
                        <input className="audience-radio" type="radio" name="audience-role" value={role.value} checked={draftAudienceRole === role.value} onChange={() => setDraftAudienceRole(role.value)} />
                        <strong>{role.label}</strong>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button className="primary-button audience-continue" type="submit" disabled={!draftAudienceRole}>Continue to Quiz <span>→</span></button>
              </div>
            </form>
          </div>
        )}

        {chapter === 3 && (
          <div className="scene prediction-scene" style={{ "--pest-color": "var(--orange)", "--pest-soft": "var(--orange-soft)" } as React.CSSProperties}>
            <div className="prediction-heading"><p className="eyebrow">Make your prediction</p><h2>Which season do you believe has the highest rate of critical pest violations in NYC restaurants?</h2><p className="instruction">Select one answer to see how your prediction compares with 2025 inspection data and other visitors’ responses.</p></div>
            <div className="season-choices" role="group" aria-label="Choose the season with the highest overall critical pest violation rate">
              {seasons.map((season) => (
                <button key={season} className={overallPrediction === season ? "selected" : ""} onClick={() => void submitAudienceVote(season)} aria-pressed={overallPrediction === season} aria-label={`${seasonAnswerLetters[season]}. ${season}, ${fullSeasonMonths[season]}`}>
                  <span className="answer-letter" aria-hidden="true">{seasonAnswerLetters[season]}</span>
                  <span className="season-choice-icon"><SeasonMark season={season} /></span>
                  <strong>{season}</strong><small>{fullSeasonMonths[season]}</small>
                </button>
              ))}
            </div>
            <p className="choice-confirmation">{!overallPrediction ? "Select one answer to continue." : pollStatus === "saving" ? `Saving your ${seasonAnswerLetters[overallPrediction]}. ${overallPrediction} prediction…` : `You chose ${seasonAnswerLetters[overallPrediction]}. ${overallPrediction}. Continue to reveal the result.`}</p>
          </div>
        )}

        {chapter === 4 && (
          <div className="scene overall-result-scene" style={{ "--pest-color": "var(--orange)", "--pest-soft": "var(--orange-soft)" } as React.CSSProperties}>
            <div className="result-copy">
              <p className="eyebrow">The overall result</p>
              <h2><em>{overallPeak}</em> leads overall.</h2>
              <p>{overallPrediction ? `You predicted ${overallPrediction}. ` : ""}{formatRate(analysis.overallSeasonal[overallPeak])} of unique initial inspections in {overallPeak.toLowerCase()} contained at least one of the four critical pest violations.</p>
              <div className="definition-note"><strong>How to read this</strong><span>Each inspection is counted once, even when inspectors recorded more than one pest violation during that visit.</span></div>
              <div className="deeper-insight"><strong>But the overall peak hides a second story.</strong><span>Fall does not mean every pest peaks in fall. Each violation type follows its own schedule.</span></div>
              <div className="audience-insight"><strong>Why this matters to you</strong><span>{activeAudienceCopy.insight}</span></div>
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

        {chapter === 5 && (
          <div className="scene calendar-bridge-scene">
            <div className="calendar-choice-panel">
              <p className="eyebrow">Turn the insight into action</p>
              <h2>What pest should we put on your calendar?</h2>
              <p className="instruction">Choose one pest to see its historically higher-recording period in 2025 NYC inspection data.</p>
              <div className="calendar-pest-options" role="radiogroup" aria-label="Choose one pest for a historical prevention reminder">
                {pestTypes.map((pest) => (
                  <button
                    key={pest}
                    role="radio"
                    className={`calendar-pest-option pest-${pest} ${selectedPest === pest ? "selected" : ""}`}
                    onClick={() => setSelectedPest(pest)}
                    aria-checked={selectedPest === pest}
                  >
                    <PestMark pest={pest} />
                    <span><strong>{pestConfig[pest].name}</strong><small>{pestConfig[pest].description}</small></span>
                  </button>
                ))}
              </div>
            </div>

            <div className="calendar-result-panel" aria-live="polite" style={selectedConfig ? { "--pest-color": selectedConfig.color, "--pest-soft": selectedConfig.soft } as React.CSSProperties : undefined}>
              {!selectedPest || !selectedConfig || selectedPeakMonth === null || !selectedPeakSeason || !reminderMonth ? (
                <div className="calendar-empty"><span>Historical calendar</span><h3>Select a pest to build your reminder.</h3><p>This step uses documented 2025 inspection patterns, not a prediction of current pest activity.</p></div>
              ) : (
                <>
                  <div className="historical-label">HISTORICAL INSPECTION PATTERN — NOT A FORECAST</div>
                  <div className="calendar-result-heading"><PestMark pest={selectedPest} /><div><span>{selectedPeakSeason} pattern</span><h3>{selectedConfig.name}: prepare by {reminderMonth}</h3></div></div>
                  <p className="historical-recommendation">Based on historical NYC inspection records, <strong>{selectedConfig.singular} violations were recorded at their highest inspection rate during {monthNames[selectedPeakMonth]}</strong>. Add a prevention reminder before that period.</p>
                  <div className="calendar-chart-shell">
                    <div className="calendar-chart-tabs" role="tablist" aria-label="Choose a pest data comparison">
                      <button id="calendar-chart-tab-monthly" role="tab" aria-selected={chartView === "monthly"} aria-controls="calendar-chart-panel" tabIndex={chartView === "monthly" ? 0 : -1} onClick={() => setChartView("monthly")} onKeyDown={(event) => changeChartViewWithKeyboard(event, "monthly")}>Monthly timing</button>
                      <button id="calendar-chart-tab-seasonal" role="tab" aria-selected={chartView === "seasonal"} aria-controls="calendar-chart-panel" tabIndex={chartView === "seasonal" ? 0 : -1} onClick={() => setChartView("seasonal")} onKeyDown={(event) => changeChartViewWithKeyboard(event, "seasonal")}>Compare pests</button>
                    </div>
                    <div id="calendar-chart-panel" className="calendar-chart-panel" role="tabpanel" aria-labelledby={`calendar-chart-tab-${chartView}`}>
                      {chartView === "monthly" ? <MonthlyTimingChart pest={selectedPest} analysis={analysis} /> : <SeasonalPestComparison analysis={analysis} />}
                    </div>
                    <p className="chart-definition"><strong>What the percentages mean:</strong> the share of unique initial inspections in that month or season where inspectors recorded the specified critical pest violation.</p>
                  </div>
                  <div className="role-calendar-action"><strong>What this could mean for you</strong><span>{activeAudienceCopy.calendarAction}</span></div>
                  <div className="inspection-transition">
                    <h3>Move from the citywide pattern to your restaurant.</h3>
                    <p>Seasonal patterns show when certain pest violations have historically appeared more often. Your own inspection history can show which issues may be most relevant to your restaurant.</p>
                    <p className="nearby-note"><strong>Nearby comparison is the next planned layer.</strong> The current MVP starts with verified restaurant-level inspection history.</p>
                    <Link href="/restaurant">Check My Inspection Record →</Link>
                  </div>
                  <p className="calendar-method">Based on {analysis.inspectionCount.toLocaleString()} unique initial inspections from 2025. This describes recorded inspection patterns and does not predict present conditions or a future inspection.</p>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {chapter > 0 && <button className="nav-button nav-back" onClick={goBack} aria-label="Previous chapter">←</button>}
      {chapter > 0 && chapter < chapters.length - 1 && chapter !== 2 && <button className={`nav-button nav-next ${!canAdvance ? "disabled" : ""}`} onClick={goNext} disabled={!canAdvance} aria-label="Next chapter">→</button>}
      {chapter > 0 && chapter < chapters.length - 1 && chapter !== 2 && <p className="continue-label">{canAdvance ? "Continue" : "Make one prediction"}<span>Arrow keys work, too</span></p>}
    </main>
  );
}
