# Promotion Optimization Implementation Plan (v2)

Date: 2026-03-04  
Primary source: `meeting_transcript.md` (Ritesh Aggarwal feedback, Mar 2, 2026)

## 1) Objective and Non-Negotiables

This build must behave like a promotion optimization product, not a generic elasticity demo.

Non-negotiables from transcript:

1. Narrative first:
   - Start of season baseline.
   - In-season pivot when market signals change.
   - Future vision via roadmap placeholders.
2. Model must be SKU-level:
   - 2 product groups: `sunscreen`, `moisturizer`.
   - 3 SKUs each (6 SKUs total).
3. Market signals must be causal, not decorative:
   - Competitor price movement changes sales even if we do not change our price.
   - Social engagement changes effective price sensitivity and recommendations.
4. Cannibalization must be explicit:
   - Discounting SKU1 can pull volume from SKU2/SKU3 in same group.
5. Season projection must be explicit:
   - 17-week horizon, current week marker, inventory trendline to week 17.
   - Goal is end-of-season inventory close to zero.
6. Event/history must be drillable:
   - Event type includes competitor price change.
   - Past promotions show which SKUs were promoted, by channel and season, with up/down outcome.
7. AI assistant must optimize:
   - Include elastic SKUs with overhang.
   - Exclude inelastic or repeatedly underperforming SKUs.

## 2) Requirement Traceability Matrix

`R01` Copy and framing must say promotion optimization everywhere, not elasticity modeling.  
`R02` Step 1 must show channel examples and realistic KPIs.  
`R03` Objective selector must change outputs (balance/sales/profit).  
`R04` Competitor delta must impact sales without own price change.  
`R05` Social signal must change effective elasticity and forecast behavior.  
`R06` Competitive + social signals must be visible on dashboard and in the data exploration flow.  
`R07` Event timeline must include `Competitor Price Change` type.  
`R08` Promo cards/tables must identify promoted SKUs and season timing.  
`R09` Elasticity must be SKU-specific; one table per SKU via dropdown in Step 5.  
`R10` Season story must show baseline -> current week -> projected end week 17 -> optimized path.  
`R11` Cannibalization within product group must be modeled and visualized.  
`R12` AI assistant must recommend inclusion/exclusion based on elasticity, competition, social, and history.

Each implementation task below is tagged back to these IDs.

## 3) Target Narrative (Demo Script)

### Act A: Start of Season (Step 1)

1. We began a 17-week season with SKU-level starting inventory (example: 100 units for demo SKU, full dataset for 6 SKUs).
2. Today we are in current week (for demo data: week 7).
3. Baseline trendline shows expected inventory at week 17 if we do nothing.
4. We decide whether to promote by channel and by SKU using elasticity + signals.

### Act B: In-Season Pivot (Step 2 + Step 3)

1. A competitor changes price on Amazon/Target (simulated web-scraped signal).
2. Social momentum changes (viral vs negative chatter).
3. Engine recalculates SKU/channel demand, cannibalization, and inventory path in real time.
4. Event Calendar explains what happened and when.

### Act C: Future Vision (Steps 6/7/8 roadmap modules + Step 9 AI)

1. Show planned modules for in-season planner, markdown sequencing, and cross-channel migration.
2. AI summarizes recommended SKU mix: include/exclude rationale with data.

## 4) Data and Model Design

## 4.1 Canonical Dataset (R04, R05, R08, R10, R11)

Current direction is correct and will be hardened with the following contracts:

1. `data/sku_channel_weekly.csv`
   - Grain: `week x sku x sales_channel`.
   - Required: inventory start/end, own price, competitor price, gap, base/effective elasticity, units, cannibalization outflow, revenue, margin.
2. `data/channel_weekly.csv`
   - Grain: `week x channel_group`.
   - KPI rollup for cards.
3. `data/market_signals.csv`
   - Weekly competitive aggregate and market context.
4. `data/social_signals.csv`
   - Weekly social trend and brand social index.
5. `data/retail_events.csv`
   - Includes `Competitor Price Change` entries.
6. `data/promo_metadata.json`
   - Includes `promoted_skus`, per-SKU outcome, per-channel outcome, season tag.

New file to add for traceability narrative:

7. `data/competitor_price_feed.csv`
   - Simulated "web-scraped" raw feed.
   - Fields: `captured_at`, `source_domain`, `channel`, `competitor_sku`, `matched_sku_id`, `match_confidence`, `observed_price`, `promo_flag`.
   - UI copy will explicitly state: "Prices are simulated as website-scraped and SKU-matched."

## 4.2 Forecast Math Contracts (R03, R04, R05, R11)

Per row (`week, sku, channel`):

