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
HISTORY_WEEKS = 52

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

COMP_SELLER_BY_CHANNEL = {
    "target": "La Roche-Posay via Target",
    "amazon": "Neutrogena Store",
    "sephora": "EltaMD Official",
    "ulta": "Coola Suncare",
}

CHANNEL_PRICE_ADJ = {"target": -0.50, "amazon": -1.0, "sephora": 1.0, "ulta": 0.50}
CHANNEL_COMP_PRESSURE = {"target": 1.06, "amazon": 1.14, "sephora": 0.94, "ulta": 0.97}
CHANNEL_SHARE_WEIGHT = {"target": 0.55, "amazon": 0.45, "sephora": 0.52, "ulta": 0.48}
GROUP_PROMO_WEEKS = {"mass": {4, 5, 8, 12, 15}, "prestige": {3, 7, 11, 14}}
COMP_REVIEW_BASE = {"SUN_S1": 14200, "SUN_S2": 9800, "SUN_S3": 6400, "MOI_M1": 7600, "MOI_M2": 5200, "MOI_M3": 3800}
COMP_RATING_BASE = {"SUN_S1": 4.3, "SUN_S2": 4.4, "SUN_S3": 4.5, "MOI_M1": 4.2, "MOI_M2": 4.3, "MOI_M3": 4.4}
BASE_SOCIAL_AUDIENCE = {"tiktok": 892000, "instagram": 1640000, "youtube": 245000, "twitter": 167000}
CUSTOMER_CHANNEL_WEIGHTS = {
    "mass": {"target": 0.57, "amazon": 0.43},
    "prestige": {"sephora": 0.53, "ulta": 0.47},
}
REGION_WEIGHTS = {"west": 0.31, "south": 0.27, "northeast": 0.24, "midwest": 0.18}
AGE_WEIGHTS = {
    "mass": {"18-24": 0.17, "25-34": 0.34, "35-44": 0.25, "45-54": 0.15, "55+": 0.09},
    "prestige": {"18-24": 0.12, "25-34": 0.33, "35-44": 0.29, "45-54": 0.17, "55+": 0.09},
}
INCOME_WEIGHTS = {
    "mass": {"<50k": 0.2, "50-100k": 0.41, "100-150k": 0.25, "150k+": 0.14},
    "prestige": {"<50k": 0.09, "50-100k": 0.28, "100-150k": 0.31, "150k+": 0.32},
}
ACQUISITION_SEGMENTS = [
    "seasonal_first_time",
    "routine_refill",
    "gift_buyer",
    "influencer_discovered",
    "promo_triggered",
]
ENGAGEMENT_SEGMENTS = [
    "prestige_loyalist",
    "value_seeker",
    "deal_hunter",
    "occasional_shop",
    "channel_switcher",
]
MONETIZATION_SEGMENTS = [
    "single_sku_staple",
    "multi_sku_builder",
    "value_bundle_buyer",
    "premium_add_on",
    "trial_size_sampler",
]
ACQUISITION_WEIGHTS = {
    "mass": {"seasonal_first_time": 0.23, "routine_refill": 0.18, "gift_buyer": 0.13, "influencer_discovered": 0.17, "promo_triggered": 0.29},
    "prestige": {"seasonal_first_time": 0.16, "routine_refill": 0.29, "gift_buyer": 0.17, "influencer_discovered": 0.24, "promo_triggered": 0.14},
}
ENGAGEMENT_WEIGHTS = {
    "mass": {"prestige_loyalist": 0.09, "value_seeker": 0.31, "deal_hunter": 0.23, "occasional_shop": 0.2, "channel_switcher": 0.17},
    "prestige": {"prestige_loyalist": 0.34, "value_seeker": 0.23, "deal_hunter": 0.1, "occasional_shop": 0.18, "channel_switcher": 0.15},
}
MONETIZATION_WEIGHTS = {
    "mass": {"single_sku_staple": 0.32, "multi_sku_builder": 0.16, "value_bundle_buyer": 0.24, "premium_add_on": 0.08, "trial_size_sampler": 0.2},
    "prestige": {"single_sku_staple": 0.22, "multi_sku_builder": 0.27, "value_bundle_buyer": 0.12, "premium_add_on": 0.24, "trial_size_sampler": 0.15},
}
TENURE_RANGES = {
    "seasonal_first_time": (14, 120),
    "routine_refill": (180, 900),
    "gift_buyer": (45, 420),
    "influencer_discovered": (30, 240),
    "promo_triggered": (21, 210),
}
CHANNEL_AOV_BASE = {"target": 36.0, "amazon": 34.5, "sephora": 52.0, "ulta": 48.5}
ACQUISITION_CAC_BASE = {
    "mass": {"seasonal_first_time": 14.5, "routine_refill": 9.8, "gift_buyer": 12.6, "influencer_discovered": 16.2, "promo_triggered": 11.3},
    "prestige": {"seasonal_first_time": 18.4, "routine_refill": 12.5, "gift_buyer": 15.2, "influencer_discovered": 21.0, "promo_triggered": 14.1},
}
CURRENT_CUSTOMER_MULTIPLIER = {"mass": 18.0, "prestige": 15.0}
SEGMENT_SAMPLE_SIZE = 15000
HISTORY_SEASONALITY = {
    "sunscreen": {1: 0.56, 2: 0.64, 3: 0.82, 4: 1.0, 5: 1.14, 6: 1.25, 7: 1.3, 8: 1.18, 9: 1.02, 10: 0.84, 11: 0.68, 12: 0.58},
    "moisturizer": {1: 1.22, 2: 1.15, 3: 1.02, 4: 0.94, 5: 0.9, 6: 0.87, 7: 0.84, 8: 0.88, 9: 0.97, 10: 1.08, 11: 1.17, 12: 1.24},
}
HISTORY_CHANNEL_SCALE = {"target": 1.0, "amazon": 0.92, "sephora": 0.88, "ulta": 0.82}
SKU_CHANNEL_FIT = {
    "SUN_S1": {"target": 1.0, "amazon": 1.16, "sephora": 0.97, "ulta": 0.94},
    "SUN_S2": {"target": 0.98, "amazon": 1.08, "sephora": 1.05, "ulta": 1.0},
    "SUN_S3": {"target": 1.14, "amazon": 1.06, "sephora": 0.9, "ulta": 0.88},
    "MOI_M1": {"target": 0.95, "amazon": 0.97, "sephora": 1.12, "ulta": 1.03},
    "MOI_M2": {"target": 0.92, "amazon": 0.98, "sephora": 1.08, "ulta": 1.06},
    "MOI_M3": {"target": 1.02, "amazon": 0.9, "sephora": 0.96, "ulta": 1.14},
}
SKU_COMPETITOR_PRESSURE = {
    "SUN_S1": 0.03,
    "SUN_S2": 0.024,
    "SUN_S3": 0.015,
    "MOI_M1": 0.02,
    "MOI_M2": 0.012,
    "MOI_M3": 0.008,
}
SKU_SOCIAL_BASE = {
    "SUN_S1": 4.5,
    "SUN_S2": 3.2,
    "SUN_S3": 1.8,
    "MOI_M1": 2.4,
    "MOI_M2": 0.8,
    "MOI_M3": -1.4,
}
CHANNEL_SOCIAL_OFFSET = {"target": -1.4, "amazon": -0.7, "sephora": 2.6, "ulta": 1.1}
WEEK_SKU_SOCIAL_SPIKES = {
    3: {"MOI_M1": 2.8, "MOI_M2": 2.0},
    5: {"SUN_S1": 8.0, "SUN_S2": 5.4, "SUN_S3": 4.6},
    7: {"SUN_S1": 3.5, "SUN_S2": 5.0, "MOI_M1": 2.4},
    8: {"SUN_S1": 2.8, "SUN_S3": 4.1},
    11: {"MOI_M1": 6.4, "MOI_M2": 4.8, "MOI_M3": 3.2},
    14: {"SUN_S3": 5.6, "SUN_S1": 2.9},
    15: {"MOI_M3": 4.2, "SUN_S3": 2.1},
}
CURRENT_SKU_WEEK_EVENTS = {
    ("SUN_S1", "amazon", 7): {"comp_extra": 0.036, "social_extra": 3.6, "demand_extra": 0.06},
    ("SUN_S2", "sephora", 7): {"social_extra": 4.8, "demand_extra": 0.05},
    ("MOI_M1", "sephora", 7): {"social_extra": 2.8, "demand_extra": 0.04},
    ("MOI_M3", "ulta", 11): {"social_extra": 3.8, "demand_extra": 0.05},
}


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
    SkuDef("SUN_S1", "Unseen Sunscreen SPF 40", "sunscreen", 34.0, 38.0, -2.35, -1.55, 145, 110, 3200, 2400),
    SkuDef("SUN_S2", "Glowscreen SPF 40", "sunscreen", 36.0, 38.0, -2.15, -1.42, 125, 95, 2800, 2100),
    SkuDef("SUN_S3", "Play Everyday Lotion SPF 50", "sunscreen", 22.0, 32.0, -1.95, -1.25, 185, 105, 4200, 2000),
    SkuDef("MOI_M1", "Superscreen Daily Moisturizer", "moisturizer", 28.0, 38.0, -2.1, -1.4, 110, 85, 2600, 1900),
    SkuDef("MOI_M2", "Mineral Sheerscreen SPF 30", "moisturizer", 32.0, 38.0, -1.92, -1.3, 90, 75, 2200, 1700),
    SkuDef("MOI_M3", "(Re)setting Powder SPF 35", "moisturizer", 26.0, 34.0, -1.75, -1.18, 95, 68, 1800, 1400),
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


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def weighted_choice(options: dict[str, float]) -> str:
    keys = list(options.keys())
    weights = list(options.values())
    return random.choices(keys, weights=weights, k=1)[0]


