# Application Explanation Guide

This folder is the detailed walkthrough guide for the application.

The goal of these files is not just to list the screens. Each step file explains:
- what we are doing in that step,
- what business question the step is answering,
- what each major feature is doing,
- what each chart, graph, card, or table is meant to convey,
- and how to read the current example values in this build.

Important data context:
- The app uses local demo-season data from `data/`.
- Step 1 KPI cards use the latest aggregated week in `channel_weekly.csv`: `2026-05-25`.
- Most in-season simulations use the current SKU week in `sku_channel_weekly.csv`: week `7` (`2026-03-16`).
- Step 8 scenario examples use `scenarios.json` plus scoped SKU, market, and social history.

Use these files when you need to explain the app clearly without sounding like you are just reading labels off the screen.

Files:
- `step1.md` - Current State Overview
- `step2.md` - Data Explorer
- `step3.md` - Event Calendar
- `step4.md` - Customer Cohorts
- `step5.md` - Segment Response Comparison
- `step6.md` - In-Season Planner Model Board
- `step7.md` - End-of-Season Markdown Decision Models
- `step8.md` - Portfolio Migration & Advanced Analysis
- `step9.md` - AI Promotion Optimization Assistant
