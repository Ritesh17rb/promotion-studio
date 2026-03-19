# Transcript-Aligned Delivery Plan

Date: 2026-03-19
Primary source: `meeting_transcript.md`
Goal: realign the product to the exact story, data visibility, and business signals requested by Ritesh Aggarwal for the promotion optimization demo.

## 1. What Ritesh Actually Wants

This product should present itself as a business-facing promotion optimization workflow, not as a generic simulator or a pure elasticity demo.

The intended presentation flow is:

1. Data Explorer first.
2. Current state of the business second.
3. Weekly deep dive / Event Calendar third.
4. Segmentation and elasticity as supporting evidence for why segments react differently.
5. Promotion simulation later in the flow.
6. AI optimization last.

What he wants to see in the product:

1. A clear opening that shows the underlying data being used.
2. A current-state dashboard that tells the business story before asking the user to simulate anything.
3. Explicit visibility of competitor price changes and social buzz as first-class inputs.
4. Event reporting framed in operational business terms:
   - what happened
   - which SKUs/channels were affected
   - what discount was used
   - how many units moved
   - what happened to revenue
5. Cohort language that uses mass/prestige framing instead of retailer-name framing wherever the purpose is segmentation.
6. More realistic underlying elasticity-related values, especially repeat loss and average order value.

## 2. Requirement Breakdown from the Transcript

## 2.1 Screen Order / Narrative Requirements

1. `Data Explorer` must be the first step.
2. The current Step 1 content must move to Step 2 and become the current-state business view.
3. Event Calendar remains an early analytical step and should read as the weekly deep dive.
4. Simulation should not appear as the opening interaction; it should come later after the business context is established.

Intent:
Ritesh wants the demo to earn credibility first by showing data, then explain business state, then drill into what changed, and only then move into predictive / optimization actions.

## 2.2 Data Explorer Requirements

1. Data Explorer must explicitly surface competitor data.
2. Data Explorer must explicitly surface social media data.
3. The purpose of the Data Explorer is not interpretation-first; it is source visibility and traceability.
4. The missing gap called out in the meeting is channel-specific social buzz and competitor price changes by product.

Intent:
The audience should immediately understand that the downstream recommendations are grounded in multiple datasets, not fabricated by a simulator.

## 2.3 Current State Dashboard Requirements

1. It should read as the “current state of the business”.
2. It should support drill-down from total business to individual products.
3. It should show the 4 key metrics together over time:
   - own price
   - competitor price
   - competitor difference
   - social media buzz
4. This chart should be over a selected period, not just a latest-point snapshot.

Intent:
The dashboard should help a commercial stakeholder see the market position and demand context before deciding any action.

## 2.4 Event Calendar Requirements

1. Simplify the timeline to 4 critical event types:
   - promotions
   - competitor price changes
   - social spikes
   - seasonal tentpoles
2. Add seasonal tentpole events such as Christmas and Thanksgiving.
3. Show history for 1 year and future for 1 year.
4. Separate past and future with a vertical `Today` line.
5. Remove unused placeholder event concepts.
6. Clicking an event should show:
   - event details
   - impacted products
   - impacted channels
   - discount
   - units sold
   - ROI / revenue impact
7. The secondary impact table should show:
   - change in own price
   - change in competitor price
   - change in social buzz
   - baseline sales
   - incremental sales
   - net revenue change

Intent:
The Event Calendar is meant to be a weekly commercial-review screen, not just a decorative timeline.

## 2.5 Metrics / Labeling Requirements

1. Replace `ads` as the impact metric with `units`.
2. Add revenue impact to the event impact table.
3. Update customer cohort labels to `mass cohorts` and `prestige cohorts`.
4. Avoid retailer-specific naming in places where the discussion is really about cohort/channel archetypes.

Intent:
The output must speak in business measures and channel archetypes that generalize to client discussions.

## 2.6 Elasticity / Realism Requirements

1. The elasticity section must explicitly support 3 response drivers:
   - own price elasticity
   - competitor price elasticity / competitive response
   - social buzz elasticity / social-demand effect
2. Segment differences must remain visible.
3. `repeat loss` values need realism review.
4. `average order value` values need realism review.
5. Any related synthetic assumptions should be made more believable.