def bounded_normal(mean: float, std_dev: float, low: float, high: float) -> float:
    return clamp(random.gauss(mean, std_dev), low, high)


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


def product_demand_factor(w: int, product_group: str) -> float:
    if product_group == "sunscreen":
        if w <= 4:
            return round(0.92 + w * 0.07, 3)
        if w <= 10:
            return round(1.16 + (w - 4) * 0.034, 3)
        if w <= 13:
            return round(1.36 - (w - 10) * 0.04, 3)
        return round(1.18 - (w - 13) * 0.07, 3)
    if w <= 4:
        return round(1.06 + w * 0.025, 3)
    if w <= 10:
        return round(1.14 - (w - 4) * 0.022, 3)
    if w <= 13:
        return round(1.0 - (w - 10) * 0.018, 3)
    return round(0.94 - (w - 13) * 0.028, 3)


def social_index(w: int) -> float:
    base = 58 + 6 * math.sin(w / 2.8)
    spike = 18 if w in {5, 11} else (9 if w in {8, 14} else 0)
    return round(max(45.0, min(95.0, base + spike + random.uniform(-2.2, 2.2))), 2)


def current_social_score(w: int, sku: SkuDef, channel: str) -> float:
    base = social_index(w)
    group_bias = 2.6 if sku.product_group == "sunscreen" and w >= 5 else 0.0
    group_bias += 2.2 if sku.product_group == "moisturizer" and w in {1, 2, 3, 11, 12, 13, 14, 15, 16, 17} else 0.0
    channel_bonus = CHANNEL_SOCIAL_OFFSET[channel]
    channel_bonus += 1.2 if sku.product_group == "moisturizer" and channel in {"sephora", "ulta"} else 0.0
    channel_bonus += 1.0 if sku.product_group == "sunscreen" and channel == "amazon" else 0.0
    spike = WEEK_SKU_SOCIAL_SPIKES.get(w, {}).get(sku.sku_id, 0.0)
    event = CURRENT_SKU_WEEK_EVENTS.get((sku.sku_id, channel, w), {})
    score = base + SKU_SOCIAL_BASE[sku.sku_id] + group_bias + channel_bonus + spike + event.get("social_extra", 0.0) + random.uniform(-2.4, 2.4)
    return round(clamp(score, 42.0, 94.0), 2)


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


