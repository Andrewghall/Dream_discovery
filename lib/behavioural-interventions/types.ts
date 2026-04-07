export type InterventionType =
  | 'Training'
  | 'Environmental Restructuring'
  | 'Incentivisation'
  | 'Enablement'
  | 'Persuasion'
  | 'Modelling';

export type Priority = 'High' | 'Medium' | 'Low';

export interface BehaviouralIntervention {
  target_behaviour: string;
  capability_gap: string;
  opportunity_gap: string;
  motivation_gap: string;
  intervention_type: InterventionType;
  action: string;
  evidence_basis?: string;
  supporting_lenses: string[];
  empirically_grounded: boolean;
  priority: Priority;
}

export interface LensInterventions {
  lens: string;
  items: BehaviouralIntervention[];
}

export interface BehaviouralInterventionsOutput {
  behavioural_interventions: LensInterventions[];
  generatedAtMs: number;
  lensesUsed: string[];
  evidenceGrounded: boolean; // true if CV data was available
}
