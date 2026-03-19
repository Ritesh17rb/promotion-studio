# Supergoop Seasonal Promotion Studio: Presentation Script

## How to use this script

This is a presenter script, not just a feature list.

For every step, it tells you:
- what the screen does
- what it is trying to convey
- what to click or highlight
- what to say while presenting
- how to transition to the next step

## Opening

### Opening script

"Today I am going to walk you through the Supergoop Seasonal Promotion Studio.

The application is designed to help answer one business question: how do we make better promotion decisions by product and channel using actual market context, not just internal sales data.

The flow is deliberate. We start with the underlying data, move into the current state of the business, zoom into last week, understand the events that drove movement, layer in customer behavior, compare response patterns, and then move into scenario planning and AI-assisted recommendation.

So this is not just a dashboard. It is a decision workflow that goes from evidence, to diagnosis, to action."

### Important note if anyone asks about the data

"The data in this demo is synthetic, but it is structured to behave like a realistic operating dataset. That means the competitor moves, social buzz, event impacts, product-channel variation, and customer cohorts are designed to mimic real commercial behavior rather than random placeholder values."

## Recommended narrative arc

Use this storyline throughout the presentation:

1. First show that the data foundation is credible.
2. Then show the current state of the business over time.
3. Then zoom into the most recent week.
4. Then explain event-level causality.
5. Then show why customer groups respond differently.
6. Then move into scenario simulation and recommendation.

## Step 1: Data Explorer

### What this step does

This is the data foundation screen. It lets you inspect the actual datasets that power the rest of the application, including:
- product x channel weekly performance
- 52-week history
- competitor price feed
- social signals
- customer and segment data

### What it is trying to convey

This step is trying to build trust.

The message is:

"Before we recommend any promotion action, we should be clear about what data the system is actually using."

Ritesh was clear that this step should not be a business interpretation page. It should be a data proof page.

### What to show

1. Start with the loader and let it complete.
2. Open the dataset list and show that there are multiple sources, not one flat file.
3. Open `Product Channel History` or `SKU Channel Weekly` and show that the app tracks weekly product-channel performance.
4. Open `Competitor Price Feed` and show that competitor pricing is explicit, retailer-specific, and SKU-specific.
5. Open `Social Signals` and show that social data is also explicit, with mentions, sentiment, engagement, and brand social index.
6. If needed, show the quick chart above each dataset to prove the data is not just tabular, it is being summarized visually too.

### Feature-by-feature explanation

`Dataset list`

This shows the breadth of the data foundation. It tells the audience that the application is combining commercial performance data, market data, and customer data.

`Dataset info panel`

This establishes context for each file: what it is, how many rows it has, how many columns it has, and what period it covers.

`Quick visual overview`

This helps the audience understand the data without reading raw rows. It is especially useful when you want to show trend shape quickly.

`Competitor Price Feed`

This is one of the most important datasets to call out. It proves that competitor pricing is not inferred vaguely. It is modeled as a direct external signal by retailer and SKU.

`Social Signals`

This is the other critical external dataset. It proves that the model is not relying only on pricing and inventory. It is also watching how demand and conversation are moving in the market.

### Suggested talk track

"I want to start with the data explorer because this establishes what the rest of the application is built on.

This screen is intentionally not trying to make a recommendation yet. Its job is to show the underlying data sets being used.

The important point here is that we are not looking only at internal sales. We are combining internal SKU-channel performance with external signals like competitor pricing and social media buzz.

For example, here is the competitor price feed. This shows product-level pricing by retailer, so when we later say a product is under pressure, that statement is grounded in observed competitor price movement.

And here is the social signals dataset. This gives us channel and platform-level buzz, mentions, and brand momentum, which matters because some products can hold price when social demand is strong, while others need a sharper promotional response.

So Step 1 is really about data credibility. It tells the audience: these later recommendations are traceable back to actual modeled inputs."

### Transition to Step 2

