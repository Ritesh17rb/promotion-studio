#!/usr/bin/env python3
"""Generate promotion-optimization datasets (17-week season, SKU/channel/inventory)."""

from __future__ import annotations

import csv
import json
import math
import random
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

random.seed(20260304)

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

SEASON_START = date(2026, 2, 2)
SEASON_WEEKS = 17
CURRENT_WEEK = 7

CHANNELS = {
    "target": "mass",
    "amazon": "mass",
    "sephora": "prestige",
    "ulta": "prestige",
}

COMP_SOURCE_BY_CHANNEL = {
    "target": "target.com",
    "amazon": "amazon.com",
    "sephora": "sephora.com",
    "ulta": "ulta.com",
}

CHANNEL_PRICE_ADJ = {"target": -0.25, "amazon": -0.5, "sephora": 0.75, "ulta": 0.25}
CHANNEL_COMP_PRESSURE = {"target": 1.05, "amazon": 1.12, "sephora": 0.96, "ulta": 0.98}
CHANNEL_SHARE_WEIGHT = {"target": 0.55, "amazon": 0.45, "sephora": 0.52, "ulta": 0.48}
GROUP_PROMO_WEEKS = {"mass": {4, 5, 8, 12, 15}, "prestige": {3, 7, 11, 14}}


@dataclass(frozen=True)
class SkuDef:
    sku_id: str
    sku_name: str
    product_group: str
    base_price_mass: float
    base_price_prestige: float
    base_elasticity_mass: float
    base_elasticity_prestige: float
    base_units_mass: float
    base_units_prestige: float
    start_inv_mass: int
    start_inv_prestige: int


SKUS = [
    SkuDef("SUN_S1", "Daily Shield SPF 40", "sunscreen", 18.99, 29.0, -2.35, -1.55, 170, 115, 3600, 2200),
    SkuDef("SUN_S2", "Invisible Mist SPF 50", "sunscreen", 21.5, 33.0, -2.15, -1.42, 140, 92, 3000, 1850),
    SkuDef("SUN_S3", "Sport Gel SPF 60", "sunscreen", 24.0, 36.0, -1.95, -1.25, 118, 84, 2600, 1650),
    SkuDef("MOI_M1", "Hydra Daily Lotion", "moisturizer", 16.75, 27.0, -2.1, -1.4, 128, 103, 2850, 2100),
    SkuDef("MOI_M2", "Barrier Repair Cream", "moisturizer", 19.5, 31.0, -1.92, -1.3, 108, 86, 2450, 1820),
    SkuDef("MOI_M3", "Night Recovery Balm", "moisturizer", 22.0, 35.0, -1.75, -1.18, 92, 73, 2100, 1550),
]


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def write_json(path: Path, payload: object) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def week_start(w: int) -> date:
    return SEASON_START + timedelta(days=(w - 1) * 7)


def season_phase(w: int) -> str:
    if w <= 4:
        return "start"
    if w <= 12:
        return "in_season"
    return "late"


def demand_index(w: int) -> float:
    if w <= 4:
        return round(0.94 + w * 0.05, 3)
    if w <= 10:
        return round(1.12 + (w - 4) * 0.022, 3)
    if w <= 13:
        return round(1.24 - (w - 10) * 0.035, 3)
    return round(1.12 - (w - 13) * 0.06, 3)


def social_index(w: int) -> float:
    base = 58 + 6 * math.sin(w / 2.8)
    spike = 18 if w in {5, 11} else (9 if w in {8, 14} else 0)
    return round(max(45.0, min(95.0, base + spike + random.uniform(-2.2, 2.2))), 2)


def promo_depth_pct(group: str, w: int) -> float:
    if w not in GROUP_PROMO_WEEKS[group]:
        return 0.0
    return random.choice([12.0, 15.0, 18.0, 20.0]) if group == "mass" else random.choice([6.0, 8.0, 10.0, 12.0])


def social_elast_modifier(score: float) -> float:
    if score >= 75:
        return 0.82
    if score >= 65:
        return 0.9
    if score >= 55:
        return 0.98
    return 1.08


def competitor_discount_factor(channel: str, w: int) -> float:
    base = 0.03 if CHANNELS[channel] == "prestige" else 0.05
    if channel == "amazon" and w in {4, 8, 12, 15}:
        base += 0.10
    if channel == "target" and w in {5, 12, 15}:
        base += 0.06
    if CHANNELS[channel] == "prestige" and w in {7, 14}:
        base += 0.03
    return max(0.0, min(0.22, base + random.uniform(-0.015, 0.02)))


