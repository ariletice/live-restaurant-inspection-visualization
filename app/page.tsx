"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Season = "Winter" | "Spring" | "Summer" | "Fall";
type Category = "temperature" | "pest" | "hygiene";
type Rates = Record<Category, Record<Season, number>>;

const seasons: Season[] = ["Winter", "Spring", "Summer", "Fall"];

const fallbackRates: Rates = {
  temperature: { Winter: 35.54, Spring: 44.05, Summer: 44.87, Fall: 37.81 },
  pest: { Winter: 28.75, Spring: 28.4, Summer: 32.56, Fall: 35.87 },
  hygiene: { Winter: 7.24, Spring: 8.59, Summer: 8.14, Fall: 7.22 },
};

const categories = {
  temperature: {
    eyebrow: "Critical risk 01",
    name: "Food temperature",
    shortName: "Temperature",
    question: "During which season do inspections most often find a critical food-temperature violation?",
    detail: "Unsafe holding, cooking, cooling, reheating, or storage temperatures can allow harmful bacteria to grow.",
    codes: "NYC violation codes 02A–02I",
    color: "var(--orange)",
    soft: "var(--orange-soft)",
  },
  pest: {
    eyebrow: "Critical risk 02",
    name: "Pests",
    shortName: "Pest",
    question: "During which season do inspections most often find a critical pest violation?",
    detail: "Evidence of rats, mice, roaches, flies, or other nuisance pests can signal contamination risks.",
    codes: "NYC violation codes 04K–04N",
    color: "var(--green-dark)",
    soft: "var(--green)",
  },
  hygiene: {
    eyebrow: "Critical risk 03",
    name: "Food-worker hygiene",
    shortName: "Worker hygiene",
    question: "During which season do inspections most often find a critical food-worker hygiene violation?",
    detail: "This category includes bare-hand contact with ready-to-eat food, personal cleanliness, and unsafe eating, drinking, or smoking in preparation areas.",
    codes: "NYC violation codes 04C, 06A, and 06B",
    color: "var(--blue)",
    soft: "var(--blue-soft)",
  },
} as const;

const chapters = [
  "Opening",
  "Context",
  "Temperature prediction",
  "Temperature result",
  "Pest prediction",
  "Pest result",
  "Hygiene prediction",
  "Hygiene result",
  "Comparison",
  "Definitions",
  "Audience",
  "Why it matters",
  "Method",
];

const categoryCodes: Record<Category, Set<string>> = {
  temperature: new Set(["02A", "02B", "02C", "02D", "02E", "02F", "02G", "02H", "02I"]),
  pest: new Set(["04K", "04L", "04M", "04N"]),
  hygiene: new Set(["04C", "06A", "06B"]),
};

const peakSeason = (values: Record<Season, number>) =>
  seasons.reduce((best, season) => (values[season] > values[best] ? season : best), seasons[0]);

function formatRate(value: number) {
  return `${value.toFixed(1)}%`;
}

function getSeason(date: Date): Season {
  const month = date.getUTCMonth() + 1;
  if (month === 12 || month <= 2) return "Winter";
  if (month <= 5) return "Spring";
  if (month <= 8) return "Summer";
  return "Fall";
}

function SeasonGlyph({ season }: { season: Season }) {
  const glyphs: Record<Season, string> = { Winter: "✳", Spring: "✿", Summer: "☀", Fall: "◆" };
  return <span aria-hidden="true">{glyphs[season]}</span>;
}

function PredictionCard({
  category,
  choice,
  onChoose,
}: {
  category: Category;
  choice?: Season;
  onChoose: (season: Season) => void;
}) {
  const config = categories[category];
  return (
    <div className="prediction-wrap" style={{ "--accent": config.color, "--accent-soft": config.soft } as React.CSSProperties}>
      <p className="eyebrow">{config.eyebrow}</p>
      <h2>{config.question}</h2>
      <p className="instruction">Make a prediction before the data appears.</p>
      <div className="season-grid" role="group" aria-label="Choose a season">
        {seasons.map((season) => (
          <button
            className={`season-choice ${choice === season ? "selected" : ""}`}
            key={season}
            onClick={() => onChoose(season)}
            aria-pressed={choice === season}
          >
            <span className="season-glyph"><SeasonGlyph season={season} /></span>
            <span>{season}</span>
          </button>
        ))}
      </div>
      <p className={`choice-confirmation ${choice ? "visible" : ""}`} aria-live="polite">
        {choice ? `Prediction locked: ${choice}. Continue to reveal the result.` : "Choose one season to continue."}
      </p>
    </div>
  );
}