"Now that we know what data the system is using, the next question is: what has actually been happening in the business over time?"

## Step 2: Current State Overview

### What this step does

This is the historical business overview. It shows the last year of performance across the six products and four channels, with the ability to drill into:
- all products
- Sunscreen
- Moisturizer
- individual SKUs

It also ties performance to the three operating levers Ritesh wanted emphasized:
- our own price
- competitor price gap
- social buzz

### What it is trying to convey

This step is trying to answer:

"What has happened in the business, where is it happening, and what external pressures are likely explaining it?"

This is the big-picture diagnosis screen.

### What to show

1. Start at the product filter and show `All 6 Products`.
2. Point to the lookback filter and keep it at `Last 1 Year` first.
3. Walk across the KPI strip:
   - total revenue
   - units sold
   - average own price
   - average competitor gap
   - average social buzz
4. Show the main trend chart and explain that this is the core current-state chart because it puts sales together with the three levers.
5. Show `Channel Mix Revenue` to explain which channels are driving the business.
6. Show `Channel & Product Price Position` to make the product x retailer economics tangible.
7. Switch the filter from `All 6 Products` to `Sunscreen`, then to `Moisturizer`, then to one SKU to show drilldown.
8. If you want to bridge into operational context, scroll to the latest-week blocks:
   - Current Channel Groups
   - Key Performance Metrics
   - This Week's Market Signal Snapshot
9. If time permits, briefly mention the promotions simulator at the bottom as the bridge from diagnosis to action, but keep the detailed simulation for Step 7.

### Feature-by-feature explanation

`Product filter`

This allows the discussion to move from portfolio level to category level to SKU level. It is important because the business question is never solved at only one level of granularity.

`Lookback window`

This lets you tell either the annual story or a tighter operational story. For a presentation, start with one year and then tighten only if someone asks.

`KPI strip`

This gives the top-line state of the business over the selected window. It tells the audience whether the problem is scale, pricing, competitive pressure, or weak demand support.

`Sales Trend vs Operating Levers`

This is the key chart on this page. It is trying to show that sales do not move in isolation. Sales are being read in the context of our price, competitor gap, and social momentum.

`Channel Mix Revenue`

This answers where the business is being carried. It is especially useful when the total portfolio view looks healthy but one channel is doing most of the work.

`Channel & Product Price Position`

This is where you make the analysis concrete. It shows which product is selling on which channel, at what price, against what competitor context, and with what social support.

`Current Channel Groups`

This translates the channel architecture into business language: mass versus prestige. It reminds the audience that pricing and promotion logic should differ across those channel groups.

`Key Performance Metrics (Latest Week)`

This gives a latest-week commercial read so the historical trend does not feel abstract.

`This Week's Market Signal Snapshot`

This is the external market layer for the current week. It brings competitor moves and social shifts into the narrative before deeper weekly analysis.

### Suggested talk track

"This is the current state of the business over the last year.

The first thing I want to show is that this screen does not just report sales. It connects sales to the three commercial levers we actually control or react to: our own price, competitor price position, and social buzz.

At the top, we can look at the total portfolio, but I can also immediately narrow the view to Sunscreen, Moisturizer, or an individual product. That matters because the right promotional posture is often different by category and by SKU.

This main chart is the center of the page. It helps answer whether revenue movement is happening alongside a price move, a competitor shock, or a change in social support.

Then on the right and below, we can see which channels are carrying that performance and whether our price position versus competitors looks intentional or exposed.

The goal of this page is to move from a generic summary to a diagnostic business view:
what is happening,
where it is happening,
and which of the three levers is most likely driving that movement."

### Optional bridge if you show the lower half

"At the bottom, we also surface the latest-week market signals and a bridge into simulation. I usually use this to set up the next part of the story, but I keep the heavy scenario discussion for the later modeling steps."

### Transition to Step 3

"The one-year view tells us the broad story. The next step is to zoom into the most recent week and diagnose the current posture in operational terms."

