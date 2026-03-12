# Walkthrough Script

## Opening

Today I will walk you through this as a promotion decision system, not just a dashboard.

The point of the application is to answer three business questions:
- what is happening in the season right now,
- what should we do next by channel and SKU,
- and how confident can we be before we go live with that decision.

One important note before I start:

This is a demo season dataset, so some dates in the data run ahead through the season. That is intentional. It allows us to show both in-season decisioning and end-of-season outcomes in one walkthrough.

## How to tell the story

The easiest way to make this engaging is to use a three-part story:

1. Current state.
2. In-season pivot.
3. Best path forward.

That way, you are not reading numbers. You are showing how the business moves from diagnosis to action.

## Step 1: Current State Overview

### What to say

I start here because this gives us the current commercial picture before we change anything.

The top cards tell us whether the business issue is volume, monetization, or repeat risk.

In this build, the KPI layer is showing `4,400` customers, `$114,082.24` in monthly revenue, `$25.93` AOV, and `3.54%` repeat loss rate. Revenue is down `4.5%` versus the prior week, AOV is down by `$1.22`, and repeat loss is slightly better by `0.06` percentage points.

The message here is:

We are not looking at one clean growth story. We are seeing pressure in revenue and order value, so the question is whether the right response is more promotion, better targeting, or better pricing discipline.

### What each feature conveys

`Current Channel Groups`

This tells the audience that we are managing two very different commercial lanes:
- Mass is volume-led and more promo-responsive.
- Prestige is more premium-led and margin-sensitive.

So from the beginning, the app is making the point that one blanket pricing policy would be commercially wrong.

`KPI cards`

These are not just scorecards.

They tell us what kind of problem we are solving:
- if customers are down, we may have a demand problem,
- if AOV is down, we may have pricing or mix pressure,
- if repeat loss rises, we may be buying short-term sales at the expense of long-term behavior.

`The Question`

This is the handoff from reporting to action.

This is where I tell the client:

We are no longer asking what happened. We are asking what happens if we change promo depth by channel and SKU from here.

## Step 1: Channel Promotions Simulator

### What to say

This is the first real decision engine in the product.

It lets us simulate channel-specific and SKU-specific promotion choices before we execute them in market.

In the current live SKU week in this build, which is week `7`, the portfolio is moving `1,599` units, generating `$38,633.46` in revenue, and still carrying `44,607` units of inventory. Sunscreen is at `891` units sold with `23,748` units in inventory, and moisturizer is at `708` units sold with `20,859` units in inventory.

So the planning question is:

Are we comfortable with this runway, or do we need to intervene?

### What each feature conveys

`Story Presets`

These make the demo feel like a business narrative instead of a technical tool.

You can say:

These presets let us jump between start-of-season baseline, in-season competitor pressure, social-momentum hold-price logic, and end-of-horizon clearance logic.

`3-Act Pitch Mode`

This is helpful if you want to show the full story quickly.

You can say:

This mode walks through baseline, pivot, and optimized finish automatically, so the app can be used not only for planning but also for executive storytelling.

`Live season timeline`

This is important because it shows that the model is time-aware.

You can say:

We are not treating the season as one average state. We can move week by week and see how the right answer changes as the season evolves.

`Live Impact (Real-Time)`

This is the executive summary card of the simulator.

You can say:

This gives immediate feedback before we go into deeper charts. It tells us if the current scenario is favorable, margin-protective, volume-defensive, or simply unattractive.

`Live pulse chart`

Explain it simply:

The red line is competitor price trend and the blue line is brand social trend. So this mini-chart is telling us whether the market is pushing us to defend price, or whether brand momentum is giving us room to hold price.

`Product Group` and `Product Focus`

You can say:

This is where the app stops being generic. We can move from total portfolio to specific product groups and even individual products, because the right action is often not the same across the whole catalog.

`Selected Product Extra Promo`

This is the SKU-specific push control.

You can say:

This lets us test hero-product strategies, but it also lets us see whether the hero is truly pulling incremental demand or just cannibalizing its siblings.

`Mass and Prestige sliders`

These are the core pricing and promo levers.

You can say:

Instead of asking whether promotion is good or bad, we can ask the more useful question: where should we promote, how deep, and in which channel is that actually worth it?

`Competitor Price Shock`

This conveys market pressure.

