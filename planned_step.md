# Planned Steps: Promotion Studio Improvements

## Based on: Ritesh Aggarwal's Review Feedback (Mar 13, 2026 Demo)

---

## Core Problem

The application treats products as **generic aggregates** (channel-level averages) instead of showing **product-specific** data. Ritesh's recurring feedback: *"bring that element of multiple products on every screen."*

There are **6 SKUs** in the data (`sku_channel_weekly.csv`): 3 Sunscreens (SUN_S1, SUN_S2, SUN_S3) and 3 Moisturizers (MOI_M1, MOI_M2, MOI_M3), across 2 channels (Mass, Prestige). The data exists — it's just not surfaced in the UI.

---

## Step 1: Fix Inventory Projection Chart — Show Historical + Projected

**Transcript Reference:** Lines 98–114
> *"Week 1 to week six being actual sales... one line for that... Week seven onward is your projection. So there will be two lines — baseline and scenario."*

**What's Wrong:**
- The inventory/revenue projection chart currently starts at week 7 (future only)
- No historical context shown

**Changes Required:**
- **File:** `js/channel-promo-simulator.js` (inventory/projection chart rendering)
- Modify the projection chart to start from **Week 1**
- Week 1–6: Single line showing **actual sales** (historical data from `sku_channel_weekly.csv`)
- Week 7–17: Two lines — **baseline projection** (blue) and **scenario projection** (green)
- The transition point (week 6→7) should be visually marked (e.g., dashed vertical line or label "Current Week")

---

## Step 2: Add Product Group / SKU Dropdown Filter to Step 1 (Channel Simulator)

**Transcript Reference:** Lines 116–138
> *"Think about whether it's two or three and show prices for them."*
> *"There are six products... What is the number of products?"*

**What's Wrong:**
- Step 1 simulator only has Sunscreen/Moisturizer product group toggles but **no individual SKU selection**
- The discount sliders apply generically to the entire channel, not per-product

**Changes Required:**
- **File:** `js/channel-promo-simulator.js`
- **File:** `index.html` (Step 1 section)
- Add a **Product Group** multi-select (Sunscreen, Moisturizer, or All)
- Add a **SKU** dropdown within each product group to drill down to individual products
- When a specific SKU is selected, show its metrics; when "All" is selected, show each SKU in a table/cards
- Discount sliders should indicate which product(s) the discount applies to

---

## Step 3: Show Competitor Prices Per Product (Not Generic Average)

**Transcript Reference:** Lines 118–126
> *"Average competitor price — which product's price is that 18.98 or 30.28? You should show prices for all of this."*

**What's Wrong:**
- Competitor price is shown as a single generic number
- User can't tell which product's competitor price they're looking at
- `competitor_price_feed.csv` has competitor prices but not broken down per SKU
- `sku_channel_weekly.csv` **does** have `competitor_price` per SKU per channel per week

**Changes Required:**
- **File:** `js/channel-promo-simulator.js` (price display section)
- **File:** `js/app.js` (data binding)
- Replace single "Average Competitor Price" display with a **per-product price table/cards**:
  ```
  | Product           | Our Price | Competitor Price | Gap   |
  |-------------------|-----------|------------------|-------|
  | Daily Shield SPF40| $18.98    | $17.50           | +$1.48|
  | Invisible Mist    | $22.50    | $21.00           | +$1.50|
  | Sport Gel SPF60   | $30.28    | $29.00           | +$1.28|
  | Hydra Daily Lotion| $24.00    | $23.50           | +$0.50|
  | Barrier Repair    | $28.00    | $27.00           | +$1.00|
  | Night Recovery    | $35.00    | $33.50           | +$1.50|
  ```
- Use data from `sku_channel_weekly.csv` columns: `list_price`, `effective_price`, `competitor_price`, `price_gap`

---

## Step 4: Make Competitor Price Drop Scenarios Product-Specific

**Transcript Reference:** Lines 221–228
> *"I don't know which product's price has been dropped by competitor. These scenarios have to be either for all sunscreens or a specific sunscreen."*

**What's Wrong:**
- The competitor price change slider/scenario is applied generically
- No indication of which product the competitor price change affects
- Impact should be shown per-product or per-product-group

**Changes Required:**
- **File:** `js/channel-promo-simulator.js` (competitor price section)
- **File:** `js/event-calendar.js` (event analysis)
- Add a **product selector** next to the competitor price change slider
  - Options: "All Products", "Sunscreen (All)", "Moisturizer (All)", or individual SKUs
- When a competitor price change is applied, show **per-product impact** on revenue/profit
- In Event Calendar (Step 3): when showing "Competitor Price Drop" events, specify **which product/category** was affected

---

## Step 5: Add Product & Channel Filters to Elasticity Models (Steps 4, 5, 6)

**Transcript Reference:** Lines 300–311
> *"There needs to be another filter for product because the elasticity will be different for different products and different channels. So there will be two more filters — product and channel."*

**What's Wrong:**
- Acquisition Elasticity (Step 4), Churn Elasticity (Step 5), and Migration Model (Step 6) have **no product filter**
- Elasticity is calculated at channel level only (`elasticity-params.json` has `ad_supported` and `ad_free`)
- Different products (sunscreen vs moisturizer) likely have different price elasticities

