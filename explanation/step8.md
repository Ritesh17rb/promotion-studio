# Step 8: Portfolio Migration & Advanced Analysis

## What we are doing in this step
We are testing advanced scenarios that combine cross-channel movement, internal SKU migration, week-5 reforecasting, and social-driven pricing power. This is the most strategic step in the app because it turns the scenario library into a management decision view.

This is also the step that directly answers the two client asks:
- what sales look like after `5` weeks and how the rest of the season changes,
- how social momentum changes elasticity and therefore pricing power.

## Current examples from this build

Scenario library:
- `9` scenarios total

Example scenario price moves:
- `Mass Defensive Promo`: `-16.5%`
- `Prestige Hold During Social Spike`: `0.0%`
- `Sunscreen Summer Launch Push`: `-11.0%`
- `Post-Promo Step-Up`: `+8.0%`
- `Prestige Reprice With Competitor Softness`: `+7.0%`

Week-5 actuals by scenario scope:
- Mass-channel portfolio: `4,766` units sold, `14.4%` sell-through, `11,246` units still remaining after week 5
- Prestige-channel portfolio: `3,067` units sold, `13.7%` sell-through, `7,634` units remaining
- Sunscreen portfolio in mass: `2,701` units sold, `14.7%` sell-through, `6,458` units remaining
- Sunscreen SKU-1 in mass: `1,061` units sold, `14.7%` sell-through, `2,588` units remaining
- Prestige moisturizer: `1,436` units sold, `13.1%` sell-through, `3,614` units remaining
- Omni-channel portfolio: `7,833` units sold, `14.1%` sell-through, `18,880` units remaining

Scenario-start social examples:
- `Mass Defensive Promo`: `70.49`
- `Prestige Hold During Social Spike`: `71.10`
- `Sunscreen Summer Launch Push`: `51.67`
- `Sunscreen SKU-1 Capture Strategy`: `52.51`

## What each feature is doing

### Scenario Selection and Simulation
This is where we choose the business hypothesis to test.

What it conveys:
- advanced analysis is scenario-led,
- so the user is comparing alternative commercial moves rather than one single forecast.

### Result Summary Cards
These are the quick readouts after simulation.

What they convey:
- whether the scenario looks attractive before the user goes deeper into migration, reforecast, or social effects.

### Migration Policy Controls
These controls let the user adjust migration intensity, depth, competitor pressure, and media or social context.

What they convey:
- migration is not assumed to be fixed,
- it can strengthen or weaken depending on scenario conditions.

### Policy Comparison Table
This compares different policy stances.

What it conveys:
- unit lift and profit effect can move differently,
- so the right policy depends on strategic objective, not just top-line lift.

### Tier Flow Table
This shows movement such as:
- mass to prestige,
- prestige to mass,
- exits.

What it conveys:
- whether the scenario improves channel mix,
- or whether it is creating leakage and downgrading behavior.

### Route Intensity Diagram
This visualizes the strength of movement across routes.

What it conveys:
- where the portfolio is gaining or losing movement intensity,
- which is easier to see visually than in a numeric table.

### Migration Matrix
This is the cannibalization or movement heatmap for advanced scenarios.

What it conveys:
- how much of the gain is true external win versus internal reallocation.

### Scenario Comparator
This is the saved-scenario comparison layer.

What it conveys:
- leadership can compare multiple commercial options side by side instead of deciding from one isolated simulation.

### Ranking Objective
This changes the lens for ranking saved scenarios.

What it conveys:
- the best scenario depends on whether we care most about balanced performance, growth, or profit protection.

### Ranked Scenarios Table
This is the executive decision table.

What it conveys:
- a structured choice set rather than a free-form recommendation.

## What each chart, graph, and table means

### 5-Week Checkpoint and Remaining-Season Reforecast
This is the first major client-requested feature.

What it shows:
- how much has already sold by week 5,
- current sell-through at that point,
- remaining inventory after week 5,
- and what the rest of the season looks like from that checkpoint onward.

What it conveys:
- the client does not just want a full-season projection,
- they want to see the current in-season position and then the reforecast from there.

For example:
- in the mass-channel portfolio, `4,766` units are already sold by week 5,
- sell-through is `14.4%`,
- and `11,246` units still remain,
- so the real management question is what to do with the remaining season from that point.

### Week-5 KPI Cards
These summarize the checkpoint before the chart.

What they convey:
- actual progress already achieved,
- and how much business is still left to influence.

### After 5 Weeks tab
This is the default commercial reforecast tab.

What it conveys:
- the primary framing is "What do we do now that week 5 has passed?"

### Sales Outlook After Week 5
This is the central week-5 chart.

How to read it:
- `Actual cumulative sold (weeks 1-5)` = what has already happened,
- `Baseline projection` = rest-of-season path if no selected scenario is applied,
- `Scenario (price only)` = the effect of the selected price move without current social trend,
- `Selected scenario + current trend` = the selected scenario with current social support,
- `Cooling-off trend case` = weaker momentum case,
- `Viral spike case` = stronger momentum case.

What it conveys:
- the chart is not just showing actual sales,
- it is showing how the remaining season branches into different futures from the same week-5 starting point.

### Scenario Readout from Week 5
This is the number table behind the week-5 chart.

What it shows:
- remaining-season units,
- remaining-season revenue,
- baseline difference,
- and other rest-of-season readouts.

What it conveys:
- exact commercial impact, not just curve shape.

### Social Pricing Power
This is the second major client-requested feature.

What it conveys:
- social media is not treated as a side metric,
- it changes effective elasticity and therefore changes how confidently the brand can price.

Current example:
- a scenario starting with social score `71.10` has stronger natural support for firmer pricing than one starting around `51.67`.

### Social Score vs Elasticity and Price Headroom
This is the main social-to-pricing chart.

How to read it:
- bars = `Price headroom %`,
- line = `Effective elasticity`.

What it conveys:
- as social momentum improves, effective elasticity becomes less severe,
- and price headroom increases,
- which means the brand can hold or raise price more confidently.

### Social-to-Elasticity Bridge
This is the detailed bridge table for the same idea.

What it shows:
- current social score,
- trend versus prior period,
- base elasticity,
- effective elasticity,
- scenario price move,
- demand tailwind,
- pricing headroom.

What it conveys:
- the recommendation is economically linked,
- not just visually correlated.

### KPI Comparison
This is the first saved-scenario comparison view.

What it conveys:
- headline performance can be compared across scenarios before diving into trade-offs.

### Multi-Dimensional Trade-offs
This is the broader scenario comparison chart.

What it conveys:
- different scenarios can win on different dimensions,
- so the "best" answer depends on which trade-off the business accepts.

### Week-5 Anchored Scenario Projection
This appears after multiple scenarios are saved.

How to read it:
- `Actual cumulative sold (weeks 1-5)` is common to all,
- `Baseline projection` is the common reference path,
- each additional line is a saved scenario's projected path from the same checkpoint.

What it conveys:
- this is the clearest answer to "how does the rest of the season change across scenarios?"

### Executive Reforecast by Scenario
This is the side-by-side rest-of-season table for saved scenarios.

What it conveys:
- units, revenue, baseline gap, and social headroom can be compared in one executive table.

## What this step is trying to achieve
Step 8 is trying to answer:

"From the current season checkpoint, which advanced pricing scenario gives us the best rest-of-season outcome, and how much pricing confidence do we get from current brand momentum?"

This is the most important decision step for the client because it combines scenario planning, reforecasting, and social-driven pricing logic in one place.