## Step 3: Last Week Performance Drilldown

### What this step does

This is the weekly operating screen. It focuses only on the latest week and shows:
- top-line weekly KPIs
- channel performance
- product x channel performance
- competitor price moves that week
- social buzz by product
- key watchouts

### What it is trying to convey

This step is trying to answer:

"What is happening right now, this week, and where should I focus first?"

It is the weekly commercial review screen.

### What to show

1. Start at the week header so the audience knows this is a single-week view.
2. Read the executive summary in one sentence.
3. Walk through the KPI row:
   - revenue
   - units sold
   - average own price
   - competitor gap
   - social buzz
   - gross margin
4. Show the channel cards and explain how each channel is positioned this week.
5. Show `Product x Channel Performance` and call out that the cells surface units, week-over-week change, price gap, and buzz.
6. Show `Competitor Price Moves This Week` and point out that this is the observed external pressure layer.
7. Show `Social Buzz by Product` to explain which products have support or softness in attention.
8. End on `Key Takeaways & Watch Items`.

### Feature-by-feature explanation

`Week header and executive summary`

These frame the weekly story so the audience immediately understands the lens has shifted from annual diagnosis to operational decisioning.

`Weekly KPI row`

This gives the current commercial pulse. It tells you whether the issue this week is volume, pricing, margin, competition, or demand softness.

`Channel performance cards`

These summarize where the current week is strong or weak by retailer and help prioritize attention.

`Product x Channel Performance`

This is the most actionable part of the page. It shows that the weekly story is not uniform. Each product-channel pair can be behaving differently.

`Competitor Price Moves This Week`

This makes competitive pressure explicit and immediate. It is useful when explaining why a SKU suddenly lost momentum.

`Social Buzz by Product`

This shows where brand or product attention is helping hold price or accelerate demand.

`Key Takeaways & Watch Items`

This converts the week into operating priorities so the page is not just observational.

### Suggested talk track

"This screen is our last-week operating review.

The purpose here is not to understand the whole year. It is to understand what happened in the latest week, where the pressure sits right now, and where we should focus first.

At the top, the KPI row summarizes the week commercially. Then the channel cards tell us whether the issue is concentrated in one retailer or spread more broadly.

What I like to focus on next is the product-by-channel grid, because that is where the behavior becomes actionable. We can see which product-channel combinations are moving, which are softening, where the competitor gap widened, and where social buzz is helping or not helping.

Then these two panels on the right and below give us the weekly market context: competitor price changes and social buzz.

So the story of Step 3 is: this is not just what happened, this is where to look first before we decide how to respond."

### Transition to Step 4

"Once we know where the pressure is this week, the next question is: what event or trigger is actually behind that movement?"

## Step 4: Event Calendar

### What this step does

This is the event-driven causality screen. It tracks four event types over a 24-month timeline:
- promotions
- competitor price changes
- social spikes
- seasonal tentpoles

When you click an event, the screen opens:
- an event summary card
- event impact summary
- metric change versus baseline
- a detailed event table showing what changed at product x retailer x SKU level

### What it is trying to convey

This step is trying to answer:

"What happened during this event, and how did it change pricing, demand, and revenue?"

It is the clearest cause-and-effect screen in the application.

### What to show

1. Start with the timeline and explain that it covers one year back and one year forward.
2. Mention that the events are limited to the four meaningful business event types.
3. Click a promotion event first because it opens the richest summary card.
4. Walk through the event card:
   - name
   - status
   - channels affected
   - promoted products
   - period
   - discount
   - target or modeled units
   - ROI
   - revenue impact
   - narrative
5. Then go to the tables below and explain them in order.
6. Click a competitor-price event or social-spike event next to show that non-promo events are also analyzable, not just promos.

### Feature-by-feature explanation

`Event filters`

These let you simplify the timeline so the audience can focus on one type of business trigger at a time.

`Product filter`