1. Own-price demand response:
   - `units_own = baseline_units * (new_price / baseline_price) ^ effective_elasticity`
2. Competitor delta response:
   - `gap = (our_effective_price - competitor_price) / competitor_price`
   - `units_comp = units_own * clamp(1 - gap * alpha_channel, min_comp, max_comp)`
3. Social modulation:
   - `effective_elasticity = base_elasticity * social_modifier(score)`
4. Cannibalization within group:
   - `transfer_i_to_j = units_i * max(0, promo_depth_j - promo_depth_i) * gamma_ij`
   - Net units respect conservation and inventory limits.
5. Inventory:
   - `end_inventory_w = max(0, start_inventory_w - net_units_w)`

Objective modes:

1. `balance`: weighted revenue + profit + inventory-to-zero penalty.
2. `sales`: maximize sell-through and week-17 inventory reduction.
3. `profit`: maximize gross profit with guardrails against steep repeat-loss risk.

## 5) Step-by-Step UX Plan

## Step 1 - Current State Overview (R01, R02, R03, R10, R11)

1. Keep title/copy strictly promotion optimization.
2. Add season story strip:
   - Start inventory (week 1), current week status, week-17 baseline vs scenario ending inventory.
3. Keep product-group and SKU selectors as primary controls.
4. Keep objective selector and show objective explanation next to result.
5. Add SKU cannibalization panel:
   - "If SKU A promo deepens, expected units pulled from SKU B/C."
6. Add explicit channel promo toggles (Mass only, Prestige only, both).

## Step 2 - Data Explorer (R06)

Add a "Signals Impact Lab" at top of Step 2:

1. Competitive signal cards:
   - Average competitor mass price.
   - Average competitor prestige price.
   - Delta vs our current price.
2. Social signal card with trend sparkline and current score.
3. "What changed this week?" panel:
   - Lists deltas vs prior week and expected sales direction.
4. Dataset tabs include raw competitor feed (`competitor_price_feed.csv`) and mapped SKU prices.

## Step 3 - Event Calendar (R06, R07, R08)

1. Event filter includes `Competitor Price Change`.
2. Market/social signal boxes use same numbers as Step 1 and Step 2.
3. Promo drilldown cards show:
   - Promoted SKUs.
   - Season.
   - Channel.
   - SKU outcomes (up/down).
4. Add "Actionable learning" summary:
   - Example: "Exclude MOI_M3 next cycle in Amazon mass defense promos."

## Step 4 - Customer Cohorts

1. Keep segmentation as-is (not product-specific), but link to product selection context.
2. Clarify that this step informs targeting overlays for promotion choices.

## Step 5 - Segment Response Comparison (R09)

1. Add SKU dropdown in this step (in addition to metric dropdown).
2. Recompute table/chart by selected SKU.
3. Show SKU-specific elasticity and risk outputs.
4. Label explicitly: "Elasticity shown below is for selected SKU."

## Steps 6/7/8 - Roadmap Placeholders (Future Vision)

1. Keep as roadmap placeholders with concise "current implementation already covers core logic" notes.
2. Ensure naming stays promotion-roadmap oriented.

## Step 9 - AI Promotion Optimization Assistant (R12)

1. Context payload must include:
   - Selected product group/SKU.
   - Inventory runway to week 17.
   - Competitor gap by channel.
   - Social trend.
   - Historical promo outcomes.
2. Response format:
   - Include list.
   - Exclude list.
   - Why now.
   - Expected week-17 inventory effect.

## 6) Detailed Engineering Tasks

## Phase A - Data generator hardening (R04, R05, R08, R10, R11)

Files:

1. `scripts/generate_promo_optimization_data.py`
2. `data/*.csv`
3. `data/*.json`

Tasks:

1. Emit and wire `competitor_price_feed.csv` with simulated scraped source fields.
2. Ensure deterministic SKU-level cannibalization matrix is explicit and configurable.
3. Ensure `is_current_week` is normalized safely (`True`/`False` parsing, no truthy-string bug).
4. Regenerate all dependent datasets.

## Phase B - Loader normalization and helpers (R04, R05, R06, R08, R10)

Files:

1. `js/data-loader.js`
2. `js/data-viewer.js`

Tasks:

1. Add parser for competitor feed and typed boolean conversion.
2. Add helper selectors:
   - `getCurrentWeekSnapshot(group, sku)`
   - `getCompetitorDeltaTrend(group, sku)`
   - `getSocialTrendWindow(weeks)`
   - `getPromoHistoryBySkuChannelSeason(...)`

## Phase C - Step 1 simulator and story widgets (R03, R04, R05, R10, R11)

Files:

