# Supergoop Promotion Studio — Strategic Improvement Analysis

**Date:** March 17, 2026
**Reviewer:** AI Business & Sales Strategy Advisor
**Scope:** Full application audit — 10 steps, 25+ JS modules, 20 data files, ~27K LOC

---

## EXECUTIVE SUMMARY

This is a strong promotional decision tool with real analytical depth. However, it suffers from **feature sprawl** — too many panels, tabs, and modules that dilute the core business story. A buyer like Ritesh Aggarwal won't sit through 10 steps. They want 3 answers: *What should I promote? At what price? When?*

Below is a prioritized list of what to improve, what to cut, and what to double down on.

---

## PART 1: WHAT TO IMPROVE

### 1. The Step Flow Is Too Long — Collapse to 5 Steps Max

**Current:** 10 steps (Welcome > Dashboard > Data Explorer > Segmentation > Segment Response > Acquisition Model > Churn Model > Migration Model > Event Calendar > AI Chat)

**Problem:** By step 4, a business stakeholder has lost interest. The flow feels like a product tour, not a decision tool. Steps 4-5 (segmentation heatmaps) and Steps 6-8 (three separate elasticity models) are granular analyst views that interrupt the business narrative.

**Recommendation:**
- **Step 1:** Current State — Channel groups + KPIs + "What Changed This Week" summary
- **Step 2:** Promotion Simulator — The main event. Channel sliders + AI recommendation + SKU response table. Merge current Step 1 simulator + Step 6 acquisition + Step 7 markdown into one unified view showing all three effects simultaneously
- **Step 3:** Market Intelligence — Event timeline + competitor price feed + social signals (current Step 9, promoted earlier — this is the "why" behind the recommendation)
- **Step 4:** Deep Dive — Segmentation heatmaps, migration analysis, data explorer (current Steps 4-5, 8, 2 collapsed into tabs for analysts who want to dig deeper)
- **Step 5:** AI Strategy Assistant — Chat interface (current Step 10)

This cuts cognitive load in half and puts the answer ("what to do") before the methodology ("how we calculated it").

---

### 2. Add a "One-Click Recommendation" Button to the Simulator

**Current:** User must manually adjust two sliders, pick an objective lens, set a planning horizon, then read a wall of text in the AI recommendation panel.

**Problem:** The first thing a VP asks is "just tell me what to do." Making them fiddle with sliders first creates friction.

**Recommendation:**
- Add a prominent **"Optimize for Me"** button at the top of the simulator
- When clicked, run the scenario engine across key combinations, pick the top recommendation based on the selected objective, and auto-set the sliders to the optimal position
- Show a before/after comparison card: "Current plan vs. Recommended plan"
- The sliders then become a "what-if I override" tool, not the primary interface

---

### 3. The AI Recommendation Panel Buries the Lead

**Current:** The `updateAiRecommendation()` generates a long narrative with a dynamic title, pricing table, timing advice, risk statements, and a 4-part brief. Thorough but dense.

**Problem:** Nobody reads 8 paragraphs of recommendation text during a demo. The most important information (which products, what price, expected outcome) gets lost in the wall of text.

**Recommendation:**
- Lead with a **3-card summary row**:
  - Card 1: **"Promote These"** — 2-3 SKU names with recommended price per retailer
  - Card 2: **"Hold These"** — SKUs where discounting destroys margin
  - Card 3: **"Expected Outcome"** — revenue lift %, margin impact, inventory clearance %
- Move the full narrative below as a collapsible "Full Analysis" section
- Add a **confidence badge** (High / Medium / Low) based on whether the validation window is clean or confounded

---

### 4. Competitor Intelligence Needs Real-Time Urgency

**Current:** Competitor prices are shown in the signal cards and event detail breakdown as tables of numbers.

**Problem:** A competitor undercut is an urgent signal. It should feel urgent in the UI, not like a spreadsheet.

**Recommendation:**
- Add a **Competitor Alert Banner** at the top of the dashboard when any competitor has dropped price >5% in the current or previous week
- Format: `ALERT: Amazon competitor undercut Sport Gel SPF 60 (SUN_S3) by 11.2% this week — your price gap is now $3.85. [See Impact] [Adjust Pricing]`
- `[See Impact]` scrolls to the SKU response table with SUN_S3 highlighted
- `[Adjust Pricing]` auto-loads a defensive scenario in the simulator

---

### 5. Inventory Position Should Be Front and Center

**Current:** Inventory is shown in the migration model (Step 8) and as a secondary metric in the simulator waterfall.

