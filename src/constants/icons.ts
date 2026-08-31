/**
 * Icon/emoji mappings for business types, tiers, and risk levels
 */

export const BUSINESS_ICONS: Record<string, string> = {
  kirana: '🏪',
  dairy: '🥛',
  textile: '👕',
  agriculture: '🌾',
  food_stall: '🍜',
  handicraft: '🎨',
  hardware: '🔨',
  pharmacy: '💊',
  electronics: '📱',
  transport: '🚚',
  beauty: '💇',
  education: '📚',
  tailoring: '✂️',
  poultry: '🐔',
  auto_repair: '🔧',
  flour_mill: '⚙️',
  other: '💼',
};

export const TIER_BADGES: Record<string, { label: string; color: string; icon: string }> = {
  tier1: { label: 'Metro', color: '#0274DF', icon: '🏙️' },
  tier2: { label: 'City', color: '#639922', icon: '🏘️' },
  tier3: { label: 'Town', color: '#EF9F27', icon: '🏡' },
  rural: { label: 'Rural', color: '#8B6F47', icon: '🌾' },
};

export const RISK_LEVELS = {
  low: { label: 'GO', color: '#639922', icon: '✓' },
  medium: { label: 'CAUTION', color: '#EF9F27', icon: '⚠' },
  high: { label: 'NO-GO', color: '#E24B4A', icon: '✗' },
};

export function getRiskLevel(riskRatio: number): keyof typeof RISK_LEVELS {
  if (riskRatio < 0.4) return 'low';
  if (riskRatio < 0.7) return 'medium';
  return 'high';
}
