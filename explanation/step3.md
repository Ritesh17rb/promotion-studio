# Step 3: Event Calendar

## What we are doing in this step
We are turning the season into a business timeline. Instead of looking at one isolated week, this step shows the sequence of competitor moves, tentpole moments, promo pushes, and social spikes that shaped performance.

This step answers:
- what happened,
- when it happened,
- and what those moments teach us about future action.

## Current example from this build
- Total events: `26`
- Tentpoles: `6`
- Competitor moves: `5`
- Promo or social-spike events: `15`
- Total campaigns: `6`

Campaign story mix:
- baseline: `2`
- pivot: `3`
- future: `1`

Average uplift from historical campaign outcomes:
- overall average SKU uplift: `+9.4%`
- Sephora: `+12.8%`
- Amazon: `+11.9%`
- Target: `+10.1%`
- Ulta: `+4.6%`

## What each feature is doing

### Event Type Filters
These narrow the timeline to event classes such as tentpoles, competitor moves, or promo moments.

What they convey:
- the user can isolate the story they care about instead of looking at one crowded timeline.

### Event Timeline
This is the main season-story visual.

How to read it:
- events are plotted on a time axis,
- so the audience can see not only what happened, but in what sequence.

What it conveys:
- commercial decisions are time-sensitive,
- and outcomes should be interpreted in the context of nearby market events.

### Event Details Table
This is the reference view for the selected event stream.

What it conveys:
- exact dates, channels, event types, and notes,
- which is useful when a stakeholder asks for the specific evidence behind the story.

### Event Analyst (LLM)
This is the event-specific assistant.

What it conveys:
- the app can explain the likely impact of a chosen event in plain business language,
- and it can suggest how the team should pivot.

## What each chart, graph, and table means

### Competitive Price Delta Trend (Our vs Competitor)
This shows the competitive pricing context over time.

What it conveys:
- whether a given event happened in a calm pricing environment or during active competitor pressure.

### Social Momentum and Elasticity Signal
This shows the timing of social strength or weakness.

What it conveys:
- whether the brand had enough natural momentum to support firmer pricing during a campaign window.

### Campaign Story Mix (Start vs Pivot vs Future)
This shows how campaigns were distributed across the season narrative.

How to read it:
- `Start` means foundation or baseline campaigns,
- `Pivot` means reactive or in-season adjustments,
- `Future` means forward-looking or strategic campaigns.

What it conveys:
- in this build, the portfolio leaned more toward `pivot` actions (`3`) than `future` actions (`1`),
- which suggests the season was managed more reactively than proactively.

### Average Promo Uplift by Retail Channel
This compares historical channel response to campaigns.

How to read it:
- higher uplift means that channel historically converted promo activity more efficiently.

What it conveys in this build:
- Sephora and Amazon were the strongest response channels,
- Ulta was materially weaker,
- so a future campaign does not need equal channel treatment.

### Promo Campaign Cards
These summarize each campaign in an easy-to-read business format.

What they convey:
- campaign goal,
- timing,
- discount logic,
- target vs actual,
- and a short read on whether the campaign performed well.

### View SKU + Channel Outcomes
This opens the campaign drilldown below the cards.

What it conveys:
- campaign performance should not only be judged at total level,
- we also need to know which SKUs and which channels drove or dragged the result.

### Promo Outcome Matrix (Product x Channel Uplift)
This is the most direct evidence table in the campaign section.

How to read it:
- rows are products,
- columns are channels,
- each cell shows uplift or underperformance.

What it conveys:
- where each product has historically worked best,
- and where it should probably not be pushed again.

### Promo Policy Extractor (From Historical Outcomes)
This converts campaign history into action rules.

What it conveys:
- which SKUs have earned inclusion in future promo plans,
- and which ones should be excluded because they do not generate efficient lift.

## What this step is trying to achieve
Step 3 is trying to answer:

“When we look back across the season, which moments changed the commercial story, and what should that teach us about the next campaign?”

This step adds timing and context to the pricing decisions shown elsewhere in the app.