You can say:

This helps us test defensive posture. If a competitor drops price in mass, do we need to react, and how much?

`Social Momentum Shock`

This conveys pricing power.

You can say:

This is where we test whether stronger brand momentum softens elasticity enough to support firmer pricing.

`Objective`

This conveys leadership choice.

You can say:

We can optimize for balanced economics, for growth, or for profit protection. The app does not assume there is only one right objective.

`Demand Driver Decomposition`

This is one of the most useful explanation tools.

You can say:

This shows us why the scenario is moving. Is it our own promo? Is it competitor pressure? Is it social momentum? Or is the gain coming from internal cannibalization?

`Elasticity & Competitive Gap table`

This is where the app becomes commercially specific.

You can say:

This table tells us which products are genuinely price-sensitive, which ones are exposed versus competitors, and where the recommended posture is to push, defend, or hold.

`Cannibalization View` and `Migration Matrix`

This is where you explain portfolio realism.

You can say:

Not all growth is good growth. If one promoted SKU is only taking demand from another SKU in our own portfolio, that is not the same as winning from the market.

`SKU-Level Projection`

This tells you what is happening product by product.

You can say:

The useful comparison here is baseline versus shock-only versus full scenario. That helps us separate market effects from our own action.

`Objective Frontier`

Use simple language:

This is the trade-off chart. Right is better revenue, up is better profit, and bigger bubbles mean better clearance. So this is where leadership can choose the right compromise instead of chasing a single metric.

`Causal Impact Waterfall`

You can say:

This is the “why” chart for the selected SKU. It shows how much of the change comes from each driver, so the recommendation is explainable.

`AI Recommendation Snapshot`

You can say:

This converts the simulation into a business action: what to include, what to exclude, and what risk to watch.

`LLM Live Co-Pilot`

You can say:

This takes the same live scenario and turns it into natural-language reasoning, which is useful for decision support and for preparing the story for stakeholders.

## Step 2: Data Explorer

### What to say

This step is here to make the system transparent.

It shows the raw signals and raw data that the planning logic is built on.

In this build, the latest market and social signal layer is showing:
- Mass competitor price at `$19.11`,
- Prestige competitor price at `$31.36`,
- brand social score at `57.7`,
- with social trending `+3.9` points week over week.

### What each feature conveys

`Signal cards`

You can say:

These cards are telling us what the market is doing to us before we even change our own promo.

`Competitive Price Delta Trend`

This conveys whether we are becoming more or less competitive over time.

`Social Score and Elasticity Modifier`

This is the bridge between buzz and economics.

You can say:

This is not social as a vanity KPI. This is social as a modifier of effective price sensitivity.

`SKU Shock-Only Projection`

This is a very useful explanation point.

You can say:

If we do nothing, and only the market changes, what happens? In the current build, baseline units are `1,599`, while shock-only units come down slightly to `1,584.5`, which is about `-0.9%`. So even before we act, the market context is already shifting our result.

If you want to make it vivid, mention the top movers:
- `Invisible Mist SPF 50` is down about `3.5` units in shock-only mode.
- `Hydra Daily Lotion` is down about `3.2`.

That makes the point that external context matters even before promotion is changed.

`Dataset Viewer`

You can say:

This is where we make the model auditable. Users can inspect the exact datasets behind the recommendation rather than taking the output on faith.

## Step 3: Event Calendar

### What to say

This is the season timeline.

It helps us understand not just what happened, but when it happened and what else was happening around it.

In this build, the event layer contains `26` events:
- `6` tentpoles,
- `5` competitor moves,
- `15` promo or social-spike events.

The campaign library includes `6` campaigns, with a story mix of `2` baseline campaigns, `3` pivot campaigns, and `1` future-oriented campaign.

### What each feature conveys

`Competitive signals chart`

This tells us when the market was getting tougher or softer.

`Social momentum chart`

This tells us when the brand had natural support and when it did not.

`Event Analyst`

You can say:

This is useful because it does not just say an event happened. It helps explain the likely impact and what commercial pivot should follow from it.

`Event Timeline`

This is the visual season story.

You can say:

The app uses the timeline to show that pricing and promotion decisions are timing decisions, not just math decisions.

`Promo Campaign Performance`

This is one of the strongest business sections.

