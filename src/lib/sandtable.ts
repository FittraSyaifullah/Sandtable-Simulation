export const MODEL_VERSION = "unified-force-0.3";
export const DATASET_VERSION = "capability-reference-2025.1";
export const ENSEMBLE_SAMPLES = 240;

export type Nation = {
  code: string;
  name: string;
  region: string;
  income_classification: string;
  budget_usd_bn: number;
  gdp_usd_bn: number;
  population_m: number;
  personnel_k: number;
  aircraft: number;
  armor: number;
  naval: number;
  readiness_index: number;
  longitude: number;
  latitude: number;
  dataset_version: string;
  as_of_date: string;
};

export type SideConfig = {
  nationCode: string;
  posture: "defensive" | "balanced" | "assertive";
  allocation: number;
  supply: number;
  support: number;
  reinforcements: number;
  formations: { land: number; air: number; naval: number; support: number };
};

export type ScenarioConfig = {
  name: string;
  regionLabel: string;
  objective: string;
  terrain: "open" | "mixed" | "restricted" | "maritime";
  tempo: "measured" | "standard" | "intense";
  duration: number;
  uncertainty: number;
  seed: string;
  sideA: SideConfig;
  sideB: SideConfig;
};

export type SimulationEvent = {
  id: string;
  week: number;
  type: "movement" | "engagement" | "logistics" | "objective";
  side: "A" | "B" | "both";
  title: string;
  detail: string;
};

export type WeeklyFrame = {
  week: number;
  aStrength: number;
  bStrength: number;
  aSupply: number;
  bSupply: number;
  aPosition: number;
  bPosition: number;
  control: "A" | "B" | "contested";
};

export type SimulationResult = {
  modelVersion: string;
  datasetVersion: string;
  seed: string;
  runKey: string;
  confidence: "moderate" | "low";
  advantage: "A" | "B";
  outcomeA: number;
  outcomeB: number;
  medianLossA: number;
  medianLossB: number;
  lossRangeA: [number, number];
  lossRangeB: [number, number];
  frames: WeeklyFrame[];
  events: SimulationEvent[];
  assumptions: string[];
  limitations: string[];
};

export const fallbackNations: Nation[] = [
  { code: "USA", name: "United States", region: "North America", income_classification: "High income", budget_usd_bn: 886, gdp_usd_bn: 27360, population_m: 334, personnel_k: 1330, aircraft: 5200, armor: 4650, naval: 470, readiness_index: .88, longitude: -98, latitude: 39, dataset_version: DATASET_VERSION, as_of_date: "2025-01-15" },
  { code: "GBR", name: "United Kingdom", region: "Europe", income_classification: "High income", budget_usd_bn: 75, gdp_usd_bn: 3340, population_m: 68, personnel_k: 185, aircraft: 620, armor: 420, naval: 72, readiness_index: .82, longitude: -3, latitude: 55, dataset_version: DATASET_VERSION, as_of_date: "2025-01-15" },
  { code: "FRA", name: "France", region: "Europe", income_classification: "High income", budget_usd_bn: 62, gdp_usd_bn: 3050, population_m: 68, personnel_k: 205, aircraft: 720, armor: 540, naval: 86, readiness_index: .81, longitude: 2, latitude: 47, dataset_version: DATASET_VERSION, as_of_date: "2025-01-15" },
  { code: "DEU", name: "Germany", region: "Europe", income_classification: "High income", budget_usd_bn: 67, gdp_usd_bn: 4450, population_m: 84, personnel_k: 184, aircraft: 610, armor: 470, naval: 64, readiness_index: .77, longitude: 10, latitude: 51, dataset_version: DATASET_VERSION, as_of_date: "2025-01-15" },
  { code: "IND", name: "India", region: "South Asia", income_classification: "Lower middle income", budget_usd_bn: 81, gdp_usd_bn: 3730, population_m: 1428, personnel_k: 1450, aircraft: 2290, armor: 4610, naval: 295, readiness_index: .74, longitude: 79, latitude: 22, dataset_version: DATASET_VERSION, as_of_date: "2025-01-15" },
  { code: "BRA", name: "Brazil", region: "Latin America", income_classification: "Upper middle income", budget_usd_bn: 23, gdp_usd_bn: 2170, population_m: 216, personnel_k: 360, aircraft: 530, armor: 470, naval: 112, readiness_index: .68, longitude: -52, latitude: -10, dataset_version: DATASET_VERSION, as_of_date: "2025-01-15" },
  { code: "JPN", name: "Japan", region: "East Asia", income_classification: "High income", budget_usd_bn: 50, gdp_usd_bn: 4210, population_m: 124, personnel_k: 247, aircraft: 820, armor: 580, naval: 154, readiness_index: .83, longitude: 138, latitude: 37, dataset_version: DATASET_VERSION, as_of_date: "2025-01-15" },
  { code: "AUS", name: "Australia", region: "Oceania", income_classification: "High income", budget_usd_bn: 32, gdp_usd_bn: 1720, population_m: 27, personnel_k: 59, aircraft: 320, armor: 210, naval: 51, readiness_index: .8, longitude: 134, latitude: -25, dataset_version: DATASET_VERSION, as_of_date: "2025-01-15" },
];

export const defaultScenario: ScenarioConfig = {
  name: "Northern passage study",
  regionLabel: "Abstract northern corridor",
  objective: "Sustain control of a shared access zone",
  terrain: "mixed",
  tempo: "standard",
  duration: 12,
  uncertainty: 42,
  seed: "ST-240-ALPHA",
  sideA: { nationCode: "GBR", posture: "balanced", allocation: 62, supply: 78, support: 64, reinforcements: 24, formations: { land: 4, air: 3, naval: 2, support: 2 } },
  sideB: { nationCode: "FRA", posture: "defensive", allocation: 58, supply: 74, support: 68, reinforcements: 20, formations: { land: 4, air: 3, naval: 2, support: 2 } },
};
