# Promotion Studio Walkthrough Script

## Purpose

This document is a presenter script for explaining the Promotion Studio end to end.

It is written for a live walkthrough, so the tone is business-facing rather than technical. The goal is to help explain:

- what the application is trying to do,
- what each step is doing,
- what each major feature means,
- what each chart is trying to convey,
- and what we changed based on `meeting_transcript.md`.

Important context to say up front:

- This is a synthetic but business-shaped promotion optimization demo.
- The portfolio is now aligned to a Supergoop-style product set rather than generic placeholder names.
- The objective is not just to show charts. The objective is to help a business user decide what to promote, where to hold price, and how to finish the season cleanly.

---

## 1. Opening Narrative

You can open with this:

"This application is a promotion decision cockpit for a seasonal skincare and sun-care brand. The business problem is straightforward: we want to optimize promotions by SKU and channel while balancing revenue, profit, competitive pressure, customer behavior, and end-of-season inventory risk. The app walks from raw evidence to current state, then to event context, then to customer response, then to scenario planning, and finally to an AI assistant that explains the recommendation in plain language."

Then add this:

"A major part of the recent iteration was driven by Ritesh's feedback in `meeting_transcript.md`. His core message was: this should feel like a client-ready business story, not a loose set of dashboards. So the improvements focused on making the app more narratable, more internally consistent, and more believable."

---

## 2. What Changed Based On The Transcript

Before going step by step, it helps to explain the major transcript-driven improvements at a high level.

### Overall changes made

1. We changed the top-level framing away from vague inventory language and toward the actual business levers Ritesh called out:
   - customer segmentation,
   - price elasticity,
   - comparative pricing,
   - and social demand.

2. We made the social layer more meaningful.
   - Ritesh explicitly said mentions alone are not enough.
   - The app now frames social as directional demand support, not just volume of conversation.
   - The user can explain how stronger sentiment reduces effective elasticity and creates more pricing headroom.

3. We improved cross-screen consistency.
   - Product naming was standardized around a canonical product catalog.
   - This prevents one screen from calling a product one thing and another screen calling it something else.

4. We improved data realism against a Supergoop-style portfolio.
   - The portfolio now uses a Supergoop-aligned catalog and pricing ladder instead of invented product names.
   - This makes the commercial story more believable in demo conditions.

5. We made filters and drilldowns more explicit.
   - Ritesh repeatedly asked "for which product?" and "for which channel?"
   - The current flow is much better at moving from total portfolio to channel to SKU.

6. We improved event narration.
   - Event windows, promotion types, and event context are clearer.
   - This supports the kind of storyline Ritesh said a client presentation needs.

7. We hardened trust and validation.
   - One of Ritesh's biggest concerns was credibility loss from small mismatches.
   - The data layer was cleaned up and validation scripts were added so naming and pricing do not drift.

8. We added more explainability.
   - More steps now support AI-assisted interpretation.
   - More visuals are now easier to explain in business terms.

### One-line summary of Ritesh's intent

"Make the app feel like a weekly operating story for a business executive, where every number can be explained, every chart has a clear purpose, and every screen connects to the next one."

---

## 3. How To Present The App

The cleanest walkthrough order is:

1. Step 1: prove the underlying data exists.
2. Step 2: establish the portfolio's current commercial position.
3. Step 3: isolate what changed last week.
4. Step 4: show the events and external triggers that explain those changes.
5. Step 5 and Step 6: explain that different customer groups behave differently.
6. Step 7: decide what to do this week.
7. Step 8: decide how to finish the season.
8. Step 9: compare broader strategic scenarios.
9. Step 10: use AI to synthesize the story.

---

## 4. Step-By-Step Script

## Step 1: Data Explorer

### What to say

"We start with the data foundation. This step is important because it makes the rest of the app auditable. Instead of asking the audience to trust the model blindly, we show the source tables that power the logic: weekly SKU-channel performance, product history, price calendars, social signals, customer records, segment KPIs, events, and external competitor context."

### What this step is doing

- It proves the model is built on inspectable source data.
- It shows the user where SKU-level, channel-level, social, and event evidence lives.
- It supports the later claim that the app is not inventing recommendations out of thin air.

### What features to explain

- Dataset accordion:
  lets the user browse the main data domains by category.
