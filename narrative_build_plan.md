# Narrative Build Plan: Promotion Optimization Storyline

Date: 2026-03-04  
Source: `meeting_transcript.md`  
Goal: Ship a client-ready narrative across all steps using a 3-act story:

1. Start of Season: baseline inventory, channels, and product-level elasticity differences.
2. In-Season Pivot: live competitor/social signal shocks with real-time recalculation.
3. Future Vision: roadmap modules with concrete value and believable outputs.

## 1) Client Intent (What We Are Building For)

Primary audience:

1. CMO: wants growth outcomes and social/creative alignment.
2. Sales/Channel Lead: wants channel-specific promotion actions (Target/Amazon vs Sephora/Ulta).
3. Revenue/Merch Lead: wants inventory-to-week-17 clearance with margin guardrails.

Non-negotiables from transcript:

1. This must read as promotion optimization, not elasticity demo language.
2. Social and competitor price changes must visibly and causally alter outcomes.
3. Product-level detail must be explicit: sunscreen + moisturizer, each with multiple SKUs.
4. Cannibalization must be shown clearly (SKU1 up can reduce SKU2/SKU3).
5. Narrative must flow end-to-end, not disconnected widgets.

## 2) Narrative Experience Architecture

## Act A: Start of Season (Step 1 + Step 2)

Business question: Where do we stand and what happens if we do nothing?

Required visuals:

1. Baseline inventory runway (current week to week 17).
2. Product/channel baseline posture (revenue/profit/leftover).
3. Product-level elasticity and competitor gap baseline.
4. Data source traceability (website-scraped competitor feed, social signal, SKU-week data).

## Act B: In-Season Pivot (Step 1 live + Step 3)

Business question: What changed in market signals, and what should we do this week?

Required visuals:

1. Live timeline playback with auto competitor/social signal injection.
2. Real-time recalculation of promo recommendations and tradeoffs.
3. Causal decomposition (own promo, competitor delta, social, internal migration).
4. Event-level analyst view: impact + pivot recommendations.

## Act C: Future Vision (Steps 6/7/8 placeholders)

Business question: How does this become an operating system for every season?

Required visuals:

1. In-Season Planner placeholder with sample weekly decision queue.
2. End-of-Season Markdown placeholder with sample markdown ladder output.
3. Cross-Channel Migration placeholder with sample migration flows.
4. Each placeholder must show value statement + sample output, not generic text.

## 3) Delivery Backlog (File-Level)

## P0 (Must-Have Narrative Cohesion, 2-3 days)

1. Story progress rail + act framing in each section.
Files:
- `index.html`
- `css/style.css`
Validation:
- Every step header explicitly maps to Act A/B/C.

2. Step 1 executive takeaway cards.
Files:
- `index.html`
- `js/channel-promo-simulator.js`
Validation:
- “If no action” vs “Current scenario” vs “Best objective mode” all visible above fold.

3. Replace remaining elasticity-demo phrasing in visible UI copy.
Files:
- `index.html`
- `js/app.js` (copy sweep utilities/modals)
Validation:
- Search audit has no contradictory “elasticity modeling demo” framing in Step 1/3/9 user text.

4. Step 3 event context continuity with Step 1.
Files:
- `js/event-calendar.js`
- `js/channel-promo-simulator.js`
- `js/app.js`
Validation:
- Selected event in Step 3 references current live week context from Step 1.

## P1 (Decision Credibility, 3-5 days)

1. Product/Channel “Action Board” in Step 1.
Files:
- `index.html`
- `js/channel-promo-simulator.js`
Feature:
- Row per SKU with channel actions: `Promote`, `Hold`, `Watch`.
Validation:
- Actions update on slider/week/event changes.

2. Cannibalization clarity panel.
Files:
- `js/channel-promo-simulator.js`
- `index.html`
Feature:
- “Winners and losers” summary: which SKU gained, which sibling SKU lost.
Validation:
- At least one migration statement always shown when measurable transfers exist.

