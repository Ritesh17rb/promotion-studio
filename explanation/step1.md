# Step 1: Current State Overview

## What we are doing in this step
We are establishing the current commercial position of the portfolio before making any move. This step is the starting point of the application because it shows where the business stands now, what is changing in the market, and what would happen if we changed promotion depth immediately.

There are two layers here:
- a current-state business summary built from the latest demo-season data,
- and a live simulator that turns that state into forward-looking revenue, profit, and inventory scenarios.

Important data context:
- KPI cards use the latest aggregated channel week: `2026-05-25`.
- The live simulator uses SKU week `7` (`2026-03-16`) as the in-season operating point.

## Current example from this build
- Total customers: `4,400`
- Monthly revenue: `$114,082.24`
- Avg order value: `$25.93`
- Repeat loss rate: `3.54%`
- Revenue vs prior week: `-4.5%`
- AOV vs prior week: `-$1.22`
- Repeat loss vs prior week: `-0.06 pp`

Live week 7 simulator state:
- Portfolio units sold: `1,599`
- Portfolio revenue: `$38,633.46`
- Inventory remaining: `44,607`
- Sunscreen: `891` units, `$21,973.03` revenue, `23,748` inventory left
- Moisturizer: `708` units, `$16,660.43` revenue, `20,859` inventory left

## What each feature is doing

### Loading Data
This initializes the app and pulls all linked datasets into one shared state.

What it conveys:
- every step after this is using the same commercial baseline,
- and the model is not stitching together disconnected numbers.

### Current Channel Groups
This separates the business into `Mass Channel` and `Prestige Channel`.

What it conveys:
- the portfolio does not operate in one uniform pricing environment,
- mass usually behaves as the more promo-sensitive lane,
- prestige usually needs stronger margin protection and better brand support.

### KPI Cards
These are the executive health indicators for the latest aggregated week.

What each card conveys:
- `Total Customers`: current demand scale. At `4,400`, the business still has reach.
- `Monthly Revenue`: current top-line size. At `$114,082.24`, this is the revenue base we are trying to improve.
- `Avg Order Value`: current monetization quality. At `$25.93`, and down `-$1.22`, it tells us the basket is getting lighter.
- `Repeat Loss Rate`: repeat-demand erosion. At `3.54%`, down `-0.06 pp`, it suggests slightly better retention pressure than the prior week.

Business reading for this build:
- revenue is soft,
- AOV is soft,
- repeat-loss is slightly improved,
- so the issue is not just `drive more volume`; it is `improve the commercial mix without creating unnecessary discount damage`.

### The Question
This reframes the dashboard from reporting into action.

What it conveys:
- Step 1 is not only about what happened,
- it is about deciding what to do next with price and promotion.

### Channel Promotions Simulator
This is the live decision engine for Step 1.

What it is doing:
- changes promo depth by channel,
- optionally adds extra push to a chosen product,
- brings in competitor and social shocks,
- recalculates revenue, profit, and ending inventory.

What it conveys:
- the app is not static reporting,
- it is a controllable scenario model.

### Story Presets
These load ready-made commercial situations such as baseline, competitor pressure, social spike, or clearance mode.

What they convey:
- the same business can be explained as different market stories,
- and the model can move with those stories without rebuilding the analysis manually.

### 3-Act Pitch Mode
This walks the user through baseline, pivot, and season-end narrative states.

What it conveys:
- the application is meant to support a management storyline,
- not just independent charts.

### Live Season Timeline
This lets the user move the simulator week by week.

What it conveys:
- the right decision changes as the season moves,
- and pricing should be tied to timing, not treated as one static choice.

## What each chart, graph, and table means

### Live Impact (Real-Time)
This is the quick outcome summary for the current scenario.

What it shows:
- revenue change,
- profit change,
- week-end leftover inventory,
- projected clearance versus current inventory,
- and a label such as favorable or unfavorable.

What it conveys:
- whether the current setup is commercially attractive at a glance.

### Live Pulse Chart
This is the small two-line context chart inside the live impact area.

How to read it:
- red line = competitor average price trend,
- blue line = brand social index trend.

What it conveys:
- if the red line drops, competitor pressure is rising,
- if the blue line rises, brand momentum is improving,
- and those two forces explain why the recommended pricing stance may change.

### Revenue by Channel Group
This compares revenue contribution by mass versus prestige under the selected scenario.

What it conveys:
- where the top line is really coming from,
- and whether a scenario is overly dependent on one lane.

### Profit by Channel Group
This compares profit contribution by channel group.

What it conveys:
- whether a revenue gain is actually profitable,
- and whether mass-driven volume is diluting profitability.

### Inventory Projection (Baseline vs Scenario)
This compares inventory runoff under the baseline and the selected scenario.

How to read it:
- one path is what happens if nothing changes,
- the other path is what happens after the simulated action.

What it conveys:
- whether the action is actually clearing stock faster,
- or only moving financial metrics without improving runway.

### Product Elasticity & Competitive Gap (Current Week)
This is the pricing logic table at product level.

What it shows:
- product elasticity,
- competitive price gap,
- and product-specific guidance.

What it conveys:
- which products are naturally promo-sensitive,
- which products are exposed because competitors are cheaper,
- and which products can hold price more confidently.

### Within-Group SKU Cannibalization View
This shows how products inside the same family take demand from one another.

What it conveys:
- not every unit gain is incremental,
- some of it may just be internal shifting from one SKU to another.

### SKU Migration Matrix (Cannibalization Heatmap)
This is the heatmap version of internal demand transfer.

How to read it:
- rows and columns represent SKUs,
- stronger cells indicate stronger movement or cannibalization between those products.

What it conveys:
- where promotion on one SKU is likely to hurt a sibling SKU.

### SKU-Level Projection (6 Products): Baseline vs Shock-Only vs Scenario
This is the clearest product-by-product outcome chart in Step 1.

How to read it:
- `Baseline` = no new action,
- `Shock-Only` = competitor and social effects without changing our promo,
- `Scenario` = full result after our promo choice.

What it conveys:
- whether the product moved because the market changed,
- or because our own action changed it.

### Objective Frontier (Revenue vs Profit vs End-of-Horizon Leftover)
This is the trade-off map across the three commercial objectives.

How to read it:
- moving right means better revenue,
- moving up means better profit,
- larger or stronger clearance markers mean less leftover inventory.

What it conveys:
- there is no single perfect answer,
- leadership can choose whether the business should optimize for growth, profit, or clearance balance.

### Causal Impact Waterfall (Selected SKU)
This is the driver-explanation chart for one product.

How to read it:
- each bar adds or subtracts from the product outcome,
- such as own promo, competitor effect, social effect, and cannibalization.

What it conveys:
- why the outcome moved,
- not just that it moved.

### AI Recommendation Snapshot
This converts the current simulator state into a plain-language action view.

What it conveys:
- which products should be pushed,
- which should be protected,
- and what risks should be watched before acting.

### LLM Live Co-Pilot
This is the in-step assistant for the live scenario.

What it conveys:
- the app can explain the scenario in business language,
- and it can also translate natural-language instructions back into control changes.

## What this step is trying to achieve
Step 1 is trying to answer one core commercial question:

"Given where the business is right now, what pricing or promotion move should we test first, and what would that do to revenue, profit, and inventory?"

That is why this step mixes current metrics with interactive simulation. It gives the baseline and the first decision layer in one place.
