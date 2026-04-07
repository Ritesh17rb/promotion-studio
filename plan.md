# Supergoop Demo Plan

Based on `meeting_transcript.md` from Apr 3, 2026. This supersedes the older Step 1-only note set and captures what Ritesh Aggarwal appears to want from the Supergoop demo.

## Intent

Ritesh is not asking for more charts. He wants a more credible and easier-to-demo product story:

- Start from real data, or at least make the data foundation obvious early, so the demo does not feel like mocked HTML.
- Keep the first business screen action-oriented for a busy operator: summary first, actions second, evidence below.
- Make promotion decisions feel grounded in elasticity, past promo evidence, competitor pricing, and social demand.
- Keep the experience simple enough to demo quickly, but deep enough that trust can be built through drill-downs.
- Use AI as an assistant across the journey, not only as a final-screen chat.
- Stay focused on promotions for now; a longer-term price-setting layer can come later.

## Requested Changes

### 1. Put the data foundation back into the story

- Show the underlying dataset(s) early and explicitly.
- Make it clear that every downstream chart, recommendation, and AI response is grounded in those tables.
- The user should understand that the system is using real SKU x channel, competitor, social, and seasonal data.
not
### 2. Keep Current Business Overview as the first real operating screen

- After grounding the user in data, land them on a business-facing overview.
- The question this screen should answer is: "How is the business doing right now, and what do I need to do?"

### 3. Make the AI business summary easier to scan

- Replace long paragraph-style summary treatment with short bullets or bullet-like statements.
- The user should be able to extract the key point in a few seconds.

### 4. Move Recommended Next Actions higher on the screen

- Place actions directly below the AI business summary.
- Details, issues, charts, and tables should support the actions, not compete with them.

### 5. Make Recommended Next Actions synthesize the whole screen

- Actions should reflect the combined reading from channel performance, pricing gaps, social buzz, competitor pressure, and product snapshot.
- They should not feel like one-to-one restatements of a single chart.

### 6. Keep issues and evidence below the action layer

- Top Issues & Opportunities still matter, but they should behave like supporting evidence.
- The details should answer "why is the system recommending this?" after the action is already clear.

### 7. Tighten metric consistency and definitions

- Cross-check that the same metric means the same thing everywhere.
- Remove or fix any mismatch between card values, summaries, and supporting detail.
- Make it obvious how to interpret metrics like competitor gap, social buzz, and at-risk revenue.

### 8. Add clearer period-over-period context on channel cards

- Revenue change is not enough.
- Also show change vs prior period for:
  - average own price
  - competitor gap
  - social buzz / sentiment
- The user should be able to infer why channel revenue moved.

### 9. Preserve channel drill-down and trend analysis

- Channel cards should support deeper inspection.
- Revenue trend, competitor pricing trend, and social trend all matter.
- These drill-downs should remain readable and directly relevant to the selected channel.

### 10. Use social buzz in context, not as an isolated score

- Actions should interpret buzz relative to its scale and pricing context.
- Example intent from the meeting:
  - mid-range buzz can justify light promotion
  - very high buzz may justify holding price or even testing price up

### 11. Reframe the broader story flow

Ritesh's intended narrative appears to be:

1. Data foundation / evidence of what the system is built on
2. Current business performance
3. Elasticity logic that explains why promo decisions work
4. Past promotion performance / learnings
5. Forward-looking optimization / scenario work
6. AI assistance throughout and full chat when needed

### 12. Bring AI assistance closer to each screen

- Do not force the user to wait until the final chat screen to ask questions.
- Each major screen should be able to answer "what am I seeing here?" and "what should I do?"

### 13. Longer-term extension: separate pricing from promotion

- Promotion is the short-term lever.
- Base price is the slower-moving 3-6 month lever.
- Finish the promotion story first, then add a more explicit long-term pricing layer later.

## Current Repo Status vs Transcript

### Already aligned or partially aligned

- Current Business Overview already exists as the primary business-facing screen.
- Competitive alerts are already sorted and truncated with expand behavior.
- Product x Channel Snapshot already consolidates pricing-position information and supports an expanded all-channel view.
- Channel drill-down modals and revenue trend popups already exist.
- Tooltips already explain several domain terms.
- Step-scoped AI widgets already exist on some screens.

### Still missing or weak

- The data foundation is present in the codebase but not clearly leading the demo story.
- The Step 1 AI summary is still rendered like a paragraph block.
- Recommended Next Actions are still too low in the visual hierarchy.
- The action block can still read as chart-by-chart restatement instead of full-screen synthesis.
- Current Business Overview channel cards still need stronger "what changed vs prior period" context beyond revenue.
- The overall step/story ordering is still not fully aligned to the desired narrative.

## Execution Plan

### Phase 1: Step 1 polish for the next demo pass

- [x] Rewrite this plan from the meeting transcript with intent, explicit asks, and repo-status mapping.
- [x] Move Recommended Next Actions directly below the AI business summary.
- [x] Render the AI business summary as quick-scan bullet points instead of a dense paragraph.
- [x] Add prior-period delta context to channel-card price, competitor gap, and social buzz.
- [ ] Tighten the action generator so the three actions represent the whole screen, not isolated widgets.

### Phase 2: Restore trust in the data story

- [ ] Expose the Data Explorer / data foundation earlier in the visible step sequence.
- [ ] Add explicit "this screen is powered by these datasets" framing near the start of the flow.
- [ ] Ensure AI responses on early screens cite the same datasets the UI is using.

### Phase 3: Re-sequence the promotion narrative

- [ ] Reorder or relabel the visible journey so the story becomes:
  - data foundation
  - current business overview
  - elasticity
  - historical promotion learnings
  - future optimization
  - AI copilot
- [ ] Audit step labels, modal step map, and hero navigation so they tell the same story.

### Phase 4: Strengthen action quality

- [ ] Improve the Step 1 action logic to combine:
  - revenue movement
  - competitor pressure
  - social momentum
  - channel role (mass vs prestige)
  - product-level pressure / opportunity
- [ ] Encode clearer thresholds for when high buzz means "promote lightly" versus "hold price" versus "price up test".

### Phase 5: Extend AI across the journey

- [ ] Audit every major screen for an embedded AI helper.
- [ ] Add or refine screen-level prompts so users can ask contextual questions without switching to the final chat screen.

## Immediate Build Focus

The right short-term move is to finish the Step 1 behavior and hierarchy first. That is the screen Ritesh is already reacting to positively, and it is the fastest path to a stronger Monday demo.