def generate() -> None:
    inventory_left: dict[tuple[str, str], int] = {}
    inventory_start_total = {"mass": 0, "prestige": 0}
    for sku in SKUS:
        for channel, group in CHANNELS.items():
            start = sku.start_inv_mass if group == "mass" else sku.start_inv_prestige
            inventory_left[(sku.sku_id, channel)] = start
            inventory_start_total[group] += start

    sku_rows: list[dict] = []
    week_social: dict[int, float] = {}
    week_group_comp_price: dict[tuple[int, str], list[float]] = defaultdict(list)

    for w in range(1, SEASON_WEEKS + 1):
        d_idx = demand_index(w)
        s_idx = social_index(w)
        week_social[w] = s_idx
        phase = season_phase(w)

        raw_rows = []
        group_channel_rows = defaultdict(list)
        for sku in SKUS:
            for channel, group in CHANNELS.items():
                list_price = (sku.base_price_mass if group == "mass" else sku.base_price_prestige) + CHANNEL_PRICE_ADJ[channel]
                list_price = round(max(9.99, list_price), 2)
                depth = promo_depth_pct(group, w)
                eff_price = round(list_price * (1 - depth / 100), 2)
                comp_disc = competitor_discount_factor(channel, w)
                comp_price = round(list_price * (1 - comp_disc), 2)
                gap = ((eff_price - comp_price) / comp_price) if comp_price else 0.0

                base_elast = sku.base_elasticity_mass if group == "mass" else sku.base_elasticity_prestige
                channel_adj = 1.06 if channel in {"amazon", "target"} else 0.97
                eff_elast = round(base_elast * channel_adj * social_elast_modifier(s_idx), 3)

                base_units = sku.base_units_mass if group == "mass" else sku.base_units_prestige
                baseline_units = base_units * d_idx * CHANNEL_SHARE_WEIGHT[channel]
                units = baseline_units * ((eff_price / list_price) ** eff_elast)
                comp_multiplier = max(0.62, min(1.32, 1 - gap * 0.52 * CHANNEL_COMP_PRESSURE[channel]))
                units *= comp_multiplier
                if w == CURRENT_WEEK and channel == "amazon":
                    units *= 0.92
                units *= random.uniform(0.94, 1.06)

                row = {
                    "week_of_season": w,
                    "week_start": week_start(w).isoformat(),
                    "season_phase": phase,
                    "is_current_week": w == CURRENT_WEEK,
                    "product_group": sku.product_group,
                    "sku_id": sku.sku_id,
                    "sku_name": sku.sku_name,
                    "channel_group": group,
                    "sales_channel": channel,
                    "list_price": list_price,
                    "promo_depth_pct": round(depth, 1),
                    "effective_price": eff_price,
                    "competitor_price": comp_price,
                    "price_gap_vs_competitor": round(gap, 4),
                    "social_engagement_score": s_idx,
                    "base_elasticity": round(base_elast, 3),
                    "effective_elasticity": eff_elast,
                    "raw_units": max(0.0, units),
                    "cannibalized_out_units": 0.0,
                }
                raw_rows.append(row)
                group_channel_rows[(sku.product_group, channel)].append(row)

        for _, entries in group_channel_rows.items():
            winner = max(entries, key=lambda r: (r["promo_depth_pct"], r["list_price"]))
            winner_gain = 0.0
            for row in entries:
                if row is winner:
                    continue
                depth_gap = max(0.0, winner["promo_depth_pct"] - row["promo_depth_pct"])
                migration = row["raw_units"] * (depth_gap / 100) * 0.36
                row["raw_units"] = max(0.0, row["raw_units"] - migration)
                row["cannibalized_out_units"] = migration
                winner_gain += migration
            winner["raw_units"] += winner_gain

        for row in raw_rows:
            inv_key = (row["sku_id"], row["sales_channel"])
            start_inv = inventory_left[inv_key]
            units_sold = min(start_inv, int(round(row["raw_units"])))
            end_inv = max(0, start_inv - units_sold)
            inventory_left[inv_key] = end_inv

            margin_base = 0.42 if row["channel_group"] == "mass" else 0.56
            margin_hit = row["promo_depth_pct"] * 0.0042
            margin_pct = round(max(0.22, margin_base - margin_hit), 3)
            revenue = round(units_sold * row["effective_price"], 2)

            sku_rows.append(
                {
                    "week_start": row["week_start"],
                    "week_of_season": row["week_of_season"],
                    "is_current_week": str(row["is_current_week"]),
                    "season_phase": row["season_phase"],
                    "product_group": row["product_group"],
                    "sku_id": row["sku_id"],
                    "sku_name": row["sku_name"],
                    "channel_group": row["channel_group"],
                    "sales_channel": row["sales_channel"],
                    "start_inventory_units": start_inv,
                    "end_inventory_units": end_inv,
                    "list_price": row["list_price"],
                    "effective_price": row["effective_price"],
                    "promo_depth_pct": row["promo_depth_pct"],
                    "competitor_price": row["competitor_price"],
                    "price_gap_vs_competitor": row["price_gap_vs_competitor"],
                    "social_engagement_score": row["social_engagement_score"],
                    "base_elasticity": row["base_elasticity"],
                    "effective_elasticity": row["effective_elasticity"],
                    "own_units_sold": units_sold,
                    "cannibalized_out_units": round(row["cannibalized_out_units"], 2),
                    "net_units_sold": units_sold,
                    "revenue": revenue,
                    "gross_margin_pct": margin_pct,
                }
            )
            week_group_comp_price[(w, row["channel_group"])].append(row["competitor_price"])

    write_csv(DATA_DIR / "sku_channel_weekly.csv", sku_rows)

    grouped = defaultdict(list)
    for row in sku_rows:
        grouped[(row["week_start"], row["channel_group"])].append(row)

    channel_weekly = []
    for (w_start, group), rows in sorted(grouped.items()):
        w = int(rows[0]["week_of_season"])
        units = sum(float(r["net_units_sold"]) for r in rows)
        revenue = sum(float(r["revenue"]) for r in rows)
        active = max(2200, int(units / (1.28 if group == "mass" else 1.18)))
        promo_avg = sum(float(r["promo_depth_pct"]) for r in rows) / len(rows)
        social_val = week_social[w]
        new_customers = int(active * (0.028 if group == "mass" else 0.021) * (1 + promo_avg / 100 * 0.55))
        repeat_loss_rate = (0.039 if group == "mass" else 0.031) * (1 + max(0, 60 - social_val) / 100 * 0.4)
        repeat_loss = int(active * repeat_loss_rate)
        avg_price = sum(float(r["list_price"]) for r in rows) / len(rows)
        avg_eff = sum(float(r["effective_price"]) for r in rows) / len(rows)
        weighted_margin = (sum(float(r["revenue"]) * float(r["gross_margin_pct"]) for r in rows) / revenue) if revenue else 0.0
        inv_left = sum(int(r["end_inventory_units"]) for r in rows)
        inv_pos = inv_left / inventory_start_total[group]
        markdown_risk = round(max(0.04, min(0.72, (w - 1) / SEASON_WEEKS * 0.58 + inv_pos * 0.35)), 3)

        channel_weekly.append(
            {
                "week_start": w_start,
                "channel_group": group,
                "season_phase": season_phase(w),
                "active_customers": active,
                "new_customers": new_customers,
                "repeat_loss_customers": repeat_loss,
                "net_adds": new_customers - repeat_loss,
                "repeat_loss_rate": round(repeat_loss_rate, 4),
                "price": round(avg_price, 2),
                "effective_price": round(avg_eff, 2),
                "promo_depth_pct": round(promo_avg, 2),
                "units_sold": round(units, 1),
                "revenue": round(revenue, 2),
                "aov": round(revenue / active, 2),
                "gross_margin_pct": round(weighted_margin, 4),
                "inventory_position": round(inv_pos, 4),
                "markdown_risk": markdown_risk,
            }
        )

    write_csv(DATA_DIR / "channel_weekly.csv", channel_weekly)

    price_calendar = []
    for row in channel_weekly:
        promo_flag = float(row["promo_depth_pct"]) > 0
        list_price = float(row["price"])
        eff = float(row["effective_price"])
        change_pct = ((eff - list_price) / list_price) * 100 if list_price else 0
        promo_type = "competitive_defense" if promo_flag and row["channel_group"] == "mass" else ("prestige_selective" if promo_flag else "full_price")
        price_calendar.append(
            {
                "week_start": row["week_start"],
                "channel_group": row["channel_group"],
                "list_price": round(list_price, 2),
                "promo_flag": str(promo_flag),
                "promo_discount_pct": round(float(row["promo_depth_pct"]), 2),
                "effective_price": round(eff, 2),
                "price_changed": str(promo_flag),
                "price_change_pct": round(change_pct, 3),
                "promo_type": promo_type,
                "promo_message": "Defend mass volume vs competitor" if promo_flag and row["channel_group"] == "mass" else ("Selective prestige offer" if promo_flag else "Hold price to protect margin"),
            }
        )
    write_csv(DATA_DIR / "price_calendar.csv", price_calendar)

    season_rows = []
    for w in range(1, SEASON_WEEKS + 1):
        w_start = week_start(w).isoformat()
        week_rows = [r for r in channel_weekly if r["week_start"] == w_start]
        inv_pos = sum(float(r["inventory_position"]) for r in week_rows) / len(week_rows)
        md = sum(float(r["markdown_risk"]) for r in week_rows) / len(week_rows)
        season_rows.append(
            {
                "week_start": w_start,
                "season_phase": season_phase(w),
                "demand_index": demand_index(w),
                "inventory_position": round(inv_pos, 4),
                "markdown_risk": round(md, 4),
                "week_of_season": w,
                "is_current_week": str(w == CURRENT_WEEK),
            }
        )
    write_csv(DATA_DIR / "season_calendar.csv", season_rows)

    market_rows = []
    social_rows = []
    for w in range(1, SEASON_WEEKS + 1):
        mass_avg = sum(week_group_comp_price[(w, "mass")]) / len(week_group_comp_price[(w, "mass")])
        prestige_avg = sum(week_group_comp_price[(w, "prestige")]) / len(week_group_comp_price[(w, "prestige")])
        marketplace_avg = sum(float(r["competitor_price"]) for r in sku_rows if int(r["week_of_season"]) == w and r["sales_channel"] == "amazon")
        marketplace_den = len([r for r in sku_rows if int(r["week_of_season"]) == w and r["sales_channel"] == "amazon"])
        marketplace_avg = marketplace_avg / marketplace_den

        market_rows.append(
            {
                "week_start": week_start(w).isoformat(),
                "competitor_price_a": round(mass_avg, 2),
                "competitor_price_b": round(prestige_avg, 2),
                "competitor_price_c": round(marketplace_avg, 2),
                "competitor_avg_price": round((mass_avg + prestige_avg + marketplace_avg) / 3, 2),
                "competitor_promo_flag": int(w in {4, 5, 8, 12, 15} or random.random() < 0.14),
                "macro_cpi": round(309.0 + random.uniform(-1.4, 1.6), 2),
                "consumer_sentiment": round(98 + demand_index(w) * 7 + random.uniform(-4.0, 4.0), 2),
                "unemployment_rate": round(3.8 + random.uniform(-0.2, 0.25), 2),
                "category_demand_index": demand_index(w),
                "promo_clutter_index": round(0.26 + (0.21 if w in {4, 5, 8, 12, 15} else 0.0) + random.uniform(-0.05, 0.06), 3),
            }
        )

        score = week_social[w]
        mentions = int(7400 + (score - 50) * 160 + random.uniform(-600, 820))
        tiktok = int(mentions * random.uniform(0.36, 0.49))
        insta = int(mentions * random.uniform(0.34, 0.44))
        paid = round(61000 + (score - 60) * 1100 + random.uniform(-4200, 5200), 2)
        earned = round(28000 + (score - 60) * 820 + random.uniform(-2800, 3000), 2)
        social_rows.append(
            {
                "week_start": week_start(w).isoformat(),
                "total_social_mentions": mentions,
                "tiktok_mentions": tiktok,
                "instagram_mentions": insta,
                "social_sentiment": round(max(0.35, min(0.88, 0.44 + (score - 45) / 100)), 3),
                "influencer_score": round(max(0.2, min(0.97, 0.34 + (score - 50) / 90)), 3),
                "paid_social_spend": paid,
                "earned_social_value": earned,
                "total_social_spend": round(paid + earned, 2),
                "brand_social_index": round(score, 2),
            }
        )

    write_csv(DATA_DIR / "market_signals.csv", market_rows)
    write_csv(DATA_DIR / "social_signals.csv", social_rows)

    competitor_feed_rows = []
    for row in sku_rows:
        list_price = float(row["list_price"])
        observed_price = float(row["competitor_price"])
        promo_flag = (list_price - observed_price) / list_price >= 0.08 if list_price else False
        competitor_feed_rows.append(
            {
                "captured_at": f"{row['week_start']}T08:00:00Z",
                "source_domain": COMP_SOURCE_BY_CHANNEL.get(row["sales_channel"], "marketplace.example"),
                "channel": row["sales_channel"],
                "competitor_sku": f"COMP_{row['sku_id']}",
                "matched_sku_id": row["sku_id"],
                "match_confidence": round(random.uniform(0.86, 0.99), 3),
                "observed_price": round(observed_price, 2),
                "promo_flag": str(promo_flag),
            }
        )
    write_csv(DATA_DIR / "competitor_price_feed.csv", competitor_feed_rows)

    events = []
    eid = 1

    def add_event(w: int, ev_type: str, group: str, channel: str, notes: str, promo_discount: float = 0.0, price_before: float = 0.0, price_after: float = 0.0, promo_id: str = "", window: str = "clean"):
        nonlocal eid
        events.append(
            {
                "event_id": f"EVT_{eid:03d}",
                "week_start": week_start(w).isoformat(),
                "event_type": ev_type,
                "channel_group": group,
                "affected_channel": channel,
                "price_before": round(price_before, 2),
                "price_after": round(price_after, 2),
                "promo_id": promo_id,
                "promo_discount_pct": round(promo_discount, 2),
                "notes": notes,
                "validation_window": window,
            }
        )
        eid += 1

    for w, note in {1: "Season kickoff assortment load-in", 5: "Memorial Day sun care spike", 8: "Prime Day marketplace pressure", 12: "Back-to-routine hydration push", 15: "Labor Day closeout pressure", 17: "End-of-season inventory close"}.items():
        add_event(w, "Tentpole", "all", "all", note, window="confounded")
    for w in sorted(GROUP_PROMO_WEEKS["mass"]):
        add_event(w, "Promo Start", "mass", "target|amazon", "Mass defensive promo launched due competitor undercut.", promo_discount=17.5, promo_id="PROMO_MEMORIAL_DAY_MASS_DEFENSE_2026", window="confounded")
        add_event(w, "Competitor Price Change", "mass", "amazon", "Competitor dropped price on key mass SKU cluster.", price_before=22.4, price_after=19.9, promo_id="COMP_SCAN", window="confounded")
    for w in sorted(GROUP_PROMO_WEEKS["prestige"]):
        add_event(w, "Promo Start", "prestige", "sephora|ulta", "Selective prestige promo on elastic SKUs only.", promo_discount=8.0, promo_id="PROMO_PRESTIGE_GLOW_WEEKEND_2026")
    add_event(1, "Promo Start", "mass", "target|amazon", "Season opening SPF baseline campaign started.", promo_discount=10.0, promo_id="PROMO_SPRING_BASELINE_SPF_2026")
    add_event(7, "Promo Start", "prestige", "sephora|ulta", "Social momentum hold campaign on premium SPF SKUs.", promo_discount=5.0, promo_id="PROMO_TIKTOK_SPORT_GEL_HOLD_2026")
    add_event(17, "Promo Start", "all", "sephora|ulta|target|amazon", "Week-17 smart clearance mix activated to close inventory.", promo_discount=20.0, promo_id="PROMO_WEEK17_CLEARANCE_MIX_2026", window="holdout")
    for w in [5, 11, 14]:
        add_event(w, "Social Spike", "all", "all", "Viral creator content increased brand pull and lowered elasticity.", promo_id="SOCIAL_VIRAL", window="confounded")
    write_csv(DATA_DIR / "retail_events.csv", events)

    promo_metadata = {
        "PROMO_WINTER_HYDRATION_PUSH_2025": {
            "promo_id": "PROMO_WINTER_HYDRATION_PUSH_2025",
            "campaign_name": "Winter Hydration Routine Reset",
            "story_phase": "baseline",
            "story_summary": "Off-season moisturizer support to seed repeat demand before the summer sun-care cycle starts.",
            "start_date": "2025-11-10",
            "end_date": "2025-11-24",
            "discount_pct": 14,
            "discount_type": "percentage",
            "duration_weeks": 2,
            "duration_months": 0.5,
            "eligible_tiers": ["ad_supported", "ad_free"],
            "eligible_cohorts": ["routine_refill", "value_seeker", "lapsed_high_value"],
            "eligible_channels": ["target", "amazon", "ulta"],
            "exclusions": ["SUN_S3"],
            "roll_off_date": "2025-12-01",
            "roll_off_type": "soft",
            "roll_off_window_weeks": 1,
            "promo_code": "HYDRATE14",
            "attribution_window_days": 7,
            "target_adds": 3900,
            "actual_adds": 3715,
            "target_roi": 1.45,
            "actual_roi": 1.39,
            "marketing_spend_usd": 67000,
            "incremental_revenue_usd": 132000,
            "repeat_loss_expected": True,
            "repeat_loss_lag_weeks": 6,
            "season": "holiday_winter_2025",
            "promoted_skus": ["MOI_M1", "MOI_M2", "MOI_M3"],
            "sku_results": [
                {"sku_id": "MOI_M1", "sku_name": "Hydra Daily Lotion", "sales_uplift_pct": 14.9, "channel": "target", "outcome": "up"},
                {"sku_id": "MOI_M2", "sku_name": "Barrier Repair Cream", "sales_uplift_pct": 11.2, "channel": "amazon", "outcome": "up"},
                {"sku_id": "MOI_M3", "sku_name": "Night Recovery Balm", "sales_uplift_pct": -1.8, "channel": "ulta", "outcome": "down"},
            ],
            "channel_results": {
                "target": {"sales_uplift_pct": 10.5, "margin_delta_pct": -3.1},
                "amazon": {"sales_uplift_pct": 9.7, "margin_delta_pct": -3.8},
                "ulta": {"sales_uplift_pct": 3.9, "margin_delta_pct": -2.4},
            },
            "notes": "Built baseline moisturizer velocity but MOI_M3 stayed weak despite discount.",
            "campaign_tags": ["moisturizer", "winter", "baseline"],
            "success_criteria": {"adds_min": 3600, "repeat_loss_rate_max": 0.2, "payback_months_max": 8, "ltv_cac_ratio_min": 1.8},
            "actual_performance": {"adds_achieved": 3715, "repeat_loss_rate_at_8w": 0.172, "payback_months": 7.3, "ltv_cac_ratio": 1.94},
        },
        "PROMO_SPRING_BASELINE_SPF_2026": {
            "promo_id": "PROMO_SPRING_BASELINE_SPF_2026",
            "campaign_name": "Spring SPF Kickoff Bundle",
            "story_phase": "baseline",
            "story_summary": "Season start baseline to seed sunscreen trial while inventory is still high and social momentum is neutral.",
            "start_date": week_start(1).isoformat(),
            "end_date": week_start(2).isoformat(),
            "discount_pct": 10,
            "discount_type": "percentage",
            "duration_weeks": 2,
            "duration_months": 0.5,
            "eligible_tiers": ["ad_supported"],
            "eligible_cohorts": ["value_seeker", "deal_hunter", "promo_triggered"],
            "eligible_channels": ["target", "amazon"],
            "exclusions": [],
            "roll_off_date": week_start(3).isoformat(),
            "roll_off_type": "soft",
            "roll_off_window_weeks": 1,
            "promo_code": "SPF10",
            "attribution_window_days": 7,
            "target_adds": 4200,
            "actual_adds": 4382,
            "target_roi": 1.5,
            "actual_roi": 1.57,
            "marketing_spend_usd": 76000,
            "incremental_revenue_usd": 149000,
            "repeat_loss_expected": False,
            "repeat_loss_lag_weeks": 0,
            "season": "spring_summer_2026",
            "promoted_skus": ["SUN_S1", "SUN_S2", "MOI_M1"],
            "sku_results": [
                {"sku_id": "SUN_S1", "sku_name": "Daily Shield SPF 40", "sales_uplift_pct": 12.6, "channel": "target", "outcome": "up"},
                {"sku_id": "SUN_S2", "sku_name": "Invisible Mist SPF 50", "sales_uplift_pct": 9.8, "channel": "amazon", "outcome": "up"},
                {"sku_id": "MOI_M1", "sku_name": "Hydra Daily Lotion", "sales_uplift_pct": 5.4, "channel": "target", "outcome": "up"},
            ],
            "channel_results": {
                "target": {"sales_uplift_pct": 9.9, "margin_delta_pct": -2.9},
                "amazon": {"sales_uplift_pct": 8.4, "margin_delta_pct": -3.3},
            },
            "notes": "Established early sunscreen velocity and validated SUN_S1/SUN_S2 elasticity in mass channels.",
            "campaign_tags": ["sunscreen", "baseline", "mass"],
            "success_criteria": {"adds_min": 4000, "repeat_loss_rate_max": 0.16, "payback_months_max": 7, "ltv_cac_ratio_min": 1.9},
            "actual_performance": {"adds_achieved": 4382, "repeat_loss_rate_at_8w": 0.131, "payback_months": 6.2, "ltv_cac_ratio": 2.07},
        },
        "PROMO_MEMORIAL_DAY_MASS_DEFENSE_2026": {
            "promo_id": "PROMO_MEMORIAL_DAY_MASS_DEFENSE_2026",
            "campaign_name": "Memorial Week SPF Price Defense",
            "story_phase": "pivot",
            "story_summary": "Competitor marketplaces undercut prices; we defended volume in Target/Amazon while accepting temporary margin pressure.",
            "start_date": week_start(4).isoformat(),
            "end_date": week_start(5).isoformat(),
            "discount_pct": 18,
            "discount_type": "percentage",
            "duration_weeks": 2,
            "duration_months": 0.5,
            "eligible_tiers": ["ad_supported"],
            "eligible_cohorts": ["value_seeker", "deal_hunter", "promo_triggered"],
            "eligible_channels": ["target", "amazon"],
            "exclusions": [],
            "roll_off_date": week_start(6).isoformat(),
            "roll_off_type": "hard",
            "roll_off_window_weeks": 1,
            "promo_code": "DEFEND18",
            "attribution_window_days": 7,
            "target_adds": 5400,
            "actual_adds": 5620,
            "target_roi": 1.4,
            "actual_roi": 1.52,
            "marketing_spend_usd": 98000,
            "incremental_revenue_usd": 191000,
            "repeat_loss_expected": True,
            "repeat_loss_lag_weeks": 5,
            "season": "spring_summer_2026",
            "promoted_skus": ["SUN_S1", "SUN_S2", "MOI_M1", "MOI_M2", "MOI_M3"],
            "sku_results": [
                {"sku_id": "SUN_S1", "sku_name": "Daily Shield SPF 40", "sales_uplift_pct": 23.4, "channel": "amazon", "outcome": "up"},
                {"sku_id": "SUN_S2", "sku_name": "Invisible Mist SPF 50", "sales_uplift_pct": 16.1, "channel": "target", "outcome": "up"},
                {"sku_id": "MOI_M1", "sku_name": "Hydra Daily Lotion", "sales_uplift_pct": 11.8, "channel": "target", "outcome": "up"},
                {"sku_id": "MOI_M2", "sku_name": "Barrier Repair Cream", "sales_uplift_pct": -2.9, "channel": "amazon", "outcome": "down"},
                {"sku_id": "MOI_M3", "sku_name": "Night Recovery Balm", "sales_uplift_pct": -5.6, "channel": "target", "outcome": "down"},
            ],
            "channel_results": {
                "amazon": {"sales_uplift_pct": 17.8, "margin_delta_pct": -6.2},
                "target": {"sales_uplift_pct": 13.4, "margin_delta_pct": -5.4},
            },
            "notes": "Volume defense worked for SPF, but moisturizer SKUs MOI_M2/MOI_M3 were cannibalized and should be excluded next cycle.",
            "campaign_tags": ["mass", "defense", "competitive", "promo-optimization"],
            "success_criteria": {"adds_min": 5000, "repeat_loss_rate_max": 0.2, "payback_months_max": 8, "ltv_cac_ratio_min": 1.8},
            "actual_performance": {"adds_achieved": 5620, "repeat_loss_rate_at_8w": 0.162, "payback_months": 6.5, "ltv_cac_ratio": 2.01},
        },
        "PROMO_TIKTOK_SPORT_GEL_HOLD_2026": {
            "promo_id": "PROMO_TIKTOK_SPORT_GEL_HOLD_2026",
            "campaign_name": "TikTok Sport Gel Momentum Hold",
            "story_phase": "pivot",
            "story_summary": "A social spike reduced effective elasticity for premium SPF, so we shifted to selective pricing and creator-led messaging.",
            "start_date": week_start(7).isoformat(),
            "end_date": week_start(8).isoformat(),
            "discount_pct": 5,
            "discount_type": "percentage",
            "duration_weeks": 1,
            "duration_months": 0.25,
            "eligible_tiers": ["ad_free"],
            "eligible_cohorts": ["prestige_loyalist", "gift_buyer", "routine_refill"],
            "eligible_channels": ["sephora", "ulta"],
            "exclusions": ["MOI_M3"],
            "roll_off_date": week_start(9).isoformat(),
            "roll_off_type": "soft",
            "roll_off_window_weeks": 1,
            "promo_code": "SOCIAL5",
            "attribution_window_days": 7,
            "target_adds": 2400,
            "actual_adds": 2518,
            "target_roi": 1.8,
            "actual_roi": 2.03,
            "marketing_spend_usd": 41000,
            "incremental_revenue_usd": 102000,
            "repeat_loss_expected": False,
            "repeat_loss_lag_weeks": 0,
            "season": "spring_summer_2026",
            "promoted_skus": ["SUN_S3", "SUN_S2", "MOI_M2"],
            "sku_results": [
                {"sku_id": "SUN_S3", "sku_name": "Sport Gel SPF 60", "sales_uplift_pct": 15.7, "channel": "sephora", "outcome": "up"},
                {"sku_id": "SUN_S2", "sku_name": "Invisible Mist SPF 50", "sales_uplift_pct": 7.9, "channel": "ulta", "outcome": "up"},
                {"sku_id": "MOI_M2", "sku_name": "Barrier Repair Cream", "sales_uplift_pct": 3.1, "channel": "ulta", "outcome": "up"},
            ],
            "channel_results": {
                "sephora": {"sales_uplift_pct": 9.8, "margin_delta_pct": -1.2},
                "ulta": {"sales_uplift_pct": 8.6, "margin_delta_pct": -1.6},
            },
            "notes": "Maintained premium pricing power with light discount because social momentum lifted conversion.",
            "campaign_tags": ["social", "pivot", "prestige", "margin-protect"],
            "success_criteria": {"adds_min": 2200, "repeat_loss_rate_max": 0.12, "payback_months_max": 6, "ltv_cac_ratio_min": 2.2},
            "actual_performance": {"adds_achieved": 2518, "repeat_loss_rate_at_8w": 0.091, "payback_months": 5.2, "ltv_cac_ratio": 2.44},
        },
        "PROMO_PRESTIGE_GLOW_WEEKEND_2026": {
            "promo_id": "PROMO_PRESTIGE_GLOW_WEEKEND_2026",
            "campaign_name": "Prestige Glow Weekend Set",
            "story_phase": "pivot",
            "story_summary": "Selective prestige weekend offer to lift velocity in Sephora/Ulta without broad market discounting.",
            "start_date": week_start(11).isoformat(),
            "end_date": week_start(12).isoformat(),
            "discount_pct": 8,
            "discount_type": "percentage",
            "duration_weeks": 1,
            "duration_months": 0.25,
            "eligible_tiers": ["ad_free"],
            "eligible_cohorts": ["prestige_loyalist", "routine_refill", "gift_buyer"],
            "eligible_channels": ["sephora", "ulta"],
            "exclusions": ["SUN_S1"],
            "roll_off_date": week_start(13).isoformat(),
            "roll_off_type": "soft",
            "roll_off_window_weeks": 1,
            "promo_code": "GLOW8",
            "attribution_window_days": 7,
            "target_adds": 3000,
            "actual_adds": 3085,
            "target_roi": 1.7,
            "actual_roi": 1.86,
            "marketing_spend_usd": 56000,
            "incremental_revenue_usd": 114000,
            "repeat_loss_expected": False,
            "repeat_loss_lag_weeks": 0,
            "season": "spring_summer_2026",
            "promoted_skus": ["SUN_S2", "SUN_S3", "MOI_M2"],
            "sku_results": [
                {"sku_id": "SUN_S2", "sku_name": "Invisible Mist SPF 50", "sales_uplift_pct": 11.4, "channel": "sephora", "outcome": "up"},
                {"sku_id": "SUN_S3", "sku_name": "Sport Gel SPF 60", "sales_uplift_pct": 8.1, "channel": "ulta", "outcome": "up"},
                {"sku_id": "MOI_M2", "sku_name": "Barrier Repair Cream", "sales_uplift_pct": 4.7, "channel": "ulta", "outcome": "up"},
            ],
            "channel_results": {
                "sephora": {"sales_uplift_pct": 7.4, "margin_delta_pct": -1.8},
                "ulta": {"sales_uplift_pct": 9.1, "margin_delta_pct": -2.1},
            },
            "notes": "Kept discount shallow and concentrated on highest prestige response products.",
            "campaign_tags": ["prestige", "selective", "margin-protect"],
            "success_criteria": {"adds_min": 2600, "repeat_loss_rate_max": 0.13, "payback_months_max": 7, "ltv_cac_ratio_min": 2.1},
            "actual_performance": {"adds_achieved": 3085, "repeat_loss_rate_at_8w": 0.102, "payback_months": 5.7, "ltv_cac_ratio": 2.33},
        },
        "PROMO_WEEK17_CLEARANCE_MIX_2026": {
            "promo_id": "PROMO_WEEK17_CLEARANCE_MIX_2026",
            "campaign_name": "Week-17 Smart Clearance Mix",
            "story_phase": "future",
            "story_summary": "End-of-season blend of targeted depth and SKU exclusions to close inventory without margin collapse.",
            "start_date": week_start(17).isoformat(),
            "end_date": week_start(17).isoformat(),
            "discount_pct": 20,
            "discount_type": "percentage",
            "duration_weeks": 1,
            "duration_months": 0.25,
            "eligible_tiers": ["ad_supported", "ad_free"],
            "eligible_cohorts": ["deal_hunter", "promo_triggered", "lapsed_high_value"],
            "eligible_channels": ["target", "amazon", "sephora", "ulta"],
            "exclusions": ["MOI_M3"],
            "roll_off_date": "2026-06-01",
            "roll_off_type": "hard",
            "roll_off_window_weeks": 1,
            "promo_code": "CLOSE20",
            "attribution_window_days": 7,
            "target_adds": 6100,
            "actual_adds": 5988,
            "target_roi": 1.35,
            "actual_roi": 1.33,
            "marketing_spend_usd": 113000,
            "incremental_revenue_usd": 216000,
            "repeat_loss_expected": True,
            "repeat_loss_lag_weeks": 3,
            "season": "spring_summer_2026",
            "promoted_skus": ["SUN_S1", "SUN_S2", "SUN_S3", "MOI_M1", "MOI_M2"],
            "sku_results": [
                {"sku_id": "SUN_S1", "sku_name": "Daily Shield SPF 40", "sales_uplift_pct": 18.2, "channel": "amazon", "outcome": "up"},
                {"sku_id": "SUN_S2", "sku_name": "Invisible Mist SPF 50", "sales_uplift_pct": 16.5, "channel": "target", "outcome": "up"},
                {"sku_id": "SUN_S3", "sku_name": "Sport Gel SPF 60", "sales_uplift_pct": 11.4, "channel": "sephora", "outcome": "up"},
                {"sku_id": "MOI_M1", "sku_name": "Hydra Daily Lotion", "sales_uplift_pct": 8.9, "channel": "target", "outcome": "up"},
                {"sku_id": "MOI_M2", "sku_name": "Barrier Repair Cream", "sales_uplift_pct": 5.8, "channel": "ulta", "outcome": "up"},
            ],
            "channel_results": {
                "target": {"sales_uplift_pct": 14.1, "margin_delta_pct": -7.2},
                "amazon": {"sales_uplift_pct": 15.3, "margin_delta_pct": -7.8},
                "sephora": {"sales_uplift_pct": 9.2, "margin_delta_pct": -4.9},
                "ulta": {"sales_uplift_pct": 8.5, "margin_delta_pct": -5.1},
            },
            "notes": "Planned future-state campaign to drive week-17 inventory close-to-zero with curated SKU mix.",
            "campaign_tags": ["future-vision", "clearance", "inventory-to-zero", "optimization"],
            "success_criteria": {"adds_min": 5900, "repeat_loss_rate_max": 0.22, "payback_months_max": 9, "ltv_cac_ratio_min": 1.7},
            "actual_performance": {"adds_achieved": 5988, "repeat_loss_rate_at_8w": 0.201, "payback_months": 8.4, "ltv_cac_ratio": 1.82},
        },
    }
    write_json(DATA_DIR / "promo_metadata.json", promo_metadata)

    scenarios = [
        {
            "id": "scenario_001",
            "name": "Mass Defensive Promo (Target + Amazon)",
            "category": "promotion",
            "model_type": "acquisition",
            "description": "Defend mass volume after competitor price drop on key SKUs.",
            "impact_summary": "Higher sell-through, lower short-term margin, better week-17 inventory position.",
            "config": {
                "tier": "ad_supported",
                "current_price": 20.1,
                "new_price": 16.78,
                "price_change_pct": -16.5,
                "promotion": {
                    "type": "competitive_defense",
                    "duration_months": 0.5,
                    "discount_pct": 16.5,
                    "promo_code": "DEFEND16",
                    "eligibility": "mass_channels",
                    "start_date": week_start(8).isoformat(),
                    "end_date": week_start(9).isoformat(),
                },
                "target_segment": "all",
                "effective_date": week_start(8).isoformat(),
                "grandfathering": False,
            },
            "constraints": {
                "platform_compliant": True,
                "price_change_12mo_limit": True,
                "notice_period_30d": True,
                "min_price": 12.0,
                "max_price": 28.0,
            },
            "priority": "high",
            "business_rationale": "Volume defense when competitors undercut in mass channels.",
        },
        {
            "id": "scenario_002",
            "name": "Prestige Hold During Social Spike",
            "category": "price_hold",
            "model_type": "acquisition",
            "description": "Hold prestige pricing when social engagement is elevated to maximize margin.",
            "impact_summary": "Lower promo spend and stable units due lower effective elasticity.",
            "config": {
                "tier": "ad_free",
                "current_price": 31.4,
                "new_price": 31.4,
                "price_change_pct": 0.0,
                "promotion": None,
                "target_segment": "all",
                "effective_date": week_start(11).isoformat(),
                "grandfathering": False,
            },
            "constraints": {
                "platform_compliant": True,
                "price_change_12mo_limit": True,
                "notice_period_30d": True,
                "min_price": 24.0,
                "max_price": 44.0,
            },
            "priority": "high",
            "business_rationale": "High social pull supports hold-price strategy in prestige channels.",
        },
    ]
    write_json(DATA_DIR / "scenarios.json", scenarios)

    elasticity_params = {
        "metadata": {
            "generated_date": "2026-03-04",
            "version": "5.0",
            "description": "Promotion-optimization elasticity parameters for retail channels and SKUs.",
            "estimation_method": "Synthetic calibration with channel dynamics, competitor delta, social modifiers, and cannibalization.",
            "confidence_level": 0.9,
        },
        "tiers": {
            "ad_supported": {
                "base_elasticity": -2.15,
                "confidence_interval": 0.22,
                "std_error": 0.12,
                "interpretation": "Mass channels are more price-sensitive and react strongly to competitor moves.",
                "price_range": {"min": 12.0, "max": 30.0, "current": 20.1},
                "segments": {
                    "new_0_3mo": {"elasticity": -2.5, "confidence_interval": 0.3, "size_pct": 0.31},
                    "tenured_3_12mo": {"elasticity": -2.1, "confidence_interval": 0.24, "size_pct": 0.39},
                    "tenured_12plus": {"elasticity": -1.72, "confidence_interval": 0.2, "size_pct": 0.30},
                },
                "cohort_elasticity": {
                    "by_age": {"18-24": -2.42, "25-34": -2.28, "35-44": -2.12, "45-54": -1.96, "55+": -1.82},
                    "by_device": {"mobile": -2.3, "web": -2.08, "in_store": -1.9, "marketplace": -2.46, "omni": -1.85},
                    "by_channel": {"target": -2.18, "amazon": -2.36, "sephora": -1.58, "ulta": -1.66, "dtc": -1.85},
                    "by_promo_status": {"full_price": -2.0, "promotional": -2.7},
                },
            },
            "ad_free": {
                "base_elasticity": -1.42,
                "confidence_interval": 0.18,
                "std_error": 0.1,
                "interpretation": "Prestige channels are less price-sensitive and better suited for selective promo depth.",
                "price_range": {"min": 24.0, "max": 44.0, "current": 31.4},
                "segments": {
                    "new_0_3mo": {"elasticity": -1.75, "confidence_interval": 0.24, "size_pct": 0.26},
                    "tenured_3_12mo": {"elasticity": -1.44, "confidence_interval": 0.2, "size_pct": 0.35},
                    "tenured_12plus": {"elasticity": -1.18, "confidence_interval": 0.16, "size_pct": 0.39},
                },
                "cohort_elasticity": {
                    "by_age": {"18-24": -1.65, "25-34": -1.56, "35-44": -1.44, "45-54": -1.36, "55+": -1.24},
                    "by_device": {"mobile": -1.52, "web": -1.41, "in_store": -1.29, "marketplace": -1.63, "omni": -1.33},
                    "by_channel": {"target": -1.68, "amazon": -1.82, "sephora": -1.22, "ulta": -1.28, "dtc": -1.35},
                    "by_promo_status": {"full_price": -1.34, "promotional": -1.88},
                },
            },
        },
        "cross_elasticity": {"ad_supported_to_ad_free": 0.29, "ad_free_to_ad_supported": 0.18},
        "time_horizon_adjustments": {
            "short_term_0_3mo": {"multiplier": 1.08, "description": "Immediate promo response period."},
            "medium_term_3_12mo": {"multiplier": 1.0, "description": "In-season baseline response."},
            "long_term_12plus": {"multiplier": 0.86, "description": "Loyalty reduces sensitivity over longer horizon."},
        },
        "external_factor_adjustments": {
            "competitive": {
                "competitor_price_increase": {"elasticity_multiplier": 0.9},
                "competitor_price_decrease": {"elasticity_multiplier": 1.15},
                "major_competitor_promo": {"elasticity_multiplier": 1.2},
            },
            "social": {"viral_spike": {"elasticity_multiplier": 0.82}, "negative_sentiment": {"elasticity_multiplier": 1.12}},
        },
        "willingness_to_pay": {
            "ad_supported": {"mean": 21.0, "median": 20.0, "std_dev": 3.2},
            "ad_free": {"mean": 32.4, "median": 31.2, "std_dev": 4.3},
        },
        "repeat_loss_elasticity": {
            "ad_supported": {"repeat_loss_elasticity": 0.88, "baseline_repeat_loss": 0.041},
            "ad_free": {"repeat_loss_elasticity": 0.62, "baseline_repeat_loss": 0.032},
        },
        "acquisition_elasticity": {
            "ad_supported": {"acquisition_elasticity": -1.74},
            "ad_free": {"acquisition_elasticity": -1.35},
        },
        "notes": {
            "use_case": "Promotion optimization with season inventory and channel-level strategy.",
            "assumptions": [
                "Competitor delta affects demand at unchanged internal prices.",
                "Social engagement reduces elasticity magnitude during viral moments.",
                "Cannibalization is strongest within same product group.",
            ],
        },
    }
    write_json(DATA_DIR / "elasticity-params.json", elasticity_params)

    write_json(
        DATA_DIR / "metadata.json",
        {
            "customers.csv": "Customer-level records with channel group, region, and purchase behavior.",
            "channel_weekly.csv": "Weekly KPIs by channel group (mass vs prestige), aggregated from SKU-channel data.",
            "sku_channel_weekly.csv": "Core optimization table by week, SKU, and channel with inventory and competitor fields.",
            "season_calendar.csv": "17-week season phases, demand index, inventory position, and markdown risk.",
            "price_calendar.csv": "Promo cadence and effective price by channel group.",
            "market_signals.csv": "Competitor pricing and macro signals aligned to season.",
            "social_signals.csv": "Social listening and engagement trend used to modulate elasticity.",
            "retail_events.csv": "Event timeline including competitor price changes and social spikes.",
            "promo_metadata.json": "Historical promotions with SKU/channel effectiveness drill-down.",
            "scenarios.json": "Priority promotion optimization scenarios.",
            "elasticity-params.json": "Channel and segment elasticity coefficients with external factor modifiers.",
        },
    )

    write_json(
        DATA_DIR / "validation_windows.json",
        {
            "clean_windows": [
                {"start_date": week_start(1).isoformat(), "end_date": week_start(3).isoformat(), "notes": "Stable pre-shock learning window"},
                {"start_date": week_start(9).isoformat(), "end_date": week_start(10).isoformat(), "notes": "Post-promo stabilization"},
            ],
            "confounded_windows": [
                {"start_date": week_start(4).isoformat(), "end_date": week_start(5).isoformat(), "notes": "Mass promo + competitor drop overlap"},
                {"start_date": week_start(11).isoformat(), "end_date": week_start(11).isoformat(), "notes": "Social viral spike"},
            ],
        },
    )

    print("Generated promotion optimization datasets for 17-week season.")


if __name__ == "__main__":
    generate()