def competitor_discount_factor(channel: str, sku: SkuDef, w: int) -> float:
    base = 0.03 if CHANNELS[channel] == "prestige" else 0.05
    if channel == "amazon" and w in {4, 8, 12, 15}:
        base += 0.10
    if channel == "target" and w in {5, 12, 15}:
        base += 0.06
    if CHANNELS[channel] == "prestige" and w in {7, 14}:
        base += 0.03
    base += SKU_COMPETITOR_PRESSURE[sku.sku_id]
    if sku.product_group == "sunscreen" and w in {5, 6, 7, 8, 12, 15}:
        base += 0.012
    if sku.product_group == "moisturizer" and w in {11, 12, 13, 14, 15}:
        base += 0.008
    if channel in {"sephora", "ulta"} and sku.sku_id in {"MOI_M1", "MOI_M2"} and w in {7, 11, 14}:
        base += 0.012
    event = CURRENT_SKU_WEEK_EVENTS.get((sku.sku_id, channel, w), {})
    base += event.get("comp_extra", 0.0)
    return max(0.0, min(0.24, base + random.uniform(-0.018, 0.024)))


def competitor_sku_code(channel: str, sku_id: str) -> str:
    prefix = {
        "target": "TGT",
        "amazon": "AMZ",
        "sephora": "SEP",
        "ulta": "ULT",
    }[channel]
    return f"{prefix}-{sku_id.replace('_', '-')}"


def history_week_start(offset_from_current: int) -> date:
    return week_start(CURRENT_WEEK) - timedelta(days=(HISTORY_WEEKS - 1 - offset_from_current) * 7)


def history_promo_depth(group: str, channel: str, week_date: date, product_group: str) -> float:
    month = week_date.month
    if group == "mass":
        if month in {5, 7, 11}:
            return random.choice([12.0, 15.0, 18.0])
        if month in {3, 9} and product_group == "sunscreen":
            return random.choice([8.0, 10.0, 12.0])
        if month == 12 and product_group == "moisturizer":
            return random.choice([10.0, 12.0, 15.0])
        if channel == "amazon" and week_date.day <= 10 and month in {7, 10}:
            return random.choice([12.0, 15.0])
        return 0.0
    if month in {4, 11}:
        return random.choice([6.0, 8.0, 10.0])
    if month == 12 and product_group == "moisturizer":
        return random.choice([6.0, 8.0])
    if month == 3 and product_group == "sunscreen":
        return random.choice([4.0, 6.0])
    return 0.0


def history_social_buzz(week_date: date, product_group: str, channel: str) -> float:
    month = week_date.month
    seasonality = HISTORY_SEASONALITY[product_group][month]
    buzz = 52 + (seasonality - 1) * 28
    if product_group == "sunscreen" and month in {5, 6, 7}:
        buzz += 6
    if product_group == "moisturizer" and month in {11, 12, 1}:
        buzz += 4
    if channel in {"sephora", "ulta"}:
        buzz += 2.5
    if week_date.month == 7 and week_date.day <= 15:
        buzz += 8
    if week_date.month == 11 and week_date.day >= 20:
        buzz += 7
    if week_date.month == 3 and week_date.day <= 25 and product_group == "sunscreen":
        buzz += 5
    return round(clamp(buzz + random.uniform(-3.6, 3.8), 42.0, 92.0), 2)


def history_competitor_discount(channel: str, week_date: date, product_group: str) -> float:
    base = 0.052 if CHANNELS[channel] == "mass" else 0.026
    month = week_date.month
    if channel == "amazon" and month in {7, 11}:
        base += 0.08
    elif channel == "target" and month in {5, 11}:
        base += 0.055
    elif channel in {"sephora", "ulta"} and month in {4, 11}:
        base += 0.025
    if product_group == "sunscreen" and month in {5, 6, 7}:
        base += 0.012
    if product_group == "moisturizer" and month in {11, 12, 1}:
        base += 0.008
    return round(clamp(base + random.uniform(-0.012, 0.016), 0.0, 0.22), 4)


