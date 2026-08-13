# NYC Pest Prep: Project Outline

## 1. Project Overview

NYC Pest Prep is a data story and restaurant-owner tool built from the NYC Department of Health and Mental Hygiene Restaurant Inspection Results dataset. The project first helps visitors understand when inspectors historically recorded critical pest violations, then guides them to search for a restaurant and review its verified inspection history.

The experience is available at [nyc-pest-prep.netlify.app](https://nyc-pest-prep.netlify.app/).

## 2. Problem Statement

NYC restaurant inspections are unannounced, and critical pest violations can affect inspection scores, grade eligibility, reputation, and safe operations. Restaurant owners can access official inspection records, but the raw data is difficult to interpret and does not immediately translate into preventative action.

NYC Pest Prep makes these records easier to understand without claiming to predict current pest activity or future inspections.

## 3. Primary Goal

Move a restaurant owner from a broad, evidence-based seasonal insight to a useful first action:

> Understand the citywide pattern → find a restaurant → review its official pest history → understand the record → identify a preventative next step.

## 4. Target Audiences

### Primary audience

- Restaurant owners and managers who want to understand their inspection history and prepare proactively.

### Secondary audiences

- Pest-control professionals who may use historical patterns to support timely education and client conversations.
- General visitors who want to explore NYC restaurant inspection data in plain language.

The selected audience changes only a small amount of explanatory copy. Everyone receives the same data, quiz, charts, and restaurant lookup experience.

## 5. Data Source and Scope

- **Dataset:** NYC Department of Health Restaurant Inspection Results
- **NYC Open Data ID:** `43nn-pn8j`
- **API:** `https://data.cityofnewyork.us/resource/43nn-pn8j.json`
- **Seasonal analysis period:** January 1–December 31, 2025
- **Seasonal analysis unit:** One unique initial inspection, identified by CAMIS, inspection date, and inspection type
- **Saved analysis scale:** Approximately 13,000 unique initial inspections
- **Restaurant lookup key:** CAMIS, NYC's unique restaurant identifier

The presentation requests current records from NYC Open Data when it loads. If that request fails, it displays the most recently saved 2025 analysis and labels the data status accordingly.

## 6. Critical Pest Categories

The project follows four critical violation codes:

| Pest category | Violation code | What the record means |
| --- | --- | --- |
| Rats | `04K` | Evidence of rats or live rats in food or non-food areas |
| Mice | `04L` | Evidence of mice or live mice in food or non-food areas |
| Roaches | `04M` | Live roaches in food or non-food areas |
| Flies | `04N` | Filth flies, food/refuse/sewage-associated flies, or related nuisance pests |

These codes identify what an inspector recorded during an inspection. They do not establish a restaurant's current condition.

## 7. Research Questions

1. During which season did NYC initial inspections record critical pest violations most often in 2025?
2. Do rat, mouse, roach, and fly violations follow different seasonal and monthly patterns?
3. Were inspections with critical pest violations more likely to receive scores outside the A-grade range than inspections without those violations?

## 8. Core Findings Presented

- Critical pest violations were not recorded at the same rate in every season.
- Different pest categories followed different monthly and seasonal patterns, so there is not one universal pest calendar.
- In the analyzed 2025 records, scored initial inspections with a critical pest violation were approximately **2.7 times as likely** to receive a score outside the A-grade range as inspections without one.

The score finding is an association. It does not prove that pest violations alone caused the final inspection score.

## 9. Data Story Structure

The landing page at `/` is the primary customer funnel and contains seven chapters.

### Chapter 1: Opening

- Establish that NYC restaurants receive unannounced health inspections.
- Introduce the 2025 inspection analysis.
- Ask whether one pest season applies to every restaurant.

### Chapter 2: Why Timing Matters

- Explain how critical pest findings can affect grades, reputation, and safe operations.
- Define the scope: rats, mice, roaches, and flies.
- Clarify that historical timing supports prevention but does not predict an inspection.

### Chapter 3: Audience Selection

- Ask visitors what brings them to the story.
- Offer three roles: restaurant owner or manager, pest-control professional, or other/exploring.
- Save the confirmed role for the current browser session.
- Use the role to lightly personalize later explanations.

### Chapter 4: Seasonal Prediction Quiz

- Ask which season the visitor believes had the highest rate of critical pest violations.
- Present Winter, Spring, Summer, and Fall as accessible multiple-choice answers.
- Save one anonymous poll response per browser.

### Chapter 5: Overall Result

- Reveal the highest-recording season in the 2025 inspection analysis.
- Compare the visitor's prediction with the data.
- Show the live audience poll without inventing sample responses.
- Explain the percentage denominator in plain language.

### Chapter 6: Pest Calendar

- Ask, “What pest should we put on your calendar?”
- Let the visitor select rats, mice, roaches, or flies.
- Show the selected pest's 12-month pattern and suggested reminder month.
- Provide a second chart comparing all four pests across the four seasons.
- Label the recommendation as a historical inspection pattern, not a forecast.

### Chapter 7: Why This Matters

- Compare the share of inspections outside the A-grade score range with and without critical pest findings.
- Explain that lower scores are better and that 0–13 is the A-grade score range.
- End with the CTA: **“Check My Inspection Record.”**
- Send the visitor to the restaurant-owner MVP at `/restaurant`.

## 10. Restaurant-Owner MVP

### Core journey

> Find restaurant → retrieve verified NYC records → show pest history → explain results → compare nearby → recommend a preventative next step → find registered professional help.

### Restaurant search at `/restaurant`

- Search by restaurant name using debounced autocomplete.
- Wait 400 milliseconds after typing stops before requesting matches.
- Require at least three characters before searching.
- Return up to 10 locations with restaurant name, address, and borough.
- Support keyboard navigation, loading, no-match, API-error, and retry states.
- Use the selected location's CAMIS to open the correct record.

### Restaurant record at `/restaurant/{CAMIS}`

#### Latest official result

- Show the latest scored inspection's date, type, score, grade, and score range.
- Keep the latest score and grade tied to the same inspection event.

#### Pest-history summary

- Count inspections containing critical pest findings.
- Show the date range, pest types, and initial-inspection/reinspection breakdown.
- State that historical findings do not describe present conditions.

#### Inspection timeline

- Display inspection events chronologically in a compact, continuous timeline.
- Separate initial inspections from reinspections.
- Show score, grade, pest-finding status, and score change for each event.
- Keep full official details and prevention guidance in expandable sections.
- Do not imply that a reinspection caused a later improvement.

#### Nearby comparison

- Compare the restaurant's latest scored initial inspection with one latest scored initial inspection per nearby restaurant.
- Limit the comparison to restaurants within 500 meters and the same calendar year.
- Use the nearby median as the typical nearby score.
- Show the restaurant score, nearby median, cohort size, and share of nearby restaurants in the A-score range.
- Warn when the sample is limited and explain when a comparison is unavailable.

#### Preventative guidance

- Translate official pest codes into plain language.
- Recommend a practical next step tied to the recorded pest category.
- Adapt the professional-help transition depending on whether the restaurant has recorded pest findings.
- Connect owners to a separate registered-provider search while keeping the experience informational.

### Registered-provider finder at `/restaurant/{CAMIS}/providers`

- Use New York State's current pesticide-business dataset rather than scraping the NYSPAD website.
- Require Category 7F — Food Processing for every displayed provider.
- Show up to 10 current registrations ordered by approximate distance from the restaurant.
- Begin within five miles and allow the owner to expand the search to 15 miles.
- Display registration number, expiration date, registered city/ZIP, category, and approximate distance.
- Link to Google Maps for an independent business search and to NYSPAD for official registration verification.
- Explain that state locations are geocoded from city/ZIP and do not confirm a street address or service area.
- State that appearing in results is informational and is not an endorsement.
- Keep bookings, paid referrals, sponsored placements, and Google rating data outside the first release.

## 11. Analysis Method

### Seasonal and monthly rates

For each month or season:

> Rate = unique initial inspections containing the specified critical pest violation ÷ all unique initial inspections in that period × 100

Each inspection is counted once in the denominator, even if the dataset contains multiple violation rows for that inspection. For the overall pest rate, an inspection is counted once even when multiple pest categories were recorded.

### Score comparison

- Include unique initial inspections with a reported score.
- Treat scores of 0–13 as within the A-grade score range.
- Treat scores of 14 or more as outside the A-grade score range.
- Compare the outside-A rate for inspections with and without a critical pest finding.

### Nearby benchmark

- Use the target restaurant's latest scored initial inspection.
- Use one latest scored initial inspection per nearby CAMIS from the same year.
- Exclude reinspections from the nearby benchmark while keeping them visible in the restaurant timeline.
- Use the median rather than the mean so repeated or unusually high scores do not dominate the comparison.

## 12. Design and Interaction Principles

- Lead with the data story before introducing the product CTA.
- Use the established cream, Prussian blue, green, orange, and supporting pest colors.
- Use clear visual hierarchy, concise copy, silhouettes/icons, and zero-based charts.
- Explain every percentage denominator near its chart.
- Keep key actions usable by keyboard and understandable without relying only on color.
- Support desktop and mobile layouts without horizontal page overflow.
- Respect reduced-motion preferences.

## 13. Trust, Accuracy, and Limitations

- Official NYC records are visually separated from product summaries and recommendations.
- Seasonal results describe inspections conducted in 2025; they are not a forecast of pest activity.
- Inspection findings indicate what was recorded on a specific date, not a restaurant's current condition.
- Associations between pest findings and scores do not prove causation.
- A restaurant's inspection sequence does not prove that a reinspection caused a later score change.
- Nearby results provide historical context, not a current rating.
- Missing scores, coordinates, or nearby records may prevent some comparisons.
- Restaurant-name search depends on the official name stored in NYC Open Data.

## 14. Current Technical Structure

- **Framework:** Next.js 16, React 19, and TypeScript
- **Build/runtime tooling:** Vinext and Vite
- **Deployment:** Netlify
- **Live datasets:** NYC restaurant inspections and NYS registered pesticide businesses through Socrata APIs
- **Audience poll storage:** Netlify Blobs
- **Styling and charts:** Custom CSS and semantic HTML; no chart library
- **Primary routes:** `/`, `/restaurant`, `/restaurant/{CAMIS}`, and `/restaurant/{CAMIS}/providers`
- **API routes:** Poll, restaurant search, restaurant history/nearby comparison, and registered-provider search

## 15. Testing Priorities

- Validate seasonal and monthly rates against the NYC Open Data records.
- Confirm each restaurant result uses the selected CAMIS.
- Test similar names and multiple restaurant locations.
- Test records with pest findings, no pest history, missing scores, and unavailable nearby comparisons.
- Confirm one latest initial inspection per nearby restaurant is used in the benchmark.
- Confirm provider results contain only current Category 7F registrations, are deduplicated, and are ordered by approximate distance.
- Test five-mile and 15-mile provider searches, missing restaurant coordinates, no provider results, and state API errors.
- Verify loading, empty, API-error, retry, and saved-data states.
- Test keyboard navigation, accessible labels, focus states, mobile layout, and reduced motion.
- Run the automated build and rendered-HTML test suite before publishing changes.

## 16. MVP Boundaries

The first version does **not** include:

- User accounts or saved restaurants
- Automated alerts or reminders
- Inspection-date prediction
- Current pest-activity prediction
- A reinspection simulator
- A two-sided pest-control marketplace
- Paid referrals or bookings
- Google Places ratings, review counts, or reproduced review content

## 17. Future Opportunities

- Allow owners to save a restaurant and opt into prevention reminders.
- Add carefully validated multi-year seasonal comparisons.
- Expand search with a separate address-based flow.
- Add borough or neighborhood comparisons when sample sizes support them.
- Add Google rating and review-count enrichment after billing, attribution, privacy, and content-storage requirements are implemented.
- Add provider contact details, service-area filters, and clearly labeled referral relationships after the informational finder is validated.
- Measure whether visitors move from the data story to restaurant search and complete a record review.

## 18. Success Criteria

The MVP succeeds when a restaurant owner can:

1. Understand the central seasonal insight without mistaking it for a prediction.
2. Find the correct restaurant location quickly.
3. Identify the latest official result and understand how the record changed over time.
4. Recognize any historical pest findings in plain language.
5. Understand how the latest comparable result stands relative to nearby restaurants.
6. Leave with one credible preventative next step.
7. Find a current Category 7F business and independently verify its registration before making contact.