- Search and export:
  helps with traceability when someone asks where a number came from.
- Dataset-specific tables and charts:
  show that each file is not just loaded, but also understood.

### Transcript-driven changes to mention

- Ritesh said the data layer should better reflect what is later used in the app.
- He also questioned generic market signal tables that were not clearly tied to products.
- Since then, the data story has been tightened so the app more clearly exposes SKU-level and channel-level inputs.
- We also aligned the catalog to a Supergoop-style product set so the raw data now feels more realistic.

### Presenter note

If someone asks why this step matters, say:

"This step builds trust. If the audience cannot see where competitor prices, social signals, season timing, and promo outcomes live, then every later recommendation feels weaker."

---

## Step 2: Current State Overview

### What to say

"This is where we establish the current commercial position of the business. We are looking back across the last 52 weeks to understand the baseline behavior of the portfolio before we make any new move."

### What this step is doing

- Shows the portfolio view before action.
- Connects sales performance to three core operating levers:
  own price, competitor gap, and social buzz.
- Lets the user filter by product, channel, and lookback window.
- Moves the story from raw data into business interpretation.

### What features to explain

- KPI cards:
  show total revenue, units sold, average own price, average competitor gap, and average social buzz.
- Trend chart:
  overlays revenue with own price, competitor gap, and social signal.
- Channel mix view:
  shows which channels are driving revenue in the selected scope.
- Product x channel price-position table:
  helps explain relative commercial posture by SKU and retailer.

### What changed from the transcript

- Ritesh asked for clearer wording and stronger interpretability.
- He specifically called out:
  - tooltips for metrics like competitor gap and social buzz,
  - clearer interpretation of social score,
  - filters that work by product and channel,
  - and tighter logic between the summary cards and the underlying chart.
- He also wanted more explicit season framing and inventory storytelling, especially around current-season context.

### How to explain the trend chart

"The revenue line tells us what happened commercially. The own-price line tells us whether we changed our own pricing posture. The competitor-gap line shows whether we were above or below the market. The social line shows demand support from brand momentum. The real value is not in any one line by itself. The value is in reading them together."

### Business interpretation example

"If revenue is up while our price is still above competitor and social buzz is also strong, that suggests brand demand is supporting pricing power. If revenue is only up when our price drops below competitor, then that is a more defensive, margin-sacrificing story."

---

## Step 3: Last Week Performance Drilldown

### What to say

"Step 2 showed the long-form baseline. Step 3 compresses the focus to the most recent week. This is the operating room view: what changed right now, and where do we need to respond immediately?"

### What this step is doing

- Zooms into the latest week only.
- Shows the most recent revenue, channel posture, competitor movement, and social context.
- Gives a current operational summary before the team makes an in-season action.

### What features to explain

- AI-generated summary:
  gives the business takeaway from the week.
- Channel performance cards:
  show which channels improved or weakened.
- Product-channel performance:
  shows what happened by SKU and retailer.
- Comparative movement indicators:
  explain own price movement, competitor movement, and buzz movement.

### What changed from the transcript

- Ritesh wanted this screen to feel less like a generic dashboard and more like a decision surface.
- He specifically asked for:
  - clearer interpretation of week-over-week changes,
  - better naming consistency,
  - product and channel context at the top,
  - and explanations that separate "our price moved" from "competitor moved" from "social moved."
- He also liked the idea of AI summaries and asked for AI chat support across screens.

### Presenter note

"The purpose of this screen is not just to say what happened last week. It is to diagnose whether the latest change came from our own action, competitor behavior, or demand momentum."

---

## Step 4: Event Calendar

### What to say

"This step turns the season into a storyline. Rather than reading performance as isolated data points, we show the sequence of events that shaped the commercial outcome: promotions, competitor price changes, social spikes, and seasonal tentpoles."

### What this step is doing

- Places changes on a time axis.
- Explains why a given week behaved the way it did.
- Connects observed moments to future operating choices.

### What features to explain

- Event filters:
  competitor changes, promos, social spikes, seasonal tentpoles.
- Timeline:
  shows what happened and when.
- Event detail panel:
  explains the selected event in business language.
- Event tables:
  make the details auditable.
- AI event analysis:
  helps narrate the implication of the event.

### What changed from the transcript

