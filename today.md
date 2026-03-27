# Today Notes

## Purpose of This Document

This file has two goals:

1. capture what **Ritesh Aggarwal** asked for in `meeting_transcript.md` and what has been done in the current application
2. explain the application step by step, based on the product intent, current implementation, and the storyline Ritesh was pushing for in the meeting

---

# Part 1. What Ritesh Asked For, and What Has Been Done

## 1. Overall Story / Flow Changes

Ritesh was not asking only for UI fixes. He was also shaping the **storyline** of the demo.

The intended flow is:

1. prove the data
2. show the current business state
3. zoom into the latest week
4. explain it using events, competition, and social context
5. then move into segmentation and modeling

### What he asked

- make the opening language less inventory-led
- use wording like:
  - customer segmentation
  - price elasticity
  - comparative pricing
  - social demand
- make Data Explorer the evidence-first starting point
- keep Current State early
- keep Last Week Drilldown early
- keep Event Calendar early

### What has been done

- Data Explorer is now the first major step
- Current State Overview is Step 2
- Last Week Performance Drilldown is Step 3
- Event Calendar is Step 4
- opening copy has been updated to reflect segmentation, elasticity, comparative pricing, and social demand signals

### Why this matters

This is the core narrative structure of the app.

Ritesh wanted the demo to feel like:

**evidence -> diagnosis -> explanation -> action**

not:

**random dashboards -> models -> AI**

---

## 2. Data Explorer / Step 1: Ritesh's Asks

### What he asked

- show data that will actually be used later
- bring competitor pricing data into the evidence layer
- bring social media data into the evidence layer
- do not only show mentions; show positive/negative sentiment
- make product-level inspection possible
- add SKU awareness where the data is product-specific
- include event/seasonal data that powers the later Event Calendar
- where charts represent product-level behavior, allow a SKU/product dropdown

### What has been done

- competitor and social datasets are present in the app data foundation
- seasonal/event-related data is part of the broader application data flow
- SKU-aware data exists in the loaded datasets
- social sentiment fields were added to key data sources

### What is only partially done

- the Data Explorer still does not fully present sentiment in the strongest positive/negative way Ritesh described
- product-level competitor exploration inside the Data Explorer is not yet fully polished

### Net understanding

Ritesh wants this step to prove that later screens are not “magic.”  
He wants the data foundation to visibly include:

- competitor pricing
- social sentiment
- product-level history
- seasonal/events data

So the user feels that later analysis is credible.

---

## 3. Current State Overview / Step 2: Ritesh's Asks

### What he asked

- remove wording like “All 6 Products”; use “All Products”
- use “own price” wording
- add a channel filter at the top
- explain Avg Comp Gap
- explain how to interpret the social signal
- clarify that the social scale should be understandable, ideally like `-100 to +100`
- make average price calculation correct
- show revenue with own price, competitor difference, and social buzz together
- add a current-season view
- add inventory visibility
- highlight missed opportunities where social buzz is high but pricing stayed too low
- make the revenue / prior-period numbers believable and consistent
- restore the useful high-level Mass / Prestige style view at the top if possible

### What has been done

- channel filter added
- product wording changed to `All Products`
- `own price` wording used
- explanatory info icons added for Avg Comp Gap and Avg Social Buzz
- current-season lookback (`Current Season (Last 7 Weeks)`) added
- inventory line added to the trend chart
- current-state trend view now combines revenue, own price, competitor gap, and social buzz

### What is only partially done

- the missed-opportunity story is implied, but not yet turned into a stronger hardcoded narrative module
- some numeric sanity concerns from the transcript still need full validation
- the richer top-of-screen Mass / Prestige summary that Ritesh liked is not fully restored as a dedicated presentation block

### Net understanding

This step is supposed to be the **business overview** screen.

Ritesh wanted it to answer:

- what is happening across the portfolio
- where competition is pressuring us
- where sentiment is helping us
- where pricing could have been smarter

He also wanted the math and labels to be strong enough that a client cannot easily catch obvious inconsistencies.

---

## 4. Last Week Performance Drilldown / Step 3: Ritesh's Asks

### What he asked

- label the top summary as AI-generated
- move takeaways to the top
- show the product x channel view prominently
- keep product names consistent across screens
- add a product dropdown to revenue by channel
- compare social buzz to last week, not competitor
- show our price last week, our price this week, and the change
- clarify what move/change means
- show all 24 product x channel rows
- make average price and KPI relationships believable
- add AI chat to each reviewed screen

### What has been done

