# Promotion Studio - Dashboard Changes Plan

Based on the review meeting between Avantika and Ritesh on Apr 2, 2026.

---

## Context

The dashboard (Step 1 / Business Snapshot screen) shows a store/category manager where they are performing well and where they are losing money. The current version has hardcoded values, redundant tables, and lacks drill-down capabilities. The changes below aim to make it data-driven, remove redundancy, and add interactivity.

---

## Change 1: Drill-Down Modals on Channel Performance Cards

**What:** When a user clicks on a channel card (e.g., Amazon, Sephora, Target), open a modal/popup showing detailed information for that channel.

**Why:** The cards currently show summary metrics (price gap, sentiment, etc.) but no way to explore further. For example, the Amazon card says "competitor price is $28 vs our $33" but doesn't show the full picture of what happened.

**Details:**
- Each channel card gets a clickable state (cursor pointer, hover effect)
- On click, open a modal showing:
  - Detailed competitor vs own price breakdown per SKU
  - Revenue impact numbers
  - Trend of the price gap over time
  - Contextual AI-generated insight for that specific channel
- Apply the same drill-down pattern to ALL card types (business snapshot cards, competitive alerts, etc.)

---

## Change 2: Integrate Channel Revenue Trend into Channel Cards (Remove Separate Chart)

**What:** Remove the standalone "Channel Mix and Revenue" chart section. Instead, add a "View Trend" button on each channel performance card that opens a popup with the revenue trend graph.

**Why:** The separate chart section is redundant with the channel performance cards. Combining them reduces scrolling and keeps context together.

**Details:**
- Remove/comment out the "Channel Mix and Revenue" chart section (do NOT delete code, just comment out)
- On each channel card, add a button (e.g., "View Revenue Trend")
- On click, show a popup with:
  - Revenue trend over weeks/days for that specific channel
  - Breakdown by SKU (up to 6 lines, one per product)
  - Appropriate chart representation (line chart or similar)
- The popup should have its own local time filter

---

## Change 3: Local Time Filter / Slider for Trend Sections

**What:** Add a dedicated time-range filter (slider or dropdown) for sections that show trend data, defaulting to "Last 1 Year".

**Why:** Currently, the global "Last 1 Week" filter causes trend charts to show a single data point, which is meaningless. Users also have to scroll back to the top to change the global filter, which is inconvenient.

**Details:**
- Add a compact filter (slider or dropdown) directly within/near the trend chart sections
- Default value: "Last 1 Year"
- Options: Last 1 Week, Last 2 Weeks, Last 1 Month, Last 3 Months, Last 6 Months, Last 1 Year
- This filter operates independently of the global lookback window filter at the top
- Should be easily accessible without scrolling to the top

---

## Change 4: Competitive Price Alerts - Sorting & Expand

**What:** Sort competitive price alerts by price gap (descending) and show only the top 3 by default with an expand option to see the full list.

**Why:** Currently showing "24 significant moves" as a hardcoded number with no clear logic for what's displayed. The manager needs to see the most critical gaps first.

**Details:**
- Sort the competitor price alerts data by price gap percentage in descending order (highest gap first)
- Display only the top 3 alerts by default on the card
- Add an expand icon/button on the card
- On expand, show a popup/modal with the complete sorted list (all 24 or however many exist)
- The "24 significant moves" count must be dynamically calculated from actual data, not hardcoded

---

## Change 5: Product & Channel Snapshot - Consolidation & Expansion

**What:** Merge the "Channel and Product Pricing Position" table INTO the "Product & Channel Snapshot" table, then remove the pricing position table entirely. Show top 3 rows with expand.

**Why:** Both tables show overlapping information (product, channel, units, pricing). Consolidating removes redundancy and gives one unified view.

**Details:**
- Add the following columns to the Product & Channel Snapshot table:
  - **Revenue** column (from the pricing position table)
  - **Social Buzz** column (from the pricing position table)
- The table now contains: Product, Top Channel, Revenue, Units, Own Price, Competitor Price, Gap, Social Buzz, WoW Change, Operating Interpretation
- Show only top 3 rows by default
- Add expand icon to see all 6 SKUs (or all products in dataset)
- Remove/comment out the "Channel and Product Pricing Position" table entirely

---

## Change 6: Cross-Channel View on Expand (Product & Channel Snapshot)

**What:** When expanding the Product & Channel Snapshot, show all product-channel combinations (6 products x 4 channels = 24 rows), grouped by product.

**Why:** Currently only the top-performing channel per SKU is shown. A store manager may want to see how "Unseen Sunscreen SPF" performs on ALL channels, not just the top one.

**Details:**
- On expand, show all 24 combinations grouped by product:
  - Unseen Sunscreen SPF → Target, Amazon, Sephora, Mass (all 4 channels)
  - Glow Screen SPF 44 → Target, Amazon, Sephora, Mass (all 4 channels)
  - ... (repeat for all 6 SKUs)
- Add a tooltip on the expand button: "Click to view product performance across all channels"
- Optionally add a filter within the expanded view to filter by specific product or channel

---

## Change 7: Info (i) Tooltips for Terminology

**What:** Add info icon buttons next to abbreviations and domain-specific terms.

**Why:** Not all users will understand terms like "WoW" (Week over Week), "Social Buzz", "At-Risk Revenue", etc. This improves accessibility without cluttering the UI.

**Details:**
- Add a small (i) icon next to terms such as:
  - WoW (Week over Week)
  - Social Buzz
  - At-Risk Revenue
  - Competitor Gap
  - Operating Interpretation
  - Any other non-obvious metric
- On click/hover, show a tooltip or small popover with a plain-language definition
- Keep definitions concise (1-2 sentences)

---

## Change 8: Remove All Hardcoded Values

**What:** Replace every hardcoded value in the dashboard with data-driven values sourced from the actual dataset tables.

**Why:** Hardcoded values cause inconsistencies (e.g., units shown in one section don't match another). For the demo to be credible, all numbers must come from a single source of truth.

**Details:**
- Audit every metric displayed on the dashboard:
  - Revenue figures
  - Unit counts
  - Price values (own and competitor)
  - Gap percentages
  - Social buzz scores
  - Competitive price alert counts ("24 significant moves")
  - AI-generated insight text references to specific numbers
- Ensure all values are pulled from the underlying data tables/dataset
- Cross-verify that the same metric shown in multiple places is consistent
- Data should align with the storyline being presented

---

## Priority / Execution Order

1. **Remove hardcoded values** (Change 8) - foundational, everything else depends on real data
2. **Merge tables** (Change 5) - structural change, simplifies the layout
3. **Competitive alerts sorting** (Change 4) - quick win, improves usability
4. **Drill-down modals on cards** (Change 1) - high impact feature
5. **Channel revenue trend integration** (Change 2) - depends on drill-down modal pattern
6. **Cross-channel expand view** (Change 6) - extends Change 5
7. **Info tooltips** (Change 7) - polish, can be done anytime
8. **Local time filter** (Change 3) - independent, can be done in parallel

---

## Notes

- **Do not delete code** for removed sections - comment it out instead
- Second screen (Step 2 - Simulation) feedback is pending from Avantika (expected by Apr 3 first half)
- Demo call scheduled for Apr 3 to show these changes to stakeholders
- Data is not yet finalized - Ritesh needs to work on making data realistic and consistent
