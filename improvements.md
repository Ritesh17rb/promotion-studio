# Promotion Optimization Audit and Improvement Plan

Date: 2026-03-05  
Reference: `meeting_transcript.md`

## 1) Intent (What Ritesh Actually Wants)

From the transcript, the core ask is:

1. This must be **promotion optimization**, not generic elasticity demo.
2. Narrative must be explicit:
   - **Start of Season**: baseline inventory + channels + SKU elasticities.
   - **In-Season Pivot**: competitor/social signal shock, engine recalculates in real time.
   - **Future Vision**: advanced optimizer modules.
3. Must include both:
   - **External movement** (to/from competitor based on price gap).
   - **Internal movement** (cannibalization across own SKUs).
4. Must show **products and timing context** (which SKUs promoted in which season window).
5. Should be **decision-grade**, not only charts: what to include/exclude in promotions and why.

## 2) Executive Business Verdict

Current build is strong in Step 1 and signal framing, but still has structural drift:

1. The demo has both a modern promo story and legacy pricing/churn artifacts.
2. Step 7/8 still feel partially disconnected from the promo-native business outcome model.
3. There is too much conceptual surface area for a pitch (high demo risk).

Business score (for client pitch readiness): **7/10**  
With focused cleanup below: **9/10**.

## 3) What Is Working Well (Keep)

1. Step 1 live simulator with inventory runway and objective lens.
2. Competitive + social shock controls and decomposition.
3. Cannibalization and migration visualization direction.
4. Event calendar concept and campaign effectiveness idea.
5. AI assistant presence and scenario framing.

## 4) Critical Problems in Current Implementation

## A. Model/KPI Mismatch (Highest Priority)

Problem:
1. Legacy scenario stack still uses subscription-style semantics (`new customers`, `churn`, `tier`) in key logic and result cards.
2. This clashes with retail promo optimization framing in the transcript.

Why this hurts:
1. Makes the story feel inconsistent and less credible to business stakeholders.
2. Confuses decisions (retail team needs units, margin, sell-through, leftover, cannibalization ratio).

Best fix:
1. Standardize KPI language and math to retail promo terms:
   - `unit lift`, `gross margin $`, `promo ROI`, `week-17 leftover`, `competitor capture`, `internal cannibalization`.
2. Keep "repeat risk" only as secondary signal, not as primary frame.

---

## B. Step 7/8 Advanced Analysis Not Fully Equivalent to Step 6 Feel

Problem:
1. Users experience Step 6 as actionable and "live", but Step 7/8 can still feel like inherited modules.
2. Advanced Analysis cards are improved in copy but still not always tightly tied to one shared scenario state.

Why this hurts:
1. Perceived incompleteness during demo.
2. User loses confidence when interactions seem visually rich but not operationally integrated.

Best fix:
1. Use one shared scenario state across Steps 6/7/8.
2. Every "advanced" panel must render from current selected scenario inputs and show a timestamp/update status.
3. Add "last recalculated at HH:MM:SS" in each advanced block.

---

## C. Overload and Redundancy in Pitch Path

Problem:
1. Too many modules and repeated constructs (legacy + new) increase cognitive load.
2. Presenter can drift into non-essential sections.

Why this hurts:
1. Weakens narrative impact.
2. Increases risk of "what is core?" question from client.

Best fix:
1. Add a strict "Pitch Mode" route with only must-show blocks.
2. Hide or collapse low-relevance details by default.

## 5) What Is Not Required (Should Be Reduced or Hidden)

For this specific client intent, these should be deprioritized in default demo mode:

1. Deep generic elasticity education blocks not tied to promotion decisions.
2. Subscription-tier style wording and artifacts.
3. Excessive segment deep-dive screens during core flow.
4. Any KPI that does not directly support "promote what, where, when, why".

Keep available under "Analyst Mode", not "Pitch Mode".

## 6) Relevance Check by Step (Business Lens)

1. Step 1: Highly relevant. Keep as centerpiece.
2. Step 2: Relevant for traceability, keep compact.
3. Step 3: Relevant if directly tied to promoted SKUs and signal changes.
4. Step 4-5: Useful support, but not core in first pass.
5. Step 6: Must be operational in-season decision workspace.
6. Step 7: Must focus on markdown path to week-17 target, not generic churn view.
7. Step 8: Must focus on competitor capture vs internal cannibalization tradeoff and route economics.
8. Step 9: AI should summarize decisions and actions, not generic analysis.

## 7) Best Target Experience (Recommended)

Single operating story, one scenario state:

1. **Start of Season Workspace**
   - Inventory by SKU/group, baseline elasticity, channel posture.
   - Initial promotion plan and expected week-17 leftover.

2. **In-Season Signal Pivot**
   - Competitor and social shocks arrive.
   - Engine recalculates promo depth by channel and SKU.
   - Show delta waterfall: own promo, competitor effect, social effect, cannibalization.

3. **End-of-Season Optimization**
   - Markdown ladder alternatives.
   - Route matrix: competitor pull vs own SKU cannibalization.
   - Ranked scenarios with explicit recommended action.

## 8) High-Value Improvements to Implement Next

### P0 (Must Do Before Important Demo)

1. Unify KPI model labels and outputs to promo-native language across Steps 6-8.
2. Ensure Step 7/8 advanced blocks are fully state-linked and always reactive.
3. Add visible loading/progress state for every LLM operation and long simulation.
4. Add one-click "Recommended scenario" CTA with rationale in business terms.

### P1 (Strong Upgrade)

1. Add cannibalization quality metric:
   - `External Capture %` vs `Internal Cannibalization %` and net value.
2. Add SKU include/exclude recommendation card from past promo effectiveness.
3. Add confidence bands or uncertainty tag for model outputs.
4. Add downloadable "Decision Brief" (one-page summary of chosen scenario).

### P2 (Future)

1. Replace simulated competitor feed with real ingestion pipeline (if available).
2. Add experiment feedback loop: actual results update elasticity priors.
3. Add role-based views (marketing, sales, finance).

## 9) AI Assistant: What "Good" Looks Like Here

AI output should answer:

1. Which SKUs to include/exclude now?
2. Which channel to push or hold?
3. What is expected week-17 leftover impact?
4. What is competitor-capture vs cannibalization split?
5. What is risk if signal reverses next week?

And every answer should cite current scenario values from the UI context.

## 10) Suggested Acceptance Criteria

1. Demo can be run in 6-8 minutes with one coherent story.
2. No legacy/subscription wording appears in pitch mode.
3. Step 7/8 advanced analysis updates immediately from active scenario.
4. At least 3 actionable recommendations are produced per scenario.
5. LLM and simulation calls always show loading status until completion.

## 11) Final Recommendation

Do not add more features right now.  
First, consolidate and simplify to one business-credible promotion operating system:

1. One narrative.
2. One scenario state.
3. One KPI language.
4. One ranked decision output.

That will make the demo feel complete, relevant, and executive-ready.