This is useful when the audience wants to see event history only for one product or one part of the portfolio.

`Timeline`

This gives the operating calendar view. It turns the business into a sequence of events rather than a static report.

`Event summary card`

This is the business summary. It tells the audience what the event was, what scope it had, and whether it was completed, observed, or planned.

`Event Impact Summary`

This shows the headline business result: channels affected, products affected, units, ROI, and revenue impact.

`Metric Change vs Baseline`

This is one of the most important parts of the screen. It shows the three levers Ritesh cared about:
- how much our price changed
- how much competitor price changed
- how much social buzz changed

It also shows:
- baseline sales
- additional sales
- total sales
- net revenue change

`Detailed event table`

This is the forensic table. It breaks the event down by product, retailer, and SKU, including:
- our price this week
- competitor price this week
- our price last week
- competitor price last week
- social buzz
- event impact readout
- baseline sales
- additional sales
- total sales
- revenue impact
- ROI

### Suggested talk track

"This screen explains the business in terms of events rather than just weekly snapshots.

The timeline is meant to answer a simple question: when we saw movement in sales, what actually happened around that time?

If I click an event, the first thing I get is a business summary card. That tells me what the event was, which channels and products it affected, what kind of promotion or market signal it represented, and what the high-level commercial impact was.

Then below that, I can see exactly what changed during the event. This is where the screen becomes very useful, because we are not stopping at event labels. We are quantifying changes in our price, competitor price, and social buzz, and then linking those changes to baseline sales, incremental sales, total sales, and revenue impact.

And if I need to go one layer deeper, the detailed table shows the exact product-retailer-SKU combinations that moved.

So the purpose of this step is to turn timeline points into a concrete explanation of what happened and why it mattered commercially."

### Transition to Step 5

"So far we have understood the business and the event context. The next question is whether all customers respond the same way. They do not, and that is what the next two steps address."

## Step 5: Customer Cohorts

### What this step does

This screen segments the customer base into Mass and Prestige cohorts and lets you analyze them across:
- acquisition sensitivity
- loyalty and repeat behavior
- basket value and depth

It also gives multiple visualization modes and a watchlist of cohorts under the most commercial pressure.

### What it is trying to convey

This step is trying to answer:

"Which customer groups are promo-responsive, which are better hold-price candidates, and which are currently under pressure?"

### What to show

1. Start with the `Channel Group` selector and explain `Mass Cohorts` versus `Prestige Cohorts`.
2. Show the `Axis` selector:
   - acquisition
   - engagement
   - monetization
3. Show the visualization selector and pick the one that is easiest for the audience:
   - heatmap for commercial pressure
   - 3-axis map for richer storytelling
4. Use the filter pills to show that you can isolate specific cohort types.
5. Walk through the KPI cards.
6. Hover or click a cohort to show the detail panel.
7. End with the `Customer response watchlist` and click one cohort to show SKU-level drilldown.

### Feature-by-feature explanation

`Mass vs Prestige selector`

This reframes segmentation in the business language Ritesh wanted. It avoids overusing retailer names when the discussion is really about cohort archetypes.

`Axis selector`

This lets you explain customer behavior from different angles:
- acquisition behavior
- loyalty behavior
- basket behavior

`Visualization selector`

This allows you to shift between a summary view and a more analytical exploration view depending on the audience.

`Filter pills`

These let you isolate the customer groups that matter to the current business question.

`Cohort KPI dashboard`

This gives a quick top-line understanding of how large, valuable, or pressured the visible customer groups are.

`Cohort detail panel`

This provides a business-readable explanation of whichever cohort the audience is looking at.

`Customer response watchlist`

This is the operational output of the page. It highlights the customer groups under the most commercial pressure after accounting for price, competitor gap, social support, and current product mix.

### Suggested talk track

"This is where we stop treating the customer base as one average number.

Ritesh wanted the language here to be business-readable, so instead of framing this around retailer names, we frame it around Mass and Prestige cohorts.