In this build:
- average SKU uplift across campaign outcomes is `+9.4%`,
- Sephora has the highest average uplift at `+12.8%`,
- Amazon is `+11.9%`,
- Target is `+10.1%`,
- Ulta is `+4.6%`.

What to say:

This tells us that not every route responds equally well, so the next cycle should not simply repeat the same inclusion list across channels.

`View SKU + Channel Outcomes`

This lets you go from campaign summary to detailed operational learning.

You can say:

This is how we move from “campaign worked” to “which SKU worked, where, and should we repeat it?”

`Promo Outcome Matrix`

This tells us where specific products worked best by channel.

`Promo Policy Extractor`

This translates history into action.

You can say:

This is where campaign history becomes next-cycle policy. We stop promoting weak products just because they were promoted before.

## Step 4: Customer Cohorts

### What to say

This step explains that customers are not all reacting the same way.

In this build, the segmentation layer covers `15,000` customers:
- `7,491` in mass,
- `7,509` in prestige,
- across `125` unique segment keys.

Average cohort AOV is `$34.93` in mass and `$44.62` in prestige. Average cohort repeat-loss rates are `13.08%` for mass and `12.56%` for prestige.

### What each feature conveys

`Recommendation card`

This gives the headline strategy:

Mass generally wants deeper promo where elasticity is higher. Prestige wants more discipline because the value pool is higher and the margin pool is more fragile.

`Heatmap`

This answers:

Where is promotion actually needed?

`3-Axis Map`

This answers:

Which cohorts are important not just because of sensitivity, but because of scale and risk?

`Scatter view`

This helps you identify large groups that could materially affect outcomes.

`Channel View`

This tells the story that channel economics and customer economics must be read together.

`Watchlist`

This is where the step becomes action-oriented.

You can say:

This is showing us the customer groups most at risk under current price conditions, so we can intervene selectively instead of discounting broadly.

If you want concrete examples from this build:
- one of the highest-risk prestige cohorts is `routine_refill / channel_switcher / multi_sku_builder` at `17.9%` repeat loss with `1,441` customers,
- one of the highest-value prestige cohorts is `promo_triggered / prestige_loyalist / multi_sku_builder` at `$57.88` AOV with `1,459` customers.

That makes the point that high value and high risk are not always the same group.

## Step 5: Segment Response Comparison

### What to say

If Step 4 is about identifying customer groups, Step 5 is about comparing them directly.

This step is where we decide where promotions are efficient and where they are wasteful.

### What each feature conveys

`Comparison table`

This lines the cohorts up side by side so we can decide which ones deserve funding and which ones are being over-incentivized.

`Elasticity comparison chart`

This gives the same answer visually and makes it easier to explain.

If you want to quote real examples from the current build:
- some of the most acquisition-sensitive prestige cohorts are around `-2.82` to `-2.84`, such as `promo_triggered / value_seeker / single_sku_staple`,
- some of the lowest repeat-loss sensitivity prestige cohorts are around `0.454` to `0.474`, such as `seasonal_first_time / prestige_loyalist / value_bundle_buyer`.

What to say:

This is useful because it helps us distinguish between customers we need to motivate with promo and customers we should not train to wait for discounts.

## Step 6: In-Season Planner Model Board

### What to say

This is the weekly action model.

It takes the live state from Step 1 and turns it into a recommended next move.

### What each feature conveys

`Four-model summary`

This says:

Our decision is not based on one input. It is based on own promo, competitor movement, social momentum, and internal migration.

`Season trajectory table`

This is where you explain runway.

You can say:

This shows how inventory evolves from the current week to the planning horizon under baseline and under the selected action.

`In-Season Action Model`

This is the actual weekly plan.

You can say:

This table tells us which products to push, which ones to hold, and how the answer changes by channel. It is where analysis becomes execution.

## Step 7: End-of-Season Markdown Decision Models

### What to say

This step is about finishing the season intelligently, not just discounting late and hoping for clearance.

In the latest tier-level week in this build, mass sells `651` units and prestige sells `485`, while both channels show markdown risk of about `0.72`. That is why the markdown layer matters.

### What each feature conveys

`Markdown scenario logic`

This tells us how aggressive a markdown path needs to be.

`Clearance vs margin trade-off`

This is the core decision.

You can say:

This step helps us decide whether we want to push harder for clearance or protect margin and accept more leftover inventory.

