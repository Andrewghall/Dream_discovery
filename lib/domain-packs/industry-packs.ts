/**
 * Industry Domain Packs
 *
 * 20 industry-specific DomainPack objects.
 * lenses, journeyStages, actorTaxonomy, and engagementVariants are fully populated.
 * metricReferences, questionTemplates, diagnosticOutputFields, discoveryLenses,
 * and discoveryQuestionTemplates are left as empty arrays for future population.
 */

import type { DomainPack } from './registry';

// ---------------------------------------------------------------------------
// Airline & Aviation
// ---------------------------------------------------------------------------

const AIRLINE_AVIATION: DomainPack = {
  key: 'airline_aviation',
  label: 'Airline & Aviation',
  description: 'Commercial aviation operations — revenue, customer experience, flight operations, safety, and sustainability.',
  category: 'operational',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Inspiration & Planning', description: 'Customer searches destinations, compares prices, explores schedules' },
    { stage: 2, label: 'Booking', description: 'Flight selection, payment, seat choice, add-ons' },
    { stage: 3, label: 'Pre-Travel Preparation', description: 'Manage booking, changes, upgrades, special assistance, passport/visa' },
    { stage: 4, label: 'Check-in', description: 'Online check-in, seat confirmation, boarding pass' },
    { stage: 5, label: 'Airport Journey', description: 'Bag drop, security, boarding gate updates, delays' },
    { stage: 6, label: 'Boarding', description: 'Gate operations, final documentation checks' },
    { stage: 7, label: 'In-Flight Experience', description: 'Cabin service, customer assistance, disruption handling' },
    { stage: 8, label: 'Arrival & Baggage', description: 'Baggage collection, immigration, transfers' },
    { stage: 9, label: 'Post-Journey Support', description: 'Lost baggage, compensation, complaints, loyalty updates' },
    { stage: 10, label: 'Loyalty & Future Engagement', description: 'Frequent flyer programmes, promotions, repeat booking' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 base lenses',
    },
    operational_deep_dive: {
      notes: 'Emphasise Flight Operations & Safety, Ground & Airport Operations, People Culture & Workforce',
    },
    ai_enablement: {
      notes: 'Emphasise Technology & Digital Transformation, Commercial & Revenue Strategy',
    },
    transformation_sprint: {
      notes: 'Emphasise Technology & Digital Transformation, Commercial & Revenue Strategy, People Culture & Workforce',
    },
    cultural_alignment: {
      notes: 'Emphasise People Culture & Workforce, Flight Operations & Safety (safety culture)',
    },
    go_to_market: {
      notes: 'Emphasise Commercial & Revenue Strategy, Customer Experience & Brand, Sustainability & Environmental Performance',
    },
  },
  actorTaxonomy: [
    { key: 'ceo_board', label: 'CEO/Board', description: 'Executive leadership and board governance' },
    { key: 'chief_commercial_officer', label: 'Chief Commercial Officer', description: 'Commercial strategy and revenue' },
    { key: 'chief_operating_officer', label: 'Chief Operating Officer', description: 'Operational leadership' },
    { key: 'network_planning_director', label: 'Network Planning Director', description: 'Route and network strategy' },
    { key: 'yield_revenue_manager', label: 'Yield & Revenue Manager', description: 'Revenue optimisation and pricing' },
    { key: 'head_cx', label: 'Head of Customer Experience', description: 'Passenger experience strategy' },
    { key: 'flight_ops_director', label: 'Flight Operations Director', description: 'Flight operations management' },
    { key: 'cabin_crew_manager', label: 'Cabin Crew Manager', description: 'Cabin crew management and training' },
    { key: 'ground_ops_manager', label: 'Ground Operations Manager', description: 'Ground handling and turnaround' },
    { key: 'airport_relationship_manager', label: 'Airport Relationship Manager', description: 'Airport partner relationships' },
    { key: 'head_digital_technology', label: 'Head of Digital & Technology', description: 'Technology and digital platforms' },
    { key: 'safety_compliance_director', label: 'Safety & Compliance Director', description: 'Safety management and regulatory compliance' },
    { key: 'sustainability_lead', label: 'Sustainability Lead', description: 'Environmental strategy and reporting' },
    { key: 'hr_people_director', label: 'HR & People Director', description: 'Workforce strategy and culture' },
    { key: 'cargo_director', label: 'Cargo Director', description: 'Cargo operations and revenue' },
    { key: 'mro_manager', label: 'MRO Manager', description: 'Maintenance, repair, and overhaul' },
    { key: 'passenger_traveller', label: 'Passenger/Traveller', description: 'End customer' },
    { key: 'corporate_travel_buyer', label: 'Corporate Travel Buyer', description: 'Business travel purchaser' },
    { key: 'travel_agent_ota', label: 'Travel Agent/OTA', description: 'Distribution channel partner' },
    { key: 'regulator', label: 'Regulator (CAA/EASA/FAA)', description: 'Aviation safety regulator' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// BPO & Outsourcing
// ---------------------------------------------------------------------------

const BPO_OUTSOURCING: DomainPack = {
  key: 'bpo_outsourcing',
  label: 'BPO & Outsourcing',
  description: 'Business process outsourcing — operational delivery, client management, workforce capability, and AI automation.',
  category: 'operational',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Business Development & Scoping', description: 'RFP response, solution design, commercial negotiation' },
    { stage: 2, label: 'Contract & Governance Setup', description: 'SLA definition, governance cadence, reporting framework' },
    { stage: 3, label: 'Transition & Knowledge Transfer', description: 'Process documentation, systems access, training design' },
    { stage: 4, label: 'Recruitment & Onboarding', description: 'Hiring to profile, induction, certification to live' },
    { stage: 5, label: 'Go-Live & Stabilisation', description: 'Controlled launch, hypercare, early performance triage' },
    { stage: 6, label: 'Steady-State Operations', description: 'BAU delivery, SLA management, QA cycles' },
    { stage: 7, label: 'Performance Review Cadence', description: 'Client governance meetings, scorecard review, escalation' },
    { stage: 8, label: 'Continuous Improvement', description: 'CI initiatives, automation pipeline, productivity optimisation' },
    { stage: 9, label: 'Workforce Management Cycle', description: 'Forecasting, scheduling, real-time adherence' },
    { stage: 10, label: 'Contract Renewal & Expansion', description: 'Rebid preparation, scope expansion, value demonstration' },
    { stage: 11, label: 'Exit & Transition Out', description: 'Knowledge repatriation, handover to new vendor or in-house' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 base lenses',
    },
    operational_deep_dive: {
      notes: 'Emphasise Operational Consistency, Workforce & Capability, Technology & Integration, Quality & Governance',
    },
    ai_enablement: {
      notes: 'Emphasise AI & Automation Reality, Technology & Integration, Workforce & Capability',
    },
    transformation_sprint: {
      notes: 'Emphasise Operational Consistency, Client Delivery & Performance, AI & Automation Reality',
    },
    cultural_alignment: {
      notes: 'Emphasise Workforce & Capability, Quality & Governance',
    },
    go_to_market: {
      notes: 'Emphasise Commercial & Client Alignment, Client Delivery & Performance, AI & Automation Reality',
    },
  },
  actorTaxonomy: [
    { key: 'bpo_account_director', label: 'BPO Account Director', description: 'Senior client relationship owner' },
    { key: 'operations_manager', label: 'Operations Manager', description: 'Day-to-day operational management' },
    { key: 'team_leader', label: 'Team Leader/Supervisor', description: 'Front-line team management' },
    { key: 'contact_centre_agent', label: 'Contact Centre Agent/Associate', description: 'Front-line delivery' },
    { key: 'wfm_analyst', label: 'WFM Analyst', description: 'Workforce management and scheduling' },
    { key: 'qa_analyst', label: 'QA Analyst', description: 'Quality assurance and calibration' },
    { key: 'training_enablement_lead', label: 'Training & Enablement Lead', description: 'Learning and development' },
    { key: 'transition_manager', label: 'Transition Manager', description: 'Contract transition management' },
    { key: 'client_programme_manager', label: 'Client-Side Programme Manager', description: 'Client-side oversight' },
    { key: 'commercial_pricing_analyst', label: 'Commercial/Pricing Analyst', description: 'Commercial modelling and pricing' },
    { key: 'technology_it_integration', label: 'Technology/IT Integration Lead', description: 'Systems integration and IT' },
    { key: 'ai_automation_specialist', label: 'AI/Automation Specialist', description: 'Automation and AI implementation' },
    { key: 'compliance_data_privacy', label: 'Compliance & Data Privacy Officer', description: 'Regulatory and data compliance' },
    { key: 'recruitment_talent', label: 'Recruitment & Talent Acquisition', description: 'Talent pipeline and hiring' },
    { key: 'site_facilities_manager', label: 'Site/Facilities Manager', description: 'Physical site management' },
    { key: 'bi_reporting_analyst', label: 'Business Intelligence/Reporting Analyst', description: 'Data and performance reporting' },
    { key: 'c_suite_divisional_md', label: 'C-Suite/Divisional MD', description: 'Senior executive leadership' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Telecommunications
// ---------------------------------------------------------------------------

const TELECOMMUNICATIONS: DomainPack = {
  key: 'telecommunications',
  label: 'Telecommunications',
  description: 'Telecoms operators — customer experience, network reliability, product, field services, and digital channels.',
  category: 'operational',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Awareness & Consideration', description: 'Customer explores providers; comparison sites, ads, word of mouth' },
    { stage: 2, label: 'Sales & Acquisition', description: 'Online/in-store/agent purchase; contract complexity, device bundling' },
    { stage: 3, label: 'Provisioning & Onboarding', description: 'Number porting, SIM/router delivery, engineer visit scheduling' },
    { stage: 4, label: 'Early Life (0-90 Days)', description: 'First bill shock risk, service set-up issues, onboarding support' },
    { stage: 5, label: 'In-Life Service Usage', description: 'Day-to-day connectivity, data/usage management, self-serve' },
    { stage: 6, label: 'Fault & Incident Management', description: 'Network fault raised, triage, engineer dispatch, resolution' },
    { stage: 7, label: 'Billing & Account Management', description: 'Bill queries, payment handling, tariff changes' },
    { stage: 8, label: 'Renewal & Upgrade', description: 'Contract expiry, retention offer, device upgrade' },
    { stage: 9, label: 'Complaint & Escalation', description: 'Formal complaints, ombudsman risk, regulatory reporting' },
    { stage: 10, label: 'Churn & Disconnection', description: 'Customer cancels, win-back attempts, port-out, final bill' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses',
    },
    operational_deep_dive: {
      notes: 'Emphasise Operations & Field Services, Network & Service Reliability, People & Frontline Capability, Technology & Platform',
    },
    ai_enablement: {
      notes: 'Emphasise Technology & Platform, Customer Experience & Retention, Operations & Field Services',
    },
    transformation_sprint: {
      notes: 'Emphasise Customer Experience & Retention, Operations & Field Services, People & Frontline Capability, Digital & Channel',
    },
    cultural_alignment: {
      notes: 'Emphasise People & Frontline Capability, Customer Experience & Retention',
    },
    go_to_market: {
      notes: 'Emphasise Product & Commercial, Customer Experience & Retention, Digital & Channel',
    },
  },
  actorTaxonomy: [
    { key: 'residential_customer', label: 'Residential Customer', description: 'Consumer end customer' },
    { key: 'sme_customer', label: 'SME Customer', description: 'Small and medium business customer' },
    { key: 'enterprise_customer', label: 'Enterprise Customer', description: 'Large business customer' },
    { key: 'sales_agent', label: 'Sales Agent (Inbound/Outbound)', description: 'Sales and acquisition' },
    { key: 'customer_service_advisor', label: 'Customer Service Advisor', description: 'Front-line customer service' },
    { key: 'retention_specialist', label: 'Retention Specialist', description: 'Customer retention and saves' },
    { key: 'field_engineer', label: 'Field Engineer', description: 'On-site technical engineer' },
    { key: 'field_ops_manager', label: 'Field Operations Manager', description: 'Field workforce management' },
    { key: 'noc_analyst', label: 'Network Operations Centre (NOC) Analyst', description: 'Network monitoring and incident management' },
    { key: 'network_planning_engineer', label: 'Network Planning Engineer', description: 'Network design and capacity planning' },
    { key: 'billing_collections', label: 'Billing & Collections Team', description: 'Billing management and debt recovery' },
    { key: 'product_manager', label: 'Product Manager', description: 'Product portfolio management' },
    { key: 'digital_app_product_owner', label: 'Digital & App Product Owner', description: 'Digital channel and app ownership' },
    { key: 'workforce_manager', label: 'Workforce Manager (WFM)', description: 'Contact centre workforce management' },
    { key: 'quality_analyst', label: 'Quality Analyst', description: 'Quality assurance' },
    { key: 'regulatory_affairs_manager', label: 'Regulatory Affairs Manager', description: 'Regulatory compliance management' },
    { key: 'data_analytics_analyst', label: 'Data & Analytics Analyst', description: 'Data and performance analytics' },
    { key: 'it_oss_bss_owner', label: 'IT/OSS/BSS Systems Owner', description: 'Operational and business support systems' },
    { key: 'chief_commercial_officer', label: 'Chief Commercial Officer', description: 'Commercial strategy' },
    { key: 'ombudsman_regulator', label: 'Ombudsman/Regulatory Body', description: 'External regulator and ombudsman' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Energy & Utilities
// ---------------------------------------------------------------------------

const ENERGY_UTILITIES: DomainPack = {
  key: 'energy_utilities',
  label: 'Energy & Utilities',
  description: 'Energy suppliers and utilities — customer affordability, network assets, energy transition, and field delivery.',
  category: 'operational',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Property Purchase/Moving In', description: 'Supply transfer, meter reading, welcome pack' },
    { stage: 2, label: 'Account Set-Up & Onboarding', description: 'Direct debit, tariff explanation, smart meter booking' },
    { stage: 3, label: 'Smart Meter Installation', description: 'Scheduling, engineer visit, IHD set-up, data consent' },
    { stage: 4, label: 'In-Life Supply & Billing', description: 'Usage monitoring, bill generation, payment, tariff reviews' },
    { stage: 5, label: 'Energy Efficiency & Support Services', description: 'Insulation schemes, ECO grants, vulnerability identification' },
    { stage: 6, label: 'Fault & Outage Management', description: 'Power cut reported, triage, ETR communication, restoration' },
    { stage: 7, label: 'Connections & New Supply', description: 'New connection application, design, installation, energisation' },
    { stage: 8, label: 'Tariff Change & Renewal', description: 'Price cap changes, switching communications, retention' },
    { stage: 9, label: 'Complaint & Vulnerability Handling', description: 'Formal complaint, PSR management, Ombudsman referral' },
    { stage: 10, label: 'Account Closure & Moving Out', description: 'Final read, final bill, security deposit return' },
    { stage: 11, label: 'EV & Heat Pump Integration', description: 'Smart charging installation, export tariff, heat pump commissioning' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses',
    },
    operational_deep_dive: {
      notes: 'Emphasise Operations & Field Delivery, Technology & Operational Systems, Network & Asset Management, People & Workforce',
    },
    ai_enablement: {
      notes: 'Emphasise Technology & Operational Systems, Operations & Field Delivery, Customer Experience & Affordability',
    },
    transformation_sprint: {
      notes: 'Emphasise Customer Experience & Affordability, Operations & Field Delivery, Technology & Operational Systems, People & Workforce',
    },
    cultural_alignment: {
      notes: 'Emphasise People & Workforce, Safety Environment & Compliance',
    },
    go_to_market: {
      notes: 'Emphasise Customer Experience & Affordability, Energy Transition & Decarbonisation, Technology & Operational Systems',
    },
  },
  actorTaxonomy: [
    { key: 'domestic_customer', label: 'Domestic Customer', description: 'Residential energy consumer' },
    { key: 'business_customer_sme', label: 'Business Customer (SME)', description: 'Small and medium business energy user' },
    { key: 'ic_customer', label: 'I&C Customer', description: 'Industrial and commercial energy user' },
    { key: 'vulnerable_customer', label: 'Vulnerable Customer', description: 'Customer requiring additional support' },
    { key: 'customer_service_advisor', label: 'Customer Service Advisor', description: 'Front-line customer service' },
    { key: 'collections_debt_advisor', label: 'Collections & Debt Advisor', description: 'Debt management and collections' },
    { key: 'smart_metering_engineer', label: 'Smart Metering Engineer', description: 'Smart meter installation and repair' },
    { key: 'connections_engineer', label: 'Connections Engineer', description: 'New connection installation' },
    { key: 'network_ops_control_room', label: 'Network Operations/Control Room Operator', description: 'Network control and monitoring' },
    { key: 'field_service_technician', label: 'Field Service Technician', description: 'Field maintenance and repair' },
    { key: 'field_ops_manager', label: 'Field Operations Manager', description: 'Field workforce management' },
    { key: 'asset_manager', label: 'Asset Manager', description: 'Network asset lifecycle management' },
    { key: 'regulation_policy_manager', label: 'Regulation & Policy Manager', description: 'Regulatory compliance and policy' },
    { key: 'vulnerability_fuel_poverty_lead', label: 'Vulnerability & Fuel Poverty Lead', description: 'Vulnerability strategy and fuel poverty schemes' },
    { key: 'data_metering_systems_manager', label: 'Data & Metering Systems Manager', description: 'Metering data and systems' },
    { key: 'energy_transition_programme_manager', label: 'Energy Transition Programme Manager', description: 'Decarbonisation and transition programmes' },
    { key: 'hse_manager', label: 'HSE Manager', description: 'Health, safety, and environment' },
    { key: 'it_platform_owner', label: 'IT & Platform Owner', description: 'Technology platform management' },
    { key: 'ofgem_regulator', label: 'Ofgem/Utility Regulator', description: 'Energy market regulator' },
    { key: 'dno_dso', label: 'Distribution Network Operator (DNO/DSO)', description: 'Network operator' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Financial Services
// ---------------------------------------------------------------------------

const FINANCIAL_SERVICES: DomainPack = {
  key: 'financial_services',
  label: 'Financial Services',
  description: 'Banks, insurers, and financial institutions — customer trust, risk, regulation, and digital innovation.',
  category: 'operational',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Discovery & Comparison', description: 'Prospective customer researches products; comparison sites, advisor referral' },
    { stage: 2, label: 'Application & Eligibility', description: 'Application submitted; credit check, ID verification, affordability assessment' },
    { stage: 3, label: 'Onboarding & Account Opening', description: 'Account activated; welcome comms, app set-up' },
    { stage: 4, label: 'Early Engagement (0-90 Days)', description: 'First transactions, feature discovery, first service contact' },
    { stage: 5, label: 'In-Life Product Management', description: 'Ongoing account/policy/loan management; renewals' },
    { stage: 6, label: 'Advice & Needs Review', description: 'Financial health check, product suitability, cross-sell opportunity' },
    { stage: 7, label: 'Claim Complaint or Hardship', description: 'Claim submitted; vulnerability triggers, hardship support' },
    { stage: 8, label: 'Arrears & Collections', description: 'Missed payment; early intervention, forbearance, debt management' },
    { stage: 9, label: 'Product Change Switch or Renewal', description: 'Interest rate change, renewal, product switch' },
    { stage: 10, label: 'Relationship Deepening', description: 'Life event triggers (mortgage, pension, investment), advisory relationship' },
    { stage: 11, label: 'Account Closure & Off-boarding', description: 'Customer leaves; cancellation, fund transfer, final settlement' },
    { stage: 12, label: 'Regulatory Event', description: 'Consumer Duty review, DSAR, complaint escalation to FOS' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses; Consumer Duty outcomes framework is the maturity benchmark',
    },
    operational_deep_dive: {
      notes: 'Emphasise Operations & Servicing, Technology & Data, Risk Management & Control, People & Talent',
    },
    ai_enablement: {
      notes: 'Emphasise Technology & Data, Operations & Servicing, Risk Management & Control',
    },
    transformation_sprint: {
      notes: 'Emphasise Operations & Servicing, Technology & Data, Customer Trust & Experience',
    },
    cultural_alignment: {
      notes: 'Emphasise People & Talent, Customer Trust & Experience, Regulatory & Compliance',
    },
    go_to_market: {
      notes: 'Emphasise Product & Commercial, Customer Trust & Experience, Digital & Innovation',
    },
  },
  actorTaxonomy: [
    { key: 'retail_customer', label: 'Retail Customer', description: 'Individual banking or insurance customer' },
    { key: 'vulnerable_customer', label: 'Vulnerable Customer', description: 'Customer requiring additional support' },
    { key: 'sme_business_customer', label: 'SME Business Customer', description: 'Small and medium business client' },
    { key: 'hnw_private_banking_client', label: 'High Net Worth/Private Banking Client', description: 'High value private client' },
    { key: 'financial_adviser', label: 'Financial Adviser/Planner', description: 'Independent or tied financial adviser' },
    { key: 'relationship_manager', label: 'Relationship Manager (Commercial)', description: 'Commercial banking relationship manager' },
    { key: 'customer_service_adviser', label: 'Customer Service Adviser', description: 'Front-line service' },
    { key: 'collections_recoveries_adviser', label: 'Collections & Recoveries Adviser', description: 'Debt and arrears management' },
    { key: 'complaints_handler', label: 'Complaints Handler', description: 'Formal complaint resolution' },
    { key: 'compliance_officer', label: 'Compliance Officer', description: 'Regulatory compliance' },
    { key: 'risk_manager', label: 'Risk Manager (Credit/Operational)', description: 'Risk identification and management' },
    { key: 'fraud_analyst', label: 'Fraud Analyst', description: 'Fraud detection and prevention' },
    { key: 'product_manager', label: 'Product Manager', description: 'Financial product management' },
    { key: 'data_scientist', label: 'Data Scientist/Modeller', description: 'Data science and credit modelling' },
    { key: 'it_core_platform_engineer', label: 'IT/Core Platform Engineer', description: 'Core banking platform engineering' },
    { key: 'operations_manager', label: 'Operations Manager (Back Office)', description: 'Back office operations' },
    { key: 'chief_risk_officer', label: 'Chief Risk Officer', description: 'Executive risk leadership' },
    { key: 'fca_pra', label: 'FCA/PRA', description: 'Financial Conduct Authority/Prudential Regulation Authority' },
    { key: 'financial_ombudsman', label: 'Financial Ombudsman Service (FOS)', description: 'External dispute resolution' },
    { key: 'open_banking_tpp', label: 'Open Banking/Third-Party Provider (TPP)', description: 'Open banking third-party' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Healthcare
// ---------------------------------------------------------------------------

const HEALTHCARE: DomainPack = {
  key: 'healthcare',
  label: 'Healthcare',
  description: 'NHS trusts and healthcare providers — patient safety, clinical operations, workforce, digital health, and transformation.',
  category: 'operational',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Awareness & Prevention', description: 'Health promotion, screening, community outreach, early diagnosis' },
    { stage: 2, label: 'Referral & Access', description: 'GP referral, self-referral, urgent care triage, e-referral' },
    { stage: 3, label: 'Waiting & Preparation', description: 'Referral-to-treatment waiting, pre-admission assessment' },
    { stage: 4, label: 'Admission & Registration', description: 'Scheduled/emergency admission, consent, initial assessment' },
    { stage: 5, label: 'Diagnosis & Investigation', description: 'Diagnostics (imaging, pathology), results communication, MDT review' },
    { stage: 6, label: 'Treatment & Intervention', description: 'Surgical procedure, medical management, clinical decision-making' },
    { stage: 7, label: 'In-Patient Stay & Care', description: 'Ward environment, nursing care, medication management' },
    { stage: 8, label: 'Discharge Planning & Coordination', description: 'Multidisciplinary discharge, social care arrangement' },
    { stage: 9, label: 'Post-Discharge Follow-Up', description: 'Outpatient review, rehabilitation, remote monitoring' },
    { stage: 10, label: 'Long-Term Condition Management', description: 'Chronic disease, repeat prescribing, care plan review' },
    { stage: 11, label: 'End of Life/Palliative Care', description: 'Advance care planning, symptom management, family support' },
    { stage: 12, label: 'Patient Feedback & Complaint Resolution', description: 'FFT, formal complaint, serious incident investigation' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses; CQC ratings language is the maturity benchmark',
    },
    operational_deep_dive: {
      notes: 'Emphasise Clinical Operations, Workforce & Clinical Capability, Digital Health & Technology, Integration & System Partnership',
    },
    ai_enablement: {
      notes: 'Emphasise Digital Health & Technology, Clinical Operations, Workforce & Clinical Capability',
    },
    transformation_sprint: {
      notes: 'Emphasise Clinical Operations, Transformation & Improvement, Workforce & Clinical Capability',
    },
    cultural_alignment: {
      notes: 'Emphasise Workforce & Clinical Capability, Patient Experience & Safety, Governance Risk & Regulation',
    },
    go_to_market: {
      notes: 'Emphasise Patient Experience & Safety, Digital Health & Technology, Finance & Resource Allocation',
    },
  },
  actorTaxonomy: [
    { key: 'patient', label: 'Patient', description: 'Primary healthcare recipient' },
    { key: 'carer_family', label: 'Carer/Family Member', description: 'Patient support network' },
    { key: 'gp_primary_care', label: 'GP/Primary Care Physician', description: 'Primary care clinician' },
    { key: 'consultant_specialist', label: 'Consultant/Specialist Physician', description: 'Secondary care specialist' },
    { key: 'junior_doctor', label: 'Junior Doctor/Registrar', description: 'Junior medical staff' },
    { key: 'nurse', label: 'Nurse (Ward/Community/Specialist)', description: 'Nursing staff' },
    { key: 'allied_health_professional', label: 'Allied Health Professional', description: 'Physio, OT, SALT, dietitian etc.' },
    { key: 'theatre_nurse', label: 'Theatre Nurse/Scrub Practitioner', description: 'Surgical team' },
    { key: 'theatre_manager', label: 'Theatre Manager/Anaesthetic Coordinator', description: 'Theatre operations' },
    { key: 'bed_manager', label: 'Bed Manager/Site Manager', description: 'Bed management and patient flow' },
    { key: 'discharge_coordinator', label: 'Discharge Coordinator', description: 'Discharge planning and social care liaison' },
    { key: 'clinical_pharmacist', label: 'Clinical Pharmacist', description: 'Medicines management' },
    { key: 'radiologist_pathologist', label: 'Radiologist/Pathologist', description: 'Diagnostic specialties' },
    { key: 'medical_records', label: 'Medical Records/HIM Team', description: 'Health information management' },
    { key: 'it_digital_health_manager', label: 'IT/Digital Health Manager', description: 'Digital health systems' },
    { key: 'qi_lead', label: 'Quality Improvement Lead', description: 'Quality improvement and safety' },
    { key: 'finance_business_partner', label: 'Finance Business Partner', description: 'Healthcare finance' },
    { key: 'cqc_inspector', label: 'CQC Inspector/Accreditation Body', description: 'External quality regulator' },
    { key: 'commissioner_icb', label: 'Commissioner/ICB', description: 'Integrated care board commissioner' },
    { key: 'social_care_lead', label: 'Social Care Lead', description: 'Social care integration' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Retail
// ---------------------------------------------------------------------------

const RETAIL: DomainPack = {
  key: 'retail',
  label: 'Retail',
  description: 'Retailers — customer experience, buying, supply chain, store operations, digital channels, and frontline capability.',
  category: 'operational',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Inspiration & Discovery', description: 'Customer identifies need; social, search, email, in-store browsing' },
    { stage: 2, label: 'Research & Comparison', description: 'Compares options; reviews, price comparison, retailer website' },
    { stage: 3, label: 'Purchase Decision', description: 'Online basket or in-store selection; checkout friction, abandoned basket' },
    { stage: 4, label: 'Payment & Transaction', description: 'Checkout; loyalty redemption, discount, payment method' },
    { stage: 5, label: 'Fulfilment & Delivery', description: 'Despatch, last-mile delivery, tracking communications' },
    { stage: 6, label: 'First Use & Post-Purchase', description: 'Unboxing, product set-up, satisfaction vs expectation' },
    { stage: 7, label: 'In-Store Experience', description: 'Browsing, colleague interaction, queue management, checkout' },
    { stage: 8, label: 'Returns & Exchanges', description: 'Return initiated; policy clarity, process friction, refund speed' },
    { stage: 9, label: 'Customer Service & Complaint', description: 'Contact for order issue, product fault, pricing query' },
    { stage: 10, label: 'Loyalty & Re-engagement', description: 'Loyalty scheme, personalised offer, re-purchase trigger' },
    { stage: 11, label: 'Seasonal & Promotional Peaks', description: 'Black Friday, Christmas, sale events' },
    { stage: 12, label: 'Product Lifecycle & Range Change', description: 'Old range exit, new range launch, availability gaps' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses; benchmark against market leader in that category',
    },
    operational_deep_dive: {
      notes: 'Emphasise Store Operations, Supply Chain & Fulfilment, People & Frontline Capability, Technology & Data',
    },
    ai_enablement: {
      notes: 'Emphasise Technology & Data, Digital & Omnichannel, Supply Chain & Fulfilment, Commercial & Buying',
    },
    transformation_sprint: {
      notes: 'Emphasise Store Operations, Digital & Omnichannel, People & Frontline Capability',
    },
    cultural_alignment: {
      notes: 'Emphasise People & Frontline Capability, Customer Experience & Loyalty, Store Operations',
    },
    go_to_market: {
      notes: 'Emphasise Commercial & Buying, Customer Experience & Loyalty, Digital & Omnichannel',
    },
  },
  actorTaxonomy: [
    { key: 'mainstream_shopper', label: 'Mainstream Shopper', description: 'Core retail customer' },
    { key: 'loyal_high_value_customer', label: 'Loyal/High-Value Customer', description: 'High-spend loyal customer' },
    { key: 'online_only_customer', label: 'Online-Only Customer', description: 'Digital-first shopper' },
    { key: 'store_first_customer', label: 'Store-First Customer', description: 'In-store preference customer' },
    { key: 'store_manager', label: 'Store Manager', description: 'Store leadership' },
    { key: 'department_manager', label: 'Department Manager/Floor Manager', description: 'Department-level management' },
    { key: 'sales_colleague', label: 'Sales Colleague/Customer Adviser', description: 'Front-line retail colleague' },
    { key: 'visual_merchandising_manager', label: 'Visual Merchandising Manager', description: 'Store presentation and display' },
    { key: 'loss_prevention', label: 'Loss Prevention/Asset Protection', description: 'Security and shrinkage management' },
    { key: 'warehouse_stock_colleague', label: 'Warehouse/Stock Room Colleague', description: 'Back-of-house stock management' },
    { key: 'buying_manager', label: 'Buying Manager', description: 'Product range buying' },
    { key: 'merchandising_analyst', label: 'Merchandising Analyst', description: 'Range and space planning' },
    { key: 'supply_chain_manager', label: 'Supply Chain Manager', description: 'Supply chain and logistics' },
    { key: 'ecommerce_manager', label: 'E-Commerce Manager', description: 'Online channel management' },
    { key: 'crm_loyalty_manager', label: 'CRM & Loyalty Manager', description: 'Customer relationship and loyalty' },
    { key: 'workforce_planner', label: 'Workforce Planner', description: 'Store staffing and scheduling' },
    { key: 'finance_business_partner', label: 'Finance Business Partner', description: 'Retail finance' },
    { key: 'it_oms_pos_owner', label: 'IT/OMS/POS Systems Owner', description: 'Order management and point of sale systems' },
    { key: 'sustainability_esg_lead', label: 'Sustainability/ESG Lead', description: 'Sustainability and responsible retail' },
    { key: 'trading_standards_regulator', label: 'Trading Standards/Regulator', description: 'Consumer protection regulator' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Technology
// ---------------------------------------------------------------------------

const TECHNOLOGY: DomainPack = {
  key: 'technology',
  label: 'Technology',
  description: 'Technology companies and SaaS businesses — product, engineering, go-to-market, AI readiness, and talent culture.',
  category: 'strategic',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Awareness & Discovery', description: 'Prospect becomes aware via channel, community, or referral' },
    { stage: 2, label: 'Evaluation & Trial', description: 'Prospect tests product, demos, self-serves' },
    { stage: 3, label: 'Commercial Negotiation', description: 'Pricing agreed, procurement engaged, legal review' },
    { stage: 4, label: 'Onboarding & Activation', description: 'Customer activated, implementation scoped, first value moment' },
    { stage: 5, label: 'Adoption & Expansion', description: 'Usage deepens, seats/modules added, success metrics tracked' },
    { stage: 6, label: 'Integration & Ecosystem', description: 'Product integrated with customer tech stack, API/partner ecosystem' },
    { stage: 7, label: 'Renewal & Retention', description: 'Renewal cycle triggered, health score reviewed, churn risk managed' },
    { stage: 8, label: 'Advocacy & Reference', description: 'Customer becomes case study or community advocate' },
    { stage: 9, label: 'Sunset & Offboarding', description: 'End of life for features, migration path managed' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 7 lenses',
    },
    operational_deep_dive: {
      notes: 'Emphasise Product & Engineering, Talent & Engineering Culture, Data & AI Readiness',
    },
    ai_enablement: {
      notes: 'Emphasise Data & AI Readiness, Product & Engineering, Customer & Market, Governance & Security',
    },
    transformation_sprint: {
      notes: 'All 7 lenses',
    },
    cultural_alignment: {
      notes: 'Emphasise Talent & Engineering Culture, Product & Engineering, Governance & Security',
    },
    go_to_market: {
      notes: 'Emphasise Go-to-Market, Customer & Market, Commercial & Pricing, Product & Engineering',
    },
  },
  actorTaxonomy: [
    { key: 'cto_vp_engineering', label: 'CTO/VP Engineering', description: 'Technology leadership' },
    { key: 'cpo_product_manager', label: 'CPO/Product Manager', description: 'Product strategy and management' },
    { key: 'software_engineer', label: 'Software Engineer (IC)', description: 'Individual contributor engineer' },
    { key: 'engineering_manager', label: 'Engineering Manager', description: 'Engineering team management' },
    { key: 'devops_platform_engineer', label: 'DevOps/Platform Engineer', description: 'Infrastructure and platform' },
    { key: 'data_engineer_ml', label: 'Data Engineer/ML Engineer', description: 'Data and machine learning' },
    { key: 'cro_vp_sales', label: 'CRO/VP Sales', description: 'Revenue and sales leadership' },
    { key: 'account_executive', label: 'Account Executive', description: 'Sales and new business' },
    { key: 'customer_success_manager', label: 'Customer Success Manager', description: 'Customer success and retention' },
    { key: 'solutions_engineer', label: 'Solutions Engineer/Pre-Sales', description: 'Technical pre-sales' },
    { key: 'marketing_demand_gen', label: 'Marketing/Demand Generation', description: 'Marketing and demand generation' },
    { key: 'ciso', label: 'Chief Information Security Officer', description: 'Security leadership' },
    { key: 'finance_cfo', label: 'Finance/CFO', description: 'Financial leadership' },
    { key: 'enterprise_customer_technical', label: 'Enterprise Customer (technical buyer)', description: 'Technical buyer in enterprise' },
    { key: 'enterprise_customer_business', label: 'Enterprise Customer (business buyer)', description: 'Business buyer in enterprise' },
    { key: 'partner_isv', label: 'Partner/ISV', description: 'Technology partner or independent software vendor' },
    { key: 'regulator_auditor', label: 'Regulator/Auditor', description: 'Compliance and audit' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Professional Services
// ---------------------------------------------------------------------------

const PROFESSIONAL_SERVICES: DomainPack = {
  key: 'professional_services',
  label: 'Professional Services',
  description: 'Consulting, legal, and advisory firms — delivery excellence, client growth, talent, IP, and commercial models.',
  category: 'strategic',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Market Positioning & Brand Awareness', description: 'Firm visible and credible in target sector' },
    { stage: 2, label: 'Lead Generation & Referral Capture', description: 'Prospect enters pipeline' },
    { stage: 3, label: 'Scoping & Proposal', description: 'RFP received, scope defined, proposal submitted' },
    { stage: 4, label: 'Negotiation & Contract', description: 'Terms agreed, engagement letter signed' },
    { stage: 5, label: 'Mobilisation & Kick-off', description: 'Team onboarded, stakeholders aligned, workplan baselined' },
    { stage: 6, label: 'Discovery & Analysis', description: 'Data gathered, interviews conducted, insight generated' },
    { stage: 7, label: 'Solution Design & Synthesis', description: 'Recommendations developed, narrative constructed' },
    { stage: 8, label: 'Delivery & Implementation Support', description: 'Recommendations delivered, capability built' },
    { stage: 9, label: 'Review & Close-out', description: 'Outcomes assessed, lessons captured' },
    { stage: 10, label: 'Account Development & Expansion', description: 'Next engagement scoped, relationship deepened' },
    { stage: 11, label: 'Alumni & Long-term Relationship', description: 'Former clients and staff maintained as assets' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses',
    },
    operational_deep_dive: {
      notes: 'Emphasise Delivery & Project Execution, Operational Infrastructure, Knowledge & IP Management',
    },
    ai_enablement: {
      notes: 'Emphasise Knowledge & IP Management, Delivery & Project Execution, Operational Infrastructure, Risk & Professional Standards',
    },
    transformation_sprint: {
      notes: 'All 8 lenses',
    },
    cultural_alignment: {
      notes: 'Emphasise People & Talent Pipeline, Delivery & Project Execution, Brand & Market Positioning',
    },
    go_to_market: {
      notes: 'Emphasise Brand & Market Positioning, Client Relationship & Growth, Commercial Model & Pricing',
    },
  },
  actorTaxonomy: [
    { key: 'managing_partner_ceo', label: 'Managing Partner/CEO', description: 'Firm leadership' },
    { key: 'partner_director', label: 'Partner/Director (client-facing)', description: 'Senior client-facing leader' },
    { key: 'senior_manager', label: 'Senior Manager/Associate Director', description: 'Senior project delivery' },
    { key: 'manager', label: 'Manager', description: 'Project management' },
    { key: 'consultant', label: 'Consultant/Senior Consultant', description: 'Core delivery team' },
    { key: 'analyst_associate', label: 'Analyst/Associate', description: 'Junior delivery team' },
    { key: 'bd_director', label: 'Business Development Director', description: 'Business development and growth' },
    { key: 'finance_director', label: 'Finance Director/CFO', description: 'Financial management' },
    { key: 'hr_talent_director', label: 'HR/Talent Director', description: 'People strategy' },
    { key: 'it_systems_manager', label: 'IT/Systems Manager', description: 'Technology and systems' },
    { key: 'risk_compliance_officer', label: 'Risk & Compliance Officer', description: 'Risk management and compliance' },
    { key: 'client_sponsor', label: 'Client Sponsor (C-suite)', description: 'Executive client sponsor' },
    { key: 'client_project_lead', label: 'Client Project Lead', description: 'Client-side project owner' },
    { key: 'client_end_user', label: 'Client End User', description: 'Delivery recipient within client organisation' },
    { key: 'subcontractor_associate', label: 'Sub-contractor/Associate', description: 'Associate and contractor resource' },
    { key: 'regulator', label: 'Regulator (SRA/ICAEW/FCA/Engineering Council)', description: 'Professional body and regulator' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Manufacturing
// ---------------------------------------------------------------------------

const MANUFACTURING: DomainPack = {
  key: 'manufacturing',
  label: 'Manufacturing',
  description: 'Manufacturers — production, supply chain, quality, engineering, workforce, sustainability, and automation.',
  category: 'operational',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Market Demand Sensing', description: 'Demand signals, forecast, capacity planning' },
    { stage: 2, label: 'New Product Introduction (NPI)', description: 'Design validated, tooling specified, production proven' },
    { stage: 3, label: 'Supplier Selection & Qualification', description: 'Suppliers assessed, contracted, onboarded' },
    { stage: 4, label: 'Raw Material Procurement & Inbound Logistics', description: 'POs raised, goods received' },
    { stage: 5, label: 'Production Planning & Scheduling', description: 'Capacity allocated, shift plans, materials staged' },
    { stage: 6, label: 'Manufacturing Execution', description: 'Parts produced, quality inspected, exceptions managed' },
    { stage: 7, label: 'Final Assembly & Test', description: 'Assembly completed, functional tests, first-article inspection' },
    { stage: 8, label: 'Outbound Logistics & Fulfilment', description: 'Finished goods warehoused, orders picked, shipped' },
    { stage: 9, label: 'After-Sales & Field Service', description: 'Warranty claims, spare parts, field repair' },
    { stage: 10, label: 'End-of-Life & Circular Economy', description: 'Product recycled, materials recovered' },
    { stage: 11, label: 'Continuous Improvement Cycle', description: 'OEE trend, Kaizen events, process performance' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses; OEE and defect rate are core triple-rating anchors',
    },
    operational_deep_dive: {
      notes: 'Emphasise Production & Operations, Supply Chain & Procurement, Quality & Continuous Improvement, Workforce & Skills',
    },
    ai_enablement: {
      notes: 'Emphasise Technology & Automation, Production & Operations, Quality & Continuous Improvement, Supply Chain & Procurement',
    },
    transformation_sprint: {
      notes: 'All 8 lenses',
    },
    cultural_alignment: {
      notes: 'Emphasise Workforce & Skills, Quality & Continuous Improvement, Production & Operations',
    },
    go_to_market: {
      notes: 'Emphasise Commercial & Customer Fulfilment, Engineering & Product Development, Supply Chain & Procurement',
    },
  },
  actorTaxonomy: [
    { key: 'ceo_md', label: 'CEO/MD', description: 'Business leadership' },
    { key: 'operations_director', label: 'Operations Director/VP Manufacturing', description: 'Manufacturing operations leadership' },
    { key: 'plant_manager', label: 'Plant Manager', description: 'Site-level management' },
    { key: 'production_supervisor', label: 'Production Supervisor/Shift Manager', description: 'Production supervision' },
    { key: 'operator_technician', label: 'Operator/Technician (skilled)', description: 'Shop floor operator' },
    { key: 'maintenance_engineer', label: 'Maintenance Engineer', description: 'Plant maintenance' },
    { key: 'quality_manager', label: 'Quality Manager/Quality Engineer', description: 'Quality management' },
    { key: 'supply_chain_manager', label: 'Supply Chain Manager', description: 'Supply chain management' },
    { key: 'procurement_manager', label: 'Procurement Manager', description: 'Procurement and sourcing' },
    { key: 'engineering_npi_manager', label: 'Engineering/NPI Manager', description: 'Engineering and new product introduction' },
    { key: 'ehs_manager', label: 'EHS Manager', description: 'Environment, health, and safety' },
    { key: 'it_ot_manager', label: 'IT/OT Manager', description: 'IT and operational technology' },
    { key: 'finance_director', label: 'Finance Director', description: 'Financial management' },
    { key: 'commercial_sales_director', label: 'Commercial/Sales Director', description: 'Commercial and sales' },
    { key: 'customer_oem', label: 'Customer (OEM/tier customer)', description: 'Downstream customer' },
    { key: 'regulatory_inspector', label: 'Regulatory Inspector', description: 'Regulatory body' },
    { key: 'logistics_provider', label: 'Logistics Provider', description: 'Third-party logistics' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Transport & Logistics
// ---------------------------------------------------------------------------

const TRANSPORT_LOGISTICS: DomainPack = {
  key: 'transport_logistics',
  label: 'Transport & Logistics',
  description: 'Logistics operators — network operations, last-mile delivery, fleet, compliance, and sustainability.',
  category: 'operational',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Shipper Demand & Capacity Planning', description: 'Shipment demand forecast, capacity allocated' },
    { stage: 2, label: 'Order Creation & Booking', description: 'Shipment booked, documentation, carrier assigned' },
    { stage: 3, label: 'Collection & First-Mile', description: 'Goods collected, loaded, manifest confirmed' },
    { stage: 4, label: 'Linehaul/Hub Transit', description: 'Cross-dock, hub sort, long-haul transit' },
    { stage: 5, label: 'Customs & Regulatory Clearance', description: 'Import/export docs, duty management' },
    { stage: 6, label: 'Warehouse Receipt & Sortation', description: 'Goods received at DC, scanned, sorted' },
    { stage: 7, label: 'Pick Pack & Despatch', description: 'Order fulfilling, packaging, labelling' },
    { stage: 8, label: 'Final-Mile Delivery', description: 'Last-mile route, delivery attempt, customer notification' },
    { stage: 9, label: 'Returns & Reverse Logistics', description: 'Return collection, assessment, re-stock or disposal' },
    { stage: 10, label: 'Exception Management & Claims', description: 'Damaged/lost goods, delay resolution' },
    { stage: 11, label: 'Billing Invoice & Proof of Delivery', description: 'Invoice generation, POD, dispute resolution' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses; on-time delivery rate and cost-per-delivery are core anchors',
    },
    operational_deep_dive: {
      notes: 'Emphasise Network & Operations, Warehouse & Last-Mile Execution, Workforce & Driver/Operator Management, Technology & Digitalisation',
    },
    ai_enablement: {
      notes: 'Emphasise Technology & Digitalisation, Network & Operations, Commercial & Pricing, Risk & Compliance',
    },
    transformation_sprint: {
      notes: 'All 8 lenses',
    },
    cultural_alignment: {
      notes: 'Emphasise Workforce & Driver/Operator Management, Network & Operations, Risk & Compliance',
    },
    go_to_market: {
      notes: 'Emphasise Commercial & Pricing, Customer & Shipper Experience, Network & Operations, Technology & Digitalisation',
    },
  },
  actorTaxonomy: [
    { key: 'ceo_md', label: 'CEO/MD', description: 'Business leadership' },
    { key: 'operations_director', label: 'Operations Director', description: 'Operations leadership' },
    { key: 'regional_ops_manager', label: 'Regional Operations Manager', description: 'Regional operations management' },
    { key: 'depot_warehouse_manager', label: 'Depot/Warehouse Manager', description: 'Site management' },
    { key: 'shift_supervisor', label: 'Shift Supervisor', description: 'Shift management' },
    { key: 'driver_courier', label: 'Driver/Courier', description: 'Last-mile delivery operative' },
    { key: 'warehouse_operative', label: 'Warehouse Operative/Picker', description: 'Warehouse operations' },
    { key: 'transport_planner', label: 'Transport Planner/Scheduler', description: 'Route and capacity planning' },
    { key: 'fleet_manager', label: 'Fleet Manager', description: 'Fleet management and compliance' },
    { key: 'customs_trade_compliance', label: 'Customs & Trade Compliance Manager', description: 'Customs and trade compliance' },
    { key: 'commercial_sales_director', label: 'Commercial/Sales Director', description: 'Commercial and customer relationships' },
    { key: 'customer_service_team', label: 'Customer Service Team', description: 'Customer service and exception handling' },
    { key: 'it_director', label: 'IT Director/Head of Technology', description: 'Technology leadership' },
    { key: 'finance_director', label: 'Finance Director', description: 'Financial management' },
    { key: 'ehs_manager', label: 'EHS Manager', description: 'Environment, health, and safety' },
    { key: 'shipper_enterprise', label: 'Shipper/Customer (enterprise)', description: 'Large enterprise shipper' },
    { key: 'shipper_sme', label: 'Shipper/Customer (SME)', description: 'SME shipper' },
    { key: 'regulatory_authority', label: 'Regulatory Authority', description: 'Transport regulator' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Automotive & Mobility
// ---------------------------------------------------------------------------

const AUTOMOTIVE_MOBILITY: DomainPack = {
  key: 'automotive_mobility',
  label: 'Automotive & Mobility',
  description: 'Automotive OEMs and mobility companies — EV transition, software-defined vehicles, manufacturing, and customer experience.',
  category: 'strategic',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Vehicle Concept & Strategy', description: 'Market gap identified, platform selected, business case approved' },
    { stage: 2, label: 'Product Development & Engineering', description: 'Engineering programme launched, suppliers nominated' },
    { stage: 3, label: 'Homologation & Regulatory Validation', description: 'Type approval, safety testing, emissions compliance' },
    { stage: 4, label: 'Manufacturing Readiness & Launch', description: 'Plant retooled, production system validated, SOP set' },
    { stage: 5, label: 'Market Launch & Channel Activation', description: 'Dealer/direct channel activated, pricing published' },
    { stage: 6, label: 'Purchase & Retail Experience', description: 'Customer configures, finances, orders, takes delivery' },
    { stage: 7, label: 'Ownership & Connected Services', description: 'Vehicle in service, OTA updates, warranty managed' },
    { stage: 8, label: 'Aftersales & Service Network', description: 'Scheduled maintenance, fault diagnosis, recall management' },
    { stage: 9, label: 'Fleet & Corporate Sales Cycle', description: 'Fleet RFP, leasing company relationships, TCO proposition' },
    { stage: 10, label: 'Remarketing & End-of-First-Life', description: 'Used vehicle valuation, remarketing, CPO programme' },
    { stage: 11, label: 'End-of-Life & Battery Recovery', description: 'Vehicle disposal, battery second-life or recycling' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses; EV transition readiness and SDV maturity are defining anchors',
    },
    operational_deep_dive: {
      notes: 'Emphasise Manufacturing & Production System, Supply Chain & Electrification Readiness, Vehicle Engineering & Platforms',
    },
    ai_enablement: {
      notes: 'Emphasise Connected Mobility & Software, Manufacturing & Production System, Customer & Ownership Experience',
    },
    transformation_sprint: {
      notes: 'All 8 lenses',
    },
    cultural_alignment: {
      notes: 'Emphasise Talent & Capability Transformation, Vehicle Engineering & Platforms, Manufacturing & Production System',
    },
    go_to_market: {
      notes: 'Emphasise Commercial & Revenue Model, Customer & Ownership Experience, Connected Mobility & Software',
    },
  },
  actorTaxonomy: [
    { key: 'ceo_board', label: 'CEO/Board', description: 'Business leadership and governance' },
    { key: 'chief_engineer', label: 'Chief Engineer/VP Engineering', description: 'Vehicle engineering leadership' },
    { key: 'vehicle_programme_director', label: 'Vehicle Programme Director', description: 'Programme delivery leadership' },
    { key: 'software_engineering_director', label: 'Software Engineering Director', description: 'Software and SDV leadership' },
    { key: 'manufacturing_director', label: 'Manufacturing Director/VP Operations', description: 'Manufacturing operations' },
    { key: 'supply_chain_director', label: 'Supply Chain Director', description: 'Supply chain strategy' },
    { key: 'chief_commercial_officer', label: 'Chief Commercial Officer/VP Sales', description: 'Commercial and sales leadership' },
    { key: 'head_digital_cx', label: 'Head of Digital/Customer Experience', description: 'Digital and customer experience' },
    { key: 'aftersales_director', label: 'Aftersales Director', description: 'Aftersales and service network' },
    { key: 'regulatory_homologation_director', label: 'Regulatory/Homologation Director', description: 'Type approval and compliance' },
    { key: 'dealer_franchise_partner', label: 'Dealer/Franchise Partner', description: 'Retail franchise' },
    { key: 'fleet_sales_manager', label: 'Fleet Sales Manager', description: 'Fleet and B2B sales' },
    { key: 'leasing_company_remarketer', label: 'Leasing Company/Remarketer', description: 'Leasing and used vehicle' },
    { key: 'end_customer_private', label: 'End Customer (private buyer)', description: 'Private vehicle purchaser' },
    { key: 'end_customer_fleet_driver', label: 'End Customer (fleet driver)', description: 'Fleet vehicle driver' },
    { key: 'battery_cell_supplier', label: 'Battery/Cell Supplier', description: 'EV battery supply chain' },
    { key: 'charging_infrastructure_provider', label: 'Charging Infrastructure Provider', description: 'EV charging network' },
    { key: 'regulator', label: 'Regulator (DVSA/SMMT/EU type approval)', description: 'Vehicle type approval regulator' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Public Sector
// ---------------------------------------------------------------------------

const PUBLIC_SECTOR: DomainPack = {
  key: 'public_sector',
  label: 'Public Sector',
  description: 'Government departments and public bodies — citizen experience, policy, digital, workforce, and value for money.',
  category: 'operational',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Policy Formation & Mandate', description: 'Government directive or legislation triggers service' },
    { stage: 2, label: 'Service Design & Commissioning', description: 'Scope, partners, funding allocation' },
    { stage: 3, label: 'Public Awareness & Eligibility', description: 'Communicating availability, eligibility, outreach' },
    { stage: 4, label: 'Application & Onboarding', description: 'Citizen submits application, verification, initial assessment' },
    { stage: 5, label: 'Case Management & Service Delivery', description: 'Ongoing management of citizen cases' },
    { stage: 6, label: 'Multi-Agency Coordination', description: 'Handoffs between departments and third parties' },
    { stage: 7, label: 'Escalation & Complaints', description: 'Formal complaints, ombudsman referrals, appeals' },
    { stage: 8, label: 'Outcome Measurement & Reporting', description: 'KPIs, ministerial reporting, public accountability' },
    { stage: 9, label: 'Policy Review & Iteration', description: 'Evidence-based policy adjustment, consultation cycles' },
    { stage: 10, label: 'Decommission & Transition', description: 'End-of-life service management, citizen migration' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses',
    },
    operational_deep_dive: {
      notes: 'Emphasise Citizen Experience & Access, Workforce & Capability, Digital & Data',
    },
    ai_enablement: {
      notes: 'Emphasise Digital & Data, Policy & Governance',
    },
    transformation_sprint: {
      notes: 'Emphasise Citizen Experience & Access, Digital & Data, Workforce & Capability',
    },
    cultural_alignment: {
      notes: 'Emphasise Workforce & Capability, Equity Diversity & Inclusion, Risk & Resilience',
    },
    go_to_market: {
      notes: 'Emphasise Partnerships & Commissioning, Finance & Value for Money',
    },
  },
  actorTaxonomy: [
    { key: 'citizen_service_user', label: 'Citizen/Service User', description: 'Primary public service recipient' },
    { key: 'vulnerable_supported_citizen', label: 'Vulnerable/Supported Citizen', description: 'Citizen requiring additional support' },
    { key: 'frontline_case_worker', label: 'Frontline Case Worker', description: 'Direct service delivery' },
    { key: 'contact_centre_agent', label: 'Contact Centre Agent', description: 'Phone and digital support' },
    { key: 'team_leader_supervisor', label: 'Team Leader/Supervisor', description: 'Front-line management' },
    { key: 'service_manager', label: 'Service Manager', description: 'Service management' },
    { key: 'policy_officer', label: 'Policy Officer', description: 'Policy development and analysis' },
    { key: 'digital_technology_officer', label: 'Digital/Technology Officer', description: 'Digital and technology delivery' },
    { key: 'data_analytics_officer', label: 'Data & Analytics Officer', description: 'Data and performance analysis' },
    { key: 'finance_commercial_officer', label: 'Finance & Commercial Officer', description: 'Financial management' },
    { key: 'commissioning_manager', label: 'Commissioning Manager', description: 'Service commissioning and procurement' },
    { key: 'legal_compliance_officer', label: 'Legal & Compliance Officer', description: 'Legal and regulatory compliance' },
    { key: 'comms_engagement_officer', label: 'Communications & Engagement Officer', description: 'Public communications' },
    { key: 'hr_people_officer', label: 'HR & People Officer', description: 'People management' },
    { key: 'minister_sro', label: 'Minister/Senior Responsible Owner', description: 'Political and executive accountability' },
    { key: 'audit_assurance', label: 'Audit & Assurance', description: 'Internal and external audit' },
    { key: 'third_sector_partner', label: 'Third Sector Partner', description: 'Charity and voluntary sector partner' },
    { key: 'local_authority_liaison', label: 'Local Authority Liaison', description: 'Local government liaison' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

const EDUCATION: DomainPack = {
  key: 'education',
  label: 'Education',
  description: 'Schools, colleges, and universities — learner outcomes, curriculum, staff wellbeing, EdTech, and safeguarding.',
  category: 'operational',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Awareness & Attraction', description: 'Prospective learner becomes aware of institution or programme' },
    { stage: 2, label: 'Enquiry & Application', description: 'Application process, admissions, offers' },
    { stage: 3, label: 'Enrolment & Induction', description: 'Joining, onboarding, orientation, initial assessment' },
    { stage: 4, label: 'Learning & Progression', description: 'Day-to-day teaching, assessment, pastoral support' },
    { stage: 5, label: 'Intervention & Support', description: 'Identifying struggling learners, SEND support, counselling' },
    { stage: 6, label: 'Assessment & Examination', description: 'Formal assessment, moderation, marking' },
    { stage: 7, label: 'Results & Accreditation', description: 'Results publication, certification, appeals' },
    { stage: 8, label: 'Transition & Destination', description: 'Next steps support (HE, employment, further study)' },
    { stage: 9, label: 'Alumni & Lifelong Learning', description: 'Staying connected, CPD' },
    { stage: 10, label: 'Inspection & Accountability', description: 'Ofsted/OfS cycle, self-assessment, external review' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses',
    },
    operational_deep_dive: {
      notes: 'Emphasise Learner Experience & Outcomes, Workforce & Staff Wellbeing, Finance & Resource Allocation',
    },
    ai_enablement: {
      notes: 'Emphasise Technology & EdTech, Curriculum & Pedagogy',
    },
    transformation_sprint: {
      notes: 'Emphasise Learner Experience & Outcomes, Technology & EdTech, Workforce & Staff Wellbeing',
    },
    cultural_alignment: {
      notes: 'Emphasise Workforce & Staff Wellbeing, Community & Equity',
    },
    go_to_market: {
      notes: 'Emphasise Partnerships & Employer Relations, Finance & Resource Allocation',
    },
  },
  actorTaxonomy: [
    { key: 'learner_student', label: 'Learner/Student', description: 'Primary education recipient' },
    { key: 'parent_guardian', label: 'Parent/Guardian', description: 'Parent or guardian' },
    { key: 'teacher_lecturer', label: 'Teacher/Lecturer', description: 'Teaching staff' },
    { key: 'teaching_assistant', label: 'Teaching Assistant/Learning Support', description: 'Learning support staff' },
    { key: 'senco', label: 'SENCO/Inclusion Coordinator', description: 'Special educational needs coordinator' },
    { key: 'head_of_department', label: 'Head of Department/Faculty Lead', description: 'Academic leadership' },
    { key: 'pastoral_wellbeing_lead', label: 'Pastoral/Wellbeing Lead', description: 'Student welfare and support' },
    { key: 'principal_vice_chancellor', label: 'Principal/Vice Chancellor', description: 'Institutional leadership' },
    { key: 'admissions_team', label: 'Admissions Team', description: 'Student recruitment and admissions' },
    { key: 'estates_facilities_manager', label: 'Estates & Facilities Manager', description: 'Facilities management' },
    { key: 'it_edtech_manager', label: 'IT & EdTech Manager', description: 'Technology and digital learning' },
    { key: 'finance_director', label: 'Finance Director', description: 'Financial management' },
    { key: 'hr_people_manager', label: 'HR & People Manager', description: 'Workforce management' },
    { key: 'employer_industry_partner', label: 'Employer/Industry Partner', description: 'Work placement and industry link' },
    { key: 'ofsted_ofs_inspector', label: 'Ofsted/OfS Inspector', description: 'Education quality regulator' },
    { key: 'local_authority_mat', label: 'Local Authority/MAT Leadership', description: 'Multi-academy trust or local authority' },
    { key: 'governing_body_trustees', label: 'Governing Body/Board of Trustees', description: 'Governance and accountability' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Media & Entertainment
// ---------------------------------------------------------------------------

const MEDIA_ENTERTAINMENT: DomainPack = {
  key: 'media_entertainment',
  label: 'Media & Entertainment',
  description: 'Media companies, broadcasters, and streaming platforms — content, audience, technology, and commercial models.',
  category: 'strategic',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Content Ideation & Development', description: 'Idea generation, format development, commissioning' },
    { stage: 2, label: 'Production & Creation', description: 'Pre-production, filming/recording/writing, post-production' },
    { stage: 3, label: 'Rights Clearance & Legal', description: 'IP clearance, talent contracts, distribution rights' },
    { stage: 4, label: 'Marketing & Audience Build', description: 'Campaign, trailer, press, social — pre-release' },
    { stage: 5, label: 'Distribution & Launch', description: 'Platform release, broadcast scheduling, theatrical release' },
    { stage: 6, label: 'Live Engagement & Real-Time Interaction', description: 'Live events, sports, social listening' },
    { stage: 7, label: 'Audience Retention & Catalogue Exploitation', description: 'Back-catalogue surfacing, binge loops' },
    { stage: 8, label: 'Monetisation & Licensing', description: 'Ad sales, subscription conversion, B2B licensing' },
    { stage: 9, label: 'Audience Data & Insight Cycle', description: 'Measuring performance, informing next commissioning' },
    { stage: 10, label: 'Awards PR & Cultural Moments', description: 'Industry awards, critical reception' },
    { stage: 11, label: 'Archive & Rights Management', description: 'Long-term IP management, re-licensing' },
    { stage: 12, label: 'Platform & Technology Evolution', description: 'Adapting to new distribution channels' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses',
    },
    operational_deep_dive: {
      notes: 'Emphasise Technology & Distribution Platforms, Data & Audience Intelligence, Commercial & Revenue Models',
    },
    ai_enablement: {
      notes: 'Emphasise Data & Audience Intelligence, Technology & Distribution Platforms',
    },
    transformation_sprint: {
      notes: 'Emphasise Technology & Distribution Platforms, Commercial & Revenue Models, Audience Experience & Engagement',
    },
    cultural_alignment: {
      notes: 'Emphasise Talent & Creative Workforce, Brand & Cultural Relevance',
    },
    go_to_market: {
      notes: 'Emphasise Commercial & Revenue Models, Brand & Cultural Relevance, Audience Experience & Engagement',
    },
  },
  actorTaxonomy: [
    { key: 'audience_consumer', label: 'Audience/Consumer', description: 'End viewer or listener' },
    { key: 'subscriber_paid_member', label: 'Subscriber/Paid Member', description: 'Paying subscriber' },
    { key: 'content_creator_talent', label: 'Content Creator/Talent', description: 'On-screen or creative talent' },
    { key: 'producer_exec_producer', label: 'Producer/Executive Producer', description: 'Content production leadership' },
    { key: 'commissioning_editor', label: 'Commissioning Editor', description: 'Content commissioning' },
    { key: 'marketing_audience_dev', label: 'Marketing & Audience Development', description: 'Audience growth and marketing' },
    { key: 'distribution_partnerships', label: 'Distribution & Partnerships Manager', description: 'Distribution and platform relationships' },
    { key: 'technology_platform_engineer', label: 'Technology & Platform Engineer', description: 'Technology and streaming infrastructure' },
    { key: 'data_analytics_lead', label: 'Data & Analytics Lead', description: 'Audience data and insight' },
    { key: 'ad_sales_commercial', label: 'Ad Sales/Commercial Manager', description: 'Advertising and commercial revenue' },
    { key: 'rights_legal_manager', label: 'Rights & Legal Manager', description: 'IP and rights management' },
    { key: 'finance_business_affairs', label: 'Finance & Business Affairs', description: 'Financial and commercial management' },
    { key: 'editorial_journalism_lead', label: 'Editorial/Journalism Lead', description: 'Editorial leadership' },
    { key: 'social_community_manager', label: 'Social & Community Manager', description: 'Social media and community' },
    { key: 'live_events_experiential', label: 'Live Events & Experiential', description: 'Live event production and experience' },
    { key: 'regulator', label: 'Regulator (Ofcom/FCC)', description: 'Media regulator' },
    { key: 'talent_agent_management', label: 'Talent Agent/Management', description: 'Talent representation' },
    { key: 'streaming_platform', label: 'Streaming Platform (Netflix/Amazon/etc.)', description: 'Major streaming distribution platform' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Real Estate & Property
// ---------------------------------------------------------------------------

const REAL_ESTATE_PROPERTY: DomainPack = {
  key: 'real_estate_property',
  label: 'Real Estate & Property',
  description: 'Estate agents, property managers, and investors — transactions, valuations, asset management, and PropTech.',
  category: 'operational',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Market Awareness & Intent', description: 'Potential buyer/investor/tenant enters awareness' },
    { stage: 2, label: 'Search & Discovery', description: 'Portal browsing, agent briefing, shortlisting' },
    { stage: 3, label: 'Viewing & Assessment', description: 'Physical/virtual viewings, surveys, structural assessments' },
    { stage: 4, label: 'Offer & Negotiation', description: 'Offer submission, counter-offers, price negotiation' },
    { stage: 5, label: 'Legal & Due Diligence', description: 'Solicitor instruction, searches, survey, contract exchange' },
    { stage: 6, label: 'Finance & Mortgage', description: 'Mortgage application, valuation for lending, offer issue' },
    { stage: 7, label: 'Exchange & Completion', description: 'Exchange of contracts, completion day, key handover' },
    { stage: 8, label: 'Post-Completion & Onboarding', description: 'Snags, warranties, utility transfers, move-in support' },
    { stage: 9, label: 'Tenancy Management (Rental)', description: 'Rent collection, maintenance, inspections, renewals' },
    { stage: 10, label: 'Asset Management & Optimisation', description: 'Refurbishment, planning, yield improvement' },
    { stage: 11, label: 'Disposal & Exit', description: 'Re-sale, lease break, portfolio disposal, auction' },
    { stage: 12, label: 'Market Cycle & Portfolio Review', description: 'Periodic revaluation, strategy review, reinvestment' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses',
    },
    operational_deep_dive: {
      notes: 'Emphasise Transaction & Legal Process, Workforce & Agency Operations, Technology & PropTech',
    },
    ai_enablement: {
      notes: 'Emphasise Technology & PropTech, Market Intelligence & Valuation',
    },
    transformation_sprint: {
      notes: 'Emphasise Technology & PropTech, Customer & Client Experience, Workforce & Agency Operations',
    },
    cultural_alignment: {
      notes: 'Emphasise Workforce & Agency Operations, Customer & Client Experience',
    },
    go_to_market: {
      notes: 'Emphasise Market Intelligence & Valuation, Customer & Client Experience, Finance Investment & Lending',
    },
  },
  actorTaxonomy: [
    { key: 'buyer', label: 'Buyer', description: 'Property purchaser' },
    { key: 'seller_vendor', label: 'Seller/Vendor', description: 'Property seller' },
    { key: 'tenant', label: 'Tenant', description: 'Rental tenant' },
    { key: 'landlord_investor', label: 'Landlord/Property Investor', description: 'Landlord and private investor' },
    { key: 'institutional_investor', label: 'Institutional Investor/Fund Manager', description: 'Institutional property investor' },
    { key: 'estate_agent_negotiator', label: 'Estate Agent/Negotiator', description: 'Sales and lettings agent' },
    { key: 'branch_manager', label: 'Branch Manager/Head of Office', description: 'Branch leadership' },
    { key: 'property_manager', label: 'Property Manager', description: 'Residential and commercial property management' },
    { key: 'surveyor_valuer', label: 'Surveyor/Valuer', description: 'Property surveying and valuation' },
    { key: 'conveyancer_solicitor', label: 'Conveyancer/Solicitor', description: 'Legal conveyancing' },
    { key: 'mortgage_broker_ifa', label: 'Mortgage Broker/IFA', description: 'Mortgage and financial advice' },
    { key: 'mortgage_lender_bank', label: 'Mortgage Lender/Bank', description: 'Mortgage lending' },
    { key: 'developer_housebuilder', label: 'Developer/Housebuilder', description: 'Property development' },
    { key: 'planning_consultant', label: 'Planning Consultant', description: 'Planning and development advice' },
    { key: 'facilities_maintenance_manager', label: 'Facilities & Maintenance Manager', description: 'Property facilities management' },
    { key: 'proptech_crm_manager', label: 'PropTech/CRM Manager', description: 'Property technology systems' },
    { key: 'compliance_aml_officer', label: 'Compliance & AML Officer', description: 'Regulatory and anti-money laundering compliance' },
    { key: 'property_auctioneer', label: 'Property Auctioneer', description: 'Auction and disposal' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Construction & Facilities
// ---------------------------------------------------------------------------

const CONSTRUCTION_FACILITIES: DomainPack = {
  key: 'construction_facilities',
  label: 'Construction & Facilities',
  description: 'Construction contractors and FM providers — project delivery, health & safety, supply chain, and digital construction.',
  category: 'operational',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Bid & Pre-Qualification', description: 'Tender opportunity, PQQ, bid strategy, estimating' },
    { stage: 2, label: 'Contract Award & Mobilisation', description: 'Contract signature, team mobilisation, site setup' },
    { stage: 3, label: 'Design Development & Approvals', description: 'RIBA stages, planning permission, design freeze' },
    { stage: 4, label: 'Enabling Works & Groundworks', description: 'Demolition, ground investigation, foundations' },
    { stage: 5, label: 'Structural & Core Construction', description: 'Superstructure, M&E rough-in, external envelope' },
    { stage: 6, label: 'Fit-Out & Finishing', description: 'Internal fit-out, M&E commissioning, snagging' },
    { stage: 7, label: 'Commissioning & Handover', description: 'Building commissioning, O&M manuals, defects period' },
    { stage: 8, label: 'Facilities Management Mobilisation', description: 'FM service mobilisation, CAFM setup, PPM scheduling' },
    { stage: 9, label: 'Planned Preventive Maintenance', description: 'Ongoing PPM cycles, statutory compliance' },
    { stage: 10, label: 'Reactive & Emergency Response', description: 'Reactive maintenance, emergency callout' },
    { stage: 11, label: 'Soft Services Delivery', description: 'Cleaning, security, catering, waste' },
    { stage: 12, label: 'Contract Review & Renewal', description: 'Performance review, benchmarking, re-tender or extension' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses',
    },
    operational_deep_dive: {
      notes: 'Emphasise Project Delivery & Programme Management, Workforce & Supply Chain, Commercial & Contract Management',
    },
    ai_enablement: {
      notes: 'Emphasise Technology & Digital Construction, Design & Engineering Quality',
    },
    transformation_sprint: {
      notes: 'Emphasise Project Delivery & Programme Management, Technology & Digital Construction, Workforce & Supply Chain',
    },
    cultural_alignment: {
      notes: 'Emphasise Health Safety & Wellbeing, Workforce & Supply Chain',
    },
    go_to_market: {
      notes: 'Emphasise Commercial & Contract Management, Client & Stakeholder Relations',
    },
  },
  actorTaxonomy: [
    { key: 'client_employer', label: 'Client/Employer', description: 'Project client and employer' },
    { key: 'facilities_manager_end_user', label: 'Facilities Manager/End User', description: 'Facilities management and occupier' },
    { key: 'pm_client_side', label: 'Project Manager (Client-Side)', description: 'Client-side project management' },
    { key: 'main_contractor', label: 'Main Contractor/Tier 1', description: 'Principal contractor' },
    { key: 'site_manager', label: 'Site Manager/Project Manager (Contractor)', description: 'Site-level management' },
    { key: 'design_manager', label: 'Design Manager/BIM Manager', description: 'Design management and BIM' },
    { key: 'quantity_surveyor', label: 'Quantity Surveyor/Commercial Manager', description: 'Cost and commercial management' },
    { key: 'hs_manager', label: 'Health & Safety Manager', description: 'Health and safety management' },
    { key: 'subcontractor', label: 'Subcontractor (Specialist)', description: 'Specialist subcontractor' },
    { key: 'supply_chain_procurement', label: 'Supply Chain/Procurement Manager', description: 'Supply chain and procurement' },
    { key: 'structural_civil_engineer', label: 'Structural/Civil Engineer', description: 'Structural and civil engineering' },
    { key: 'me_engineer', label: 'M&E Engineer', description: 'Mechanical and electrical engineering' },
    { key: 'architect_lead_designer', label: 'Architect/Lead Designer', description: 'Architectural design' },
    { key: 'planning_consultant', label: 'Planning Consultant', description: 'Planning and development' },
    { key: 'fm_service_provider', label: 'FM Service Provider', description: 'Facilities management contractor' },
    { key: 'cafm_technology_manager', label: 'CAFM/Technology Systems Manager', description: 'CAFM and technology systems' },
    { key: 'sustainability_manager', label: 'Sustainability Manager', description: 'Sustainability and ESG' },
    { key: 'cdm_coordinator', label: 'CDM Coordinator/Principal Designer', description: 'Construction design and management' },
    { key: 'building_control_inspector', label: 'Building Control/Inspector', description: 'Building regulations inspector' },
    { key: 'insurance_risk_manager', label: 'Insurance & Risk Manager', description: 'Insurance and risk management' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Agriculture & Environmental
// ---------------------------------------------------------------------------

const AGRICULTURE_ENVIRONMENTAL: DomainPack = {
  key: 'agriculture_environmental',
  label: 'Agriculture & Environmental',
  description: 'Farming and agri-food businesses — land stewardship, seasonal operations, supply chain, sustainability, and precision agriculture.',
  category: 'operational',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Strategic Planning & Crop/Programme Design', description: 'Annual planning, rotation, input budgeting' },
    { stage: 2, label: 'Input Procurement & Preparation', description: 'Seeds, chemicals, fertilisers, equipment readiness' },
    { stage: 3, label: 'Land Preparation & Planting', description: 'Soil preparation, sowing, early season agronomic decisions' },
    { stage: 4, label: 'Growing Season Management', description: 'Monitoring, irrigation, pest/disease management' },
    { stage: 5, label: 'Harvest & Yield Capture', description: 'Harvest timing, machinery deployment, yield measurement' },
    { stage: 6, label: 'Storage Processing & Quality Grading', description: 'On-farm storage, grading, preservation' },
    { stage: 7, label: 'Market Access & Sales', description: 'Contract fulfilment, spot market, cooperative/auction routes' },
    { stage: 8, label: 'Logistics & Distribution', description: 'Transport to processor, distributor, or export' },
    { stage: 9, label: 'Environmental Monitoring & Reporting', description: 'Compliance reporting, carbon measurement' },
    { stage: 10, label: 'Subsidy & Grant Administration', description: 'Scheme applications, record-keeping' },
    { stage: 11, label: 'Season Review & Business Planning', description: 'Financial review, next-cycle planning' },
    { stage: 12, label: 'R&D & Variety/Practice Trialling', description: 'New variety testing, regenerative practice pilots' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses',
    },
    operational_deep_dive: {
      notes: 'Emphasise Operations & Seasonal Execution, Workforce & Labour, Supply Chain & Market Access, Technology & Precision Agriculture',
    },
    ai_enablement: {
      notes: 'Emphasise Technology & Precision Agriculture, Operations & Seasonal Execution, Land & Resource Stewardship',
    },
    transformation_sprint: {
      notes: 'Emphasise Operations & Seasonal Execution, Commercial & Financial Viability, Technology & Precision Agriculture, Environmental Compliance & Sustainability',
    },
    cultural_alignment: {
      notes: 'Emphasise Workforce & Labour, Community & Stakeholder Relations, Commercial & Financial Viability',
    },
    go_to_market: {
      notes: 'Emphasise Commercial & Financial Viability, Supply Chain & Market Access, Environmental Compliance & Sustainability',
    },
  },
  actorTaxonomy: [
    { key: 'farm_owner_operator', label: 'Farm Owner/Operator', description: 'Farm owner and primary decision-maker' },
    { key: 'farm_manager', label: 'Farm Manager', description: 'Farm day-to-day management' },
    { key: 'agronomist_advisor', label: 'Agronomist/Technical Advisor', description: 'Agronomic advice and technical support' },
    { key: 'seasonal_migrant_labour', label: 'Seasonal/Migrant Labour', description: 'Seasonal workforce' },
    { key: 'permanent_farm_workforce', label: 'Permanent Farm Workforce', description: 'Year-round farm employees' },
    { key: 'agricultural_contractor', label: 'Agricultural Contractor', description: 'Contract machinery and operations' },
    { key: 'input_supplier_merchant', label: 'Input Supplier/Merchant', description: 'Seeds, agri-chemicals, and fertiliser supplier' },
    { key: 'buyer_offtaker', label: 'Buyer/Offtaker', description: 'Crop and produce purchaser' },
    { key: 'agricultural_bank', label: 'Agricultural Bank/Finance Provider', description: 'Agricultural finance and lending' },
    { key: 'environmental_consultant', label: 'Environmental/Land Management Consultant', description: 'Environmental and land management advice' },
    { key: 'government_rpa', label: 'Government/Rural Payments Agency', description: 'Government scheme administrator' },
    { key: 'cooperative_farmer_group', label: 'Cooperative/Farmer Group', description: 'Collective farming and marketing' },
    { key: 'logistics_haulage', label: 'Logistics/Haulage Operator', description: 'Agricultural logistics' },
    { key: 'certifying_body', label: 'Certifying Body', description: 'Organic, LEAF, and other certification bodies' },
    { key: 'research_institution', label: 'Research Institution/AHDB', description: 'Agricultural research and development' },
    { key: 'environmental_regulator', label: 'Environmental Regulator', description: 'Environment Agency and NatureScot' },
    { key: 'technology_provider', label: 'Technology Provider', description: 'Precision agriculture technology' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Home Services
// ---------------------------------------------------------------------------

const HOME_SERVICES: DomainPack = {
  key: 'home_services',
  label: 'Home Services',
  description: 'Tradespeople and home service businesses — field operations, customer trust, scheduling, and revenue growth.',
  category: 'operational',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Awareness & Lead Generation', description: 'Customer discovers via search, referral, review, ad' },
    { stage: 2, label: 'Enquiry & Booking', description: 'Inbound call/online booking, job scoping, appointment' },
    { stage: 3, label: 'Pre-Job Communication', description: 'Confirmation, technician details, arrival window' },
    { stage: 4, label: 'Technician Dispatch & Arrival', description: 'Routing, on-time arrival, professional presentation' },
    { stage: 5, label: 'Diagnosis & Scoping On-Site', description: 'Problem identification, quoting, customer consent' },
    { stage: 6, label: 'Job Execution', description: 'Technical work delivery, quality, standards adherence' },
    { stage: 7, label: 'Completion & Sign-Off', description: 'Work explained, customer sign-off, photos/documentation' },
    { stage: 8, label: 'Payment & Invoicing', description: 'On-site or digital payment, warranty communication' },
    { stage: 9, label: 'Post-Job Follow-Up', description: 'Satisfaction check, review request' },
    { stage: 10, label: 'Repeat & Retention', description: 'Maintenance plan, service reminder, loyalty incentive' },
    { stage: 11, label: 'Complaint & Remediation', description: 'Complaint intake, rapid response, rework' },
    { stage: 12, label: 'Referral & Review', description: 'Active referral capture, review generation, NPS' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses',
    },
    operational_deep_dive: {
      notes: 'Emphasise Service Delivery & Field Operations, Workforce & Field Workforce Management, Technology & Job Management, Supply Chain & Parts Management',
    },
    ai_enablement: {
      notes: 'Emphasise Technology & Job Management, Service Delivery & Field Operations, Commercial & Revenue Operations',
    },
    transformation_sprint: {
      notes: 'Emphasise Service Delivery & Field Operations, Commercial & Revenue Operations, Technology & Job Management, Customer Experience & Trust',
    },
    cultural_alignment: {
      notes: 'Emphasise Workforce & Field Workforce Management, Customer Experience & Trust, Brand & Local Market Position',
    },
    go_to_market: {
      notes: 'Emphasise Brand & Local Market Position, Commercial & Revenue Operations, Customer Experience & Trust',
    },
  },
  actorTaxonomy: [
    { key: 'homeowner_residential', label: 'Homeowner/Residential Customer', description: 'Primary residential customer' },
    { key: 'landlord_property_manager', label: 'Landlord/Property Manager', description: 'Managed property client' },
    { key: 'estate_letting_agent', label: 'Estate/Letting Agent', description: 'Property agent client' },
    { key: 'field_technician_engineer', label: 'Field Technician/Engineer', description: 'Front-line technical operative' },
    { key: 'apprentice_junior_technician', label: 'Apprentice/Junior Technician', description: 'Trainee technician' },
    { key: 'dispatcher_scheduler', label: 'Dispatcher/Scheduler', description: 'Job scheduling and dispatch' },
    { key: 'customer_service_booking_agent', label: 'Customer Service/Booking Agent', description: 'Inbound enquiry and booking' },
    { key: 'subcontractor', label: 'Subcontractor', description: 'Specialist subcontractor' },
    { key: 'operations_service_manager', label: 'Operations/Service Manager', description: 'Operations management' },
    { key: 'parts_procurement_coordinator', label: 'Parts & Procurement Coordinator', description: 'Parts and supply chain' },
    { key: 'finance_invoicing_admin', label: 'Finance/Invoicing Administrator', description: 'Financial administration' },
    { key: 'sales_growth_manager', label: 'Sales/Growth Manager', description: 'Sales and business development' },
    { key: 'marketing_coordinator', label: 'Marketing Coordinator', description: 'Marketing and lead generation' },
    { key: 'compliance_hs_officer', label: 'Compliance/H&S Officer', description: 'Regulatory compliance and health and safety' },
    { key: 'franchise_territory_manager', label: 'Franchise Owner/Territory Manager', description: 'Franchise management' },
    { key: 'national_accounts_b2b', label: 'National Accounts/B2B Client', description: 'Large commercial client' },
    { key: 'technology_systems_admin', label: 'Technology/Systems Administrator', description: 'Job management systems' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Waste Management
// ---------------------------------------------------------------------------

const WASTE_MANAGEMENT: DomainPack = {
  key: 'waste_management',
  label: 'Waste Management',
  description: 'Waste collectors and processors — collection logistics, processing, circular economy, compliance, and fleet.',
  category: 'operational',
  lenses: [],
  journeyStages: [
    { stage: 1, label: 'Contract Inception & Service Design', description: 'Scope, waste audit, service specification, mobilisation' },
    { stage: 2, label: 'Bin/Container Provisioning', description: 'Customer/site setup, container delivery, contamination education' },
    { stage: 3, label: 'Collection Scheduling & Route Planning', description: 'Route design, frequency, crew allocation' },
    { stage: 4, label: 'Daily Collection Operations', description: 'Route execution, missed collections, customer communications' },
    { stage: 5, label: 'Vehicle Maintenance & Fleet Readiness', description: 'Planned maintenance, breakdowns, substitute vehicles' },
    { stage: 6, label: 'Reception & Weighbridge at Facility', description: 'Inbound vehicle management, weighing, load recording' },
    { stage: 7, label: 'Sorting & Processing', description: 'Material segregation, automated sorting, contamination removal' },
    { stage: 8, label: 'Materials Recovery & Secondary Market', description: 'Baling, brokering, commodity market sale' },
    { stage: 9, label: 'Residual Waste Disposal', description: 'Landfill, EfW, treatment routes for non-recyclable material' },
    { stage: 10, label: 'Hazardous Waste Handling', description: 'Consignment notes, specialist treatment, regulatory documentation' },
    { stage: 11, label: 'Reporting & Contract Performance', description: 'KPI reporting, diversion data, audit support' },
    { stage: 12, label: 'Contract Review & Renewal', description: 'Performance review, CPI adjustments, re-bid' },
    { stage: 13, label: 'Community Engagement & Behaviour Change', description: 'Recycling education, contamination campaigns' },
  ],
  engagementVariants: {
    diagnostic_baseline: {
      notes: 'All 8 lenses',
    },
    operational_deep_dive: {
      notes: 'Emphasise Collection & Logistics Operations, Processing & Recovery, Workforce & Operational Safety, Technology & Fleet Management',
    },
    ai_enablement: {
      notes: 'Emphasise Technology & Fleet Management, Collection & Logistics Operations, Processing & Recovery',
    },
    transformation_sprint: {
      notes: 'Emphasise Collection & Logistics Operations, Circular Economy & Sustainability Strategy, Technology & Fleet Management',
    },
    cultural_alignment: {
      notes: 'Emphasise Workforce & Operational Safety, Customer & Client Relationships',
    },
    go_to_market: {
      notes: 'Emphasise Commercial & Contract Management, Circular Economy & Sustainability Strategy, Customer & Client Relationships',
    },
  },
  actorTaxonomy: [
    { key: 'waste_collection_driver', label: 'Waste Collection Driver/HGV Operative', description: 'HGV collection driver' },
    { key: 'loader_collection_operative', label: 'Loader/Collection Operative', description: 'Collection crew operative' },
    { key: 'route_planner_scheduler', label: 'Route Planner/Scheduler', description: 'Route planning and scheduling' },
    { key: 'transport_manager', label: 'Transport Manager', description: 'Transport operations management' },
    { key: 'facility_operative_sorter', label: 'Facility Operative/Sorter', description: 'Waste processing operative' },
    { key: 'facility_site_manager', label: 'Facility Manager/Site Manager', description: 'Facility management' },
    { key: 'fleet_manager', label: 'Fleet Manager/Workshop Technician', description: 'Fleet management and maintenance' },
    { key: 'environmental_compliance_manager', label: 'Environmental/Compliance Manager', description: 'Environmental compliance and permits' },
    { key: 'hs_manager', label: 'H&S Manager', description: 'Health and safety management' },
    { key: 'commercial_manager_estimator', label: 'Commercial Manager/Estimator', description: 'Commercial management and bidding' },
    { key: 'contract_manager', label: 'Contract Manager/Account Manager', description: 'Contract and client management' },
    { key: 'local_authority_client', label: 'Local Authority Client', description: 'Local government client' },
    { key: 'commercial_waste_customer', label: 'Commercial Waste Customer', description: 'Business waste customer' },
    { key: 'materials_broker', label: 'Materials Broker/Secondary Market Buyer', description: 'Recovered materials buyer' },
    { key: 'environment_agency_inspector', label: 'Environment Agency/SEPA Inspector', description: 'Environmental regulator' },
    { key: 'weighbridge_operator', label: 'Weighbridge Operator', description: 'Facility weighbridge operations' },
    { key: 'community_comms_officer', label: 'Community/Communications Officer', description: 'Community engagement and communications' },
    { key: 'technology_telematics_analyst', label: 'Technology/Telematics Analyst', description: 'Fleet telematics and data analytics' },
  ],
  metricReferences: [],
  questionTemplates: [],
  diagnosticOutputFields: [],
  discoveryLenses: [],
  discoveryQuestionTemplates: [],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const INDUSTRY_PACKS: Record<string, DomainPack> = {
  airline_aviation: AIRLINE_AVIATION,
  agriculture_environmental: AGRICULTURE_ENVIRONMENTAL,
  automotive_mobility: AUTOMOTIVE_MOBILITY,
  bpo_outsourcing: BPO_OUTSOURCING,
  construction_facilities: CONSTRUCTION_FACILITIES,
  education: EDUCATION,
  energy_utilities: ENERGY_UTILITIES,
  financial_services: FINANCIAL_SERVICES,
  healthcare: HEALTHCARE,
  home_services: HOME_SERVICES,
  manufacturing: MANUFACTURING,
  media_entertainment: MEDIA_ENTERTAINMENT,
  professional_services: PROFESSIONAL_SERVICES,
  public_sector: PUBLIC_SECTOR,
  real_estate_property: REAL_ESTATE_PROPERTY,
  retail: RETAIL,
  technology: TECHNOLOGY,
  telecommunications: TELECOMMUNICATIONS,
  transport_logistics: TRANSPORT_LOGISTICS,
  waste_management: WASTE_MANAGEMENT,
};
