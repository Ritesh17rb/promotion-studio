# Promotion Optimization Studio: Application Explanation

## 1. What This Application Is

This application is a promotion decision-support studio.

It is built to help a business user answer a practical question:

**Where should we promote, where should we hold price, where should we defend against competition, and where should we avoid broad discounting?**

The app is not meant to be just a dashboard and not meant to be just a simulator.

It combines:

- evidence
- diagnosis
- event context
- segmentation
- scenario modeling
- AI-assisted interpretation

So the user can move from:

**What data do we have?**  
to  
**What is happening right now?**  
to  
**Why is it happening?**  
to  
**What should we do next?**

## 2. Core Intent of the Product

The intent of the application is to make promotion planning more intelligent and more selective.

The product is designed around the idea that promotions should not be applied broadly across all products and channels.

Instead, the application tries to show:

- when demand is already strong and discounting may be unnecessary
- when competition is forcing a defensive move
- when social sentiment is creating pricing power
- when markdowns should be targeted instead of broad
- when different customer groups require different strategies

This is why the app repeatedly focuses on the same business levers:

- **own price**
- **competitor price**
- **social sentiment / social demand**

These are the core operating signals that the app uses to explain outcomes and support decisions.

## 3. The Intended Storyline

The application follows a deliberate storyline.

It is not a random collection of screens.

The flow is:

1. **Prove the data foundation**
2. **Show the current state of the business**
3. **Zoom into the most recent week**
4. **Explain what happened using event context**
5. **Show that customer groups behave differently**
6. **Compare response patterns across segments**
7. **Turn those insights into in-season decisions**
8. **Extend the logic to markdown planning**
9. **Extend the logic to portfolio migration tradeoffs**
10. **Offer an AI layer to query and summarize the system**

This is the product logic that holds the whole experience together.

## 4. How to Think About the Application

The easiest way to understand the app is to think of it as four layers:

### Layer 1: Evidence

These steps prove the inputs and show the current business state.

- Step 1: Data Explorer
- Step 2: Current State Overview
- Step 3: Last Week Performance Drilldown
- Step 4: Event Calendar

### Layer 2: Behavioral Understanding

These steps explain that different customer groups react differently.

- Step 5: Customer Cohorts
- Step 6: Segment Response Comparison

### Layer 3: Decision Modeling

These steps convert evidence into actionable scenarios.

- Step 7: In-Season Planner Model Board
- Step 8: End-of-Season Markdown Decision Models
- Step 9: Portfolio Migration & Advanced Analysis

### Layer 4: Conversational Access

This step makes the system easier to use.

- Step 10: AI Promotion Optimization Assistant

## 5. Step-by-Step Explanation

## Step 1: Data Explorer

### Why this step exists

This step is here to establish credibility before any business recommendation is made.

It answers:

- what data is available
- what data powers later screens
- whether competitor pricing, social sentiment, events, and history are actually included

### What this step is trying to do

It is trying to make the user trust the application.

If the user does not trust the data foundation, then the charts, simulations, and AI outputs later in the flow will feel weak.

### What features in this step are trying to do

- **Dataset explorer / viewer**: helps the user inspect the raw source tables
- **dataset switching**: shows that the system uses multiple evidence layers, not a single flat table
- **dataset previews / charts**: help the user quickly understand what kind of data exists
- **AI assistant on this screen**: lets the user ask questions like which files or datasets power later screens

### Why it matters

This step tells the user:

**The rest of the application is grounded in structured evidence.**

## Step 2: Current State Overview

### Why this step exists

This is the main portfolio-level readout.

It answers:

- how the business is doing
- how the selected portfolio / product / channel is trending
- what the relationship is between revenue and the three levers

### What this step is trying to do

It is trying to show the current business picture in a way that is analytically useful and business-friendly.

This is where the app stops being "data" and starts becoming "decision context."

### What features in this step are trying to do

- **product filter**: move between total portfolio, product groups, and individual products
- **channel filter**: isolate behavior by retailer/channel
- **lookback window filter**: compare long-term, medium-term, short-term, and current-season views
- **KPI cards**: summarize the current selected scope in a compact way
- **Avg Comp Gap tooltip**: explain how price gap should be read
- **Avg Social Buzz tooltip**: explain the sentiment scale and meaning
- **Sales Trend vs Operating Levers chart**: place revenue, own price, competitor gap, social buzz, and inventory together so the user can explain movement rather than just observe it
- **Channel Mix Revenue chart**: show channel concentration and contribution
- **Channel & Product Price Position table**: show how each product x channel is positioned against competition
- **AI assistant on this screen**: help the user ask pattern-oriented questions such as missed opportunities or strongest channels

### Why it matters

This step is trying to answer:

**What is the business state, and where are the visible pressure points or opportunities?**

It is especially important because this is where the user can identify missed opportunity situations, such as:

- sentiment was strong
- we were still priced low
- revenue was good
- therefore we may have discounted more than needed

## Step 3: Last Week Performance Drilldown

### Why this step exists

The previous step shows patterns across a chosen window.

This step focuses specifically on the latest week and explains the current operating reality in detail.

### What this step is trying to do