## Step 8: Portfolio Migration & Advanced Analysis

### What to say

This is the strongest advanced decision area in the app, and this is where the two client asks are addressed directly.

The scenario library in this build contains `9` scenarios. Each one has its own scope, price move, week-5 sold units, and social context.

### Client ask (a): sales after 5 weeks and rest-of-season projection

What to say:

This is where we move from historical progress to forward commercial control.

For example, in this build:
- the mass-channel portfolio has sold `4,766` units by week 5 with `14.4%` sell-through and `11,246` units still left after week 5,
- the prestige-channel portfolio has sold `3,067` units by week 5 with `13.7%` sell-through and `7,634` units remaining,
- sunscreen SKU-1 alone has sold `1,061` units by week 5 with `2,588` units still remaining after that point.

That is powerful because it changes the conversation from “how much did we sell?” to “how much is left to win, and how does that change under different scenarios?”

### Client ask (b): social media linked to elasticity and pricing power

What to say:

This is where the app shows that brand momentum is not just tracked, it is used.

For example:
- the Mass Defensive Promo scenario starts with social score `70.49`,
- Prestige Hold During Social Spike starts with `71.10`,
- Sunscreen Summer Launch Push starts with `51.67`.

So the app can show that a stronger social state supports softer effective elasticity and more price headroom, while a weaker social state implies less pricing power.

### What each feature conveys

`Scenario selection`

This is where we choose the commercial hypothesis we want to test.

`Result summary cards`

These tell us whether the scenario is directionally attractive before we go deeper.

`Migration policy controls`

These let us vary channel and migration assumptions to see how demand shifts.

`Tier flow table`

You can say:

This tells us whether we are upgrading customers, downgrading them, or losing them entirely. So it is a mix-quality view, not just a volume view.

`Route intensity diagram`

This shows where the movement is strongest.

`Migration matrix`

This is where you explain internal leakage.

You can say:

This helps us distinguish competitor capture from internal cannibalization.

`5-Week Checkpoint and Remaining-Season Reforecast`

This is the exact answer to the first client ask.

You can say:

This section shows what has already happened by week 5, and then reforecasts the rest of the season from that same checkpoint.

`Sales Outlook After Week 5`

Explain it simply:

The dark line is actual cumulative sales through week 5. After that, the different curves show what the rest of the season looks like under baseline, under the selected scenario, and under different social momentum states.

`Scenario Readout from Week 5`

This gives the explicit numbers behind the chart.

`Social Pricing Power`

This is the exact answer to the second client ask.

You can say:

This shows how social momentum changes effective elasticity, demand tailwind, and price headroom. So when the brand is trending, the app can justify firmer pricing rather than assuming discount is always the answer.

`Scenario Comparator`

This is the executive decision view.

You can say:

We are not forcing leadership to pick from one scenario in isolation. We can save scenarios, rank them by objective, and compare them side by side on revenue, profit, clearance, and risk.

## Step 9: AI Promotion Optimization Assistant

### What to say

This is the conversational layer on top of the analysis.

It is useful because decision-makers often do not want to navigate every chart manually. They want to ask a business question and get a direct answer.

### What each feature conveys

`Chat workspace`

This turns the analytical system into a decision assistant.

`Suggested prompts`

These show the kinds of questions the app is built to answer:
- what to promote this week,
- how to respond to competitor drops,
- which SKUs to hold at full price when social is strong,
- which products underperformed in past promos,
- what to include in clearance,
- where we are over-promoting inelastic SKUs.

What to say:

This is valuable because it lets the same analytical logic be used in plain business language during meetings.

## Closing

If I had to summarize the whole application in one sentence, I would say:

This is a promotion decision platform that moves from current-state diagnosis, to in-season action, to end-of-season optimization, while making the reasoning visible at SKU, channel, customer, and scenario level.

If I had to summarize the two client asks in one sentence, I would say:

We implemented a week-5 anchored sales reforecast for the rest of the season, and we implemented a social-to-elasticity pricing-power layer so trending demand can justify firmer pricing inside the scenarios.

## Final tip for delivery

Do not read every number.

Use numbers only to anchor the story. The real value is to explain what each feature is telling the business:
- where the pressure is,
- what the lever is,
- what trade-off it creates,
- and why the recommendation is commercially credible.