- `AI-Generated Summary` style labeling added
- key takeaways moved up
- product dropdown added to revenue-by-channel
- product naming was standardized
- the table was reworked to include richer price-change fields
- the table now targets the full product x channel detail
- an AI chat widget with sample prompts has been added

### What is only partially done

- the full numeric sanity review is still not something I would call fully closed
- some business-story packaging could still be stronger

### Net understanding

Ritesh wanted this screen to stop being a generic KPI page and become an **operating review page**.

It should explain:

- what happened this week
- which channels drove it
- which products drove it
- what changed in our own pricing
- what changed in competition
- how sentiment changed versus last week

This is the “what just happened?” step.

---

## 5. Event Calendar / Step 4: Ritesh's Asks

### What he asked

- keep only the important event families:
  - promotions
  - competitor price changes
  - social spikes
  - seasonal tentpoles
- show seasonal names clearly like Thanksgiving and Christmas
- add SKU/product dropdown to the comparative price chart
- make the chart understandable by product and portfolio
- use a social scale that is interpretable, like `-100 to +100`
- explain the four price lines clearly
- show event windows as from/to, not just one date
- show what promotion type it was
- mention what competition price did
- mark future events clearly as projected
- make the event metrics believable
- create clearer story examples that can be used in a client demo

### What has been done

- SKU/product filtering has been added to the comparative chart
- social sentiment logic now prefers `sentiment_score`
- social scales and event details have been improved
- holiday/tentpole naming is present
- event windows now use from/to style formatting
- `promotion_type` has been added to event details
- competitor price callouts are shown
- future events are labeled as projected
- narrative example structures have been added

### What is only partially done

- the app still needs the tightest possible curated demo stories
- numeric consistency across all event details still deserves validation
- by-product versus total-portfolio inspection in every event-detail path is improved, but not perfectly complete everywhere

### Net understanding

Ritesh wants this step to be the **cause-and-effect storytelling layer**.

Not just:

- an event happened

but:

- this promotion / competitor move / social spike / holiday created the business result we are seeing

This is important because this screen helps explain whether future actions should be:

- defensive
- selective
- opportunistic
- or avoided

---

## 6. Cross-Cutting Asks from the Meeting

### AI chat on each reviewed screen

Ritesh explicitly asked for AI chat widgets on each screen, with sample questions and screen-level understanding.

### What has been done

- AI chat is available on the reviewed business screens
- prompts are screen-specific

### Still open

- it is not yet uniformly present on every major screen in the full product

---

### Numeric credibility

Ritesh repeatedly pushed on this.

He was clear that if:

- revenue deltas
- margin relationships
- event impact numbers
- prior-period comparisons

do not make sense, client confidence will drop.

### Current state

- some calculations and labels have been corrected
- but the full “numeric confidence sweep” is still not something I would mark as fully closed

---

### Product naming consistency

Ritesh called out that product names should be consistent across screens.

### What has been done

- naming consistency has been improved in the weekly/current-state views

---

## 7. Summary of What Has Been Implemented vs Still Open

## Clearly implemented

- revised storyline order
- improved opening positioning
- channel filter in Step 2
- current-season view in Step 2
- tooltip explanations for comp gap and social signal
- inventory visibility in Step 2
- AI-generated summary labeling in Step 3
- top-level takeaways in Step 3
- richer product x channel detail in Step 3
- AI chat added to reviewed business screens
- SKU-aware comparative chart in Step 4
- event windows and promotion type in Step 4
- projected labeling for future events
- stronger event-detail business context

## Partial / still open

- strongest possible sentiment-led presentation in Step 1
- full product-specific competitor browsing in Step 1
- missed-opportunity storytelling packaged more clearly in Step 2
- full numeric sanity validation across the reviewed steps
- fully curated demo stories in Step 4
- perfect by-product vs total-portfolio handling in all event-detail experiences
- AI chat consistency across every major screen

---

# Part 2. Detailed Step-by-Step Explanation of the Application

## Important framing for this section

The transcript mainly reviewed Steps 1 to 4 in depth.

Steps 5 to 10 were not reviewed at the same level in the meeting, but their role in the application is still clear from the product structure.

So below:

- Steps 1 to 4 are explained both by product intent and by Ritesh’s explicit feedback
- Steps 5 to 10 are explained by the application structure and how they logically continue the intended storyline

---

## Step 1. Data Explorer

### Intent

This step exists to establish trust in the data foundation.

Before the app makes any conclusion, it shows the underlying data layers.

### What this step is trying to do

