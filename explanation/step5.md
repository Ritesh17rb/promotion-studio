# Step 5: Segment Response Comparison

## What we are doing in this step
We are comparing segments side by side so we can choose where discounts are efficient and where they are wasted. This step is less about broad customer mapping and more about ranking segments for action.

This step answers:
- which segments are most promo-responsive,
- which are too discount-dependent,
- and which should be prioritized or avoided in campaign design.

## Current example from this build
Examples from prestige-channel elasticity:
- `promo_triggered / value_seeker / single_sku_staple`: acquisition elasticity `-2.84`
- `promo_triggered / deal_hunter / multi_sku_builder`: `-2.82`
- `promo_triggered / prestige_loyalist / multi_sku_builder`: `-2.82`

Examples of lower repeat-loss sensitivity:
- `seasonal_first_time / prestige_loyalist / value_bundle_buyer`: `0.454`
- `influencer_discovered / prestige_loyalist / single_sku_staple`: `0.459`

## What each feature is doing

### Axis Selector
This changes the comparison lens between acquisition, engagement, and monetization.

What it conveys:
- segment attractiveness depends on the business objective,
- so the “best” segment changes with the question being asked.

### Channel Group Selector
This keeps the comparison within mass or prestige.

What it conveys:
- segment behavior should not be generalized across channel environments.

### Product Selector
This narrows the comparison to all products or one selected product.

What it conveys:
- a segment can behave one way for the portfolio and another way for a specific SKU.

### Sort Selector
This changes ranking order for the segment list.

What it conveys:
- the user can prioritize elasticity, customer size, repeat-loss, or AOV depending on the decision.

### Segment Comparison Table
This is the main ranking table in the step.

What it shows:
- segment identity,
- elasticity,
- risk level,
- and supporting metrics such as size or value.

What it conveys:
- which segments are worth targeting first,
- and which segments carry too much pricing risk.

## What each chart, graph, and table means

### Elasticity Comparison Chart
This is the visual version of the segment ranking.

How to read it:
- each bar is a segment,
- the y-axis is `Absolute Elasticity`,
- taller bars mean the segment reacts more strongly to price,
- bar color signals risk level.

What it conveys:
- which segments are most responsive,
- and whether that responsiveness comes with high or manageable risk.

Current reading from this build:
- the strongest acquisition-response examples are around `-2.84` to `-2.82`,
- so those segments are very price-sensitive and likely to move with discounts,
- but that also means they can become expensive to sustain if overused.

The lower repeat-loss sensitivity examples around `0.454` to `0.459` are useful because they indicate segments that are less fragile from a retention standpoint.

## What this step is trying to achieve
Step 5 is trying to answer:

“If we cannot target everyone the same way, which segments give us the best commercial return from promotion?”

This step is the prioritization layer between broad cohort understanding and actual campaign design.
