# Step 7: End-of-Season Markdown Decision Models

## What we are doing in this step
We are deciding how to finish the season without using a blunt markdown strategy. This step combines historical promo evidence, SKU policy logic, markdown sequencing, and repeat-risk trade-offs.

This step answers:
- whether markdown is needed,
- which SKUs should be included,
- how deep markdown should go,
- and how much future repeat-risk or margin pressure that creates.

## Current example from this build
Latest aggregated tier week: `2026-05-25`

At that point:
- Mass units sold: `651`
- Prestige units sold: `485`
- Mass revenue: `$12,992.31`
- Prestige revenue: `$15,528.25`
- Markdown risk:
  - Mass: `0.72`
  - Prestige: `0.72`

## What each feature is doing

### Markdown Scenario Logic
This tests end-of-season markdown paths against the current inventory position.

What it conveys:
- markdown is a controlled decision ladder,
- not just a last-minute blanket discount.

### Narrative Coverage by Phase
This summarizes campaign evidence by story phase.

What it conveys:
- whether the markdown policy is leaning on a broad set of evidence or only one part of the season.

### Model A: Historical Campaign Effectiveness
This is the top historical proof table.

What it conveys:
- which past campaigns actually produced uplift,
- and which channels or products responded best.

### Model B: SKU Include/Exclude Policy for Markdown
This is the core markdown inclusion logic.

What it shows:
- SKU,
- campaign count,
- up/down history,
- average uplift,
- best channel,
- inventory,
- suggested depth,
- and final policy.

What it conveys:
- markdown should be selective,
- and broad markdown should not include products with weak evidence or poor economics.

### Model C: End-of-Season Markdown Ladder
This is the planned markdown path across the final weeks.

What it conveys:
- how markdown depth should build over time,
- while keeping an explicit margin floor and clearance target in view.

### Decision Summary
This is the business-readable action summary.

What it conveys:
- which products should stay in the markdown pool,
- and which should be pulled out.

## What each chart, graph, and table means

### Clearance vs Margin Comparison
This is the core trade-off idea of the step.

What it conveys:
- deeper markdown can improve clearance,
- but only at the cost of margin,
- so the right choice depends on how much inventory risk remains and how valuable the product is.

### Simulation Lab: Markdown Decisioning
This is the interactive markdown sandbox.

What it conveys:
- the user can test strictness, phase focus, channel focus, aggressiveness, and margin floor in one place.

### Policy Mix Diagram
This chart shows how many SKUs are falling into include, hold, or exclude policy states.

What it conveys:
- whether the markdown plan is concentrated on a small targeted set,
- or spreading too broadly across the portfolio.

### Markdown Ladder Diagram
This chart shows the markdown path and inventory runoff over the remaining weeks.

How to read it:
- later weeks usually carry deeper markdown,
- while projected units left decline over time.

What it conveys:
- whether the ladder is strong enough to clear stock without breaking the guardrails.

### Lagged Repeat-Risk Diagram
This chart shows the delayed customer-risk effect of markdown and promo pressure.

What it conveys:
- aggressive discounting may clear units now,
- but can create repeat-loss or churn-style damage later.

### Repeat-Risk Elasticity Lab (Churn in Promo Context)
This tests how price posture, promo fatigue, and social protection affect repeat-loss over time.

What it conveys:
- markdown decisions should not only be judged on clearance,
- they should also be judged on customer damage and revenue drag over the next `12` weeks.

### Markdown Simulation Tables
These tables show:
- simulated policy by SKU,
- simulated ladder by week.

What they convey:
- exactly what the chosen markdown strategy would do operationally.

## What this step is trying to achieve
Step 7 is trying to answer:

"How do we finish the season cleanly, clear inventory responsibly, and avoid creating unnecessary margin and repeat-demand damage?"

This is the controlled end-of-season decision layer of the app.