def history_units_for_row(sku: SkuDef, channel: str, own_price: float, comp_price: float, social_buzz: float, week_date: date) -> float:
    group = CHANNELS[channel]
    base_units = sku.base_units_mass if group == "mass" else sku.base_units_prestige
    list_price = (sku.base_price_mass if group == "mass" else sku.base_price_prestige) + CHANNEL_PRICE_ADJ[channel]
    elasticity = sku.base_elasticity_mass if group == "mass" else sku.base_elasticity_prestige
    seasonality = HISTORY_SEASONALITY[sku.product_group][week_date.month]
    social_multiplier = 1 + ((social_buzz - 58) / 100) * (0.28 if group == "mass" else 0.22)
    price_ratio = (own_price / list_price) if list_price else 1
    comp_gap = ((own_price - comp_price) / comp_price) if comp_price else 0
    comp_multiplier = clamp(1 - (comp_gap * (0.58 if group == "mass" else 0.42)), 0.65, 1.3)
    units = base_units * CHANNEL_SHARE_WEIGHT[channel] * HISTORY_CHANNEL_SCALE[channel] * seasonality * social_multiplier
    units *= price_ratio ** elasticity
    units *= comp_multiplier
    units *= random.uniform(0.92, 1.08)
    return max(0.0, units)


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
                comp_disc = competitor_discount_factor(channel, sku, w)
                comp_price = round(list_price * (1 - comp_disc), 2)
                gap = ((eff_price - comp_price) / comp_price) if comp_price else 0.0

                base_elast = sku.base_elasticity_mass if group == "mass" else sku.base_elasticity_prestige
                channel_adj = 1.06 if channel in {"amazon", "target"} else 0.97
                social_score = current_social_score(w, sku, channel)
                eff_elast = round(base_elast * channel_adj * social_elast_modifier(social_score), 3)

                base_units = sku.base_units_mass if group == "mass" else sku.base_units_prestige
                demand_factor = d_idx * product_demand_factor(w, sku.product_group) * SKU_CHANNEL_FIT[sku.sku_id][channel]
                event = CURRENT_SKU_WEEK_EVENTS.get((sku.sku_id, channel, w), {})
                demand_factor *= 1 + event.get("demand_extra", 0.0)
                baseline_units = base_units * demand_factor * CHANNEL_SHARE_WEIGHT[channel]
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
                    "social_engagement_score": social_score,
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
        promo_avg = sum(float(r["promo_depth_pct"]) for r in rows) / len(rows)
        social_val = week_social[w]
        base_aov = 31.5 if group == "mass" else 48.0
        promo_penalty = promo_avg * (0.14 if group == "mass" else 0.08)
        social_uplift = (social_val - 58) * (0.06 if group == "mass" else 0.09)
        target_aov = clamp(base_aov - promo_penalty + social_uplift, 24.0 if group == "mass" else 39.0, 37.0 if group == "mass" else 56.0)
        monthly_revenue = revenue * 4.3
        active = max(900 if group == "mass" else 650, int(round(monthly_revenue / target_aov)))
        acquisition_rate = (0.03 if group == "mass" else 0.023) * (1 + promo_avg / 100 * 0.65) * (1 + max(0, social_val - 60) / 100 * 0.25)
        new_customers = int(active * acquisition_rate)
        repeat_loss_rate = (0.041 if group == "mass" else 0.029) * (1 + max(0, 58 - social_val) / 100 * 0.55)
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
                "aov": round(target_aov, 2),
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
    social_followers = BASE_SOCIAL_AUDIENCE.copy()
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
        creator_spike = 1.0 if w in {5, 11} else (0.55 if w in {8, 14} else 0.18 if w in {3, 15} else 0.0)
        campaign_push = 1.0 if w in {4, 5, 8, 12, 15} else (0.4 if w in {7, 11, 14} else 0.0)
        total_mentions = int(18500 + (score - 55) * 380 + creator_spike * 6200 + campaign_push * 1800 + random.uniform(-900, 1200))
        total_mentions = max(14000, total_mentions)

        tiktok_share = clamp(0.41 + creator_spike * 0.04 + random.uniform(-0.015, 0.018), 0.37, 0.49)
        instagram_share = clamp(0.35 + campaign_push * 0.02 + random.uniform(-0.014, 0.015), 0.31, 0.41)
        youtube_share = clamp(0.10 + creator_spike * 0.018 + random.uniform(-0.01, 0.01), 0.07, 0.16)
        twitter_share = clamp(1 - tiktok_share - instagram_share - youtube_share, 0.06, 0.13)
        total_share = tiktok_share + instagram_share + youtube_share + twitter_share
        tiktok_share /= total_share
        instagram_share /= total_share
        youtube_share /= total_share
        twitter_share /= total_share

        tiktok = int(round(total_mentions * tiktok_share))
        insta = int(round(total_mentions * instagram_share))
        youtube = int(round(total_mentions * youtube_share))
        twitter = max(0, total_mentions - tiktok - insta - youtube)

        sentiment = round(clamp(0.5 + (score - 52) / 118 + creator_spike * 0.045 + random.uniform(-0.018, 0.02), 0.47, 0.84), 3)
        influencer = round(clamp(0.36 + (score - 52) / 95 + creator_spike * 0.055 + random.uniform(-0.016, 0.018), 0.33, 0.78), 3)
        paid = round(125000 + (score - 58) * 2400 + campaign_push * 18500 + creator_spike * 12000 + random.uniform(-5500, 6200), 2)
        earned = round(68000 + (score - 56) * 1800 + creator_spike * 22000 + random.uniform(-4500, 5500), 2)

        tiktok_rate = round(clamp(4.2 + (score - 56) / 7.5 + creator_spike * 1.2 + random.uniform(-0.35, 0.38), 3.5, 8.9), 1)
        instagram_rate = round(clamp(2.8 + (score - 56) / 9.5 + creator_spike * 0.6 + random.uniform(-0.25, 0.28), 2.3, 6.1), 1)
        youtube_rate = round(clamp(4.4 + (score - 56) / 8.0 + creator_spike * 0.9 + random.uniform(-0.35, 0.35), 3.6, 7.8), 1)
        twitter_rate = round(clamp(1.1 + (score - 56) / 24 + campaign_push * 0.35 + random.uniform(-0.15, 0.15), 0.8, 2.9), 1)

        social_followers["tiktok"] += int(2400 + max(0, tiktok - 7500) * 0.42 + creator_spike * 3200 + random.uniform(-400, 600))
        social_followers["instagram"] += int(1800 + max(0, insta - 7000) * 0.28 + creator_spike * 2100 + random.uniform(-300, 500))
        social_followers["youtube"] += int(450 + max(0, youtube - 2000) * 0.22 + creator_spike * 680 + random.uniform(-80, 140))
        social_followers["twitter"] += int(280 + max(0, twitter - 1500) * 0.12 + campaign_push * 180 + random.uniform(-50, 90))

        social_rows.append(
            {
                "week_start": week_start(w).isoformat(),
                "total_social_mentions": total_mentions,
                "tiktok_mentions": tiktok,
                "instagram_mentions": insta,
                "youtube_mentions": youtube,
                "twitter_mentions": twitter,
                "social_sentiment": sentiment,
                "influencer_score": influencer,
                "paid_social_spend": paid,
                "earned_social_value": earned,
                "total_social_spend": round(paid + earned, 2),
                "brand_social_index": round(score, 2),
                "tiktok_engagement_rate": tiktok_rate,
                "instagram_engagement_rate": instagram_rate,
                "youtube_engagement_rate": youtube_rate,
                "twitter_engagement_rate": twitter_rate,
                "tiktok_followers": social_followers["tiktok"],
                "instagram_followers": social_followers["instagram"],
                "youtube_subscribers": social_followers["youtube"],
                "twitter_followers": social_followers["twitter"],
            }
        )

    write_csv(DATA_DIR / "market_signals.csv", market_rows)
    write_csv(DATA_DIR / "social_signals.csv", social_rows)

    competitor_feed_rows = []
    for row in sku_rows:
        list_price = float(row["list_price"])
        observed_price = float(row["competitor_price"])
        channel = row["sales_channel"]
        sku_id = row["sku_id"]
        week_no = int(row["week_of_season"])
        price_gap = ((list_price - observed_price) / list_price) if list_price else 0.0
        promo_threshold = 0.085 if channel == "amazon" else 0.07 if channel == "target" else 0.04
        promo_flag = price_gap >= promo_threshold
        review_growth = (week_no - 1) * (24 if channel in {"amazon", "target"} else 14)
        review_count = int(COMP_REVIEW_BASE[sku_id] + review_growth + random.uniform(-45, 70))
        rating = round(clamp(COMP_RATING_BASE[sku_id] + random.uniform(-0.08, 0.06), 4.1, 4.8), 1)
        match_floor = 0.91 if channel in {"target", "amazon"} else 0.94
        match_confidence = round(clamp(random.uniform(match_floor, 0.992), 0.89, 0.995), 3)
        availability = "low_stock" if promo_flag and channel in {"amazon", "target"} and random.random() < 0.24 else ("limited_stock" if channel in {"sephora", "ulta"} and week_no in {7, 11, 14} and random.random() < 0.18 else "in_stock")
        promo_badge = ""
        if promo_flag:
            promo_badge = "limited_time_deal" if channel in {"amazon", "target"} else "beauty_offer"
        competitor_feed_rows.append(
            {
                "captured_at": f"{row['week_start']}T08:00:00Z",
                "source_domain": COMP_SOURCE_BY_CHANNEL.get(channel, "marketplace.example"),
                "channel": channel,
                "competitor_sku": competitor_sku_code(channel, sku_id),
                "matched_sku_id": sku_id,
                "match_confidence": match_confidence,
                "observed_price": round(observed_price, 2),
                "promo_flag": str(promo_flag),
                "promo_badge": promo_badge,
                "seller_name": COMP_SELLER_BY_CHANNEL[channel],
                "availability_status": availability,
                "star_rating": rating,
                "review_count": review_count,
                "capture_type": "product_page_scrape",
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

    actual_history_map = {}
    for row in sku_rows:
        week_no = int(row["week_of_season"])
        if week_no > CURRENT_WEEK:
            continue
        actual_history_map[(row["week_start"], row["sku_id"], row["sales_channel"])] = row

    product_history_rows = []
    for hist_idx in range(HISTORY_WEEKS):
        hist_date = history_week_start(hist_idx)
        for sku in SKUS:
            for channel, group in CHANNELS.items():
                actual_key = (hist_date.isoformat(), sku.sku_id, channel)
                actual_row = actual_history_map.get(actual_key)
                if actual_row:
                    own_price = round(float(actual_row["effective_price"]), 2)
                    comp_price = round(float(actual_row["competitor_price"]), 2)
                    social_buzz = round(float(actual_row["social_engagement_score"]), 2)
                    units_sold = int(round(float(actual_row["net_units_sold"])))
                    revenue = round(float(actual_row["revenue"]), 2)
                    price_gap = round(float(actual_row["price_gap_vs_competitor"]), 4)
                    promo_depth = round(float(actual_row["promo_depth_pct"]), 2)
                else:
                    list_price = (sku.base_price_mass if group == "mass" else sku.base_price_prestige) + CHANNEL_PRICE_ADJ[channel]
                    promo_depth = history_promo_depth(group, channel, hist_date, sku.product_group)
                    own_price = round(list_price * (1 - promo_depth / 100), 2)
                    comp_discount = history_competitor_discount(channel, hist_date, sku.product_group)
                    comp_price = round(list_price * (1 - comp_discount), 2)
                    social_buzz = history_social_buzz(hist_date, sku.product_group, channel)
                    units_sold = int(round(history_units_for_row(sku, channel, own_price, comp_price, social_buzz, hist_date)))
                    revenue = round(units_sold * own_price, 2)
                    price_gap = round(((own_price - comp_price) / comp_price) if comp_price else 0.0, 4)

                product_history_rows.append(
                    {
                        "week_start": hist_date.isoformat(),
                        "history_window_weeks": HISTORY_WEEKS,
                        "history_week_index": hist_idx + 1,
                        "weeks_from_current": hist_idx - (HISTORY_WEEKS - 1),
                        "is_latest_week": str(hist_date == week_start(CURRENT_WEEK)),
                        "product_group": sku.product_group,
                        "sku_id": sku.sku_id,
                        "sku_name": sku.sku_name,
                        "channel_group": group,
                        "sales_channel": channel,
                        "own_price": own_price,
                        "competitor_price": comp_price,
                        "price_gap_vs_competitor": price_gap,
                        "social_buzz_score": social_buzz,
                        "units_sold": units_sold,
                        "revenue": revenue,
                        "promo_depth_pct": promo_depth,
                    }
                )
    write_csv(DATA_DIR / "product_channel_history.csv", product_history_rows)

    current_week_rows = [row for row in sku_rows if int(row["week_of_season"]) == CURRENT_WEEK]
    channel_price_pool = {}
    for channel in ["target", "amazon", "sephora", "ulta"]:
        channel_rows = [row for row in current_week_rows if row["sales_channel"] == channel]
        channel_price_pool[channel] = sorted(channel_rows, key=lambda item: float(item["effective_price"]))

    current_week_start = week_start(CURRENT_WEEK).isoformat()
    current_group_rows = {row["channel_group"]: row for row in channel_weekly if row["week_start"] == current_week_start}
    group_customer_targets = {
        group: max(12000 if group == "mass" else 8000, int(round(int(current_group_rows[group]["active_customers"]) * CURRENT_CUSTOMER_MULTIPLIER[group])))
        for group in ["mass", "prestige"]
    }

    def choose_price_row(channel: str, monetization_segment: str) -> dict:
        ranked = channel_price_pool[channel]
        if monetization_segment == "trial_size_sampler":
            candidates = ranked[:2]
        elif monetization_segment == "premium_add_on":
            candidates = ranked[-2:]
        elif monetization_segment == "multi_sku_builder":
            candidates = ranked[2:]
        elif monetization_segment == "value_bundle_buyer":
            candidates = ranked[1:4]
        else:
            candidates = ranked[:4]
        weights = [max(1, int(float(row["own_units_sold"]))) for row in candidates]
        return random.choices(candidates, weights=weights, k=1)[0]

    def age_choice(group: str, acquisition_segment: str) -> str:
        weights = AGE_WEIGHTS[group].copy()
        if acquisition_segment == "influencer_discovered":
            weights["18-24"] += 0.06
            weights["25-34"] += 0.05
        elif acquisition_segment == "routine_refill":
            weights["35-44"] += 0.05
            weights["45-54"] += 0.03
        elif acquisition_segment == "gift_buyer":
            weights["35-44"] += 0.03
            weights["45-54"] += 0.03
        return weighted_choice(weights)

    def income_choice(group: str, engagement_segment: str, sales_channel: str) -> str:
        weights = INCOME_WEIGHTS[group].copy()
        if engagement_segment == "prestige_loyalist":
            weights["100-150k"] += 0.03
            weights["150k+"] += 0.05
        if sales_channel == "amazon" and group == "mass":
            weights["50-100k"] += 0.03
        if sales_channel == "sephora":
            weights["150k+"] += 0.04
        return weighted_choice(weights)

    customer_rows = []
    customer_profiles = []
    snapshot_date = week_start(CURRENT_WEEK) + timedelta(days=3)
    customer_id = 1
    for group in ["mass", "prestige"]:
        for _ in range(group_customer_targets[group]):
            sales_channel = weighted_choice(CUSTOMER_CHANNEL_WEIGHTS[group])
            acquisition_segment = weighted_choice(ACQUISITION_WEIGHTS[group])
            engagement_segment = weighted_choice(ENGAGEMENT_WEIGHTS[group])
            monetization_segment = weighted_choice(MONETIZATION_WEIGHTS[group])

            if acquisition_segment == "promo_triggered" and engagement_segment == "prestige_loyalist" and random.random() < 0.75:
                engagement_segment = "value_seeker" if group == "mass" else "channel_switcher"
            if acquisition_segment == "routine_refill" and engagement_segment == "deal_hunter" and random.random() < 0.6:
                engagement_segment = "value_seeker"
            if group == "prestige" and monetization_segment == "value_bundle_buyer" and engagement_segment == "prestige_loyalist" and random.random() < 0.5:
                monetization_segment = "multi_sku_builder"

            tenure_low, tenure_high = TENURE_RANGES[acquisition_segment]
            tenure_days = int(round(bounded_normal((tenure_low + tenure_high) / 2, max(18, (tenure_high - tenure_low) / 4), tenure_low, tenure_high)))
            if engagement_segment == "prestige_loyalist":
                tenure_days = int(clamp(tenure_days + random.randint(45, 150), 21, 960))
            first_purchase_date = snapshot_date - timedelta(days=tenure_days)

            active_prob = 0.87 if group == "mass" else 0.9
            if acquisition_segment == "routine_refill":
                active_prob += 0.04
            if engagement_segment == "prestige_loyalist":
                active_prob += 0.05
            if engagement_segment == "deal_hunter":
                active_prob -= 0.1
            if engagement_segment == "occasional_shop":
                active_prob -= 0.06
            if acquisition_segment == "promo_triggered":
                active_prob -= 0.05
            is_active = random.random() < clamp(active_prob, 0.68, 0.96)

            engagement_base = {
                "prestige_loyalist": 0.78,
                "value_seeker": 0.58,
                "deal_hunter": 0.46,
                "occasional_shop": 0.38,
                "channel_switcher": 0.51,
            }[engagement_segment]
            if acquisition_segment == "routine_refill":
                engagement_base += 0.05
            if acquisition_segment == "seasonal_first_time":
                engagement_base -= 0.04
            if not is_active:
                engagement_base -= 0.16
            engagement_score = round(bounded_normal(engagement_base, 0.11, 0.18, 0.95), 3)

            active_days_mean = {
                "prestige_loyalist": 12,
                "value_seeker": 9,
                "deal_hunter": 7,
                "occasional_shop": 5,
                "channel_switcher": 8,
            }[engagement_segment]
            active_days_30d = int(round(bounded_normal(active_days_mean if is_active else max(1, active_days_mean - 5), 2.4, 0, 23)))

            orders_base = {
                "seasonal_first_time": 1.6,
                "routine_refill": 4.1,
                "gift_buyer": 1.9,
                "influencer_discovered": 2.4,
                "promo_triggered": 2.1,
            }[acquisition_segment]
            orders_base += {"prestige_loyalist": 1.2, "value_seeker": 0.5, "deal_hunter": 0.2, "occasional_shop": -0.4, "channel_switcher": 0.1}[engagement_segment]
            orders_base += {"single_sku_staple": 0.2, "multi_sku_builder": 0.5, "value_bundle_buyer": 0.3, "premium_add_on": 0.1, "trial_size_sampler": -0.3}[monetization_segment]
            if not is_active:
                orders_base -= 1.4
            orders_90d = int(round(clamp(orders_base + random.uniform(-0.8, 0.9), 0, 7)))

            units_per_order = {
                "single_sku_staple": 1.2,
                "multi_sku_builder": 2.4,
                "value_bundle_buyer": 2.1,
                "premium_add_on": 1.7,
                "trial_size_sampler": 1.1,
            }[monetization_segment]
            if group == "mass" and monetization_segment == "value_bundle_buyer":
                units_per_order += 0.15
            if group == "prestige" and monetization_segment == "premium_add_on":
                units_per_order += 0.1
            units_per_order = round(clamp(units_per_order + random.uniform(-0.18, 0.22), 1.0, 3.1), 2)
            units_90d = round(max(0.0, orders_90d * units_per_order * random.uniform(0.9, 1.08)), 1)

            price_row = choose_price_row(sales_channel, monetization_segment)
            current_price = round(float(price_row["effective_price"]), 2)
            basket_factor = {
                "single_sku_staple": 1.0,
                "multi_sku_builder": 1.08,
                "value_bundle_buyer": 1.02,
                "premium_add_on": 1.16,
                "trial_size_sampler": 0.94,
            }[monetization_segment]
            acquisition_aov_lift = {
                "seasonal_first_time": -1.5,
                "routine_refill": 2.0,
                "gift_buyer": 3.5,
                "influencer_discovered": 1.0,
                "promo_triggered": -2.0,
            }[acquisition_segment]
            avg_order_value = round(
                clamp(
                    (current_price * max(1.0, units_per_order) * basket_factor) + acquisition_aov_lift + (CHANNEL_AOV_BASE[sales_channel] - current_price * 1.15) * 0.22 + random.uniform(-2.6, 3.1),
                    current_price * 0.9,
                    86.0 if group == "mass" else 138.0,
                ),
                2,
            )

            discount_base = {
                "seasonal_first_time": 0.46,
                "routine_refill": 0.28,
                "gift_buyer": 0.34,
                "influencer_discovered": 0.39,
                "promo_triggered": 0.74,
            }[acquisition_segment]
            discount_base += {"prestige_loyalist": -0.15, "value_seeker": 0.09, "deal_hunter": 0.16, "occasional_shop": 0.03, "channel_switcher": 0.07}[engagement_segment]
            discount_base += {"single_sku_staple": 0.0, "multi_sku_builder": -0.02, "value_bundle_buyer": 0.08, "premium_add_on": -0.08, "trial_size_sampler": 0.04}[monetization_segment]
            discount_affinity = round(bounded_normal(discount_base, 0.09, 0.06, 0.92), 2)

            social_base = {
                "seasonal_first_time": 0.34,
                "routine_refill": 0.28,
                "gift_buyer": 0.22,
                "influencer_discovered": 0.67,
                "promo_triggered": 0.31,
            }[acquisition_segment]
            age_group = age_choice(group, acquisition_segment)
            if age_group in {"18-24", "25-34"}:
                social_base += 0.06
            if sales_channel in {"sephora", "ulta"}:
                social_base += 0.04
            if engagement_segment == "prestige_loyalist":
                social_base += 0.05
            social_engagement_score = round(bounded_normal(social_base, 0.12, 0.08, 0.93), 2)

            repeat_loss_flag = not is_active
            repeat_loss_date = ""
            if repeat_loss_flag:
                lag_days = int(round(bounded_normal(54, 24, 7, 140)))
                repeat_loss_date = (snapshot_date - timedelta(days=lag_days)).isoformat()

            region = weighted_choice(REGION_WEIGHTS)
            income_band = income_choice(group, engagement_segment, sales_channel)

            margin_rate = 0.43 if group == "mass" else 0.57
            margin_rate += {"single_sku_staple": 0.0, "multi_sku_builder": 0.02, "value_bundle_buyer": -0.04, "premium_add_on": 0.03, "trial_size_sampler": -0.03}[monetization_segment]
            margin_rate += {"prestige_loyalist": 0.02, "value_seeker": -0.01, "deal_hunter": -0.03, "occasional_shop": -0.01, "channel_switcher": -0.015}[engagement_segment]
            margin_rate -= discount_affinity * 0.04
            margin_rate = round(clamp(margin_rate, 0.29, 0.64), 3)

            promo_redemption_rate = round(
                clamp(
                    0.08 + discount_affinity * 0.22 + (0.03 if acquisition_segment == "promo_triggered" else 0.0) + (0.015 if engagement_segment == "deal_hunter" else 0.0) + random.uniform(-0.015, 0.02),
                    0.05,
                    0.34,
                ),
                3,
            )
            avg_cac = round(
                clamp(
                    ACQUISITION_CAC_BASE[group][acquisition_segment] + (0.7 if sales_channel in {"sephora", "amazon"} else 0.0) + (0.6 if acquisition_segment == "influencer_discovered" else 0.0) + random.uniform(-0.8, 0.85),
                    5.8,
                    16.8,
                ),
                2,
            )

            cust_id = f"CUST{customer_id:06d}"
            customer_id += 1
            customer_rows.append(
                {
                    "customer_id": cust_id,
                    "first_purchase_date": first_purchase_date.isoformat(),
                    "channel_group": group,
                    "sales_channel": sales_channel,
                    "region": region,
                    "age_group": age_group,
                    "income_band": income_band,
                    "tenure_days": tenure_days,
                    "tenure_months": round(tenure_days / 30, 1),
                    "engagement_score": engagement_score,
                    "active_days_30d": active_days_30d,
                    "orders_90d": orders_90d,
                    "units_90d": units_90d,
                    "avg_order_value_90d": avg_order_value,
                    "discount_affinity": discount_affinity,
                    "social_engagement_score": social_engagement_score,
                    "repeat_loss_flag": str(repeat_loss_flag),
                    "repeat_loss_date": repeat_loss_date,
                    "current_price": current_price,
                    "is_active": str(is_active),
                }
            )
            customer_profiles.append(
                {
                    "customer_id": cust_id,
                    "channel_group": group,
                    "sales_channel": sales_channel,
                    "acquisition_segment": acquisition_segment,
                    "engagement_segment": engagement_segment,
                    "monetization_segment": monetization_segment,
                    "segment_key": f"{acquisition_segment}|{engagement_segment}|{monetization_segment}",
                    "repeat_loss_flag": repeat_loss_flag,
                    "avg_order_value_90d": avg_order_value,
                    "avg_units_per_order": round(units_90d / orders_90d, 2) if orders_90d > 0 else 0.0,
                    "avg_cac": avg_cac,
                    "promo_redemption_rate": promo_redemption_rate,
                    "margin_rate": margin_rate,
                }
            )

    write_csv(DATA_DIR / "customers.csv", customer_rows)

    segment_sample = random.sample(customer_profiles, k=min(SEGMENT_SAMPLE_SIZE, len(customer_profiles)))
    segment_rows = [
        {
            "customer_id": row["customer_id"],
            "channel_group": row["channel_group"],
            "acquisition_segment": row["acquisition_segment"],
            "engagement_segment": row["engagement_segment"],
            "monetization_segment": row["monetization_segment"],
            "segment_key": row["segment_key"],
        }
        for row in segment_sample
    ]
    write_csv(DATA_DIR / "segments.csv", segment_rows)

    segment_rollup = defaultdict(lambda: {"customer_count": 0, "repeat_loss_count": 0, "aov_sum": 0.0, "units_sum": 0.0, "cac_sum": 0.0, "promo_sum": 0.0, "margin_sum": 0.0})
    for row in customer_profiles:
        agg = segment_rollup[(row["segment_key"], row["channel_group"])]
        agg["customer_count"] += 1
        agg["repeat_loss_count"] += int(row["repeat_loss_flag"])
        agg["aov_sum"] += float(row["avg_order_value_90d"])
        agg["units_sum"] += float(row["avg_units_per_order"])
        agg["cac_sum"] += float(row["avg_cac"])
        agg["promo_sum"] += float(row["promo_redemption_rate"])
        agg["margin_sum"] += float(row["margin_rate"])

    segment_kpis = []
    for acquisition_segment in ACQUISITION_SEGMENTS:
        for engagement_segment in ENGAGEMENT_SEGMENTS:
            for monetization_segment in MONETIZATION_SEGMENTS:
                segment_key = f"{acquisition_segment}|{engagement_segment}|{monetization_segment}"
                for group in ["mass", "prestige"]:
                    agg = segment_rollup[(segment_key, group)]
                    count = agg["customer_count"]
                    segment_kpis.append(
                        {
                            "segment_key": segment_key,
                            "channel_group": group,
                            "customer_count": count,
                            "repeat_loss_rate": round(agg["repeat_loss_count"] / count, 3) if count else 0.0,
                            "avg_order_value": round(agg["aov_sum"] / count, 2) if count else 0.0,
                            "avg_units_per_order": round(agg["units_sum"] / count, 2) if count else 0.0,
                            "avg_cac": round(agg["cac_sum"] / count, 2) if count else 0.0,
                            "promo_redemption_rate": round(agg["promo_sum"] / count, 3) if count else 0.0,
                            "margin_rate": round(agg["margin_sum"] / count, 3) if count else 0.0,
                        }
                    )
    write_csv(DATA_DIR / "segment_kpis.csv", segment_kpis)

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
                "price_range": {"min": 18.0, "max": 42.0, "current": 29.7},
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
                "price_range": {"min": 28.0, "max": 48.0, "current": 36.3},
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
            "ad_supported": {"mean": 30.5, "median": 29.0, "std_dev": 4.8},
            "ad_free": {"mean": 38.0, "median": 37.0, "std_dev": 5.2},
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
            "product_channel_history.csv": "Rolling 52-week product x channel history with revenue, own price, competitor price, gap, and social buzz.",
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
