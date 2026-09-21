/**
 * AARTHIKA Centralized Sectors Registry
 * Complete business presets for micro-entrepreneurs across rural, semi-urban, and artisanal sectors.
 */

export interface SectorItem {
  id: string;
  category: 'agri' | 'retail' | 'services' | 'manufacturing';
  titleKey: string;
  subKey: string;
  icon: string;
  isPopular?: boolean;
  imageKey?: 'farming' | 'poultry' | 'goat' | 'dairy';
  presets: {
    setupCost: number;
    monthlyFixed: number;
    unitType: string;
    pricePerUnit: number;
    costPerUnit: number;
    salesPerMonth: number;
    personalCost: number;
    breakdown: Array<{ label: string; cost: number }>;
  };
}

export const SECTOR_CATALOG: SectorItem[] = [
  // --- Popular / Agriculture & Livestock ---
  {
    id: 'farming',
    category: 'agri',
    titleKey: 'sector_farming',
    subKey: 'sector_farming_sub',
    icon: '🌾',
    isPopular: true,
    imageKey: 'farming',
    presets: {
      setupCost: 95000,
      monthlyFixed: 4000,
      unitType: 'Kg',
      pricePerUnit: 40,
      costPerUnit: 18,
      salesPerMonth: 1800,
      personalCost: 8000,
      breakdown: [
        { label: 'Drip Irrigation & Land Prep', cost: 45000 },
        { label: 'Certified Seeds & Bio-Fertilizer', cost: 30000 },
        { label: 'Sprayer & Crates', cost: 20000 }
      ]
    }
  },
  {
    id: 'poultry',
    category: 'agri',
    titleKey: 'sector_poultry',
    subKey: 'sector_poultry_sub',
    icon: '🐔',
    isPopular: true,
    imageKey: 'poultry',
    presets: {
      setupCost: 120000,
      monthlyFixed: 6000,
      unitType: 'Bird',
      pricePerUnit: 180,
      costPerUnit: 110,
      salesPerMonth: 600,
      personalCost: 9000,
      breakdown: [
        { label: 'Shed Construction & Brooder', cost: 65000 },
        { label: 'Feed & Veterinary Buffer', cost: 35000 },
        { label: 'Feeders, Drinkers & Lighting', cost: 20000 }
      ]
    }
  },
  {
    id: 'goat',
    category: 'agri',
    titleKey: 'sector_goat',
    subKey: 'sector_goat_sub',
    icon: '🐐',
    isPopular: true,
    imageKey: 'goat',
    presets: {
      setupCost: 85000,
      monthlyFixed: 3500,
      unitType: 'Unit',
      pricePerUnit: 4500,
      costPerUnit: 1800,
      salesPerMonth: 6,
      personalCost: 7500,
      breakdown: [
        { label: 'Shed Setup & Fencing', cost: 40000 },
        { label: 'Breeder Stock Purchase', cost: 30000 },
        { label: 'Fodder & Healthcare Kit', cost: 15000 }
      ]
    }
  },
  {
    id: 'dairy',
    category: 'agri',
    titleKey: 'sector_dairy',
    subKey: 'sector_dairy_sub',
    icon: '🐄',
    isPopular: true,
    imageKey: 'dairy',
    presets: {
      setupCost: 150000,
      monthlyFixed: 8000,
      unitType: 'Litre',
      pricePerUnit: 52,
      costPerUnit: 28,
      salesPerMonth: 1200,
      personalCost: 10000,
      breakdown: [
        { label: 'Cattle Purchase (2 High-Yield Cows)', cost: 100000 },
        { label: 'Milking Area & Cattle Shed', cost: 30000 },
        { label: 'Chaff Cutter & Feed Storage', cost: 20000 }
      ]
    }
  },

  // --- Retail & Commerce ---
  {
    id: 'kirana',
    category: 'retail',
    titleKey: 'sector_kirana',
    subKey: 'sector_kirana_sub',
    icon: '🏪',
    presets: {
      setupCost: 110000,
      monthlyFixed: 5500,
      unitType: 'Basket',
      pricePerUnit: 350,
      costPerUnit: 260,
      salesPerMonth: 320,
      personalCost: 8500,
      breakdown: [
        { label: 'Initial Inventory & Stock', cost: 65000 },
        { label: 'Racks, Shelves & Counter', cost: 30000 },
        { label: 'Weighing Scale & Billing POS', cost: 15000 }
      ]
    }
  },
  {
    id: 'retail',
    category: 'retail',
    titleKey: 'sector_retail',
    subKey: 'sector_retail_sub',
    icon: '👕',
    presets: {
      setupCost: 135000,
      monthlyFixed: 7000,
      unitType: 'Item',
      pricePerUnit: 450,
      costPerUnit: 270,
      salesPerMonth: 220,
      personalCost: 9000,
      breakdown: [
        { label: 'Garment Stock & Samples', cost: 85000 },
        { label: 'Display Racks & Lighting', cost: 35000 },
        { label: 'Mirror, Trial Room & Signboard', cost: 15000 }
      ]
    }
  },

  // --- Services & Trades ---
  {
    id: 'tailoring',
    category: 'services',
    titleKey: 'sector_tailoring',
    subKey: 'sector_tailoring_sub',
    icon: '🧵',
    presets: {
      setupCost: 45000,
      monthlyFixed: 2500,
      unitType: 'Dress',
      pricePerUnit: 250,
      costPerUnit: 60,
      salesPerMonth: 120,
      personalCost: 7000,
      breakdown: [
        { label: 'Heavy Duty Sewing & Interlock Machines', cost: 28000 },
        { label: 'Cutting Table, Scissors & Threads', cost: 10000 },
        { label: 'Shop Rent Advance & Ironing Setup', cost: 7000 }
      ]
    }
  },
  {
    id: 'beauty',
    category: 'services',
    titleKey: 'sector_beauty',
    subKey: 'sector_beauty_sub',
    icon: '✂️',
    presets: {
      setupCost: 60000,
      monthlyFixed: 4000,
      unitType: 'Client',
      pricePerUnit: 200,
      costPerUnit: 45,
      salesPerMonth: 160,
      personalCost: 8000,
      breakdown: [
        { label: 'Styling Chairs, Mirrors & Stations', cost: 30000 },
        { label: 'Cosmetic Products & Kits', cost: 18000 },
        { label: 'Sterilizer, Blow Dryers & Tools', cost: 12000 }
      ]
    }
  },
  {
    id: 'mobile_repair',
    category: 'services',
    titleKey: 'sector_mobile_repair',
    subKey: 'sector_mobile_repair_sub',
    icon: '📱',
    presets: {
      setupCost: 75000,
      monthlyFixed: 4500,
      unitType: 'Job',
      pricePerUnit: 350,
      costPerUnit: 120,
      salesPerMonth: 110,
      personalCost: 8500,
      breakdown: [
        { label: 'SMD Rework Station & Diagnostic Tools', cost: 30000 },
        { label: 'Common Spare Parts & Displays', cost: 30000 },
        { label: 'Workbench, Microscope & Soldering Iron', cost: 15000 }
      ]
    }
  },
  {
    id: 'carpentry',
    category: 'services',
    titleKey: 'sector_carpentry',
    subKey: 'sector_carpentry_sub',
    icon: '🪑',
    presets: {
      setupCost: 80000,
      monthlyFixed: 4000,
      unitType: 'Piece',
      pricePerUnit: 1800,
      costPerUnit: 900,
      salesPerMonth: 22,
      personalCost: 9000,
      breakdown: [
        { label: 'Power Saws, Planers & Router', cost: 42000 },
        { label: 'Timber & Plywood Buffer', cost: 25000 },
        { label: 'Hand Tools, Clamps & Hardware', cost: 13000 }
      ]
    }
  },
  {
    id: 'plumbing',
    category: 'services',
    titleKey: 'sector_plumbing',
    subKey: 'sector_plumbing_sub',
    icon: '🔧',
    presets: {
      setupCost: 35000,
      monthlyFixed: 2000,
      unitType: 'Service',
      pricePerUnit: 400,
      costPerUnit: 80,
      salesPerMonth: 75,
      personalCost: 8000,
      breakdown: [
        { label: 'Pipe Threader, Cutters & Wrench Set', cost: 18000 },
        { label: 'Emergency Valves, Taps & Sealants Stock', cost: 10000 },
        { label: 'Toolkit Bag & Safety Gear', cost: 7000 }
      ]
    }
  },
  {
    id: 'electrical',
    category: 'services',
    titleKey: 'sector_electrical',
    subKey: 'sector_electrical_sub',
    icon: '⚡',
    presets: {
      setupCost: 55000,
      monthlyFixed: 3000,
      unitType: 'Visit',
      pricePerUnit: 350,
      costPerUnit: 70,
      salesPerMonth: 90,
      personalCost: 8500,
      breakdown: [
        { label: 'Multi-meters, Drill & Cable Pullers', cost: 24000 },
        { label: 'Wires, Switches, MCBs & Bulbs Stock', cost: 22000 },
        { label: 'Toolbag & Safety Equipment', cost: 9000 }
      ]
    }
  },
  {
    id: 'transport',
    category: 'services',
    titleKey: 'sector_transport',
    subKey: 'sector_transport_sub',
    icon: '🛺',
    presets: {
      setupCost: 180000,
      monthlyFixed: 7500,
      unitType: 'Trip',
      pricePerUnit: 120,
      costPerUnit: 35,
      salesPerMonth: 340,
      personalCost: 10000,
      breakdown: [
        { label: 'E-Rickshaw / Commercial Vehicle Down Payment', cost: 120000 },
        { label: 'Battery Charging & Maintenance Buffer', cost: 35000 },
        { label: 'Commercial Permit, Registration & Insurance', cost: 25000 }
      ]
    }
  },
  {
    id: 'auto',
    category: 'services',
    titleKey: 'sector_auto',
    subKey: 'sector_auto_sub',
    icon: '🏍️',
    presets: {
      setupCost: 90000,
      monthlyFixed: 5000,
      unitType: 'Job',
      pricePerUnit: 300,
      costPerUnit: 90,
      salesPerMonth: 130,
      personalCost: 9500,
      breakdown: [
        { label: 'Air Compressor & Pneumatic Tools', cost: 40000 },
        { label: 'Jack, Stand, Spanners & Oil Drainers', cost: 28000 },
        { label: 'Engine Oil, Filters & Plugs Stock', cost: 22000 }
      ]
    }
  },

  // --- Manufacturing, Food & Crafts ---
  {
    id: 'food',
    category: 'manufacturing',
    titleKey: 'sector_food',
    subKey: 'sector_food_sub',
    icon: '🍲',
    presets: {
      setupCost: 50000,
      monthlyFixed: 3500,
      unitType: 'Meal',
      pricePerUnit: 70,
      costPerUnit: 32,
      salesPerMonth: 650,
      personalCost: 8000,
      breakdown: [
        { label: 'Commercial Stove, Gas Connection & Utensils', cost: 25000 },
        { label: 'Insulated Tiffin Containers & Delivery Bags', cost: 15000 },
        { label: 'Monthly Spices & Grocery Buffer', cost: 10000 }
      ]
    }
  },
  {
    id: 'handicrafts',
    category: 'manufacturing',
    titleKey: 'sector_handicrafts',
    subKey: 'sector_handicrafts_sub',
    icon: '🏺',
    presets: {
      setupCost: 40000,
      monthlyFixed: 2000,
      unitType: 'Artifact',
      pricePerUnit: 400,
      costPerUnit: 140,
      salesPerMonth: 90,
      personalCost: 7500,
      breakdown: [
        { label: 'Pottery Wheel / Artisan Tools & Molds', cost: 20000 },
        { label: 'Clay, Natural Dyes & Glazes Buffer', cost: 12000 },
        { label: 'Display Shelves & Packaging Material', cost: 8000 }
      ]
    }
  }
];