- prove that the analysis is grounded in real structured inputs
- show that competitor pricing is part of the system
- show that social sentiment is part of the system
- show that event/seasonality data exists and feeds later screens
- show that product and channel level behavior is actually modeled

### What each feature is trying to do

- **dataset list / explorer**
  - lets the user see the available data assets
  - proves breadth of data coverage

- **dataset preview**
  - makes the data tangible
  - reduces the feeling that later outputs are black-box results

- **visual summaries**
  - help the user quickly understand what the data represents
  - especially useful for competitor, social, and event data

- **AI screen assistant**
  - helps the user ask “which datasets prove X?”
  - reinforces the evidence-first positioning

### What Ritesh wanted specifically

He wanted this step to make it obvious that the app includes:

- competitor price data
- social sentiment, not just mentions
- seasonal/event data used later
- product-level inspection where relevant

### How this step connects to the next one

Once the user accepts the data foundation, the next logical question is:

**What is the business state right now?**

---

## Step 2. Current State Overview

### Intent

This is the portfolio-level business readout.

It shows the current business state and how it has evolved over the selected period.

### What this step is trying to do

- summarize current business health
- show the relationship between revenue and the three key levers
- let the user move between portfolio, product, and channel views
- reveal pressure points and opportunities

### What each feature is trying to do

- **product filter**
  - move between all products and specific product scopes

- **channel filter**
  - isolate channel-specific behavior
  - this was directly requested by Ritesh

- **lookback window**
  - compare long windows and current-season behavior
  - supports the in-season narrative

- **KPI cards**
  - provide an immediate top-line readout
  - make it easier for executives to orient quickly

- **Avg Comp Gap explanation**
  - prevent ambiguity around what “gap” means

- **Avg Social Buzz explanation**
  - clarify that the signal should be interpretable, not decorative

- **trend chart**
  - tie revenue to own price, competitor gap, social signal, and inventory
  - this is one of the most important screens in the app

- **channel mix chart**
  - show where revenue concentration sits

- **channel/product table**
  - translate the big picture into actionable detail

- **AI assistant**
  - help users ask for missed opportunities, strongest channels, or key patterns

### What Ritesh wanted specifically

He wanted this step to surface:

- the current business picture
- product/channel drillability
- competitor context
- social sentiment context
- in-season perspective
- inventory visibility
- and especially the idea of **missed opportunities**

Meaning:

If social sentiment is strong and pricing is still low, we may be over-discounting.

### How this step connects to the next one

The current-state screen shows the broad situation.

The next step answers:

**What exactly happened in the latest week?**

---

## Step 3. Last Week Performance Drilldown

### Intent

This step is the week-level operating review.

### What this step is trying to do

- explain the latest week in detail
- show how current performance is distributed across products and channels
- show week-over-week changes in our price, competition, and sentiment

### What each feature is trying to do

- **AI-generated summary**
  - give a top-level explanation immediately

- **key takeaways**
  - put the business meaning before the tables

- **latest-week KPI layer**
  - summarize the most recent operating result

- **product x channel table**
  - give the detailed operating view Ritesh wanted
  - show the 24 product x channel combinations

- **our price last week / this week / change**
  - make price movement explicit instead of vague “move” language

- **social signal relative to last week**
  - make the comparison logical and interpretable

- **revenue by channel with product selection**
  - let the user isolate contribution clearly

- **AI assistant**
  - help the user diagnose what happened this week

### What Ritesh wanted specifically

He wanted this screen to feel like a strong business review page, not just a dashboard.

That means:

- a top summary
- key takeaways first
- detailed SKU x channel evidence
- consistent naming
- believable numbers

### How this step connects to the next one

Once the weekly result is understood, the user naturally asks:

**What events, competitor moves, or social spikes explain this week?**

---

## Step 4. Event Calendar

### Intent

This is the explanation layer for timing and causality.

### What this step is trying to do

- connect business movement to events
- explain promotion outcomes
- explain competitor pressure
- explain seasonal/holiday effects
- explain social spikes

### What each feature is trying to do

- **event timeline**
  - show when important things happened

- **history + forward framing**
  - position the user between past evidence and future planning

- **competitive price chart**
  - show how our position evolved against the market
  - should be interpretable at both total and product level

- **social chart**
  - show how sentiment and elasticity signals moved

- **event detail panel**
  - convert a clicked event into a business explanation
  - include event window, promo type, units, revenue, and competition context

- **future event labeling**
  - prevent confusion between observed and projected behavior