**Problem:** For a seasonal brand like Supergoop, inventory clearance by end-of-season is the #1 constraint. If you have 4 weeks left and 40% inventory remaining, nothing else matters.

**Recommendation:**
- Add an **Inventory Health Gauge** to the dashboard KPI cards showing:
  - Current inventory position (units remaining)
  - Weeks-of-supply at current sell-through rate
  - Projected end-of-season position (surplus / stockout risk)
  - Color-coded: Green (on track), Yellow (needs promotion), Red (markdown urgently)
- This gauge should update in real-time as simulator sliders change

---

### 6. "What Changed Since Last Week" Needs More Bite

**Current:** `updateWhatChanged()` compares week-over-week competitor prices, social scores, and inventory. Reads like a changelog.

**Problem:** A sales VP wants "3 things that matter this week" — not a data dump.

**Recommendation:**
- Limit to **top 3 changes**, ranked by business impact
- Format each as an actionable insight:
  - Instead of: "Competitor mass price changed from $22.40 to $19.90 (-11.2%)"
  - Write: "Amazon undercut your Sport Gel by $3.85 — you're losing ~340 units/week to competitor capture. Recommend defensive 10% promo at Target & Amazon."
- Add a severity indicator (red / yellow / green dot) next to each change
- Include estimated revenue impact in dollars, not just percentages

---

### 7. Social Buzz Section Should Show Content, Not Just Numbers

**Current:** Social spike events show TikTok mentions, sentiment score, influencer score, and the elasticity modifier. Analytically correct but emotionally flat.

**Problem:** When a TikTok video goes viral for your product, the energy should come through in the tool.

