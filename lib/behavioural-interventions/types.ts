export type InterventionType =
  | 'Training'
  | 'Environmental Restructuring'
  | 'Incentivisation'
  | 'Enablement'
  | 'Persuasion'
  | 'Modelling';

export type Priority = 'High' | 'Medium' | 'Low';

export type CapabilityType = 'Physical' | 'Psychological' | 'Both';
export type MotivationType = 'Reflective' | 'Automatic' | 'Both';
export type OpportunityType = 'Physical' | 'Social' | 'Both';

export interface BehaviouralIntervention {
  target_behaviour: string;
  capability_gap: string;
  capability_type?: CapabilityType;
  opportunity_gap: string;
  opportunity_type?: OpportunityType;
  motivation_gap: string;
  motivation_type?: MotivationType;
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
