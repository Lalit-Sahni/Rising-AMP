export const CATEGORY_STYLE = {
  labour: { label: 'Labour', hex: '#5E82A6' },
  trade: { label: 'Trade', hex: '#C08A3E' },
  purchase: { label: 'Materials', hex: '#B5654A' },
  materials: { label: 'Materials', hex: '#B5654A' },
  service: { label: 'Service', hex: '#4E8C82' },
  equipment: { label: 'Equipment', hex: '#7E9B63' },
  installation: { label: 'Installation', hex: '#B5654A' },
};

const FALLBACK = { label: 'Uncategorized', hex: '#565B64' };

export function getCategoryStyle(key) {
  if (!key) return FALLBACK;
  const normalised = String(key).toLowerCase().trim();
  if (CATEGORY_STYLE[normalised]) {
    return CATEGORY_STYLE[normalised];
  }
  return { ...FALLBACK, label: key };
}

export function categoryLabel(key) {
  return getCategoryStyle(key).label;
}

export function categoryIconWell(hex) {
  return `color-mix(in srgb, ${hex} 14%, #fff)`;
}