The core idea is that customer behavior differs across acquisition, loyalty, and basket behavior. Some cohorts are highly promo-responsive. Others are less price sensitive and can support a hold-price posture, especially when social demand is strong.

The visualizations help us understand the shape of the customer base, but the operational output is really this watchlist. It tells us which customer groups are under the most commercial pressure right now, and then it lets us drill into the SKU-level drivers.

So the point of this screen is to make targeting more intelligent. It helps us decide not just whether to promote, but for whom."

### Transition to Step 6

"Once we understand the customer groups, the next question is how differently they respond to each lever. That is what the next screen makes explicit."

## Step 6: Segment Response Comparison

### What this step does

This screen compares cohort response across the three levers Ritesh asked to see explicitly:
- own price response
- competitor price response
- social buzz response

It also lets you filter by:
- cohort dimension
- Mass versus Prestige
- product
- sort logic

### What it is trying to convey

This step is trying to answer:

"Which cohorts should get promotion depth, which need competitor-defense support, and which can justify holding price?"

### What to show

1. Start with the explanatory banner and say this is the explicit three-lever comparison screen.
2. Show the controls:
   - cohort dimension
   - channel group
   - product
   - sort by
3. Use `All Products` first, then switch to one SKU so the audience sees that cohort response changes by product.
4. Walk through the three summary cards.
5. Show the comparison table and call out the three response columns.
6. End with the grouped comparison chart.

### Feature-by-feature explanation

`Controls`

These let you align the segment response view to the business question being discussed. For example, one product can be much more socially amplified than another.

`Three summary cards`

These give the fastest readout on:
- which cohort is most sensitive to our own price
- which cohort is most exposed to competitor actions
- which cohort benefits most from social buzz

`Comparison table`

This is the decision table. It makes it clear which cohorts are:
- discount-sensitive
- competition-sensitive
- demand-amplified by social momentum

`Comparison chart`

This makes the three-lever differences easier to compare visually across cohorts.

### Suggested talk track

"This screen turns customer response into something explicitly comparable.

Ritesh asked for three kinds of elasticity or response to be visible here: our own price, competitor price actions, and social buzz. That is exactly what this screen is designed to show.

So instead of saying a cohort is simply sensitive or not sensitive, we can be much more precise. One cohort may react sharply to our own price. Another may only move when competitors become aggressive. Another may justify holding price because social demand is doing the work.

That distinction is critical, because it changes which products and cohorts we include in a campaign and which ones we deliberately exclude.

So the purpose of this step is to move from descriptive segmentation to decision-ready cohort strategy."

### Transition to Step 7

"Now that we understand the business, the weekly posture, the event context, and the customer response patterns, we can finally move into simulation."

## Step 7: In-Season Planner Model Board

### What this step does

This is the weekly scenario planning workspace. It is where users can model SKU x channel promotion actions using:
- inventory runway
- competitor price deltas
- social momentum
- product scope
- channel group
- scenario settings

It is designed to show what happens before a promotion decision is executed.

### What it is trying to convey

This step is trying to answer:

"If I change the promotion plan now, what happens to sales, revenue, profit, and inventory for the rest of the season?"

### What to show

1. Start with the scenario workflow banner and explain that this is where diagnosis turns into action.
2. Open the `In-Season Planner` tab if it is not already active.
3. Show the main controls:
   - cohort or product selection
   - channel group
   - price or promotion setting
   - scenario experiments
4. Run or reference one scenario.
5. Walk through the key outputs:
   - projected customer or sales impact
   - scenario state
   - inventory projection
   - commercial checkpoint
   - week-5 anchored scenario readout
6. If you have saved scenarios, show ranking and recommendation briefly.

### Feature-by-feature explanation

`Scenario controls`

These let the user build a practical promotion action instead of just observing the market.

`Scenario experiments`

These are useful in a presentation because they give a fast path to a business story instead of requiring you to build a case from scratch.