- Ritesh asked for more believable event storytelling.
- He specifically wanted:
  - product-aware event views,
  - clear event windows instead of ambiguous one-day feeling,
  - more explicit promotion types,
  - and examples that tell a specific business story.
- He also wanted seasonal moments such as holidays or tentpoles to be visible in the event logic, not only implied later.

### How to explain the event timeline

"This chart is useful because timing matters. A discount during a calm week means one thing. The same discount during a competitor undercut or a strong social spike means something very different. The timeline is what lets us connect action to context."

### How to explain the event detail

"For the selected event, we can explain what happened, which channels or products were affected, how pricing changed, what demand support existed, and whether the event is something we should repeat, avoid, or monitor."

---

## Step 5: Customer Cohorts

### What to say

"Up to this point we have mostly explained the market and the portfolio. This step shifts the focus to the customer. The core idea is that not all demand behaves the same way. Some customer groups are highly price-sensitive, some are loyal, some are promotion-triggered, and some are high-value groups that we should protect."

### What this step is doing

- Splits customers into behavior-based groups.
- Shows how behavior differs by mass and prestige channels.
- Helps the team understand who should receive promo support and who should not.

### What features to explain

- Channel selector:
  switches between mass and prestige.
- Axis selector:
  changes the lens across acquisition, engagement, and monetization.
- Visualization selector:
  changes how the segment story is shown.
- KPI dashboard:
  summarizes size, value, risk, and response.
- Watchlist:
  highlights groups that deserve attention.

### What changed from the transcript

- At the beginning of the transcript, Ritesh said the hero copy should explicitly mention customer segmentation.
- That matters because segmentation is not decorative in this app. It is one of the core decision levers.
- The walkthrough should make clear that promotions are not just chosen by channel. They are informed by customer response quality.

### How to explain the heatmap

"A heatmap is the fastest way to see where strong and weak response patterns sit. Each cell is a combination of segment and metric. Darker or hotter cells usually mean stronger intensity. In this app, the heatmap helps us quickly identify where elasticity or risk is concentrated, so we do not need to read every segment one row at a time."

### How to explain the 3-axis view

"The 3-axis view is meant to stop us from oversimplifying segment quality. A customer group is not only about sensitivity or only about value. This view combines acquisition behavior, engagement behavior, and monetization behavior in one frame, so we can see whether a segment is attractive for growth, fragile from a loyalty standpoint, or valuable from a basket standpoint."

### Presenter note

"If I had to explain this screen in one sentence, I would say: this is where we stop treating customers as one pool and start seeing which groups deserve different pricing treatment."

---

## Step 6: Segment Response Comparison

### What to say

"Step 5 maps the cohort landscape. Step 6 ranks the segments for action. This is where we compare segment response side by side to decide where promotion depth is efficient and where it is wasted."

### What this step is doing

- Compares segments directly.
- Ranks them by elasticity, value, risk, or size.
- Helps the user prioritize targeting decisions.

### What features to explain

- Product selector:
  lets the user compare segment behavior for all products or a selected SKU.
- Sort controls:
  reorder the comparison by the chosen business objective.
- Segment comparison table:
  gives the side-by-side ranking.
- Elasticity comparison chart:
  visualizes the ranking.

### What changed from the transcript

- This step is part of the broader shift Ritesh asked for:
  move from generic analytics to a narratable business decision path.
- When presenting, explain that the purpose is not to admire segments, but to decide which segment-specific actions are commercially sensible.

### How to explain the comparison chart

"This chart turns the segment ranking into a visual decision. Taller bars mean stronger response to price changes. But we do not act on elasticity alone. We also care about whether the segment is large enough, valuable enough, and low-risk enough to justify targeting."

---

## Step 7: In-Season Planner Model Board

### What to say

"This is where the app moves from diagnosis to action. We are now using the current in-season operating point to decide what to do this week by SKU and channel."

### What this step is doing

- Takes the live in-season state.
- Models weekly actions by SKU and channel.
- Combines own promo effect, competitor delta, social momentum, and cannibalization.
- Produces action-oriented recommendations.

### What features to explain

- Four-model summary:
  own promo effect, competitor delta, social momentum, and SKU migration.
- Action model table:
  recommendation by product and channel.
