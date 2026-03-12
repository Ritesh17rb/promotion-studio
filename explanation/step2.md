# Step 2: Data Explorer

## What we are doing in this step
We are exposing the raw market and demand signals that sit underneath the scenario logic. This step makes the model explainable because it shows what the outside world is doing before we make any pricing move ourselves.

This step answers:
- what competitors are doing,
- what the brand social signal is doing,
- and what the portfolio would experience even if we kept our own promo unchanged.

## Current example from this build
- Avg competitor price in mass: `$19.11`
- Avg competitor price in prestige: `$31.36`
- Brand social score: `57.7`
- Social trend: `+3.9 pts WoW`

Shock-only view at live week 7:
- Baseline units: `1,599`
- Shock-only units: `1,584.5`
- Total shock-only delta: `-0.9%`

Top current negatives in the shock-only view:
- `Invisible Mist SPF 50`: `-3.5` units
- `Hydra Daily Lotion`: `-3.2` units
- `Daily Shield SPF 40`: `-2.3` units

## What each feature is doing

### In-Season Pivot Signal Lab
This is the main signal-monitoring block for Step 2.

What it conveys:
- the model is reacting to live market inputs,
- not inventing scenario changes in a vacuum.

### Avg Competitor Price Cards
These show current competitor pricing by channel context.

What they convey:
- `Mass` at `$19.11` signals the lower-price lane,
- `Prestige` at `$31.36` signals a higher-price lane,
- and the gap between those tells us where we may need to defend share versus where we may still protect brand price.

### Brand Social Score
This is the current brand momentum reading.

What it conveys:
- how much natural demand support the brand currently has,
- independent of price cuts.

At `57.7`, the brand has moderate momentum, not a peak spike.

### Social Trend
This shows direction, not just level.

What it conveys:
- the brand is improving by `+3.9 pts` week over week,
- so pricing pressure may be easing slightly because the brand is getting more organic support.

## What each chart, graph, and table means

### Competitive Price Delta Trend
This is the history of our price position versus competitors over time.

How to read it:
- when the delta moves against us, competitors are becoming more aggressive,
- when it improves, our relative price position is less pressured.

What it conveys:
- whether price pressure is a one-week issue or a sustained market pattern.

### Social Score and Elasticity Modifier
This is one of the most important bridge charts in the app.

How to read it:
- social score is the demand signal,
- elasticity modifier shows how price sensitivity changes as that signal rises or falls.

What it conveys:
- stronger brand momentum reduces effective elasticity,
- which means consumers are less price-sensitive,
- which later supports firmer pricing in advanced scenarios.

### Signal Change Log
This translates changes in market and social inputs into short commentary.

What it conveys:
- a fast narrative of what changed this week without forcing the user to decode every chart manually.

### Method Note
This explains how the signal calculations are built.

What it conveys:
- the logic is auditable,
- and the signal layer is grounded in measurable inputs.

### SKU Shock-Only Projection (No Own Promo Change)
This isolates external pressure from our own actions.

How to read it:
- `Baseline` = expected units with no extra market shock,
- `Shock-Only` = what happens after competitor and social inputs are applied,
- our own promo policy is kept unchanged.

What it conveys:
- the market alone is already causing some pressure.

Current business reading:
- baseline is `1,599` units,
- shock-only drops to `1,584.5`,
- a `-0.9%` delta,
- so even before we change our own offer, external conditions are slightly negative.

The SKU list underneath shows where that pressure is concentrated. For example:
- `Invisible Mist SPF 50` is down `-3.5` units,
- `Hydra Daily Lotion` is down `-3.2`,
- so these are current candidates for closer attention in later steps.

### Dataset Viewer
This is the raw table browser for the loaded files.

What it conveys:
- the app is transparent,
- users can inspect source rows, search them, and export them,
- which is important when someone asks where a number came from.

## What this step is trying to achieve
Step 2 is trying to answer:

“What is the market already doing to us before we take any action?”

That matters because a bad outcome can come from external pressure, not from our own pricing decision. This step separates those two things.