`Live scenario state`

This tells the audience what scenario is currently being simulated and whether the outputs have been refreshed.

`Inventory projection and commercial checkpoint`

These connect promotion choices to the operational consequence: how much inventory is likely to remain and what the rest-of-season commercial picture looks like.

`Scenario ranking and recommendation`

These help move from experimentation to decision.

### Suggested talk track

"Everything up to this point has been about understanding the business and the drivers behind current performance.

This is the point where we actually ask: what should we do next?

The in-season planner lets us build a scenario by product, cohort, and channel context, and then project the likely effect on sales and inventory.

What makes this useful is that it is not a blind discount simulator. It is informed by the same competitor signals, social momentum, and customer response patterns we saw earlier.

So the message of this step is: we are no longer just describing the market. We are pressure-testing decisions before they go live."

### Transition to Step 8

"In-season planning solves the near-term question. The next screen deals with the end-of-season problem: how do we clear responsibly without damaging value?"

## Step 8: End-of-Season Markdown Decision Models

### What this step does

This screen focuses on markdown planning near season end. It combines:
- historical promotion evidence
- markdown ladder logic
- repeat-loss risk
- inventory clearance logic

### What it is trying to convey

This step is trying to answer:

"What markdown path helps us finish the season closer to zero inventory without collapsing margin or creating unnecessary repeat-loss risk?"

### What to show

1. Open the `End-of-Season Markdown` tab.
2. Show the markdown controls and scenario experiments.
3. Show the repeat-loss chart over time.
4. Show the retention and revenue impact view.
5. If available, show lag-window risk and the historical campaign evidence.
6. Conclude with the scenario comparison or recommendation output.

### Feature-by-feature explanation

`Markdown controls`

These let you model how aggressive the markdown should be.

`Repeat-loss chart`

This is important because it prevents the conversation from becoming purely short-term. It shows that markdown choices can solve inventory while creating downstream customer risk.

`Retention and revenue view`

This shows the trade-off more clearly: some markdowns lift short-term sell-through but weaken future retention economics.

`Historical evidence`

This grounds the markdown discussion in prior observed campaign behavior, not only simulated math.

### Suggested talk track

"This screen is specifically about late-season discipline.

The question here is not simply how to sell more units. The question is how to reduce leftover inventory without destroying economics or creating too much delayed repeat-loss.

That is why this page combines markdown simulation with time-lagged customer impact and historical campaign evidence.

So the business value of this step is that it helps choose a markdown ladder that clears inventory intelligently rather than reactively."

### Transition to Step 9

"After looking at in-season and end-of-season tactics, the next question is how promotion actions reshape the portfolio itself."

## Step 9: Portfolio Migration & Advanced Analysis

### What this step does

This screen simulates migration and cannibalization across the portfolio. It shows how changes in one area can shift demand across:
- Mass and Prestige channel groups
- sibling SKUs
- product groups

It also includes scenario ranking and advanced analysis to compare trade-offs.

### What it is trying to convey

This step is trying to answer:

"Are we creating true external capture, or are we just moving demand around inside our own portfolio?"

### What to show

1. Start with the migration scenario area and select a product or group.
2. Show the SKU inventory projection.
3. Show the migration flow or matrix.
4. Show `Historical Promo Effectiveness (SKU + Channel)` to ground the analysis in past performance.
5. Open the advanced panel and show the decision takeaway.
6. If scenarios are saved, show:
   - ranking
   - top scenarios
   - recommended scenario
   - reforecast comparison

### Feature-by-feature explanation

`Migration flow and matrix`

These visualize how demand shifts when one product or channel gets promoted more aggressively.

`SKU inventory projection`

This connects migration logic back to an operational outcome.

`Historical promo effectiveness`

This helps explain where promotions have historically created lift and where they have merely displaced demand.

`Advanced analysis`

This is the executive decision layer. It helps identify the policies where external capture is higher than internal cannibalization.