- **story examples**
  - make the screen usable in a client demo, not only analytically useful

- **AI assistant**
  - answer questions like:
    - which promos failed?
    - where did social spikes create opportunity?
    - what happened during holidays?

### What Ritesh wanted specifically

He wanted this screen to go beyond raw chronology and become a storytelling layer.

He also wanted:

- seasonal names like Thanksgiving/Christmas called out
- clearer price-line meaning
- promotion type visible
- event windows clearly shown
- by-product and total-product inspection

### How this step connects to the next one

After understanding what happened and why, the next question becomes:

**Do different customer groups respond differently to these dynamics?**

---

## Step 5. Customer Cohorts

### Intent

This step introduces the customer lens.

### What this step is trying to do

- show that not all demand behaves the same way
- explain Mass vs Prestige customer structure
- support targeted promotion logic

### What each feature is trying to do

- **cohort views**
  - describe customer groups

- **cohort KPI views**
  - quantify economic differences between groups

- **Mass / Prestige framing**
  - align segmentation to the business narrative

### Why it matters in the storyline

The app is moving from:

- what happened in the business

to:

- who responds in different ways inside the business

---

## Step 6. Segment Response Comparison

### Intent

This step shows behavioral differences between segments.

### What this step is trying to do

- compare how segments react to price
- compare how segments react to competitor moves
- compare how segments react to social sentiment

### What each feature is trying to do

- **comparison visualizations**
  - show relative segment sensitivity

- **segment filters**
  - let the user isolate a cohort or behavioral axis

- **tables and detailed comparison**
  - support a more defendable explanation

### Why it matters in the storyline

This is where the app starts saying:

**The right promotion is not only product-specific. It is also customer-segment-specific.**

---

## Step 7. In-Season Planner Model Board

### Intent

This is the first major action step.

### What this step is trying to do

- model weekly promotion decisions
- show how inventory, competitor movement, social momentum, and cannibalization affect outcomes

### What each feature is trying to do

- **scenario cards**
  - give users starting decision templates

- **simulation controls**
  - test specific operating moves

- **inventory trajectory**
  - show what happens to stock under different actions

- **action tables**
  - identify where to defend, hold, or push

- **save and rank**
  - compare strategies under business objectives

### Why it matters in the storyline

The app is now moving from explanation into action.

This step answers:

**What should we do this week?**

---

## Step 8. End-of-Season Markdown Decision Models

### Intent

This step handles markdown planning near season end.

### What this step is trying to do

- decide markdown depth
- decide which SKUs should be included or excluded
- balance sell-through against margin and fatigue risk

### What each feature is trying to do

- **historical campaign evidence**
  - show which past actions worked

- **include/exclude policy**
  - narrow markdown scope

- **markdown ladder**
  - sequence the markdown over remaining weeks

- **repeat-risk / lag lab**
  - account for future downside of excessive promotion

- **save and rank**
  - compare markdown strategies

### Why it matters in the storyline

It extends the same evidence-led logic from in-season planning into end-of-season cleanup.

---

## Step 9. Portfolio Migration & Advanced Analysis

### Intent

This step broadens the lens from weekly execution to portfolio movement.

### What this step is trying to do

- show flow between Mass and Prestige
- show cannibalization across products
- compare strategic scenarios across growth/profit tradeoffs

### What each feature is trying to do

- **migration scenarios**
  - test strategic movement assumptions

- **migration matrices**
  - make the flows visible

- **ranking**
  - compare scenarios under different objectives

### Why it matters in the storyline

This step answers:

**Did our strategy create real value, or did it mostly shift value around the portfolio?**

---

## Step 10. AI Promotion Optimization Assistant

### Intent

This is the conversational layer on top of the system.

### What this step is trying to do

- make the system easier to query
- summarize recommendations in business language
- help users move faster through the evidence and scenarios

### What each feature is trying to do

- **chat UI**
  - provide a simple interaction layer

- **context-aware recommendations**
  - answer questions using loaded app context

- **SKU-level recommendation framing**
  - turn technical outputs into business guidance

### Why it matters in the storyline

The AI is not the core logic.  
The AI is the interface layer that makes the rest of the system easier to use.

---

## Final Application Understanding

The best single-sentence explanation of the application is:

This is a guided promotion reasoning system that starts by proving the data, then explains current and recent business performance, connects outcomes to events and sentiment, adds customer behavior differences, and finally helps the user simulate and rank better promotion decisions.

That is the intended story of the application, and that is the direction Ritesh was pushing in the meeting.