- Simulation lab:
  lets the user test weekly changes.
- Inventory runway:
  shows how the decision affects the season horizon.
- SKU lift and cannibalization views:
  show who gains and whether the gain is truly incremental.

### What changed from the transcript

- Ritesh wanted the app to answer "what do I do now?" more explicitly.
- He also wanted inventory to be visible in-season, not just as a generic concept.
- This is one of the main places where the app now behaves more like a weekly operating tool instead of a retrospective dashboard.

### How to explain the migration or cannibalization matrix

"This heatmap shows whether a promoted SKU is winning truly incremental demand or simply stealing volume from a sibling SKU. That matters because a promotion can look successful at SKU level but still be weak at portfolio level if it mostly creates internal substitution."

### How to explain the inventory runway

"This chart matters because a good weekly action should not only improve this week's units. It should also put the remaining season on a healthier stock path."

---

## Step 8: End-of-Season Markdown Decision Models

### What to say

"This step is about finishing the season cleanly. The question is not just 'Should we markdown?' The real question is 'Which SKUs should be included, how deep should markdown go, and what customer or margin damage are we accepting in return?'"

### What this step is doing

- Uses historical promo evidence to decide markdown policy.
- Builds a selective include/hold/exclude logic by SKU.
- Models markdown ladders over the remaining weeks.
- Balances clearance versus margin and repeat-risk.

### What features to explain

- Historical campaign effectiveness:
  shows which SKUs and channels responded well in the past.
- SKU include/exclude policy:
  turns history into a decision rule.
- Markdown ladder:
  shows depth by week.
- Repeat-risk view:
  shows the lagged downside of aggressive markdowns.
- Simulation controls:
  let the user adjust aggressiveness, phase, and margin floor.

### What changed from the transcript

- Ritesh was clear that the data must "gel" and make sense before downstream decisions are trusted.
- He also wanted event detail and promo interpretation to be more grounded, which matters directly for a markdown decision step like this.
- The current positioning is more evidence-led and selective, which is closer to his intent.

### How to explain the clearance versus margin trade-off

"This is the classic seasonal retail problem. Deeper markdown improves clearance but damages margin. Too little markdown protects margin but leaves stock stranded. The app is designed to show that this is a controlled trade-off, not a blunt one-size-fits-all discount."

---

## Step 9: Portfolio Migration And Advanced Analysis

### What to say

"This is the strategic scenario step. Here we test broader commercial moves such as channel migration, internal SKU movement, and how the rest of the season reforecasts from a mid-season checkpoint."

### What this step is doing

- Lets the user compare scenarios, not just one forecast.
- Anchors analysis at a season checkpoint.
- Shows how the rest of the season branches under different paths.
- Connects social momentum to pricing power.

### What features to explain

- Scenario selection and saved scenario comparison.
- Week-5 checkpoint and reforecast.
- Social pricing power views.
- Migration tables.
- Ranking objective and ranked scenarios table.

### What changed from the transcript

- Ritesh specifically wanted a stronger in-season story and a clearer link between social demand and pricing opportunity.
- He also talked about the missed opportunity case:
  if social buzz is up, maybe we do not need to discount as much.
- This step is where that idea becomes strategic and measurable.

### How to explain the week-5 reforecast

"The point of the week-5 checkpoint is that management decisions are made from the current season position, not from day zero. We first show what has already sold, what inventory remains, and then how the remaining season changes under different scenarios."

### How to explain the social pricing power chart

"This chart translates social momentum into economics. As social support improves, effective elasticity gets less severe. That means the brand gets more room to hold price or even step price up without losing as much demand."

### How to explain the frontier or trade-off chart

"This is the scenario trade-off map. It shows that there is no single perfect answer. One scenario may be best for revenue, another for profit, another for clearance. Leadership can choose based on the objective they care about most."

---

## Step 10: AI Promotion Optimization Assistant

### What to say

"The last step turns the analysis into a conversation. Instead of forcing the user to manually summarize everything, the AI assistant lets them ask business questions directly and get context-aware answers."

### What this step is doing

- Synthesizes the prior steps.
- Uses scenario, inventory, competitor, social, and promo-history context.
- Helps explain the recommendation to a decision-maker.

### What features to explain

- Chat workspace:
  for free-form questions.
