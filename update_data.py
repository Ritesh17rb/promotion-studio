"""Update CSV data files based on meeting feedback."""
import pandas as pd
from datetime import timedelta

DATA_DIR = "data"

# =============================================================
# 1. social_signals.csv  – add sentiment_score column
# =============================================================
ss = pd.read_csv(f"{DATA_DIR}/social_signals.csv")
ss["sentiment_score"] = ((ss["social_sentiment"] - 0.5) * 200).round(1)
ss.to_csv(f"{DATA_DIR}/social_signals.csv", index=False)
print("social_signals.csv updated – added sentiment_score column")

# =============================================================
# 2. retail_events.csv – add promotion_type, event_start_date,
#    event_end_date, affected_sku
# =============================================================
re = pd.read_csv(f"{DATA_DIR}/retail_events.csv")

# --- promotion_type ---
def assign_promotion_type(row):
    et = row["event_type"]
    if et in ("Tentpole", "Competitor Price Change", "Social Spike"):
        return "None"
    # Promo Start rows
    disc = row["promo_discount_pct"]
    if disc == 17.5:
        return "Price Reduction"
    elif disc == 8.0:
        return "Percentage Off"
    elif disc == 10.0:
        return "Price Reduction"
    elif disc == 5.0:
        return "Percentage Off"
    elif disc == 20.0:
        return "Bundle Deal + Price Reduction"
    return "None"

re["promotion_type"] = re.apply(assign_promotion_type, axis=1)

# --- event_start_date & event_end_date ---
re["week_start"] = pd.to_datetime(re["week_start"])

def assign_dates(row):
    start = row["week_start"]
    if row["event_type"] == "Tentpole":
        return start, start  # same-day for tentpoles
    elif row["event_type"] == "Promo Start":
        # 1-2 week duration: use 2 weeks for bigger promos, 1 week for smaller
        if row["promo_discount_pct"] >= 10:
            return start, start + timedelta(weeks=2)
        else:
            return start, start + timedelta(weeks=1)
    else:
        # Competitor Price Change, Social Spike – same day
        return start, start

dates = re.apply(assign_dates, axis=1, result_type="expand")
re["event_start_date"] = dates[0]
re["event_end_date"] = dates[1]

# Format dates back to string
re["event_start_date"] = re["event_start_date"].dt.strftime("%Y-%m-%d")
re["event_end_date"] = re["event_end_date"].dt.strftime("%Y-%m-%d")
re["week_start"] = re["week_start"].dt.strftime("%Y-%m-%d")

# --- affected_sku ---
def assign_affected_sku(row):
    et = row["event_type"]
    cg = row["channel_group"]
    if et != "Promo Start":
        return "all"
    if cg == "mass":
        return "SUN_S1|SUN_S2|SUN_S3|MOI_M1"
    elif cg == "prestige":
        return "SUN_S1|SUN_S2|MOI_M1|MOI_M2"
    else:  # "all"
        return "all"

re["affected_sku"] = re.apply(assign_affected_sku, axis=1)

re.to_csv(f"{DATA_DIR}/retail_events.csv", index=False)
print("retail_events.csv updated – added promotion_type, event_start_date, event_end_date, affected_sku")

# =============================================================
# 3. sku_channel_weekly.csv – add sentiment_score
# =============================================================
scw = pd.read_csv(f"{DATA_DIR}/sku_channel_weekly.csv")
scw["sentiment_score"] = ((scw["social_engagement_score"] - 50) * 2).round(1)
scw.to_csv(f"{DATA_DIR}/sku_channel_weekly.csv", index=False)
print(f"sku_channel_weekly.csv updated – added sentiment_score ({len(scw)} rows)")

# =============================================================
# 4. product_channel_history.csv – add sentiment_score
# =============================================================
pch = pd.read_csv(f"{DATA_DIR}/product_channel_history.csv")
pch["sentiment_score"] = ((pch["social_buzz_score"] - 50) * 2).round(1)
pch.to_csv(f"{DATA_DIR}/product_channel_history.csv", index=False)
print(f"product_channel_history.csv updated – added sentiment_score ({len(pch)} rows)")

print("\nAll files updated successfully.")