Intent:
Ritesh is not rejecting synthetic data; he is rejecting synthetic data that looks implausible or distracts from the demo.

## 3. Current Codebase Mapping

## 3.1 Current Step Structure

Current visible structure in `index.html` is already partially reworked but still inconsistent:

1. Section `#section-1` is `Step 1 / Current State Overview`.
2. Section `#section-2` is `Step 2 / Data Explorer`.
3. Section `#section-8` is `Step 3 / Event Calendar`.
4. Sections `#section-6` and `#section-7` are `Step 4` and `Step 5`.
5. Sections `#section-3`, `#section-4`, `#section-5` visually show `Step 6`, `Step 7`, `Step 8`.

Implication:
The demo story is partly aligned already, but the opening screen order still violates the meeting ask because Current State is still first and Data Explorer is second.

## 3.2 Relevant Files

Primary files that control the requested changes:

1. `index.html`
   - step headers
   - subtitles
   - navigation buttons
   - section order and labels
   - current Step 1 and Data Explorer markup

2. `js/step-navigation.js`
   - step sequencing
   - injected navigation controls
   - which content is mounted into each step container

3. `js/data-viewer.js`
   - Data Explorer datasets
   - accordion grouping
   - table/chart summary behavior
   - should be enhanced for clearer competitor/social surfacing

4. `js/app.js`
   - current-state KPI snapshot logic
   - Step 2 market signal summary
   - segmentation summaries
   - several business metric calculations and labels

5. `js/channel-promo-simulator.js`
   - current-state simulator content presently shown in Step 1
   - owns key market, social, competitor, and product-level scenario logic
   - likely source for the current-state trend chart once moved to Step 2

6. `js/event-calendar.js`
   - event loading
   - event filtering
   - event timeline rendering
   - event detail tables
   - promo drilldown

7. Data files
   - `data/retail_events.csv`
   - `data/social_signals.csv`
   - `data/competitor_price_feed.csv`
   - `data/segment_kpis.csv`
   - `data/elasticity-params.json`
   - possibly `data/segment_elasticity.json`

## 3.3 Already-Implemented Pieces We Can Reuse

The codebase already contains useful building blocks:

1. Data Explorer already includes `competitor_price_feed` and `social_signals`.
2. Step 2 already has a market signal snapshot block.
3. Event Calendar already supports:
   - competitor price events
   - social spikes
   - promo drilldown
   - product/SKU mapping
4. Step 1 simulator already contains competitor/social logic and rich product/channel state.
5. Segmentation already distinguishes mass vs prestige internally, even if visible labels still overuse retailer names.

Conclusion:
This is a realignment/refactor task more than a greenfield build. The work is mostly about narrative, surfacing, consistency, and realism calibration.

## 4. Gaps Against the Transcript

## 4.1 Highest-Priority Gaps

1. Wrong opening step order.
2. Current-state business dashboard is still presented before Data Explorer.
3. The “4 key metrics on one chart” requirement is not yet clearly satisfied in the current-state opening view.
4. Event Calendar does not yet reflect a true 1-year-back / 1-year-forward operating timeline with a Today divider.
5. Seasonal tentpoles are present, but not in the broader business calendar form requested by Ritesh.
6. Event impact reporting still needs stronger units/revenue framing.
7. Cohort naming still exposes retailer-specific channel labels in places that should be mass/prestige cohort language.
8. Segment KPI realism needs recalibration review.

## 4.2 Secondary Gaps

1. Some visible copy still leans too much into elasticity-model language.
2. Watchlist framing around “at risk of attrition” may not be the strongest demo framing for this meeting.
3. Existing data date ranges are season-specific rather than a full operating-year window.

## 5. Implementation Strategy

Implementation will follow the order that best protects demo coherence:

1. Lock the story first.
2. Move the right content into the right steps.
3. Upgrade the screens Ritesh will actually see in sequence.
4. Then calibrate the supporting model/metric realism.

## 5.1 Phase 1: Narrative and Step Realignment

Goal:
Make the product open in the exact narrative order requested in the meeting.

Changes:

1. Swap Step 1 and Step 2 roles so `Data Explorer` becomes Step 1.
2. Move `Current State Overview` to Step 2.
3. Update top navigation labels, steps overview modal, and next/previous actions.
4. Ensure step-navigation mounts the correct content into the correct sections.
5. Review any “Step 1” hard-coded language in help text, methodology, and pitch copy.

Files:

1. `index.html`
2. `js/step-navigation.js`
3. `js/app.js`
4. potentially `js/channel-promo-simulator.js`

Acceptance criteria:

1. First screen after home is Data Explorer.
2. Next screen is the current-state dashboard.
3. Event Calendar remains Step 3.
4. No obvious numbering mismatch remains in the visible user flow.

## 5.2 Phase 2: Data Explorer Upgrade

Goal:
Make Step 1 clearly show the actual data sources that power the analysis, with competitor and social data impossible to miss.

Changes:

1. Add a stronger source-of-truth intro block explaining what each dataset contributes.
2. Explicitly call out competitor price feed and social signals as critical external datasets.
3. Surface channel-specific social buzz summaries, not only raw tables.
4. Surface product-specific competitor price changes, ideally with a compact chart/table summary before the raw tables.
5. Ensure dataset descriptions reinforce “data source traceability,” not “analysis result”.

Files:

1. `index.html`
2. `js/data-viewer.js`
3. `js/app.js` if the current market signal snapshot stays attached to the Data Explorer

Acceptance criteria:

1. A user can point to the competitor source and social source within 10 seconds.
2. Data Explorer clearly includes both product-level competitor data and social signal data.
3. The purpose of the screen feels like data provenance and business context, not simulation.

## 5.3 Phase 3: Current State Dashboard Upgrade

Goal:
Turn the moved current-state screen into the business dashboard Ritesh described.

Changes:

1. Keep overall KPI summary, but reframe the page away from “what happens if we adjust promo depth” and toward “where the business stands right now.”
2. Add or upgrade a single trend chart that overlays:
   - own price
   - competitor price
   - competitor difference
   - social buzz
3. Support drill-down:
   - total business
   - product group
   - SKU
4. Ensure the chart period is selectable or at least uses a sensible recent time window.
5. Keep simulator controls lower on the page or de-emphasized so the opening impression remains “dashboard first”.

Files:

1. `index.html`
2. `js/channel-promo-simulator.js`
3. `js/app.js`

Acceptance criteria:

1. The top half of the screen reads as a current-state business review.
2. The 4 requested metrics appear in one coherent trend view.
3. Product drill-down works without breaking the narrative.

## 5.4 Phase 4: Event Calendar Refactor

Goal:
Make Step 3 function like a weekly commercial-review and event-impact workspace.

Changes:

1. Rebuild the timeline range to show:
   - 12 months historical
   - Today divider
   - 12 months forward
2. Limit event categories to the 4 types called out in the meeting.
3. Add seasonal tentpoles such as Thanksgiving and Christmas into the future/past event list.
4. Remove unused placeholder event concepts from filters and labels.
5. Update event detail reporting to use `units` instead of `ads`.
6. Add revenue impact as an explicit metric in event tables.
7. Build or improve the secondary metrics-change table:
   - own price delta
   - competitor price delta
   - social delta
   - baseline sales
   - incremental sales
   - net revenue change

Files:

1. `js/event-calendar.js`
2. `index.html`
3. `css/style.css`
4. `data/retail_events.csv`
5. possibly `data/promo_metadata.json`

Acceptance criteria:

1. Timeline visibly separates past and future with a Today marker.
2. Seasonal tentpoles include recognizable business moments.
3. Event click/drilldown is readable in business terms.
4. Units and revenue impact are explicitly shown.

## 5.5 Phase 5: Cohort Renaming and Segmentation Framing

Goal:
Align segmentation with the meeting’s preferred business language.

Changes:

1. Replace visible retailer-name cohort framing with `mass cohorts` and `prestige cohorts` where the user is choosing cohort/channel archetypes.
2. Keep retailer names only where channel-level operational detail is genuinely needed.
3. Review watchlist and attrition framing; keep it only if it supports the story rather than distracting from it.
4. Update explanatory text, labels, and recommendation cards to use generalized cohort language.

