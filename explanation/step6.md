# Step 6: In-Season Planner Model Board

## What we are doing in this step
We are converting the current in-season state into a weekly operating plan. Step 1 tells us the current position. Step 6 turns that position into specific next-cycle recommendations by product and channel.

This step answers:
- what to do this week,
- which products to push,
- which to hold,
- and how that changes the inventory path to the season horizon.

## Current example from this build
This step is fed from the live week 7 state:
- Total units: `1,599`
- Revenue: `$38,633.46`
- Inventory left: `44,607`
- Sunscreen: `891` units
- Moisturizer: `708` units

## What each feature is doing

### Model Input Required State
This warning appears when Step 1 has not been run.

What it conveys:
- the planner depends on the live scenario context,
- so it is a downstream operating tool, not an isolated screen.

### Start-of-Season to In-Season Pivot Alert
This explains what the planner is recalculating.

What it conveys:
- the model is taking the current week and re-optimizing from here,
- rather than pretending we are starting the season from zero.

### Four-Model Summary Cards
These are the top cards:
- `Model 1: Own Promo Effect`
- `Model 2: Competitor Delta`
- `Model 3: Social Momentum`
- `Model 4: SKU Migration`

What they convey:
- which driver is moving the weekly plan most,
- and whether the decision is being driven by our own action, the market, brand momentum, or internal cannibalization.

### Model Mechanics Panel
This explains the planning logic in plain language.

What it conveys:
- promo changes affect units through elasticity,
- competitor price gaps affect conversion,
- social momentum reduces elasticity drag,
- SKU asymmetry creates cannibalization.

### In-Season Action Model
This is the main recommendation table.

What it conveys:
- exact promo posture by product and channel,
- plus the reason behind each recommendation.

It is useful because it does not only say “promote more” or “promote less”; it says why, using elasticity, gap versus competitor, social support, and cannibal flow.

## What each chart, graph, and table means

### Season Trajectory to Week Horizon
This is the planner’s inventory runway table.

How to read it:
- each row is a future week,
- it shows competitor average price, social score, baseline inventory left, scenario inventory left, and the gap between them.

What it conveys:
- how the current decision changes the remaining season path,
- not just the current week.

### Simulation Lab: Test Weekly Actions
This is the interactive weekly planning sandbox.

What it conveys:
- the user can test different weekly postures such as balanced, competitor defense, or social momentum push.

### Inventory Runway Diagram
This chart shows inventory left from the current week to the planning horizon.

How to read it:
- one line is baseline inventory left,
- one line is simulated inventory left.

What it conveys:
- whether the weekly action is actually improving stock runoff,
- and how quickly that effect compounds through the rest of the season.

### SKU Lift Diagram
This chart shows expected lift by SKU under the simulated weekly action.

What it conveys:
- which products are carrying the benefit,
- and which products are not responding enough to justify extra discounting.

### Weekly Action Table
This is the execution table under the simulation lab.

What it shows:
- simulated mass promo,
- simulated prestige promo,
- simulated unit lift,
- cannibal net,
- and an action cue.

What it conveys:
- what to do SKU by SKU in the next decision cycle.

## What this step is trying to achieve
Step 6 is trying to answer:

“Given where we are right now in the season, what weekly operating action should we take by product and channel?”

This is the tactical execution layer of the app.