function RateBars({ category, rates, choice }: { category: Category; rates: Rates; choice?: Season }) {
  const config = categories[category];
  const values = rates[category];
  const peak = peakSeason(values);
  const max = Math.max(...seasons.map((season) => values[season]));

  return (
    <div className="reveal-grid" style={{ "--accent": config.color, "--accent-soft": config.soft } as React.CSSProperties}>
      <div className="reveal-copy">
        <p className="eyebrow">The result</p>
        <h2><span>{peak}</span> rises to the top.</h2>
        <p>
          {choice ? `You predicted ${choice}. ` : ""}
          {category === "pest"
            ? "The highest pest-violation rate appears in fall—not summer, the season many people expect."
            : category === "temperature"
              ? "Summer leads, with spring close behind. The coldest and warmest seasons do not produce the same pattern."
              : "Spring is highest in this sample, but the difference across seasons is small, so this pattern deserves caution."}
        </p>
        <div className="rate-definition">
          <strong>What does the percentage mean?</strong>
          <span>The share of unique 2025 initial inspections containing at least one critical violation in this category.</span>
        </div>
      </div>

      <div className="bar-chart" aria-label={`${config.name} violation rate by season`}>
        {seasons.map((season) => {
          const isPeak = season === peak;
          return (
            <div className={`bar-row ${isPeak ? "peak" : ""}`} key={season}>
              <div className="bar-label"><SeasonGlyph season={season} /> {season}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(values[season] / max) * 100}%` }} />
              </div>
              <strong>{formatRate(values[season])}</strong>
              {isPeak && <span className="peak-tag">highest</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComparisonChart({ rates }: { rates: Rates }) {
  const max = 50;
  return (
    <div className="comparison-chart" aria-label="Critical violation rates by category and season">
      <div className="chart-scale" aria-hidden="true">
        {[50, 40, 30, 20, 10, 0].map((tick) => <span key={tick}>{tick}%</span>)}
      </div>
      <div className="comparison-columns">
        {seasons.map((season) => (
          <div className="comparison-column" key={season}>
            <div className="comparison-plot">
              {(["temperature", "pest", "hygiene"] as Category[]).map((category) => (
                <div
                  className={`data-dot ${category}`}
                  key={category}
                  style={{ bottom: `${(rates[category][season] / max) * 100}%` }}
                  title={`${categories[category].name}: ${formatRate(rates[category][season])}`}
                >
                  <span>{formatRate(rates[category][season])}</span>
                </div>
              ))}
            </div>
            <strong><SeasonGlyph season={season} /> {season}</strong>
          </div>
        ))}
      </div>
      <div className="chart-legend">
        {(["temperature", "pest", "hygiene"] as Category[]).map((category) => (
          <span key={category} className={category}><i />{categories[category].name}</span>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [chapter, setChapter] = useState(0);
  const [choices, setChoices] = useState<Partial<Record<Category, Season>>>({});
  const [audience, setAudience] = useState<"restaurant" | "city" | "curious" | null>(null);
  const [rates, setRates] = useState<Rates>(fallbackRates);
  const [inspectionCount, setInspectionCount] = useState(13158);
  const [dataStatus, setDataStatus] = useState<"loading" | "live" | "fallback">("loading");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchLiveData = useCallback(async () => {
    setDataStatus("loading");
    try {
      const params = new URLSearchParams({
        "$select": "camis,inspection_date,inspection_type,violation_code,critical_flag",
        "$where": "inspection_date between '2025-01-01T00:00:00.000' and '2025-12-31T23:59:59.999' AND inspection_type like '%Initial Inspection%'",
        "$limit": "50000",
      });
      const response = await fetch(`https://data.cityofnewyork.us/resource/43nn-pn8j.json?${params.toString()}`);
      if (!response.ok) throw new Error("NYC Open Data did not respond");
      const rows: Array<{ camis?: string; inspection_date?: string; inspection_type?: string; violation_code?: string; critical_flag?: string }> = await response.json();
      const denominators: Record<Season, Set<string>> = { Winter: new Set(), Spring: new Set(), Summer: new Set(), Fall: new Set() };
      const numerators: Record<Category, Record<Season, Set<string>>> = {
        temperature: { Winter: new Set(), Spring: new Set(), Summer: new Set(), Fall: new Set() },
        pest: { Winter: new Set(), Spring: new Set(), Summer: new Set(), Fall: new Set() },
        hygiene: { Winter: new Set(), Spring: new Set(), Summer: new Set(), Fall: new Set() },
      };

      for (const row of rows) {
        if (!row.camis || !row.inspection_date || !row.inspection_type) continue;
        const date = new Date(row.inspection_date);
        if (Number.isNaN(date.getTime())) continue;
        const season = getSeason(date);
        const inspectionKey = `${row.camis}|${row.inspection_date.slice(0, 10)}|${row.inspection_type}`;
        denominators[season].add(inspectionKey);
        if (row.critical_flag !== "Critical" || !row.violation_code) continue;
        for (const category of Object.keys(categoryCodes) as Category[]) {
          if (categoryCodes[category].has(row.violation_code)) numerators[category][season].add(inspectionKey);
        }
      }

      const computed = structuredClone(fallbackRates);
      for (const category of Object.keys(categoryCodes) as Category[]) {
        for (const season of seasons) {
          const denominator = denominators[season].size;
          if (denominator) computed[category][season] = (numerators[category][season].size / denominator) * 100;
        }
      }
      const totalInspections = seasons.reduce((sum, season) => sum + denominators[season].size, 0);
      if (!totalInspections) throw new Error("No inspections returned");
      setRates(computed);
      setInspectionCount(totalInspections);
      setDataStatus("live");
      setLastUpdated(new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date()));
    } catch {
      setRates(fallbackRates);
      setInspectionCount(13158);
      setDataStatus("fallback");
      setLastUpdated("using the most recent saved 2025 analysis");
    }
  }, []);

  useEffect(() => { void fetchLiveData(); }, [fetchLiveData]);

  const canAdvance = useMemo(() => {
    if (chapter === 2) return Boolean(choices.temperature);
    if (chapter === 4) return Boolean(choices.pest);
    if (chapter === 6) return Boolean(choices.hygiene);
    return true;
  }, [chapter, choices]);

  const goNext = useCallback(() => {
    if (canAdvance) setChapter((current) => Math.min(chapters.length - 1, current + 1));
  }, [canAdvance]);
  const goBack = useCallback(() => setChapter((current) => Math.max(0, current - 1)), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "Enter") goNext();
      if (event.key === "ArrowLeft") goBack();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goBack]);

  const audienceCopy = {
    restaurant: {
      title: "For restaurant teams",
      text: "Seasonal patterns can guide when teams reinforce temperature logs, pest prevention, and staff practices—but every inspection uses the same standards year-round.",
    },
    city: {
      title: "For public-health teams",
      text: "Different peaks may help shape the timing of education and prevention resources. They do not, on their own, prove that season causes violations.",
    },
    curious: {
      title: "For diners and researchers",
      text: "The story shows patterns across inspections, not the safety of a specific restaurant. A seasonal rate should never replace a restaurant’s current inspection record.",
    },
  } as const;

  return (
    <main className="story-shell">
      <div className="progress" aria-label={`Chapter ${chapter + 1} of ${chapters.length}`}>
        {chapters.map((label, index) => (
          <button
            key={label}
            className={index <= chapter ? "complete" : ""}
            onClick={() => setChapter(index)}
            aria-label={`Go to ${label}`}
            title={label}
          />
        ))}
      </div>

      <header className="topbar">
        <button className="wordmark" onClick={() => setChapter(0)} aria-label="Return to the beginning">
          <span>NYC</span> After the Bell
        </button>
        <div className={`live-status ${dataStatus}`}>
          <i /> {dataStatus === "loading" ? "Checking NYC Open Data" : dataStatus === "live" ? "Live data connected" : "Saved data shown"}
        </div>
      </header>

      <section className="stage" aria-live="polite">
        {chapter === 0 && (
          <div className="scene cover-scene">
            <div className="inspection-stamp stamp-one">UNANNOUNCED</div>
            <div className="inspection-stamp stamp-two">CRITICAL</div>
            <div className="cover-copy">
              <p className="eyebrow">A data story about 13,000+ NYC inspections</p>
              <h1>What does the season reveal?</h1>
              <p className="dek">Temperature, pests, and worker hygiene do not peak at the same time of year.</p>
              <button className="primary-button" onClick={goNext}>Start the story <span>→</span></button>
            </div>
            <div className="grade-card" aria-hidden="true">
              <span>NYC</span>
              <strong>A</strong>
              <small>RESTAURANT<br />INSPECTION</small>
            </div>
            <p className="cover-note">Based on unique initial inspections conducted in 2025</p>
          </div>
        )}

        {chapter === 1 && (
          <div className="scene context-scene">
            <div className="context-copy">
              <p className="eyebrow">Before we look at the numbers</p>
              <h2>NYC restaurants are inspected under the same health standards year-round—but critical risks may not follow the same calendar.</h2>
              <p>This story tests whether unsafe food temperatures, pests, and worker hygiene appear at different rates across seasons.</p>
            </div>
            <div className="risk-cards">
              {(["temperature", "pest", "hygiene"] as Category[]).map((category, index) => (
                <article className={`risk-card card-${index + 1}`} key={category}>
                  <span>0{index + 1}</span>
                  <h3>{categories[category].name}</h3>
                  <p>{categories[category].detail}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        {chapter === 2 && <div className="scene"><PredictionCard category="temperature" choice={choices.temperature} onChoose={(season) => setChoices((current) => ({ ...current, temperature: season }))} /></div>}
        {chapter === 3 && <div className="scene"><RateBars category="temperature" rates={rates} choice={choices.temperature} /></div>}
        {chapter === 4 && <div className="scene"><PredictionCard category="pest" choice={choices.pest} onChoose={(season) => setChoices((current) => ({ ...current, pest: season }))} /></div>}
        {chapter === 5 && <div className="scene"><RateBars category="pest" rates={rates} choice={choices.pest} /></div>}
        {chapter === 6 && <div className="scene"><PredictionCard category="hygiene" choice={choices.hygiene} onChoose={(season) => setChoices((current) => ({ ...current, hygiene: season }))} /></div>}
        {chapter === 7 && <div className="scene"><RateBars category="hygiene" rates={rates} choice={choices.hygiene} /></div>}

        {chapter === 8 && (
          <div className="scene comparison-scene">
            <div className="scene-heading">
              <p className="eyebrow">Step back</p>
              <h2>Three risks. Three seasonal patterns.</h2>
              <p>Temperature violations rise most in summer, pest violations peak in fall, and worker-hygiene rates remain comparatively steady.</p>
            </div>
            <ComparisonChart rates={rates} />
          </div>
        )}

        {chapter === 9 && (
          <div className="scene definitions-scene">
            <div className="scene-heading">
              <p className="eyebrow">What is being counted?</p>
              <h2>The labels matter as much as the numbers.</h2>
            </div>
            <div className="definition-layout">
              <div className="definition-cards">
                {(["temperature", "pest", "hygiene"] as Category[]).map((category) => (
                  <article key={category}>
                    <h3>{categories[category].name}</h3>
                    <p>{categories[category].detail}</p>
                    <small>{categories[category].codes}</small>
                  </article>
                ))}
              </div>
              <div className="season-key">
                <h3>Seasons used</h3>
                <p><strong>Winter</strong> December–February</p>
                <p><strong>Spring</strong> March–May</p>
                <p><strong>Summer</strong> June–August</p>
                <p><strong>Fall</strong> September–November</p>
              </div>
            </div>
          </div>
        )}

        {chapter === 10 && (
          <div className="scene audience-scene">
            <p className="eyebrow">Your turn</p>
            <h2>What brings you to this story?</h2>
            <p className="instruction">Choose the perspective closest to yours. Your answer changes the final takeaway.</p>
            <div className="audience-grid">
              <button className={audience === "restaurant" ? "selected" : ""} onClick={() => setAudience("restaurant")}>
                <span>01</span><strong>Restaurant owner or worker</strong><small>Preparing a team or operation</small>
              </button>
              <button className={audience === "city" ? "selected" : ""} onClick={() => setAudience("city")}>
                <span>02</span><strong>Public-health or city staff</strong><small>Planning education or resources</small>
              </button>
              <button className={audience === "curious" ? "selected" : ""} onClick={() => setAudience("curious")}>
                <span>03</span><strong>Diner, student, or researcher</strong><small>Understanding the public record</small>
              </button>
            </div>
          </div>
        )}

        {chapter === 11 && (
          <div className="scene takeaway-scene">
            <div className="takeaway-card">
              <p className="eyebrow">{audience ? audienceCopy[audience].title : "Why this matters"}</p>
              <h2>Seasonal context can sharpen preparation. It should never change the standard.</h2>
              <p>{audience ? audienceCopy[audience].text : "These patterns can help restaurant and public-health teams ask better questions about prevention and timing while keeping expectations consistent throughout the year."}</p>
              <div className="takeaway-points">
                <span><b>Summer</b> Watch temperature controls</span>
                <span><b>Fall</b> Reinforce pest prevention</span>
                <span><b>Year-round</b> Maintain worker practices</span>
              </div>
            </div>
          </div>
        )}

        {chapter === 12 && (
          <div className="scene method-scene">
            <div className="method-copy">
              <p className="eyebrow">Method and limits</p>
              <h2>A pattern is an invitation to investigate—not proof of a cause.</h2>
              <p>This analysis groups unique NYC restaurant initial inspections from 2025 by season. A category’s rate is the percentage of those inspections containing at least one critical violation in that category.</p>
              <ul>
                <li>Inspections are the unit of analysis, not individual restaurants.</li>
                <li>The results show association; they do not prove that season caused a violation.</li>
                <li>The hygiene difference is small and was not conclusive in the original significance check.</li>
              </ul>
              <a href="https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j/about_data" target="_blank" rel="noreferrer">View the NYC Open Data source ↗</a>
            </div>
            <div className="data-receipt">
              <span>DATA RECEIPT</span>
              <dl>
                <div><dt>Year</dt><dd>2025</dd></div>
                <div><dt>Unique initial inspections</dt><dd>{inspectionCount.toLocaleString()}</dd></div>
                <div><dt>Connection</dt><dd>{dataStatus === "live" ? "Live" : "Saved"}</dd></div>
                <div><dt>Last checked</dt><dd>{lastUpdated || "Checking now"}</dd></div>
              </dl>
              <button onClick={() => void fetchLiveData()} disabled={dataStatus === "loading"}>
                {dataStatus === "loading" ? "Refreshing…" : "Re-run the live fetch"}
              </button>
            </div>
          </div>
        )}
      </section>

      {chapter > 0 && <button className="nav-button nav-back" onClick={goBack} aria-label="Previous chapter">←</button>}
      {chapter < chapters.length - 1 && chapter !== 0 && (
        <button className={`nav-button nav-next ${!canAdvance ? "disabled" : ""}`} onClick={goNext} disabled={!canAdvance} aria-label="Next chapter">→</button>
      )}
      {chapter > 0 && chapter < chapters.length - 1 && (
        <p className="continue-label">{canAdvance ? "Continue" : "Choose a season"}<span>Arrow keys work, too</span></p>
      )}
    </main>
  );
}