Files:

1. `index.html`
2. `js/app.js`
3. any segmentation rendering helpers in `js/step-navigation.js` and related modules

Acceptance criteria:

1. Segmentation screens read as reusable client-facing archetypes.
2. Retailer names are not overused in cohort-selection contexts.

## 5.6 Phase 6: Realism Calibration

Goal:
Reduce the chance that synthetic metrics undermine trust during the demo.

Changes:

1. Audit `avg_order_value` ranges in `segment_kpis.csv`.
2. Audit `repeat_loss_rate` ranges in `segment_kpis.csv` and repeat-loss baselines in `elasticity-params.json`.
3. Review whether visible KPI cards and downstream calculations are using the intended fields.
4. Adjust unrealistic outliers or inconsistent units.
5. Verify that cohort recommendations still look directionally right after calibration.

Files:

1. `data/segment_kpis.csv`
2. `data/elasticity-params.json`
3. possibly `data/segment_elasticity.json`
4. `js/app.js`
5. `js/churn-simple.js`
6. `js/chat.js` if thresholds are hard-coded there

Acceptance criteria:

1. AOV values look commercially plausible for the product portfolio.
2. Repeat-loss values are neither trivially low nor implausibly high.
3. No obvious metric-field mismatch remains.

## 6. Detailed Work Order

Recommended build order:

1. Update visible step order and navigation.
2. Move/relabel current-state content into Step 2.
3. Strengthen Data Explorer source visibility.
4. Add the current-state 4-metric trend chart.
5. Refactor Event Calendar timeline and drilldowns.
6. Sweep labels for mass/prestige cohort framing.
7. Calibrate AOV and repeat-loss realism.
8. Run final UI and data sanity checks.

Reason for this order:

1. Step order affects copy, nav, and where modules render.
2. Current-state/Data Explorer alignment must stabilize before polishing downstream screens.
3. Event Calendar and metric realism are easier to validate after the narrative flow is correct.

## 7. Risks and Constraints

## 7.1 Structural Risks

1. Section ids and displayed step numbers are already decoupled.
2. `step-navigation.js` injects content into containers with a custom mapping.
3. A superficial numbering change without remapping content could leave the UI internally inconsistent.

Mitigation:
Treat section order, injected content, modal labels, and overview navigation as one coordinated change.

## 7.2 Data Risks

1. The current event dataset appears focused on the synthetic season window rather than a rolling 24-month view.
2. Historical/future 1-year Event Calendar may require extending `retail_events.csv`, not only changing rendering.
3. Some labels in sample data still reference season-specific synthetic events that may not match the new calendar framing.

Mitigation:
If full rolling-window data is not present, expand the synthetic event file in a controlled way with clearly business-relevant tentpoles.

## 7.3 Metric Risks

1. Some parts of the app compute AOV from revenue/customers, while segmentation uses `avg_order_value`.
2. Repeat-loss values are used across multiple modules with slightly different assumptions.

Mitigation:
Trace metric usage before changing source values so downstream charts do not silently drift or contradict each other.

## 8. Verification Plan

After implementation, verify:

1. Home -> Step 1 lands on Data Explorer.
2. Step order in nav, modal, and next/prev controls is consistent.
3. Data Explorer visibly includes competitor and social data summaries plus raw tables.
4. Current State screen contains the combined 4-metric trend chart.
5. Event Calendar shows past/future with Today divider.
6. Event detail tables use units and include revenue impact.
7. Cohort labels favor mass/prestige language.
8. AOV and repeat-loss values look plausible in UI summaries.
9. No console-breaking regressions occur while navigating steps.

## 9. Definition of Done

This work is done when:

1. The product follows the transcript’s intended narrative order.
2. The opening screens clearly establish data credibility and current business state.
3. Competitor data and social buzz are explicit in both Data Explorer and decision-making views.
4. Event Calendar functions as a commercial weekly deep dive with business-friendly impact reporting.
5. Cohort framing and KPI realism no longer distract from the demo.
6. The resulting flow shows exactly what Ritesh asked to see, in the order he asked to see it.

