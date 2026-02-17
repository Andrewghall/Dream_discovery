// Empty template structure for DREAM workshop output
// Defines the 5 core lenses: Customer, Regulator, Client, Technology, Organisation

export const emptyTemplateData = {
  workshopName: "",
  workshopDate: "",
  organization: "",
  facilitator: "Upstream Works",

  execSummary: {
    title: "Executive Summary",
    overview: "",
    keyFindings: [],
    metrics: {
      participantsEngaged: 0,
      domainsExplored: 5,
      insightsGenerated: 0,
      transformationalIdeas: 0
    }
  },

  discoveryOutput: {
    participants: [],
    totalUtterances: 0,
    sections: [
      {
        domain: "Customer",
        icon: "👥",
        color: "blue",
        utteranceCount: 0,
        topThemes: [],
        wordCloud: [],
        quotes: [],
        sentiment: {
          optimistic: 0,
          neutral: 0,
          concerned: 0
        },
        consensusLevel: 0
      },
      {
        domain: "Client",
        icon: "🏢",
        color: "green",
        utteranceCount: 0,
        topThemes: [],
        wordCloud: [],
        quotes: [],
        sentiment: {
          optimistic: 0,
          neutral: 0,
          concerned: 0
        },
        consensusLevel: 0
      },
      {
        domain: "Organisation",
        icon: "🔄",
        color: "indigo",
        utteranceCount: 0,
        topThemes: [],
        wordCloud: [],
        quotes: [],
        sentiment: {
          optimistic: 0,
          neutral: 0,
          concerned: 0
        },
        consensusLevel: 0
      },
      {
        domain: "Technology",
        icon: "💻",
        color: "orange",
        utteranceCount: 0,
        topThemes: [],
        wordCloud: [],
        quotes: [],
        sentiment: {
          optimistic: 0,
          neutral: 0,
          concerned: 0
        },
        consensusLevel: 0
      },
      {
        domain: "Regulator",
        icon: "⚖️",
        color: "purple",
        utteranceCount: 0,
        topThemes: [],
        wordCloud: [],
        quotes: [],
        sentiment: {
          optimistic: 0,
          neutral: 0,
          concerned: 0
        },
        consensusLevel: 0
      }
    ]
  },

  reimagineContent: {
    title: "",
    description: "",
    subtitle: "",
    supportingSection: null,
    accordionSections: [],
    journeyMapping: null,
    primaryThemes: [],
    shiftOne: null,
    supportingThemes: [],
    shiftTwo: null,
    horizonVision: null
  },

  constraintsContent: {
    regulatory: [],
    technical: [],
    commercial: [],
    organizational: []
  },

  commercialContent: {
    investmentSummary: {
      totalInvestment: "",
      fiveYearROI: "",
      paybackPeriod: "",
      annualSavings: ""
    },
    deliveryPhases: [],
    riskAssessment: []
  },

  summaryContent: {
    keyFindings: [],
    recommendedNextSteps: [],
    successMetrics: []
  }
};