- Suggested questions:
  for guided usage.
- Context-aware responses:
  so answers are tied to the current app state, not generic advice.

### What changed from the transcript

- Ritesh explicitly asked for AI chat on individual screens with sample questions.
- That request came from a presentation need:
  the app should help the presenter answer follow-up questions live.
- This assistant is the final expression of that idea.

### Presenter note

"I would position this not as a separate chatbot, but as a business explanation layer built on top of the evidence already generated in the earlier steps."

---

## 5. How To Explain The Main Visual Types

This section is useful if someone points at a chart and says, "What exactly am I supposed to read here?"

### KPI cards

Use this explanation:

"KPI cards are executive summary indicators. Their purpose is speed. They tell us the current health of the business before we go deeper into why that health looks the way it does."

### Time-series line charts

Use this explanation:

"Line charts show direction over time. In this app they are most useful when multiple lines are shown together, because the goal is to see how revenue moved relative to own price, competitor movement, or social momentum."

### Bar charts

Use this explanation:

"Bar charts are good for ranking and comparison. In this app they are often used to compare response by channel, segment, SKU, or scenario."

### Heatmaps

Use this explanation:

"Heatmaps compress a lot of information into a fast visual scan. Stronger color means stronger intensity. They are especially useful when we want to compare many segments or many migration paths at once."

### 3-axis visual

Use this explanation:

"The 3-axis visual is designed to show that customer quality is multi-dimensional. A segment can be strong on one axis and weak on another. This prevents us from making simplistic decisions based on one metric alone."

### Scatter plots

Use this explanation:

"Scatter plots help show trade-offs between size and behavior. In this app, a scatter plot helps us see whether a segment is large enough to matter and sensitive enough to move with pricing."

### Waterfall charts

Use this explanation:

"Waterfall charts explain causality. Instead of only seeing the final outcome, we see how each driver added to or subtracted from the result."

### Migration matrix

Use this explanation:

"The migration matrix is a specialized heatmap showing where demand is moving. It helps answer whether growth is incremental or simply shifting within the portfolio."

### Inventory runway charts

Use this explanation:

"Inventory runway charts are there to show whether the selected action changes the remaining season path, not just the current week."

### Scenario trade-off or frontier charts

Use this explanation:

"These charts show that different strategies optimize different objectives. They help leadership choose deliberately instead of assuming one metric should always dominate."

---

## 6. How To Explain The Supergoop Alignment

Use this when someone asks whether the data is realistic:

"The application is still a synthetic demo, but we tightened the realism by aligning the catalog to a Supergoop-style portfolio. That means the product set, naming, and price ladders are much closer to what a user would expect from a modern prestige-and-mass skincare and sun-care brand. This helps the story feel less abstract and more commercially believable."

You can add:

"The purpose was not to exactly recreate a live brand system. The purpose was to make the demo plausible enough that the commercial logic feels grounded."

---

## 7. Best Closing Summary

End with this:

"So the overall flow is: first we prove the data, then we establish the current state, then we explain what changed, then we connect it to events, then we show why customer groups behave differently, then we plan the weekly action, then we plan the end-of-season action, then we compare strategic scenarios, and finally we use AI to explain the recommendation. That is the business story the app is designed to tell."

---

## 8. Short Version If You Need A Fast Demo

If you only have a few minutes, use this compressed script:

1. Step 1:
   "These are the raw datasets that power the app."
2. Step 2:
   "This is the 52-week baseline of revenue, pricing, competitor gap, and social demand."
3. Step 3:
   "This is what changed last week."
4. Step 4:
   "These are the events that explain why it changed."
5. Step 5 and Step 6:
   "These steps show that different customer groups react differently to promotions."
6. Step 7:
   "This is the weekly action planner by SKU and channel."
7. Step 8:
   "This is the controlled markdown strategy for finishing the season."
8. Step 9:
   "This is the strategic scenario comparison and mid-season reforecast."
9. Step 10:
   "This AI layer explains the recommendation in plain business language."

---

## 9. Final Presenter Reminder

Do not present the app as "a lot of charts."

Present it as:

"A connected promotion decision workflow:
data -> diagnosis -> trigger -> customer response -> action -> scenario comparison -> explanation."

That is the framing most consistent with Ritesh's feedback.
