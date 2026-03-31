from __future__ import annotations

import csv
import json
from pathlib import Path
from statistics import median
import sys


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_csv(path: Path):
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def to_float(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def median_for(rows, field):
    values = [to_float(row.get(field)) for row in rows]
    values = [value for value in values if value is not None]
    return median(values) if values else None


def main() -> int:
    catalog_rows = load_json(DATA_DIR / "product_catalog.json")
    sku_weekly = load_csv(DATA_DIR / "sku_channel_weekly.csv")
    product_history = load_csv(DATA_DIR / "product_channel_history.csv")
    promo_metadata = load_json(DATA_DIR / "promo_metadata.json")

    catalog = {row["sku_id"]: row for row in catalog_rows}
    failures: list[str] = []
    warnings: list[str] = []

    for dataset_name, rows in (
        ("sku_channel_weekly.csv", sku_weekly),
        ("product_channel_history.csv", product_history),
    ):
        unknown = sorted({row["sku_id"] for row in rows if row["sku_id"] not in catalog})
        if unknown:
            failures.append(f"{dataset_name}: unknown SKU ids: {', '.join(unknown)}")

        for sku_id, catalog_row in catalog.items():
            official_name = catalog_row["official_name"]
            aliases = set(catalog_row.get("legacy_aliases", []))
            observed_names = sorted({row["sku_name"] for row in rows if row["sku_id"] == sku_id})
            if not observed_names:
                failures.append(f"{dataset_name}: missing rows for {sku_id}")
                continue
            invalid = [name for name in observed_names if name != official_name and name not in aliases]
            if invalid:
                failures.append(
                    f"{dataset_name}: unexpected names for {sku_id}: {', '.join(invalid)}"
                )

    for promo_id, promo in promo_metadata.items():
        for row in promo.get("sku_results", []):
            sku_id = row.get("sku_id")
            if sku_id not in catalog:
                failures.append(f"promo_metadata.json: {promo_id} references unknown SKU {sku_id}")
                continue
            official_name = catalog[sku_id]["official_name"]
            if row.get("sku_name") != official_name:
                failures.append(
                    f"promo_metadata.json: {promo_id} uses '{row.get('sku_name')}' for {sku_id}, expected '{official_name}'"
                )

    for sku_id, catalog_row in catalog.items():
        sku_rows = [row for row in sku_weekly if row["sku_id"] == sku_id]
        for channel_group, range_field, price_field in (
            ("mass", "expected_mass_price_range_usd", "list_price"),
            ("prestige", "expected_prestige_price_range_usd", "list_price"),
        ):
            scoped_rows = [row for row in sku_rows if row["channel_group"] == channel_group]
            observed_median = median_for(scoped_rows, price_field)
            if observed_median is None:
                failures.append(f"sku_channel_weekly.csv: missing {channel_group} rows for {sku_id}")
                continue
            expected_low, expected_high = catalog_row[range_field]
            if observed_median < expected_low or observed_median > expected_high:
                failures.append(
                    f"sku_channel_weekly.csv: {sku_id} {channel_group} median {observed_median:.2f} outside expected range {expected_low:.2f}-{expected_high:.2f}"
                )

            effective_median = median_for(scoped_rows, "effective_price")
            if effective_median is not None and effective_median > expected_high * 1.02:
                warnings.append(
                    f"sku_channel_weekly.csv: {sku_id} {channel_group} effective median {effective_median:.2f} sits above list-price band {expected_low:.2f}-{expected_high:.2f}"
                )

        history_rows = [row for row in product_history if row["sku_id"] == sku_id]
        if not history_rows:
            failures.append(f"product_channel_history.csv: missing rows for {sku_id}")

    print("Supergoop alignment check")
    print(f"Catalog SKUs: {len(catalog_rows)}")
    print(f"SKU weekly rows: {len(sku_weekly)}")
    print(f"Product history rows: {len(product_history)}")
    print(f"Promo campaigns: {len(promo_metadata)}")

    if warnings:
        print("\nWarnings")
        for item in warnings:
            print(f"- {item}")

    if failures:
        print("\nFailures")
        for item in failures:
            print(f"- {item}")
        return 1

    print("\nAll checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