**Recommendation:**
- Add a **"Trending Content" preview section**:
  - Top hashtags driving mentions (even if simulated, e.g. #SupergoopSportGel, #SPF60challenge)
  - Estimated reach/impressions
  - Key creator handles (simulated)
- Add a **"Social Momentum Score"** thermometer-style gauge (0-100) — more visual than a table number
- Connect social data to pricing recommendation more explicitly: "Social buzz score is 81.9 — price sensitivity is 22% lower than baseline. This is NOT the week to discount."

---

### 8. Channel Labels Still Say "Mass" / "Prestige" in Some Places

**Current:** Most UI now says "Target & Amazon" / "Sephora & Ulta" but several dropdowns, chart labels, and internal references still use "Mass Channel" / "Prestige Channel" or "ad_supported" / "ad_free".

**Problem:** Ritesh's explicit feedback — no generic labels. Every reference should name the actual retailers.

**Specific places to fix:**
- Step 6/7/8 tier dropdowns: "Mass Channel ($24.00)" / "Prestige Channel ($36.00)"
- Migration model flow box labels: "Mass Channel" / "Prestige Channel"
- Migration transition table rows: "Mass Channel -> Prestige Channel (Upgrade)"
- Segment response panel tier filter
- Data explorer dataset descriptions
- Any chart axis or tooltip showing "ad_supported" / "ad_free"

---

### 9. The Three Separate Elasticity Models Should Be Unified

**Current:** Steps 6, 7, and 8 are three separate models (acquisition, churn, migration) each with their own slider, chart, and output panel.

**Problem:** They all answer the same question: "what happens if I change the price?" Showing them separately creates a false impression that these are independent decisions. In reality, a 15% promo causes acquisition AND churn AND migration effects all at once.

**Recommendation:** Merge into a single "Scenario Deep Dive" panel with tabs or a stacked view. Show all three effects simultaneously for a given price change. One slider, three outcome panels.

---

### 10. Add "Click Event to Simulate" from Timeline

**Current:** The event timeline shows competitor moves and social spikes but they're read-only — the user has to mentally translate "competitor dropped SUN_S3 by 11.2%" into slider settings.

**Recommendation:**
- Add a **"Simulate Response"** button on each event detail card
- Clicking it auto-loads the simulator with the appropriate defensive/offensive scenario pre-configured
- This closes the loop: see signal -> understand impact -> act on it

---

## PART 2: WHAT TO REMOVE

### 1. Remove the Data Explorer from the Main Step Flow

**Why:** The 12-dataset accordion with search/filter/export is an analyst tool, not a decision tool. Putting it at Step 2 — before the user has seen a single recommendation — signals "here's raw data, figure it out yourself."

**What to do:** Move it to a "Data Library" link in the nav bar or footer. Analysts who want to audit can find it there. It should not be a numbered step.

---

### 2. Remove Pyodide / Python-in-Browser Bridge

**Why:** `pyodide-bridge.js` loads ~15MB Python runtime into the browser for statistical confidence intervals that could be computed in 10 lines of JavaScript. It adds 3-5 seconds to initial load time.

**What to do:** Port the confidence interval math (normal distribution quantiles) to JS. Delete `pyodide-bridge.js` and all Pyodide initialization code. Users won't notice — confidence bands will still render.

---

### 3. Remove or Wire Up the Decision Pack Export

**Why:** `decision-pack.js` exists but is not connected to any UI button. Dead code signals an unfinished product.

**What to do:** Either add a visible "Export Recommendation as PDF" button in the AI recommendation panel, or delete the module entirely.

---

### 4. Remove Duplicate Elasticity Calculation Paths

**Why:** Elasticity is calculated in at least 4 places: `elasticity-model.js`, `scenario-engine.js`, `channel-promo-simulator.js` (`computeScenarioForRow`), and `segmentation-engine.js`. Each uses slightly different modifiers and clamping.

**What to do:** Consolidate to a single `computeElasticity(sku, channel, week, externalFactors)` function. All other modules call it. This prevents "why are two panels showing different numbers for the same SKU?" bugs.

---

### 5. Remove Unused Chart Functions

**Why:** `charts.js` contains `renderRadarChart()` which is never called. There are also unused scatter plot variants.

**What to do:** Delete unreferenced chart functions. Fewer functions = easier maintenance.

---

### 6. Remove the Welcome/Hero Screen Gate

**Why:** Step 0 is a splash page with a "Start Exploration" button. It adds a click before any value is shown.

**What to do:** Auto-load directly into Step 1 (Current State Dashboard). The hero branding can be a header bar, not a full-screen gate.

---

## PART 3: WHAT TO DOUBLE DOWN ON

### 1. The Channel Promo Simulator (Step 1)

This is the crown jewel. The dual-slider interface with real-time SKU response, waterfall decomposition, and AI recommendation is genuinely impressive.

**Invest more:**
- Make it the FIRST thing users see
- Add preset scenario buttons ("Defensive Match", "Aggressive Acquire", "Hold & Ride Social", "End-of-Season Clear") that auto-set sliders
- Show before/after comparison more prominently
- Add the "Optimize for Me" auto-recommendation button

---

### 2. Product-Specific Storytelling

The recent changes to make everything SKU-specific (SUN_S3 Sport Gel instead of "mass SKU cluster") are exactly right. Push further:
- Every chart tooltip should name the product, not just the SKU code
- Every recommendation should say "promote Sport Gel SPF 60 at $21.14 on Amazon" not "reduce SUN_S3 effective price by 10%"
- Add product images or icons next to SKU names in tables and cards

---

### 3. The Event Timeline as "Situation Room"

Currently underutilized. Should be where all market intelligence converges:
- Click-to-simulate: clicking a competitor event auto-loads defensive scenario
- Event forecasting: "based on pattern, expect competitor price drop in week 12"
- Make it the narrative backbone: what happened -> what it means -> what to do

---

### 4. The AI Chat as Decision Partner

This differentiates the tool from a spreadsheet.

**Invest in:**
- Pre-loaded question chips ("What should I promote this week?", "Is now the right time to markdown?", "How is Sport Gel vs. competitor?")
- Ability to reference specific charts from chat responses
- Summary export: "Generate a 1-page brief for my weekly pricing meeting"

---

## PART 4: QUICK WINS (Ranked by Impact / Effort)

| # | Improvement | Impact | Effort |
|---|-------------|--------|--------|
| 1 | Add "Optimize for Me" auto-recommendation button | High | Medium |
| 2 | Add competitor alert banner on dashboard | High | Low |
| 3 | Add inventory health gauge to KPI cards | High | Low |
| 4 | Collapse AI recommendation into 3-card summary + expandable detail | High | Medium |
| 5 | Replace all remaining "Mass"/"Prestige" UI labels with retailer names | Medium | Low |
| 6 | Move Data Explorer out of main step flow | Medium | Low |
| 7 | Remove Pyodide bridge (port CI math to JS) | Medium | Medium |
| 8 | Wire decision-pack export or delete it | Low | Low |
| 9 | Delete unused chart functions | Low | Low |
| 10 | Add "Simulate Response" button on event detail cards | High | Medium |

---

## FINAL VERDICT

**What makes this tool sell:** The channel promo simulator with real-time SKU-level impact analysis and AI-generated recommendations. That is the demo you lead with.

**What kills the sale:** Showing 10 steps of increasingly granular analytics before the buyer sees a single recommendation. The tool answers the right questions but makes the user work too hard to find the answers.

**One-line summary:** Make the recommendation the hero, not the methodology.
