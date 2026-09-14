import { AgentTurn, ASSET_DATASET_VERSION, AssetDomain, AssetPool, DATASET_VERSION, DomainScores, ENSEMBLE_SAMPLES, MODEL_VERSION, Nation, ScenarioConfig, SimulationEvent, SimulationResult, WeeklyFrame } from "./sandtable";

function hashText(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rng(seed: string) {
  let state = hashText(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

const domains: AssetDomain[] = ["land", "air", "maritime", "support"];
const terrainWeights: Record<ScenarioConfig["terrain"], DomainScores> = {
  open: { land: .4, air: .3, maritime: .06, support: .24 },
  mixed: { land: .34, air: .28, maritime: .12, support: .26 },
  restricted: { land: .34, air: .2, maritime: .08, support: .38 },
  maritime: { land: .1, air: .25, maritime: .4, support: .25 },
};

type DomainMetric = { score: number; sustainment: number; repair: number; replacement: number };
type CapabilityProfile = Record<AssetDomain, DomainMetric>;

function fallbackPool(nation: Nation, domain: AssetDomain): Omit<AssetPool, "id" | "evidence" | "updated_at"> {
  const inventory = { land: nation.armor, air: nation.aircraft, maritime: nation.naval, support: Math.max(1, nation.personnel_k / 10) }[domain];
  const availability = { land: [.55, .78], air: [.5, .72], maritime: [.58, .8], support: [.65, .86] }[domain];
  return {
    version_id: `${ASSET_DATASET_VERSION}:derived-fallback`, nation_code: nation.code, domain, category: `${domain}_aggregate`,
    inventory_low: inventory * .85, inventory_estimate: inventory, inventory_high: inventory * 1.15,
    availability_low: availability[0], availability_high: availability[1],
    readiness_low: Math.max(.25, nation.readiness_index - .12), readiness_high: Math.min(.98, nation.readiness_index + .06),
    sustainment_index: Math.min(.95, Math.max(.35, nation.readiness_index * (domain === "support" ? 1.02 : domain === "maritime" ? .95 : domain === "land" ? .92 : .88))),
    repair_rate: { land: .035, air: .045, maritime: .03, support: .055 }[domain],
    replacement_rate: Math.min(.08, Math.max(.005, nation.gdp_usd_bn / 100000 + nation.budget_usd_bn / 50000)),
    confidence: "moderate", review_status: "approved",
  };
}

function domainMetric(nation: Nation, assetPools: AssetPool[], domain: AssetDomain): DomainMetric {
  const approved = assetPools.filter(pool => pool.nation_code === nation.code && pool.domain === domain && pool.review_status === "approved");
  const pools = approved.length ? approved : [fallbackPool(nation, domain)];
  const inventory = pools.reduce((sum, pool) => sum + Number(pool.inventory_estimate), 0);
  const weighted = (field: "availability_low" | "availability_high" | "readiness_low" | "readiness_high" | "sustainment_index" | "repair_rate" | "replacement_rate") => {
    const totalWeight = pools.reduce((sum, pool) => sum + Math.max(1, Number(pool.inventory_estimate)), 0);
    return pools.reduce((sum, pool) => sum + Number(pool[field]) * Math.max(1, Number(pool.inventory_estimate)), 0) / totalWeight;
  };
  const availability = (weighted("availability_low") + weighted("availability_high")) / 2;
  const readiness = (weighted("readiness_low") + weighted("readiness_high")) / 2;
  const sustainment = weighted("sustainment_index");
  const rangeWidth = pools.reduce((sum, pool) => sum + Math.max(0, Number(pool.inventory_high) - Number(pool.inventory_low)), 0);
  const certainty = Math.max(.82, 1 - rangeWidth / Math.max(1, inventory) * .12);
  const score = Math.log10(inventory + 1) * 26 * (.45 + availability * .55) * (.45 + readiness * .55) * (.7 + sustainment * .3) * certainty;
  return { score, sustainment, repair: weighted("repair_rate"), replacement: weighted("replacement_rate") };
}

function capabilityProfile(nation: Nation, assetPools: AssetPool[]): CapabilityProfile {
  return {
    land: domainMetric(nation, assetPools, "land"),
    air: domainMetric(nation, assetPools, "air"),
    maritime: domainMetric(nation, assetPools, "maritime"),
    support: domainMetric(nation, assetPools, "support"),
  };
}

function domainPower(profile: CapabilityProfile, formations: ScenarioConfig["sideA"]["formations"], terrain: ScenarioConfig["terrain"]) {
  const weights = terrainWeights[terrain];
  const formation = {
    land: .55 + formations.land / 6,
    air: .55 + formations.air / 6,
    maritime: .55 + formations.naval / 6,
    support: .55 + formations.support / 6,
  };
  const supportEnabler = .82 + Math.min(.35, profile.support.score / 180);
  const contributions = {
    land: profile.land.score * weights.land * formation.land * supportEnabler,
    air: profile.air.score * weights.air * formation.air * supportEnabler,
    maritime: profile.maritime.score * weights.maritime * formation.maritime * supportEnabler,
    support: profile.support.score * weights.support * formation.support,
  };
  return domains.reduce((sum, domain) => sum + contributions[domain], 0);
}

function profileScores(profile: CapabilityProfile): DomainScores {
  return {
    land: +profile.land.score.toFixed(1),
    air: +profile.air.score.toFixed(1),
    maritime: +profile.maritime.score.toFixed(1),
    support: +profile.support.score.toFixed(1),
  };
}

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

function resolve(config: ScenarioConfig, nationA: Nation, nationB: Nation, sampleSeed: string, includeDetail: boolean, agentTurns: AgentTurn[], assetPools: AssetPool[]) {
  const random = rng(sampleSeed);
  const tempoFactor = { measured: .78, standard: 1, intense: 1.24 }[config.tempo];
  const postureA = { defensive: .93, balanced: 1, assertive: 1.1 }[config.sideA.posture];
  const postureB = { defensive: .93, balanced: 1, assertive: 1.1 }[config.sideB.posture];
  const profileA = capabilityProfile(nationA, assetPools);
  const profileB = capabilityProfile(nationB, assetPools);
  const basePowerA = domainPower(profileA, config.sideA.formations, config.terrain);
  const basePowerB = domainPower(profileB, config.sideB.formations, config.terrain);
  const supportRecoveryA = profileA.support.score * profileA.support.sustainment / 70 + profileA.support.repair * 2 + profileA.support.replacement * 2;
  const supportRecoveryB = profileB.support.score * profileB.support.sustainment / 70 + profileB.support.repair * 2 + profileB.support.replacement * 2;
  let aStrength = 100;
  let bStrength = 100;
  let aSupply = config.sideA.supply;
  let bSupply = config.sideB.supply;
  let aPosition = 10;
  let bPosition = 90;
  const frames: WeeklyFrame[] = [];
  const events: SimulationEvent[] = [];

  for (let week = 0; week <= config.duration; week += 1) {
    const gap = bPosition - aPosition;
    const engaged = gap <= 22;
    const agentTurn = agentTurns.find(turn => turn.week === week);
    const stanceA = { hold: .65, cautious: .82, balanced: 1, press: 1.2 }[agentTurn?.sideA.stance ?? "balanced"];
    const stanceB = { hold: .65, cautious: .82, balanced: 1, press: 1.2 }[agentTurn?.sideB.stance ?? "balanced"];
    const supplyAAgent = agentTurn?.sideA.priority === "logistics" ? .78 : agentTurn?.sideA.priority === "resilience" ? .88 : 1;
    const supplyBAgent = agentTurn?.sideB.priority === "logistics" ? .78 : agentTurn?.sideB.priority === "resilience" ? .88 : 1;
    const readinessA = agentTurn?.sideA.priority === "readiness" ? .9 : 1;
    const readinessB = agentTurn?.sideB.priority === "readiness" ? .9 : 1;
    if (week > 0) {
      const moveA = (config.sideA.posture === "defensive" ? 1.1 : 2.6) * tempoFactor * (aSupply / 100) * stanceA;
      const moveB = (config.sideB.posture === "defensive" ? 1.1 : 2.6) * tempoFactor * (bSupply / 100) * stanceB;
      aPosition = Math.min(50, aPosition + moveA);
      bPosition = Math.max(50, bPosition - moveB);
      aSupply = Math.max(0, aSupply - (1.7 + tempoFactor * 1.9) * supplyAAgent + config.sideA.support / 90 + config.sideA.reinforcements / 110 + supportRecoveryA);
      bSupply = Math.max(0, bSupply - (1.7 + tempoFactor * 1.9) * supplyBAgent + config.sideB.support / 90 + config.sideB.reinforcements / 110 + supportRecoveryB);
      if (engaged) {
        const uncertainty = config.uncertainty / 100;
        const noiseA = 1 + (random() - .5) * uncertainty;
        const noiseB = 1 + (random() - .5) * uncertainty;
        const powerA = basePowerA * config.sideA.allocation / 100 * postureA * (aSupply / 100) * noiseA;
        const powerB = basePowerB * config.sideB.allocation / 100 * postureB * (bSupply / 100) * noiseB;
        const total = Math.max(1, powerA + powerB);
        const recoveryA = Math.min(.75, profileA.support.repair * 4 + profileA.support.replacement * 3 + profileA.support.score / 160);
        const recoveryB = Math.min(.75, profileB.support.repair * 4 + profileB.support.replacement * 3 + profileB.support.score / 160);
        aStrength = Math.max(2, aStrength - tempoFactor * readinessA * (2.2 + 7 * powerB / total) + recoveryA);
        bStrength = Math.max(2, bStrength - tempoFactor * readinessB * (2.2 + 7 * powerA / total) + recoveryB);
      } else {
        aStrength = Math.min(100, aStrength + config.sideA.reinforcements / 150 + supportRecoveryA / 4);
        bStrength = Math.min(100, bStrength + config.sideB.reinforcements / 150 + supportRecoveryB / 4);
      }
    }
    const scoreA = aStrength * .55 + aSupply * .2 + basePowerA * .2 + (aPosition >= 48 ? 9 : 0);
    const scoreB = bStrength * .55 + bSupply * .2 + basePowerB * .2 + (bPosition <= 52 ? 9 : 0);
    const control: WeeklyFrame["control"] = Math.abs(scoreA - scoreB) < 5 ? "contested" : scoreA > scoreB ? "A" : "B";
    frames.push({ week, aStrength: +aStrength.toFixed(1), bStrength: +bStrength.toFixed(1), aSupply: +aSupply.toFixed(1), bSupply: +bSupply.toFixed(1), aPosition: +aPosition.toFixed(1), bPosition: +bPosition.toFixed(1), control });
    if (includeDetail && week > 0) {
      events.push({ id: `${week}-move`, week, type: "movement", side: "both", title: "Posture adjusted", detail: `Aggregate formations advanced within the abstract ${config.regionLabel.toLowerCase()}.` });
      if (engaged) events.push({ id: `${week}-contact`, week, type: "engagement", side: "both", title: "Effective formations interact", detail: "Seeded land, air, maritime, and support resolution applied to adjacent aggregate formations." });
      if (aSupply < 45 || bSupply < 45) events.push({ id: `${week}-supply`, week, type: "logistics", side: aSupply < bSupply ? "A" : "B", title: "Supply pressure rising", detail: "Modeled tempo now exceeds available aggregate support capacity." });
      if (frames[week - 1]?.control !== control) events.push({ id: `${week}-objective`, week, type: "objective", side: control === "contested" ? "both" : control, title: "Objective state changed", detail: control === "contested" ? "The objective is modeled as contested." : `Side ${control} holds the modeled advantage at the objective.` });
    }
  }
  const final = frames[frames.length - 1];
  const finalScoreA = final.aStrength * .58 + final.aSupply * .22 + basePowerA * .2 + (final.control === "A" ? 8 : 0);
  const finalScoreB = final.bStrength * .58 + final.bSupply * .22 + basePowerB * .2 + (final.control === "B" ? 8 : 0);
  return { winner: finalScoreA >= finalScoreB ? "A" as const : "B" as const, lossA: 100 - final.aStrength, lossB: 100 - final.bStrength, frames, events, profileA, profileB };
}

export function runSimulation(config: ScenarioConfig, nations: Nation[], agentTurns: AgentTurn[] = [], assetPools: AssetPool[] = []): SimulationResult {
  const nationA = nations.find(nation => nation.code === config.sideA.nationCode) ?? nations[0];
  const nationB = nations.find(nation => nation.code === config.sideB.nationCode) ?? nations[1];
  const relevantPools = assetPools.filter(pool => (pool.nation_code === nationA.code || pool.nation_code === nationB.code) && pool.review_status === "approved");
  const canonical = resolve(config, nationA, nationB, config.seed, true, agentTurns, relevantPools);
  const samples = Array.from({ length: ENSEMBLE_SAMPLES }, (_, index) => resolve(config, nationA, nationB, `${config.seed}:${index}`, false, agentTurns, relevantPools));
  const outcomeA = Math.round(samples.filter(sample => sample.winner === "A").length / ENSEMBLE_SAMPLES * 100);
  const lossesA = samples.map(sample => sample.lossA);
  const lossesB = samples.map(sample => sample.lossB);
  const assetEvidenceKey = relevantPools.map(pool => ({ id: pool.id, version: pool.version_id, inventory: [pool.inventory_low, pool.inventory_estimate, pool.inventory_high], availability: [pool.availability_low, pool.availability_high], readiness: [pool.readiness_low, pool.readiness_high], sustainment: pool.sustainment_index, repair: pool.repair_rate, replacement: pool.replacement_rate })).sort((a, b) => a.id.localeCompare(b.id));
  const frozenDecisionKey = agentTurns.map(turn => ({ week:turn.week, sideA:turn.sideA, sideB:turn.sideB, observationA:turn.observationA, observationB:turn.observationB, models:turn.models, modes:turn.modes }));
  const configKey = JSON.stringify({ config, frozenDecisionKey, nationInputs: [nationA, nationB], assetEvidenceKey });
  const versions = [...new Set(relevantPools.map(pool => pool.version_id))].sort();
  const assetDatasetVersion = versions.length ? versions.join("+") : `${ASSET_DATASET_VERSION}:derived-fallback`;
  return {
    modelVersion: MODEL_VERSION,
    datasetVersion: DATASET_VERSION,
    assetDatasetVersion,
    seed: config.seed,
    runKey: `${MODEL_VERSION}:${DATASET_VERSION}:${hashText(configKey).toString(16).padStart(8, "0")}`,
    confidence: config.uncertainty < 65 ? "moderate" : "low",
    advantage: outcomeA >= 50 ? "A" : "B",
    outcomeA,
    outcomeB: 100 - outcomeA,
    medianLossA: +percentile(lossesA, .5).toFixed(1),
    medianLossB: +percentile(lossesB, .5).toFixed(1),
    lossRangeA: [+percentile(lossesA, .2).toFixed(1), +percentile(lossesA, .8).toFixed(1)],
    lossRangeB: [+percentile(lossesB, .2).toFixed(1), +percentile(lossesB, .8).toFixed(1)],
    domainCapabilities: { sideA: profileScores(canonical.profileA), sideB: profileScores(canonical.profileB) },
    frames: canonical.frames,
    events: canonical.events,
    agentTurns,
    assumptions: [relevantPools.length ? "Only approved pools from the active versioned asset dataset inform domain capability." : "Approved asset pools were unavailable; four domain pools were deterministically derived from governed national indicators.", "Land, air, maritime, and support are calculated independently, then weighted by terrain and configured aggregate formations.", "Inventory ranges, availability, readiness, sustainment, repair, and replacement are modeled as auditable aggregate inputs.", "Each bounded AI agent observes the preceding aggregate frame, decides independently, and is committed before deterministic adjudication.", "Frozen decision content—not invocation IDs or timestamps—is included in the reproducible run key.", `${ENSEMBLE_SAMPLES} deterministic sample seeds produce the displayed ranges.`],
    limitations: ["Illustrative model output—not a forecast, intelligence assessment, or operational recommendation.", "Live intelligence, weapons employment, target selection, attack routes, and real unit locations are excluded.", "Aggregate asset pools and model-generated agent choices cannot represent tactical context or establish predictive validity."],
  };
}
