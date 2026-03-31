const FALLBACK_PRODUCT_CATALOG = [
  { sku_id: 'SUN_S1', official_name: 'Unseen Sunscreen SPF 50', short_name: 'Unseen Sunscreen', product_group: 'sunscreen' },
  { sku_id: 'SUN_S2', official_name: 'Glowscreen SPF 40', short_name: 'Glowscreen', product_group: 'sunscreen' },
  { sku_id: 'SUN_S3', official_name: 'Every. Single. Face. Watery Lotion SPF 50', short_name: 'Every. Single. Face.', product_group: 'sunscreen' },
  { sku_id: 'MOI_M1', official_name: 'Superscreen Hydrating Daily Cream SPF 40', short_name: 'Superscreen Daily Cream', product_group: 'moisturizer' },
  { sku_id: 'MOI_M2', official_name: 'Mineral Sheerscreen SPF 30', short_name: 'Mineral Sheerscreen', product_group: 'moisturizer' },
  { sku_id: 'MOI_M3', official_name: '(Re)setting 100% Mineral Powder SPF 35', short_name: '(Re)setting Powder', product_group: 'moisturizer' }
];

let productCatalogPromise = null;

export async function loadProductCatalog() {
  if (productCatalogPromise) {
    return productCatalogPromise;
  }

  productCatalogPromise = fetch('data/product_catalog.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load product catalog (${response.status})`);
      }
      return response.json();
    })
    .catch(error => {
      console.warn('Falling back to built-in product catalog.', error);
      return FALLBACK_PRODUCT_CATALOG;
    });

  return productCatalogPromise;
}

export function buildProductCatalogMap(catalog = []) {
  return new Map((catalog || []).map(entry => [String(entry.sku_id || '').trim().toUpperCase(), entry]));
}

export function getCatalogEntry(catalogMap, skuId) {
  if (!(catalogMap instanceof Map)) return null;
  return catalogMap.get(String(skuId || '').trim().toUpperCase()) || null;
}

export function getCatalogLabel(catalogMap, skuId, fallback = '') {
  const entry = getCatalogEntry(catalogMap, skuId);
  return entry?.official_name || fallback || String(skuId || '');
}

export function buildProductOptions(catalog = [], options = {}) {
  const { includeAll = true, includeSku = true } = options;
  const rows = [];

  if (includeAll) {
    rows.push({ value: 'all', label: 'All Products' });
  }

  (catalog || []).forEach(entry => {
    const skuId = String(entry.sku_id || '').trim().toUpperCase();
    const name = entry.official_name || skuId;
    rows.push({
      value: skuId,
      label: includeSku ? `${skuId} - ${name}` : name
    });
  });

  return rows;
}
