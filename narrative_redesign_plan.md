# Narrative Redesign Blueprint (Ritesh Intent Aligned)

Date: 2026-03-04  
Source of truth: `meeting_transcript.md`

## 1) What Ritesh Actually Wants

This product should behave like a promotion optimizer used by a commercial team in-season, not a generic elasticity demo.

Core intent extracted from transcript:

1. Keep the framing fully in "promotion optimization" language.
2. Tell a business story in 3 acts:
   - Start of Season
   - In-Season Pivot
   - Future Vision
3. Make causality explicit:
   - Competitor price changes must affect sales even if own promo does not change.
   - Social momentum must change effective elasticity and demand response.
4. Work at SKU level with realistic product structure:
   - 2 groups: sunscreen, moisturizer
   - 3 SKUs in each group
5. Model both elasticities:
   - Own vs competitor substitution
   - Internal cannibalization across sibling SKUs
6. Show season runway objective:
   - Week 1 start, current week status, week-17 projection, and path to near-zero inventory.
7. Keep channel-aware strategy:
   - Mass vs Prestige now, extensible to more channels later.
8. Use past campaign outcomes for next-cycle learning:
   - Which products worked, which did not, by season and by channel.
9. AI must produce optimization recommendations:
   - Include/Exclude SKUs with rationale and expected inventory outcome.

## 2) Current Gaps vs Intent

1. Story exists but still reads as dashboard-first rather than decision-flow-first.
2. Causality is present in logic but not always obvious in visuals.
3. Cannibalization needs clearer "who gained / who lost" communication.
4. Objective modes need stronger, explicit tradeoff explanation.
5. Historical promotions are richer now, but policy extraction can be stronger.

## 3) Target Experience Architecture

## Act A: Start of Season Command Center

Goal: show where we are and why we need intervention.

Modules:

1. Inventory runway headline:
   - Start units, current units, baseline week-17 leftover, optimized week-17 leftover.
2. SKU runway small multiples:
   - 6 product mini-trendlines.
3. Channel KPI posture:
   - Revenue/profit/lift by Mass vs Prestige.

## Act B: In-Season Pivot and Causal Proof

Goal: prove "if signal changes, forecast changes."

Modules:

1. Shock controls:
   - Competitor shock, social shock, channel toggles, SKU boost.
2. Causal decomposition:
   - Own promo effect, competitor delta effect, social effect, cannibalization effect.
3. SKU-level impact:
   - Baseline vs shock-only vs full scenario.
4. Cannibalization movement:
   - From SKU -> To SKU unit migration table.

## Act C: Decision and Future Vision

Goal: convert analysis into action and roadmap confidence.

Modules:

1. Decision brief:
   - Include/Exclude SKUs
   - Channel plan
   - Week-17 inventory effect
2. Promotion memory:
   - Historical campaign outcomes by product, channel, season.
3. Roadmap placeholders:
   - In-season planner, markdown engine, migration planner.

## 4) Visualization Inventory (Recommended)

P0 (must have now):

1. SKU causal waterfall (selected SKU): baseline, own promo, competitor delta, social, cannibalization, final.
2. SKU shock-only impact chart (already added): no own promo change baseline.
3. Decision brief panel: structured recommendation for pitch.
4. Competitive and social trend charts in Step 2 and Event Calendar (already added).

P1 (next):

1. Objective frontier chart:
   - Revenue delta vs profit delta vs week-17 leftover for balance/sales/profit.
2. SKU migration matrix heatmap by product group.
3. Promo policy extractor:
   - "never include", "conditional include", "winner SKU x channel."

P2 (later):

1. Sankey-style migration visual for cannibalization + competitor pull.
2. Event-to-impact timeline linking competitor/social events to forecast shifts.
3. Explainability panel with formula cards and confidence bands.

## 5) Data + Model Contracts

1. Keep explicit source traceability:
   - `sku_channel_weekly.csv`, `market_signals.csv`, `social_signals.csv`, `competitor_price_feed.csv`, `promo_metadata.json`, `retail_events.csv`.
2. Use shared transformations across pages:
   - social score normalization
   - social elasticity modifier
   - competitor gap multipliers
3. Ensure all visual cards can be derived from current data (no mocked inference statements).

## 6) Delivery Plan

## Phase P0 (in progress)

1. Add narrative blueprint file.  
2. Add Step 1 causal waterfall.  
3. Add Step 1 decision brief block.  
4. Keep Step 2 and Event Calendar chart-first and formula-first.

## Phase P1

1. Add objective frontier chart.  
2. Add migration matrix heatmap.  
3. Add policy extraction from campaign history.

## Phase P2

1. Add event-linked impact timeline.  
2. Add confidence/uncertainty overlays.  
3. Add optional 5-channel expansion view.

## 7) Pitch Script (Condensed)

1. "We started with X inventory at week 1; at week Y we are projected to end with Z leftover by week 17 if we do nothing."
2. "Now competitor drops price and social momentum shifts; without touching our promo depth, forecast changes by SKU and channel."
3. "When we apply targeted promos, SKU1 gains, SKU2/SKU3 may lose from cannibalization, and week-17 leftover improves."
4. "Historical campaigns show what worked by product/channel/season, and AI converts that into an include/exclude plan."
5. "Roadmap modules industrialize this into a weekly in-season operating system."