**Changes Required:**
- **File:** `js/acquisition-simple.js`
- **File:** `js/churn-simple.js`
- **File:** `js/migration-simple.js`
- **File:** `js/elasticity-model.js`
- **File:** `data/elasticity-params.json` (add per-SKU elasticity parameters)
- **File:** `index.html` (add filter dropdowns to Steps 4, 5, 6)

**Implementation:**
1. Add **Product dropdown** and **Channel dropdown** to each elasticity step's UI
2. Extend `elasticity-params.json` to include per-SKU elasticity coefficients:
   ```json
   {
     "sku_elasticity": {
       "SUN_S1": { "mass": -2.30, "prestige": -1.55 },
       "SUN_S2": { "mass": -2.10, "prestige": -1.40 },
       "SUN_S3": { "mass": -1.95, "prestige": -1.30 },
       "MOI_M1": { "mass": -2.40, "prestige": -1.60 },
       "MOI_M2": { "mass": -2.20, "prestige": -1.45 },
       "MOI_M3": { "mass": -2.05, "prestige": -1.35 }
     }
   }
   ```
3. Update elasticity calculation functions to accept SKU parameter
4. Demand curve, survival curve, Sankey diagram should all re-render when product/channel filter changes

---

## Step 6: Add Product Filter to Scenario Engine & Comparison (Steps 7, 8)

**Transcript Reference:** Lines 281–311 (general requirement for all screens)

**What's Wrong:**
- Scenario simulation and comparison don't break results down by product
- All scenarios are channel-level ("What if we discount Mass channel by 10%?")
- Cannot run product-specific scenarios ("What if we discount only sunscreens?")

**Changes Required:**
- **File:** `js/scenario-engine.js`
- **File:** `js/decision-engine.js`
- **File:** `js/app.js` (scenario UI)
- **File:** `data/scenario.json` (add product-specific scenario templates)
- Add product filter to scenario builder
- Show scenario impact **per product** in results table
- In scenario comparison (Step 8), allow comparing product-specific scenarios

---

## Step 7: Update Event Calendar with Product-Level Detail

**Transcript Reference:** Lines 198–228

**What's Wrong:**
- Promo events and competitor actions are shown without product specificity
- "Competitor dropped price from $22 to $19" — but which product?

**Changes Required:**
- **File:** `js/event-calendar.js`
- **File:** `data/retail_events.csv` (add SKU/product_group column if missing)
- **File:** `data/promo_metadata.json` (already has some SKU detail — surface it)
- Show **product name** alongside each event
- Add product filter to the event timeline view
- In the "Analyze Event" section, show per-product impact tables

---

## Step 8: Adapt Price Elasticity Demo for Retail Context

**Transcript Reference:** Lines 269–311
> *"I need you to make a different version of that demo for this context... multiple products being sold by retailers... mass and prestige channels."*

**What's Wrong:**
- The existing price elasticity demo (theme park version) has "ad-lite" and "ad-free" tiers
- Needs to be adapted for retail with: multiple products + mass/prestige channels

**Changes Required:**
- This is a **separate demo** (price elasticity studio) but the same patterns apply
- Replace "Ad-Lite / Ad-Free" → "Mass / Prestige" channels
- Replace "2 ticket types" → "3-6 products (sunscreens + moisturizers)"
- Add per-product elasticity curves
- Show channel × product elasticity matrix
- Add filters for product and channel throughout

---

## Priority Order

| Priority | Step | Effort | Impact |
|----------|------|--------|--------|
| P0 | Step 1 — Historical + Projected chart | Medium | High (directly requested, visual) |
| P0 | Step 3 — Per-product competitor prices | Medium | High (directly called out as confusing) |
| P0 | Step 2 — Product dropdown on simulator | Medium | High (foundation for all other changes) |
| P1 | Step 4 — Product-specific competitor scenarios | Medium | High (called out explicitly) |
| P1 | Step 5 — Elasticity filters (product + channel) | High | High (core analytical value) |
| P1 | Step 7 — Event calendar product detail | Low | Medium (polish) |
| P2 | Step 6 — Scenario engine product filter | High | Medium (advanced feature) |
| P2 | Step 8 — Retail price elasticity demo | High | Medium (separate deliverable) |

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `index.html` | Add product/channel filter dropdowns to Steps 1, 4, 5, 6, 7, 8 |
| `js/channel-promo-simulator.js` | Historical chart fix, per-product prices, product-aware simulator |
| `js/elasticity-model.js` | Accept SKU parameter, per-product elasticity lookup |
| `js/acquisition-simple.js` | Product filter, per-product demand curves |
| `js/churn-simple.js` | Product filter, per-product survival curves |
| `js/migration-simple.js` | Product filter, per-product migration flows |
| `js/scenario-engine.js` | Product-specific scenario support |
| `js/event-calendar.js` | Product column in events, product filter |
| `js/app.js` | Wire up new filters, state management for selected product |
| `data/elasticity-params.json` | Add `sku_elasticity` section with per-product parameters |
| `data/scenario.json` | Add product-specific scenario templates |
| `data/retail_events.csv` | Add product/SKU column to events |

---

## Summary

The single biggest gap is: **the application treats all products as a single aggregate when the reviewer expects product-level granularity throughout.** The data (`sku_channel_weekly.csv`) already supports per-product analysis — the work is primarily UI/filter additions and wiring up existing data to the elasticity and simulation engines.
