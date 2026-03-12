# Step 4: Customer Cohorts

## What we are doing in this step
We are segmenting the customer base so we can stop treating all demand as if it behaves the same way. This step shows which customer groups are more price-sensitive, which groups are more valuable, and which groups are more at risk of repeat-loss.

This step answers:
- who should receive promo support,
- who can tolerate firmer pricing,
- and where the business is taking avoidable retention risk.

## Current example from this build
- Total customers in segmentation data: `15,000`
- Mass customers: `7,491`
- Prestige customers: `7,509`
- Unique segment keys: `125`

Average cohort performance:
- Mass AOV: `$34.93`
- Prestige AOV: `$44.62`
- Mass repeat-loss: `13.08%`
- Prestige repeat-loss: `12.56%`

Example high-risk prestige cohorts:
- `routine_refill / channel_switcher / multi_sku_builder`: `17.9%` repeat loss, `1,441` customers
- `gift_buyer / channel_switcher / multi_sku_builder`: `17.9%` repeat loss, `1,333` customers

Example high-value prestige cohorts:
- `promo_triggered / prestige_loyalist / multi_sku_builder`: `$57.88` AOV, `1,459` customers
- `influencer_discovered / channel_switcher / value_bundle_buyer`: `$57.88` AOV, `791` customers

## What each feature is doing

### Channel Group Selector
This switches the analysis between mass and prestige.

What it conveys:
- customer behavior is not uniform across channel context,
- so segmentation should be channel-aware.

### Axis Selector
This changes the segmentation lens between acquisition, engagement, and monetization.

What it conveys:
- the same cohorts can be studied for growth, loyalty, or value quality depending on the business question.

### Visualization Selector
This switches between the major cohort visuals.

What it conveys:
- there is more than one good way to read segment behavior,
- and each visual answers a slightly different management question.

### Filter Pills
These isolate cohorts by sensitivity, risk, or basket/value style.

What they convey:
- the step can be used as a targeted decision tool, not just a passive report.

### Recommendation Card
This is the strategic readout for the current cohort view.

What it conveys:
- the analysis should change promo and pricing posture,
- not stay at descriptive segmentation only.

### Cohort KPI Dashboard
This summarizes size, value, and risk for the visible cohort set.

What it conveys:
- which cohort groups matter commercially,
- because the highest-risk group is not always the biggest group, and the biggest group is not always the most valuable.

## What each chart, graph, and table means

### Cohort Elasticity Heatmap
This is the fastest way to spot where promotion is likely to work.

How to read it:
- darker or more intense cells indicate stronger elasticity,
- rows represent segments,
- columns represent tiers or cohort categories depending on the active lens.

What it conveys:
- where demand is highly price-sensitive,
- so those are places where discounts may drive response,
- but also places where the business may become too discount-dependent.

### 3-Axis Cohort Map
This is the strategic summary view of the cohort landscape.

How to read it:
- the visual combines multiple cohort dimensions at once,
- typically size, sensitivity, and risk/value.

What it conveys:
- which cohorts are both big enough to matter and important enough to act on.

### Cohort Scatter: Customers vs Elasticity
This compares group size and sensitivity directly.

How to read it:
- larger points or positions indicate bigger cohorts,
- elasticity shows how strongly they react to price.

What it conveys:
- the biggest opportunity is usually where a cohort is both large and meaningfully sensitive,
- not simply the most elastic small niche.

### Bar: Elasticity by channel
This compares price elasticity at channel level.

What it conveys:
- which retail routes are more responsive to price moves,
- and whether a uniform channel strategy would be too blunt.

### Heatmap: Channel x Elasticity & group
This combines channel and group information in one matrix.

What it conveys:
- not only which channels are more elastic,
- but whether that elasticity sits in mass or prestige context.

### Channel summary (elasticity & tier)
This is the compact interpretation table for the channel view.

What it conveys:
- the key price-sensitivity pattern by route to market,
- without forcing the user to infer everything from charts alone.

### Selected Cohort Insight
This gives interpretation for the highlighted cohort.

What it conveys:
- why the cohort matters,
- and how the team should treat it.

### Customer group watchlist
This is the risk-monitoring list.

What it conveys:
- which groups are most exposed under current conditions,
- especially when repeat-loss is high or value contribution is important.

In this build, the watchlist is especially useful for explaining why certain prestige cohorts need careful handling:
- a `17.9%` repeat-loss cohort should not be pushed with blunt discounting if it also has meaningful customer count,
- while a `$57.88` AOV cohort deserves protection because it contributes premium value.

## What this step is trying to achieve
Step 4 is trying to answer:

“Which customer groups should we stimulate, which should we protect, and which are at risk if we use the wrong pricing approach?”

This is the customer intelligence layer behind later pricing and scenario recommendations.