`Scenario ranking`

This is useful in a presentation because it turns multiple experiments into a shortlist of options.

### Suggested talk track

"This screen is important because not all promo lift is good lift.

Sometimes a promotion creates real external capture. Other times it simply pulls demand from another SKU or from another channel in our own portfolio.

This step helps separate those two outcomes. We can see migration routes, cannibalization pressure, and historical evidence of where promotions have genuinely worked.

Then the advanced ranking tools help us compare multiple scenarios and identify the ones that create the best growth-versus-profit trade-off.

So the purpose of this screen is portfolio discipline, not just campaign optimization."

### Transition to Step 10

"Once all of that context is in place, the final step is to use AI to turn the evidence into a recommendation."

## Step 10: AI Promotion Optimization Assistant

### What this step does

This is the conversational recommendation layer. It lets the user ask natural-language questions about:
- what to promote
- where inventory risk sits
- how to respond to competitor moves
- whether social momentum supports holding price
- which scenarios look best

### What it is trying to convey

This step is trying to answer:

"Can the system synthesize all of this evidence into a recommendation that a planner or business leader can act on quickly?"

### What to show

1. Start by explaining that this is grounded in the same data shown earlier.
2. Point to the suggested questions as examples.
3. Enter one practical query, such as:
   - what should I promote this week to clear inventory by season end with minimal margin damage?
   - which SKUs should I include in a season-end clearance promo by channel?
4. Explain the answer in business terms rather than as a chatbot response.

### Feature-by-feature explanation

`Suggested questions`

These help the audience understand the intended use cases quickly.

`Chat input`

This is the natural-language interface to the same inventory, pricing, social, event, and scenario logic shown across the application.

`Assistant response`

This is meant to compress the analysis into a planner-friendly answer, not replace the underlying evidence.

### Suggested talk track

"This final step is the synthesis layer.

Everything we have seen so far has built the context: the data foundation, the current state of the business, the weekly posture, the event history, the customer differences, and the scenario trade-offs.

The AI assistant sits on top of that and helps turn the analysis into a decision-ready recommendation.

So if a user asks what should be promoted this week, or which SKUs belong in a season-end clearance plan, the assistant should respond using the same commercial logic we just walked through, not as a generic chatbot.

That is why I position this as the last screen. It is strongest when it is clearly backed by everything that came before it."

## Closing script

"So to summarize, this application is designed as a full promotion decision workflow.

It starts with trusted data, moves into business diagnosis, explains the weekly and event-level drivers, incorporates customer and segment response differences, lets us simulate decisions, and finally uses AI to compress that into a recommendation.

The important point is that it is not optimizing promotions in the abstract. It is doing so with product-level, channel-level, competitor-level, social-level, and cohort-level context."

## Short version if time is limited

If you only have a short demo window, focus on:

1. Step 1 to establish data credibility.
2. Step 2 to show the annual business view and the core trend chart.
3. Step 3 to show the latest-week operating posture.
4. Step 4 to show event-level causality.
5. Step 6 to show the three-lever cohort response.
6. Step 7 or Step 9 to show decision simulation.
7. Step 10 to end with AI recommendation.

## Questions you should be ready for

### "What makes this different from a normal dashboard?"

"A normal dashboard reports outcomes. This workflow links outcomes to competitor pricing, social momentum, event history, cohort behavior, and scenario planning so it can support decisions, not just reporting."

### "Why include social buzz?"

"Because some products can hold price or respond differently when demand momentum is strong. Social buzz is one of the external signals that helps explain when a price move is necessary and when it is not."

### "Why separate Mass and Prestige?"

"Because the commercial logic is different. Mass is generally more promo-responsive and more exposed to value pressure, while Prestige can justify more price discipline when the brand and product context support it."

### "Why do we need both cohort analysis and scenario simulation?"

"Cohort analysis tells us who reacts differently. Scenario simulation tells us what happens if we act on that insight."