3. Objective explanation engine.
Files:
- `js/channel-promo-simulator.js`
- `index.html`
Feature:
- Natural-language explanation for why `balance/sales/profit` differ.
Validation:
- Objective toggle changes explanation + frontier + recommendations together.

4. Event impact windows (T0/T+1/T+2).
Files:
- `js/event-calendar.js`
- `index.html`
Validation:
- Event detail card includes short horizon impact estimates and confidence labels.

## P2 (LLM Co-Pilot Productization, 4-6 days)

1. Step 1 LLM co-pilot hardening.
Files:
- `js/chat.js`
- `js/app.js`
- `index.html`
Feature:
- Structured outputs with fallback templates if model unavailable.
Validation:
- No broken UI when LLM not configured.

2. NL-to-controls with preview before apply.
Files:
- `js/app.js`
- `index.html`
Feature:
- Show parsed plan summary and “Confirm Apply”.
Validation:
- Users can cancel or apply; applied controls match parsed values.

3. Step 3 Event Analyst with citations.
Files:
- `js/chat.js`
- `js/app.js`
- `js/event-calendar.js`
Feature:
- Show cited event id/week and key signal values used for analysis.
Validation:
- Analyst output includes at least one explicit numeric signal reference.

4. Prompt guardrails and hallucination protection.
Files:
- `js/chat.js`
Validation:
- JSON schema enforcement + parser fallback + user-safe error messages.

## P3 (Future Vision Upgrade, 3-4 days)

1. Replace roadmap placeholders with “interactive stubs.”
Files:
- `index.html`
- `js/app.js`
Feature:
- Each future module includes one mini simulation output card and business value.
Validation:
- No placeholder appears as empty/static text.

2. Pitch mode (auto walkthrough).
Files:
- `js/app.js`
- `js/channel-promo-simulator.js`
- `index.html`
Feature:
- One-click sequence: baseline -> pivot -> social -> clearance, with scripted captions.
Validation:
- Full sequence runs in < 2 minutes and can be paused/resumed.

## 4) Data + Model Contract Rules

1. Every insight card must map to existing data tables:
- `sku_channel_weekly.csv`
- `market_signals.csv`
- `social_signals.csv`
- `competitor_price_feed.csv`
- `promo_metadata.json`
- `retail_events.csv`

2. No “mock” interpretation copy in production-facing text unless labeled `Simulated`.
3. Week-level calculations must be time-aligned across Step 1 and Step 3.
4. Product names must be human-readable in all UI surfaces.

## 5) Acceptance Criteria by Act

## Act A Done

1. User can explain baseline in 30 seconds with exact numbers.
2. “No-action week-17 leftover” is always visible.
3. Product and channel specificity is explicit.

## Act B Done

1. Moving one live signal visibly changes projections.
2. Cannibalization appears in table/matrix and causal summary.
3. Co-pilot gives actionable suggestions tied to current week snapshot.

## Act C Done

1. Roadmap modules look like credible next releases.
2. Each placeholder has a concrete business-value statement.
3. Pitch transitions are smooth and coherent.

## 6) QA Checklist

1. Desktop and mobile layout integrity for sticky control panels.
2. LLM disconnected state does not block non-LLM workflow.
3. All charts update without console errors during live playback.
4. Event selection, scenario updates, and co-pilot hooks stay synchronized.

## 7) 6-Minute Pitch Runbook

1. 0:00-1:30: Start of season baseline and no-action risk.
2. 1:30-4:30: Live in-season pivot:
- trigger competitor shock
- show product/channel recalculation
- show cannibalization and objective tradeoff
- run LLM co-pilot
3. 4:30-6:00: Future vision modules and implementation path.

## 8) Execution Order (Recommended)

1. P0 first (narrative cohesion and cross-step continuity).
2. P1 second (decision credibility and explainability).
3. P2 third (LLM productization).
4. P3 last (future vision and pitch mode automation).