1. `js/channel-promo-simulator.js`
2. `index.html`
3. `css/style.css`
4. `js/app.js`

Tasks:

1. Keep objective-specific output differences obvious and explainable.
2. Add cannibalization impact table for selected SKU group.
3. Add week-17 baseline vs scenario endpoint callout.
4. Show competitor/social contribution decomposition:
   - "X% from own promo, Y% from competitor delta, Z% from social shift."

## Phase D - Step 2 and Step 3 signal coherence (R06, R07, R08)

Files:

1. `index.html`
2. `js/data-viewer.js`
3. `js/event-calendar.js`

Tasks:

1. Add Signals Impact Lab to Step 2.
2. Add competitor-source narrative ("web-scraped + SKU matched") in Step 2 and Step 3.
3. Enforce numeric consistency between Step 1 cards and Step 3 cards.
4. Extend event badges/count logic for competitor price changes.

## Phase E - Step 5 SKU dropdown and per-SKU output (R09)

Files:

1. `index.html`
2. `js/segment-charts.js`
3. `js/segmentation-engine.js`
4. `js/app.js`

Tasks:

1. Add SKU selector in Step 5 controls.
2. Recompute chart/table for selected SKU.
3. Render SKU-specific elasticity/risk summary.

## Phase F - AI recommendation upgrade (R12)

Files:

1. `js/chat.js`
2. `js/app.js`
3. `js/channel-promo-simulator.js`

Tasks:

1. Extend tool context with SKU-level signal decomposition.
2. Add rule-based preface for deterministic include/exclude recommendations.
3. Ensure output references product, channel, and season week.

## Phase G - Narrative and copy QA pass (R01)

Files:

1. `index.html`
2. `README.md`
3. `js/step-navigation.js`

Tasks:

1. Remove conflicting legacy elasticity wording where this demo is shown as promo optimization.
2. Ensure step order supports the story: baseline -> signals -> historical context -> recommendations -> roadmap.

## 7) Acceptance Test Suite (Must Pass)

`T01` Objective mode changes outputs:

1. Set same SKU and promos.
2. Toggle `balance/sales/profit`.
3. Revenue/profit/week-17 inventory all change with rationale text.

`T02` Competitor-only shock:

1. Keep own promo depth constant.
2. Lower competitor mass price by 10%.
3. Mass volume forecast decreases; explanation shows competitor delta effect.

`T03` Social-only shock:

1. Keep prices fixed.
2. Increase social index by +15 points.
3. Effective elasticity and forecast update; recommendation may shift toward lighter discounting.

`T04` Cannibalization:

1. In sunscreen group, deepen promo only for `SUN_S1`.
2. `SUN_S1` units rise while `SUN_S2`/`SUN_S3` decline due to internal migration.
3. Cannibalization table reflects transfer.

`T05` Week-17 inventory narrative:

1. Baseline endpoint shows residual inventory.
2. Scenario endpoint moves closer to zero.
3. Story strip shows start/current/end state clearly.

`T06` Step 5 SKU drilldown:

1. Change SKU dropdown.
2. Table and risk metrics update for that SKU.

`T07` Historical promo effectiveness:

1. Select a promo campaign.
2. See promoted SKU list and per-SKU up/down outcomes by channel and season.

`T08` Cross-page signal consistency:

1. Compare Step 1, Step 2, Step 3 competitor/social metrics for current week.
2. Values match within rounding tolerance.

`T09` AI recommendation quality:

1. Ask "Which SKUs should we promote this week in mass channel?"
2. Answer includes include/exclude lists with competitor/social/inventory/history evidence.

## 8) Execution Sequence (Implementation Order)

1. Data contracts and generator (`Phase A`).
2. Loader and helper APIs (`Phase B`).
3. Step 1 simulator + season story + cannibalization visuals (`Phase C`).
4. Step 2 Signals Impact Lab + Step 3 event/signal coherence (`Phase D`).
5. Step 5 SKU drilldown (`Phase E`).
6. AI recommendation upgrade (`Phase F`).
7. Narrative copy QA and walkthrough polish (`Phase G`).
8. Full acceptance-test run and final fixes.

## 9) Done Criteria

The work is done only when:

1. The walkthrough clearly tells the Start of Season -> In-Season Pivot -> Future Vision story.
2. SKU-level promotion optimization is visible for 2 groups x 3 SKUs.
3. Competitor and social changes drive real forecast changes.
4. Cannibalization is modeled and visible.
5. Week-17 inventory-to-zero planning is front-and-center.
6. Historical promo drilldown identifies winning/losing SKUs by channel/season.
7. AI gives actionable include/exclude recommendations grounded in model outputs.
