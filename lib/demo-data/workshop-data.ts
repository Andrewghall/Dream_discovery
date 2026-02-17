// Complete demo workshop data for NHS Digital Health Platform Reimagination

export const demoWorkshopData = {
  workshopName: "NHS Digital Health Platform Reimagination",
  workshopDate: "February 13, 2026",
  organization: "NHS Digital",
  facilitator: "Upstream Works",

  execSummary: {
    title: "Executive Summary",
    overview: "A strategic workshop exploring how NHS Digital can transform from legacy patient management systems to an AI-enabled, patient-centric digital health platform. The workshop identified 23 strategic opportunities across clinical, technical, and commercial domains, with a clear path to move beyond incremental improvements toward transformational change.",
    keyFindings: [
      {
        title: "Patient Experience Crisis",
        description: "Current systems force patients through 8+ touchpoints for simple tasks, with 47% reporting frustration with digital services.",
        impact: "High"
      },
      {
        title: "Legacy Technical Debt",
        description: "15-year-old core systems consuming 73% of IT budget on maintenance rather than innovation.",
        impact: "Critical"
      },
      {
        title: "AI-Enabled Opportunity",
        description: "Potential to reduce clinical admin burden by 60% and improve diagnostic accuracy by 30% through AI assistance.",
        impact: "Transformational"
      }
    ],
    metrics: {
      participantsEngaged: 24,
      domainsExplored: 4,
      insightsGenerated: 127,
      transformationalIdeas: 23
    }
  },

  discoveryOutput: {
    sections: [
      {
        domain: "Clinical Experience",
        icon: "🏥",
        color: "blue",
        content: [
          {
            type: "North Star",
            text: "Every patient receives personalized, proactive care that anticipates their needs before they arise"
          },
          {
            type: "Principle",
            text: "Patient agency over clinical convenience - patients control their health data and care journey"
          },
          {
            type: "Goal",
            text: "Reduce average patient journey time from 14 days to under 48 hours for non-urgent care"
          },
          {
            type: "Recommendation",
            text: "Implement AI-powered symptom checker that triages 80% of inquiries without human intervention"
          },
          {
            type: "Recommendation",
            text: "Create unified patient dashboard consolidating all health records, appointments, and communications"
          },
          {
            type: "Assumption",
            text: "Patients are willing to share health data if they receive clear value in return"
          },
          {
            type: "Risk",
            text: "Data privacy concerns could slow adoption among vulnerable populations"
          },
          {
            type: "Dependency",
            text: "Requires integration with 47 existing NHS trust systems across England"
          }
        ]
      },
      {
        domain: "Technology Platform",
        icon: "💻",
        color: "purple",
        content: [
          {
            type: "North Star",
            text: "A modern, API-first platform that enables rapid innovation while maintaining clinical safety"
          },
          {
            type: "Principle",
            text: "Cloud-native architecture with zero legacy constraints"
          },
          {
            type: "Goal",
            text: "Reduce system deployment time from 6 months to 2 weeks through containerization"
          },
          {
            type: "Recommendation",
            text: "Adopt microservices architecture allowing independent service scaling and deployment"
          },
          {
            type: "Recommendation",
            text: "Implement real-time data mesh replacing nightly batch ETL processes"
          },
          {
            type: "Assumption",
            text: "AWS/Azure can achieve NHS Digital data sovereignty requirements"
          },
          {
            type: "Risk",
            text: "Migration could disrupt critical clinical services if not phased carefully"
          },
          {
            type: "Dependency",
            text: "Requires DCB 0129 compliance certification for all new components"
          }
        ]
      },
      {
        domain: "Commercial Model",
        icon: "💰",
        color: "green",
        content: [
          {
            type: "North Star",
            text: "Self-funding platform through operational savings, not increased NHS budgets"
          },
          {
            type: "Principle",
            text: "Value-based outcomes over activity-based billing"
          },
          {
            type: "Goal",
            text: "Achieve £127M annual operational savings through automation by Year 3"
          },
          {
            type: "Recommendation",
            text: "Shift from perpetual licenses to consumption-based pricing aligned with patient outcomes"
          },
          {
            type: "Recommendation",
            text: "Create innovation fund using 20% of realized savings to continuously improve platform"
          },
          {
            type: "Assumption",
            text: "Trusts will adopt if ROI exceeds 200% within 2 years"
          },
          {
            type: "Risk",
            text: "Budget constraints across NHS may delay procurement decisions"
          },
          {
            type: "Dependency",
            text: "Requires NHS England framework agreement approval"
          }
        ]
      },
      {
        domain: "Organizational Change",
        icon: "👥",
        color: "orange",
        content: [
          {
            type: "North Star",
            text: "Clinical staff empowered to focus on complex care, freed from administrative burden"
          },
          {
            type: "Principle",
            text: "Technology augments clinicians, never replaces clinical judgment"
          },
          {
            type: "Goal",
            text: "Reduce clinical admin time by 12 hours per week per GP through AI automation"
          },
          {
            type: "Recommendation",
            text: "Establish clinical AI ethics board with 50% patient representation"
          },
          {
            type: "Recommendation",
            text: "Create 'Digital Champions' program training 500 clinicians as change agents"
          },
          {
            type: "Assumption",
            text: "Clinicians will trust AI recommendations if explainability and override controls exist"
          },
          {
            type: "Risk",
            text: "Resistance from staff concerned about job security or deskilling"
          },
          {
            type: "Dependency",
            text: "Requires GMC approval for AI-assisted clinical decision support tools"
          }
        ]
      }
    ],
    designPrinciples: [
      {
        title: "Patient First, Always",
        description: "Every technical and operational decision must demonstrably improve patient outcomes or experience"
      },
      {
        title: "Clinically Safe by Design",
        description: "Safety checks embedded at every layer, not added as afterthought"
      },
      {
        title: "Open and Interoperable",
        description: "No vendor lock-in; all data accessible via standard FHIR APIs"
      },
      {
        title: "Privacy as Default",
        description: "Zero-knowledge architecture where data is encrypted at rest and in transit"
      }
    ],
    linkedIntelligence: {
      clinical: [
        "NICE guidelines NG123 require explainable AI for clinical decisions",
        "Care Quality Commission mandates 24/7 system availability for critical services",
        "Patient safety requires dual authorization for medication dosing algorithms"
      ],
      strategic: [
        "NHS Long Term Plan commits to digital-first primary care by 2028",
        "Integrated Care Systems require data sharing across organizational boundaries",
        "Government mandate: 90% patient portal adoption by 2027"
      ],
      commercial: [
        "£3.2B NHS Digital transformation budget allocated over 5 years",
        "Average trust spends £4.7M annually on patient admin - automation opportunity",
        "Value-based care contracts increasing 40% year-over-year"
      ]
    }
  },

  reimagineContent: {
    sections: [
      {
        domain: "Clinical Experience",
        content: [
          {
            type: "aspiration",
            text: "AI health assistant that knows patient's history, preferences, and cultural context - provides guidance in their language"
          },
          {
            type: "aspiration",
            text: "Predictive health monitoring that alerts patients weeks before symptoms emerge based on continuous data"
          },
          {
            type: "opportunity",
            text: "Virtual wards allowing 70% of hospital monitoring to occur in patient's home with wearables"
          },
          {
            type: "opportunity",
            text: "Instant specialist consultations via AI-matched clinician marketplace across UK"
          }
        ]
      },
      {
        domain: "Technology Platform",
        content: [
          {
            type: "aspiration",
            text: "Self-healing infrastructure that detects and resolves issues before they impact clinical services"
          },
          {
            type: "aspiration",
            text: "Real-time clinical intelligence layer providing insights across all 6.5M daily patient interactions"
          },
          {
            type: "opportunity",
            text: "Federated learning allowing AI models to improve across trusts without sharing patient data"
          },
          {
            type: "opportunity",
            text: "Blockchain-based consent management giving patients granular control over data sharing"
          }
        ]
      }
    ]
  },

  constraintsContent: {
    regulatory: [
      {
        title: "UK GDPR Article 22",
        description: "Prohibits purely automated decisions affecting patients without human review",
        impact: "High",
        mitigation: "Implement 'human-in-the-loop' for all clinical AI recommendations"
      },
      {
        title: "MHRA Medical Device Regulations",
        description: "AI diagnostic tools classified as Class IIa/IIb devices requiring certification",
        impact: "Critical",
        mitigation: "Partner with pre-certified AI platform providers or budget 18 months for certification"
      },
      {
        title: "NHS Data Security & Protection Toolkit",
        description: "Mandatory annual assessment with 116 compliance requirements",
        impact: "Medium",
        mitigation: "Build compliance monitoring into platform architecture from day one"
      }
    ],
    technical: [
      {
        title: "Legacy System Integration",
        description: "47 trusts running different EMR systems (Cerner, EPIC, local builds)",
        impact: "Critical",
        mitigation: "Build FHIR translation layer; phase migration over 3 years"
      },
      {
        title: "Data Quality Issues",
        description: "35% of patient records have incomplete or conflicting information",
        impact: "High",
        mitigation: "Implement AI-powered data cleansing and deduplication pipeline"
      },
      {
        title: "Network Infrastructure",
        description: "12% of GP practices still on sub-10Mbps connections",
        impact: "Medium",
        mitigation: "Design offline-first mobile apps with smart sync"
      }
    ],
    commercial: [
      {
        title: "Procurement Timelines",
        description: "NHS procurement processes average 9-14 months from RFP to contract",
        impact: "High",
        mitigation: "Use existing framework agreements (G-Cloud, DOS) for faster deployment"
      },
      {
        title: "Budget Cycles",
        description: "Trusts plan budgets 18 months in advance; difficult to accommodate new initiatives",
        impact: "Medium",
        mitigation: "Offer risk-share model: pay only after demonstrable savings achieved"
      }
    ],
    organizational: [
      {
        title: "Change Fatigue",
        description: "NHS staff experienced 7 major IT system changes in past 5 years",
        impact: "High",
        mitigation: "Emphasize continuity: build on familiar workflows, gradual rollout"
      },
      {
        title: "Clinical Engagement",
        description: "Previous digital initiatives had <30% clinician adoption due to poor usability",
        impact: "Critical",
        mitigation: "Co-design with clinicians; appoint clinical product owner for each major feature"
      }
    ]
  },

  commercialContent: {
    investmentSummary: {
      totalInvestment: "£47.3M",
      paybackPeriod: "26 months",
      fiveYearROI: "347%",
      annualSavings: "£127M by Year 3"
    },
    deliveryPhases: [
      {
        phase: "Phase 1: Foundation",
        duration: "Months 1-9",
        investment: "£12.8M",
        scope: [
          "Cloud infrastructure setup (AWS gov cloud)",
          "FHIR API gateway deployment",
          "Patient portal MVP (registration, appointments, records access)",
          "Initial trust onboarding (3 pilot sites)"
        ],
        outcomes: [
          "50K patients onboarded",
          "Basic appointment booking operational",
          "API integration with 3 EMR systems validated"
        ]
      },
      {
        phase: "Phase 2: Intelligence",
        duration: "Months 10-18",
        investment: "£18.7M",
        scope: [
          "AI symptom checker deployment",
          "Clinical decision support tools",
          "Predictive analytics dashboard",
          "Expansion to 15 trusts"
        ],
        outcomes: [
          "500K patients using AI triage",
          "40% reduction in GP appointment demand for minor ailments",
          "Clinical staff save 8 hours/week on admin"
        ]
      },
      {
        phase: "Phase 3: Transformation",
        duration: "Months 19-36",
        investment: "£15.8M",
        scope: [
          "Virtual wards platform",
          "Federated learning AI models",
          "Full NHS England rollout (all 106 trusts)",
          "Advanced analytics and insights"
        ],
        outcomes: [
          "6.5M patients active on platform",
          "£127M annual operational savings",
          "12,000 virtual ward beds operational"
        ]
      }
    ],
    riskAssessment: [
      {
        risk: "Slower than expected trust adoption",
        probability: "Medium",
        impact: "High",
        mitigation: "Offer 90-day pilot at no cost; showcase early wins"
      },
      {
        risk: "AI bias affecting clinical decisions",
        probability: "Low",
        impact: "Critical",
        mitigation: "Quarterly fairness audits; diverse training data; clinician override always available"
      },
      {
        risk: "Data breach or security incident",
        probability: "Low",
        impact: "Critical",
        mitigation: "Zero-trust architecture; penetration testing; £10M cyber insurance"
      }
    ]
  },

  summaryContent: {
    keyFindings: [
      {
        category: "Clinical Impact",
        findings: [
          "Current patient journey involves 8+ touchpoints; opportunity to reduce to 2-3 through intelligent routing",
          "GPs spend 18 hours/week on admin that could be automated, freeing time for complex care",
          "AI symptom checker could safely handle 60% of inquiries currently requiring GP appointment"
        ]
      },
      {
        category: "Technical Foundation",
        findings: [
          "Legacy systems consuming 73% of IT budget on maintenance vs 27% on innovation",
          "Cloud-native architecture could reduce infrastructure costs by 40% while improving reliability",
          "API-first design enables ecosystem of third-party innovations without core system changes"
        ]
      },
      {
        category: "Commercial Viability",
        findings: [
          "£127M annual savings achievable through automation and virtual care",
          "Self-funding model possible: platform pays for itself through operational efficiencies",
          "Risk-share pricing removes budget barriers for early adopter trusts"
        ]
      }
    ],
    recommendedNextSteps: [
      {
        step: "Secure Executive Sponsorship",
        timeframe: "Week 1-2",
        owner: "NHS Digital CTO",
        actions: [
          "Present business case to NHS England board",
          "Secure £47.3M budget allocation",
          "Appoint program director and clinical lead"
        ]
      },
      {
        step: "Establish Governance",
        timeframe: "Week 3-6",
        owner: "Program Director",
        actions: [
          "Create clinical AI ethics board with patient representation",
          "Define success metrics and KPIs",
          "Establish data governance framework"
        ]
      },
      {
        step: "Pilot Site Selection",
        timeframe: "Week 7-12",
        owner: "Clinical Lead",
        actions: [
          "Identify 3 diverse pilot trusts (urban, rural, different EMRs)",
          "Negotiate pilot agreements",
          "Begin trust staff engagement and training"
        ]
      },
      {
        step: "Platform Build Initiation",
        timeframe: "Month 4",
        owner: "Technical Lead",
        actions: [
          "Finalize vendor selection for cloud and AI services",
          "Begin infrastructure provisioning",
          "Start patient portal MVP development"
        ]
      }
    ],
    successMetrics: [
      {
        metric: "Patient Satisfaction",
        baseline: "67% satisfaction (current)",
        target: "85% satisfaction by Year 2",
        measurement: "Quarterly patient surveys"
      },
      {
        metric: "Clinical Admin Burden",
        baseline: "18 hours/week per GP",
        target: "6 hours/week by Year 3",
        measurement: "Time-motion studies"
      },
      {
        metric: "Cost Savings",
        baseline: "£0",
        target: "£127M annually by Year 3",
        measurement: "Trust financial reports"
      },
      {
        metric: "Platform Adoption",
        baseline: "0 patients",
        target: "6.5M active users by Year 3",
        measurement: "Platform analytics"
      }
    ]
  }
};