It is trying to answer:

- what just happened
- which products and channels drove it
- whether price changes or competitor moves explain it
- whether the latest KPI story is believable

### What features in this step are trying to do

- **AI-generated summary**: give a top-level narrative immediately
- **Key Takeaways & Watch Items**: surface the business interpretation before the user reads tables
- **latest-week KPI blocks**: provide a quick readout of current performance
- **channel performance views**: show where momentum is concentrated
- **revenue-by-channel view with product dropdown**: isolate contribution by product and channel
- **product x channel performance table**: show the operational detail behind the summary
- **week-over-week price movement**: show what changed in our own prices
- **week-over-week competitor context**: show whether the market moved against us or with us
- **week-over-week sentiment view**: compare this week to last week instead of using a vague external benchmark
- **AI assistant on this screen**: let the user ask focused diagnostic questions

### Why it matters

This step is trying to convert a portfolio story into an operating story.

It makes the user comfortable saying:

**Revenue moved because of these specific product, channel, pricing, and sentiment changes.**

## Step 4: Event Calendar

### Why this step exists

This step introduces causality and timing.

Without this step, the app would describe what happened, but not explain the event context behind it.

### What this step is trying to do

It is trying to connect business outcomes to:

- promotions
- competitor price changes
- social spikes
- seasonal tentpoles

### What features in this step are trying to do

- **event timeline**: show when important events happened
- **today marker / history + forward framing**: show what has happened and what is upcoming
- **competitive price trend chart**: compare our market position against competitors over time
- **SKU/product filter on the competitive chart**: let the user inspect by product instead of only portfolio level
- **social momentum chart**: show how sentiment and elasticity-related signals move over time
- **event detail drawer / modal**: explain units, revenue, price behavior, and event context in one place
- **promotion type display**: make event interpretation more explicit
- **future events as projected**: clarify that future event metrics are modeled, not observed
- **guided examples / narrative hooks**: turn raw event data into reusable business stories
- **AI assistant on this screen**: let the user ask for examples like bad promos, good promos, competitor moves, or holiday impact

### Why it matters

This step allows the user to say:

**We did not just see a number move. We understand what event environment surrounded that movement.**

That is critical for promotion planning because it separates:

- natural demand
- competitor-driven disruption
- event-driven lift
- promotion-driven lift

## Step 5: Customer Cohorts

### Why this step exists

After the evidence and event layers, the next question is whether all customers behave the same way.

This step answers that they do not.

### What this step is trying to do

It is trying to add the customer lens into promotion planning.

### What features in this step are trying to do

- **Mass vs Prestige framing**: keep the segmentation view aligned to the business structure
- **cohort views**: show that different customer groups have different value, behavior, and sensitivity
- **KPI cards and cohort-level views**: summarize cohort economics
- **filters and visualizations**: let the user explore segment definitions and distributions
- **export options / watchlist-type tools**: make the analysis operational rather than purely exploratory

### Why it matters

This step tells the user:

**Promotions should be targeted with customer behavior in mind, not just product behavior.**

## Step 6: Segment Response Comparison

### Why this step exists

Once the user sees the cohorts, the next step is to compare how those cohorts respond to the main levers.

### What this step is trying to do

It is trying to show that response sensitivity differs across segments.

### What features in this step are trying to do

- **segment comparison tables**: compare groups directly
- **response sensitivity views**: show how segments respond to pricing and other drivers
- **scatter / heatmap / radial views**: support different ways of reading segment differences
- **segment search and drilldown**: help the user isolate a particular customer profile
- **watchlist logic**: highlight segments that deserve attention

### Why it matters

This step tells the user:

**A promotion that works for one customer profile may not work for another.**

That is the bridge from descriptive analytics to targeted decision-making.

## Step 7: In-Season Planner Model Board

### Why this step exists

This is the first major action layer.

### What this step is trying to do

It is trying to turn the earlier evidence into weekly SKU x channel decisions.

### What features in this step are trying to do

- **scenario cards**: give ready-to-run strategic options
- **planner simulation inputs**: let the user test competitor shock, social shock, pricing posture, and inventory context
- **inventory trajectory logic**: show how decisions affect remaining stock
- **action tables by SKU**: recommend where to defend, where to hold, and where to push
- **save scenario**: preserve candidate strategies
- **rank saved scenarios**: compare options under business objectives
- **Python model runner / scenario studio**: make the modeling layer feel explicit and operational

### Why it matters

This step is the point where the app becomes a planning tool instead of just an explanation tool.

It answers:

**What should we do this week?**

## Step 8: End-of-Season Markdown Decision Models

### Why this step exists

In-season planning and end-of-season markdown planning are related but not identical.

Markdown logic needs its own decision framework.

### What this step is trying to do

It is trying to balance:

- inventory clearance
- margin protection
- past campaign evidence
- repeat-risk / fatigue effects

### What features in this step are trying to do

- **historical campaign effectiveness tables**: show what kinds of markdowns or promos worked before
- **SKU include/exclude policy**: decide which products should or should not be broadly discounted
- **markdown ladder**: sequence depth over future weeks
- **decision summary**: translate the evidence into simple action categories
- **simulation lab**: let the user test markdown aggressiveness, margin floor, and phase/channel focus
- **lagged repeat-risk lab**: account for the fact that promotions can create future downside
- **save scenario / ranking integration**: compare markdown strategies

