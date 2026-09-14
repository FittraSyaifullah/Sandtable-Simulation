import { AgentObservation, AgentTurn, DomainScores, SimulationResult, WeeklyFrame } from "./sandtable";

function objectiveState(control: WeeklyFrame["control"], side: "A" | "B"): AgentObservation["objectiveState"] {
  if (control === "contested") return "contested";
  return control === side ? "advantage" : "disadvantage";
}

function scores(result: SimulationResult, side: "A" | "B"): DomainScores {
  const available = side === "A" ? result.domainCapabilities?.sideA : result.domainCapabilities?.sideB;
  return available ?? { land: 0, air: 0, maritime: 0, support: 0 };
}

export function buildTurnObservations(result: SimulationResult, week: number, uncertainty: number, previousTurn?: AgentTurn) {
  const frame = result.frames[Math.max(0, week - 1)];
  const observationA: AgentObservation = {
    week,
    ownStrength: frame.aStrength,
    ownSupply: frame.aSupply,
    objectiveState: objectiveState(frame.control, "A"),
    observedOpponentStrength: frame.bStrength,
    observedOpponentSupply: frame.bSupply,
    ownDomains: scores(result, "A"),
    uncertainty,
    ...(previousTurn ? { previousDecision: { stance: previousTurn.sideA.stance, priority: previousTurn.sideA.priority } } : {}),
  };
  const observationB: AgentObservation = {
    week,
    ownStrength: frame.bStrength,
    ownSupply: frame.bSupply,
    objectiveState: objectiveState(frame.control, "B"),
    observedOpponentStrength: frame.aStrength,
    observedOpponentSupply: frame.aSupply,
    ownDomains: scores(result, "B"),
    uncertainty,
    ...(previousTurn ? { previousDecision: { stance: previousTurn.sideB.stance, priority: previousTurn.sideB.priority } } : {}),
  };
  return { observationA, observationB };
}
