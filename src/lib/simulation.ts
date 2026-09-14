import { DATASET_VERSION, ENSEMBLE_SAMPLES, MODEL_VERSION, Nation, ScenarioConfig, SimulationEvent, SimulationResult, WeeklyFrame } from "./sandtable";

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

function capability(n: Nation) {
  return n.readiness_index * 48 + Math.log10(n.budget_usd_bn + 1) * 9 + Math.log10(n.personnel_k + 1) * 6 + Math.log10(n.aircraft + n.armor + n.naval + 1) * 5;
}

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

function resolve(config: ScenarioConfig, nationA: Nation, nationB: Nation, sampleSeed: string, includeDetail: boolean) {
  const random = rng(sampleSeed);
  const terrainFactor = { open: 1.08, mixed: 1, restricted: .9, maritime: .96 }[config.terrain];
  const tempoFactor = { measured: .78, standard: 1, intense: 1.24 }[config.tempo];
  const postureA = { defensive: .93, balanced: 1, assertive: 1.1 }[config.sideA.posture];
  const postureB = { defensive: .93, balanced: 1, assertive: 1.1 }[config.sideB.posture];
  const formationPower = (formations: ScenarioConfig["sideA"]["formations"]) => Math.max(.45, (formations.land * 1.05 + formations.air * 1.18 + formations.naval * (config.terrain === "maritime" ? 1.35 : .72) + formations.support * .6) / 10);
  const formationA = formationPower(config.sideA.formations);
  const formationB = formationPower(config.sideB.formations);
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
    if (week > 0) {
      const moveA = (config.sideA.posture === "defensive" ? 1.1 : 2.6) * tempoFactor * (aSupply / 100);
      const moveB = (config.sideB.posture === "defensive" ? 1.1 : 2.6) * tempoFactor * (bSupply / 100);
      aPosition = Math.min(50, aPosition + moveA);
      bPosition = Math.max(50, bPosition - moveB);
      aSupply = Math.max(0, aSupply - (1.7 + tempoFactor * 1.9) + config.sideA.support / 90 + config.sideA.reinforcements / 110);
      bSupply = Math.max(0, bSupply - (1.7 + tempoFactor * 1.9) + config.sideB.support / 90 + config.sideB.reinforcements / 110);
      if (engaged) {
        const uncertainty = config.uncertainty / 100;
        const noiseA = 1 + (random() - .5) * uncertainty;
        const noiseB = 1 + (random() - .5) * uncertainty;
        const powerA = capability(nationA) * config.sideA.allocation / 100 * postureA * terrainFactor * formationA * (aSupply / 100) * noiseA;
        const powerB = capability(nationB) * config.sideB.allocation / 100 * postureB / terrainFactor * formationB * (bSupply / 100) * noiseB;
        const total = Math.max(1, powerA + powerB);
        aStrength = Math.max(2, aStrength - tempoFactor * (2.2 + 7 * powerB / total));
        bStrength = Math.max(2, bStrength - tempoFactor * (2.2 + 7 * powerA / total));
      } else {
        aStrength = Math.min(100, aStrength + config.sideA.reinforcements / 150);
        bStrength = Math.min(100, bStrength + config.sideB.reinforcements / 150);
      }
    }
    const scoreA = aStrength * .55 + aSupply * .2 + capability(nationA) * .2 + (aPosition >= 48 ? 9 : 0);
    const scoreB = bStrength * .55 + bSupply * .2 + capability(nationB) * .2 + (bPosition <= 52 ? 9 : 0);
    const control: WeeklyFrame["control"] = Math.abs(scoreA - scoreB) < 5 ? "contested" : scoreA > scoreB ? "A" : "B";
    frames.push({ week, aStrength: +aStrength.toFixed(1), bStrength: +bStrength.toFixed(1), aSupply: +aSupply.toFixed(1), bSupply: +bSupply.toFixed(1), aPosition: +aPosition.toFixed(1), bPosition: +bPosition.toFixed(1), control });
    if (includeDetail && week > 0) {
      events.push({ id: `${week}-move`, week, type: "movement", side: "both", title: "Posture adjusted", detail: `Aggregate formations advanced within the abstract ${config.regionLabel.toLowerCase()}.` });
      if (engaged) events.push({ id: `${week}-contact`, week, type: "engagement", side: "both", title: "Effective formations interact", detail: "Seeded force resolution applied to adjacent aggregate formations." });
      if (aSupply < 45 || bSupply < 45) events.push({ id: `${week}-supply`, week, type: "logistics", side: aSupply < bSupply ? "A" : "B", title: "Supply pressure rising", detail: "Modeled tempo now exceeds available support capacity." });
      if (frames[week - 1]?.control !== control) events.push({ id: `${week}-objective`, week, type: "objective", side: control === "contested" ? "both" : control, title: "Objective state changed", detail: control === "contested" ? "The objective is modeled as contested." : `Side ${control} holds the modeled advantage at the objective.` });
    }
  }
  const final = frames[frames.length - 1];
  const finalScoreA = final.aStrength * .58 + final.aSupply * .22 + capability(nationA) * .2 + (final.control === "A" ? 8 : 0);
  const finalScoreB = final.bStrength * .58 + final.bSupply * .22 + capability(nationB) * .2 + (final.control === "B" ? 8 : 0);
  return { winner: finalScoreA >= finalScoreB ? "A" as const : "B" as const, lossA: 100 - final.aStrength, lossB: 100 - final.bStrength, frames, events };
}

export function runSimulation(config: ScenarioConfig, nations: Nation[]): SimulationResult {
  const nationA = nations.find(n => n.code === config.sideA.nationCode) ?? nations[0];
  const nationB = nations.find(n => n.code === config.sideB.nationCode) ?? nations[1];
  const canonical = resolve(config, nationA, nationB, config.seed, true);
  const samples = Array.from({ length: ENSEMBLE_SAMPLES }, (_, index) => resolve(config, nationA, nationB, `${config.seed}:${index}`, false));
  const outcomeA = Math.round(samples.filter(sample => sample.winner === "A").length / ENSEMBLE_SAMPLES * 100);
  const lossesA = samples.map(sample => sample.lossA);
  const lossesB = samples.map(sample => sample.lossB);
  const configKey = JSON.stringify(config);
  return {
    modelVersion: MODEL_VERSION,
    datasetVersion: DATASET_VERSION,
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
    frames: canonical.frames,
    events: canonical.events,
    assumptions: ["National capability is represented through governed aggregate indicators.", "Formations move toward one abstract objective on weekly strategic ticks.", `${ENSEMBLE_SAMPLES} deterministic sample seeds produce the displayed ranges.`],
    limitations: ["Illustrative model output—not a forecast, intelligence assessment, or operational recommendation.", "Political decisions, alliances, escalation, command behavior, and real unit locations are excluded.", "Aggregate inputs cannot represent tactical context or establish predictive validity."],
  };
}