### Why it matters

This step tells the user:

**Markdown decisions should be evidence-led and sequenced, not reactive and broad.**

## Step 9: Portfolio Migration & Advanced Analysis

### Why this step exists

Promotions can shift behavior across tiers, products, or portfolio groups.

This step deals with those higher-level tradeoffs.

### What this step is trying to do

It is trying to show where demand is moving and whether that movement is healthy.

### What features in this step are trying to do

- **migration scenarios**: test different movement assumptions
- **cannibalization views**: show when one SKU steals from another
- **Mass vs Prestige flow analysis**: show portfolio-level movement patterns
- **ranking / objective views**: compare scenarios by growth, profit, balance, or risk posture
- **migration matrices**: visualize movement between tiers or portfolio states

### Why it matters

This step broadens the lens from:

- "did the promotion work?"

to:

- "did the promotion improve the portfolio mix, or just shift value around internally?"

## Step 10: AI Promotion Optimization Assistant

### Why this step exists

By this point the user has a lot of evidence, charts, and model outputs.

The assistant step exists to make that system easier to query and summarize.

### What this step is trying to do

It is trying to turn the application into a conversational analysis layer.

### What features in this step are trying to do

- **chat interface**: let the user ask business questions directly
- **AI reasoning against loaded context**: connect questions to data and scenario context
- **SKU-level recommendation framing**: help translate model outputs into business language
- **scenario comparison support**: summarize tradeoffs quickly

### Why it matters

This step tells the user:

**The AI is not replacing the underlying evidence or models. It is making them easier to access and explain.**

## 6. Cross-Cutting Product Principles

There are a few design principles that appear across the whole application.

### A. Progressive disclosure

The user is not shown everything at once.

The system starts with evidence, then moves to explanation, then to modeling.

This is implemented through the step-based navigation flow.

### B. Reuse of the same business levers

The app repeatedly returns to:

- own price
- competitor price
- social sentiment

This repetition is intentional. It creates a stable business language across screens.

### C. Portfolio view first, then drilldown

The user first sees the overall state, then recent performance, then event context, then segment logic, then scenario outputs.

### D. Actionability

Most later screens are designed to end in a decision:

- promote
- defend
- hold
- markdown
- test migration scenario
- ask AI for recommendation

## 7. How the Application Is Structured in Code

For someone trying to understand the implementation, the most important files are:

- `index.html`
  - defines the visible step wrappers and the major sections

- `js/step-navigation.js`
  - controls the step flow
  - maps step numbers to sections
  - moves reusable sections into the active step container
  - drives the later model-heavy screens

- `js/app.js`
  - main application orchestration
  - loading flow
  - current state dashboard
  - weekly drilldown
  - chat widget wiring
  - scenario result and ranking integration

- `js/data-viewer.js`
  - Data Explorer logic

- `js/event-calendar.js`
  - Event Calendar logic
  - market signal charts
  - event detail narratives

- `js/data-loader.js`
  - loads and normalizes the source data files

- `js/segmentation-engine.js`
  - customer/segment logic

- `js/acquisition-simple.js`
  - in-season planner behavior

- `js/churn-simple.js`
  - markdown / lag-risk style behavior

- `js/migration-simple.js`
  - migration-related behavior

- `js/chat.js`
  - AI assistant integration

## 8. How the Step System Works

The app uses a step-navigation system that is more important than it first appears.

The step system:

- activates the correct wrapper section
- hides unrelated sections
- moves reusable content blocks into the visible step container
- ensures the story feels linear even though parts of the app are modular underneath

This matters because the product is intentionally designed as a guided narrative rather than a loose tabbed tool.

## 9. How the Data Supports the Product Story

The data files support the product in distinct ways:

- `sku_channel_weekly.csv`
  - weekly SKU x channel behavior
  - one of the main sources for trend, drilldown, and planner logic

- `product_channel_history.csv`
  - longer historical context

- `market_signals.csv`
  - competitive and external market context

- `social_signals.csv`
  - sentiment / social movement context

- `retail_events.csv`
  - promotion and event timing context

- `promo_metadata.json`
  - historical campaign evidence

- `segment_kpis.csv`, `segments.csv`, `segment_elasticity.json`
  - customer cohort and response logic

The app is strong because these sources are not shown as isolated tables. They are combined into one business story.

## 10. The Most Important Product Takeaway

The best way to understand this application is:

It is a **promotion reasoning system**.

It does not only show performance.

It tries to explain:

- what happened
- why it happened
- who it affected
- whether it should be repeated
- what to do next

That is the central intent behind the storyline and the product design.

## 11. Final Summary

If someone wants the shortest explanation of the application, this is it:

This application helps a business user understand promotion performance and make better future decisions by combining data credibility, current-state diagnosis, weekly drilldown, event context, customer segmentation, and scenario-based planning into one guided flow. The first steps prove and explain the business. The later steps model actions. The AI layer makes the whole system easier to query and communicate.
