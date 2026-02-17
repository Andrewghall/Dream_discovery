// Complete demo workshop data for Travel Company Contact Centre Transformation

export const travelContactCentreData = {
  workshopName: "TravelWise Contact Centre Transformation",
  workshopDate: "February 13, 2026",
  organization: "TravelWise UK",
  facilitator: "Upstream Works",

  execSummary: {
    title: "Executive Summary",
    overview: "A strategic workshop exploring how TravelWise can transform from a reactive call centre handling complaints to a proactive customer engagement hub that drives bookings and loyalty. The workshop engaged 10 contact centre staff, team leaders, and operations managers who identified critical pain points in current processes and envisioned an AI-enhanced future where agents focus on high-value conversations while routine queries are automated.",
    keyFindings: [
      {
        title: "Agent Burnout Crisis",
        description: "80% of calls are repetitive queries (booking status, flight changes, refunds) that could be automated. Agents spend only 20% of time on meaningful customer engagement, leading to high turnover (42% annually).",
        impact: "Critical"
      },
      {
        title: "Peak Season Bottleneck",
        description: "During summer (June-August) and Christmas, call volumes spike 300% but staffing only increases 40%. Wait times exceed 45 minutes, leading to 23% call abandonment and lost bookings worth £8.7M annually.",
        impact: "High"
      },
      {
        title: "AI-Powered Opportunity",
        description: "Potential to automate 70% of inbound queries through intelligent chatbot + voice AI, reduce average handling time from 12 minutes to 4 minutes for complex queries, and enable agents to become 'Travel Advisors' who upsell experiences.",
        impact: "Transformational"
      }
    ],
    metrics: {
      participantsEngaged: 10,
      domainsExplored: 4,
      insightsGenerated: 89,
      transformationalIdeas: 18
    }
  },

  discoveryOutput: {
    participants: [
      { name: "Sarah Mitchell", role: "Contact Centre Manager", yearsExperience: 8 },
      { name: "James Thompson", role: "Senior Travel Advisor", yearsExperience: 12 },
      { name: "Priya Patel", role: "Team Leader - Bookings", yearsExperience: 6 },
      { name: "Marcus Johnson", role: "Customer Service Agent", yearsExperience: 3 },
      { name: "Emma Roberts", role: "Quality Assurance Lead", yearsExperience: 5 },
      { name: "David Chen", role: "Training Manager", yearsExperience: 7 },
      { name: "Lisa Anderson", role: "Complaints Specialist", yearsExperience: 4 },
      { name: "Tom Bradley", role: "Operations Manager", yearsExperience: 10 },
      { name: "Aisha Khan", role: "Customer Service Agent", yearsExperience: 2 },
      { name: "Rebecca Foster", role: "Team Leader - Retention", yearsExperience: 9 }
    ],
    totalUtterances: 247,
    sections: [
      {
        domain: "Customer Experience",
        icon: "✈️",
        color: "blue",
        utteranceCount: 73,
        topThemes: ["Self-service", "Wait times", "Personalization", "Omnichannel"],
        wordCloud: [
          { word: "Self-Service Portal", size: 4, frequency: 28 },
          { word: "Chatbot", size: 3, frequency: 21 },
          { word: "Wait Times", size: 3, frequency: 19 },
          { word: "Mobile App", size: 2, frequency: 15 },
          { word: "Personalization", size: 2, frequency: 14 },
          { word: "Omnichannel", size: 2, frequency: 12 },
          { word: "WhatsApp", size: 1, frequency: 9 },
          { word: "Email Response", size: 1, frequency: 8 },
          { word: "Proactive Updates", size: 2, frequency: 16 }
        ],
        quotes: [
          {
            text: "Customers call us for things they could easily do themselves - check booking status, download tickets, change seat preferences. We need a self-service portal that actually works.",
            author: "Marcus Johnson, Customer Service Agent",
            sentiment: "frustrated"
          },
          {
            text: "During peak season, customers wait 45 minutes on hold. By the time we answer, they're furious. The call that should take 3 minutes takes 15 because we're dealing with their anger first.",
            author: "Priya Patel, Team Leader - Bookings",
            sentiment: "concerned"
          },
          {
            text: "If we had a smart chatbot that could handle 'Where's my booking confirmation?' or 'Can I change my flight?' we could focus on helping customers plan amazing holidays instead of being glorified search engines.",
            author: "James Thompson, Senior Travel Advisor",
            sentiment: "optimistic"
          },
          {
            text: "Our customers are on WhatsApp, Instagram, TikTok - but we only do phone and email. We're losing the younger generation because we're not meeting them where they are.",
            author: "Aisha Khan, Customer Service Agent",
            sentiment: "concerned"
          }
        ],
        sentiment: {
          optimistic: 52,
          neutral: 28,
          concerned: 20
        },
        consensusLevel: 89
      },
      {
        domain: "Agent Experience",
        icon: "👤",
        color: "purple",
        utteranceCount: 68,
        topThemes: ["Repetitive work", "Burnout", "Career growth", "Training", "Tools"],
        wordCloud: [
          { word: "Repetitive Queries", size: 4, frequency: 31 },
          { word: "Burnout", size: 3, frequency: 24 },
          { word: "Career Progression", size: 3, frequency: 20 },
          { word: "Knowledge Base", size: 2, frequency: 17 },
          { word: "AI Assistance", size: 3, frequency: 22 },
          { word: "Training", size: 2, frequency: 15 },
          { word: "Empowerment", size: 2, frequency: 13 },
          { word: "Legacy Systems", size: 2, frequency: 14 }
        ],
        quotes: [
          {
            text: "I answer the same 10 questions 50 times a day. 'Where's my booking email?' 'Can I get a refund?' 'Is my flight on time?' It's soul-destroying. I didn't become a travel advisor to be a robot.",
            author: "Marcus Johnson, Customer Service Agent",
            sentiment: "frustrated"
          },
          {
            text: "Our turnover is 42% annually. People join excited about travel, then burn out within 18 months because they're just resetting passwords and sending confirmation emails. We need to let them do the interesting work.",
            author: "Sarah Mitchell, Contact Centre Manager",
            sentiment: "concerned"
          },
          {
            text: "Imagine if AI handled all the routine stuff and I could spend my day helping families plan their dream safari in Kenya or honeymoons in the Maldives. That's the job I thought I was signing up for.",
            author: "James Thompson, Senior Travel Advisor",
            sentiment: "optimistic"
          },
          {
            text: "We have 6 different systems - booking tool, CRM, knowledge base, refund portal, email, phone system. I'm switching between tabs constantly. An integrated platform would save us 10 minutes per call.",
            author: "Priya Patel, Team Leader - Bookings",
            sentiment: "frustrated"
          }
        ],
        sentiment: {
          optimistic: 38,
          neutral: 25,
          concerned: 37
        },
        consensusLevel: 92
      },
      {
        domain: "Technology & AI",
        icon: "🤖",
        color: "green",
        utteranceCount: 61,
        topThemes: ["Chatbot", "Voice AI", "Knowledge base", "CRM integration", "Analytics"],
        wordCloud: [
          { word: "AI Chatbot", size: 4, frequency: 29 },
          { word: "Voice Recognition", size: 3, frequency: 23 },
          { word: "Smart Routing", size: 3, frequency: 21 },
          { word: "CRM Integration", size: 2, frequency: 18 },
          { word: "Real-time Analytics", size: 2, frequency: 16 },
          { word: "Knowledge Graph", size: 2, frequency: 14 },
          { word: "Sentiment Analysis", size: 2, frequency: 15 },
          { word: "Predictive", size: 1, frequency: 11 }
        ],
        quotes: [
          {
            text: "A chatbot that understands natural language - not just keyword matching. If someone says 'I need to move my Barcelona trip because my sister's wedding changed', it should understand and offer options.",
            author: "David Chen, Training Manager",
            sentiment: "optimistic"
          },
          {
            text: "Voice AI for phone calls - the AI answers, handles simple stuff, and seamlessly transfers to a human when needed. Customer doesn't even realize they started with a bot.",
            author: "Tom Bradley, Operations Manager",
            sentiment: "optimistic"
          },
          {
            text: "Real-time sentiment analysis during calls. If a customer's tone indicates frustration, the system alerts me with suggested responses or automatically offers compensation authority.",
            author: "Lisa Anderson, Complaints Specialist",
            sentiment: "optimistic"
          },
          {
            text: "I'm worried about job security. If AI handles 70% of calls, do we need 70% fewer agents? Management needs to be clear that this is about enhancement, not replacement.",
            author: "Aisha Khan, Customer Service Agent",
            sentiment: "concerned"
          }
        ],
        sentiment: {
          optimistic: 68,
          neutral: 21,
          concerned: 11
        },
        consensusLevel: 85
      },
      {
        domain: "Business Model",
        icon: "💰",
        color: "orange",
        utteranceCount: 45,
        topThemes: ["Cost reduction", "Upselling", "Retention", "Revenue growth", "Metrics"],
        wordCloud: [
          { word: "Cost per Contact", size: 3, frequency: 19 },
          { word: "Upsell Conversion", size: 3, frequency: 21 },
          { word: "Customer Lifetime Value", size: 2, frequency: 15 },
          { word: "Peak Season Capacity", size: 3, frequency: 22 },
          { word: "Retention Rate", size: 2, frequency: 17 },
          { word: "NPS Score", size: 2, frequency: 14 },
          { word: "First Contact Resolution", size: 2, frequency: 16 }
        ],
        quotes: [
          {
            text: "Each call costs us £8.50 on average. If we automate 70%, that's £4.7M saved annually. Even if we only automate 40%, it still pays for the entire tech investment in Year 1.",
            author: "Sarah Mitchell, Contact Centre Manager",
            sentiment: "optimistic"
          },
          {
            text: "Right now we're order-takers. But what if agents became travel advisors who upsell experiences - wine tours in Tuscany, spa days in Bali, private guides? Each agent could generate £50K additional revenue annually.",
            author: "Rebecca Foster, Team Leader - Retention",
            sentiment: "optimistic"
          },
          {
            text: "During peak season we lose £8.7M in abandoned bookings because wait times are too long. If we had AI handling the queue, we'd convert 80% of those into sales.",
            author: "Tom Bradley, Operations Manager",
            sentiment: "concerned"
          },
          {
            text: "Our NPS is 34. Travel competitors average 58. The gap is almost entirely explained by contact centre experience - wait times, agent knowledge, resolution rates. Fix this, fix NPS.",
            author: "Emma Roberts, Quality Assurance Lead",
            sentiment: "concerned"
          }
        ],
        sentiment: {
          optimistic: 64,
          neutral: 22,
          concerned: 14
        },
        consensusLevel: 87
      }
    ],
    overallConsensus: 88
  },

  reimagineContent: {
    title: "The future contact centre for TravelWise",
    description: "The Reimagine session focused on defining the future direction of customer contact/engagement as a core business.",
    subtitle: "The workshop explored how TravelWise can transform from a reactive call centre handling complaints to a proactive customer engagement hub that drives bookings and loyalty through AI-powered self-service and expert travel advisors.",

    supportingSection: {
      title: "Supporting Customers Before Crisis",
      description: "Moving from reactive problem-solving to proactive travel assistance that anticipates customer needs before they reach out.",
      points: [
        "AI handles 70% of routine queries (booking status, flight changes, refunds) instantly via chat and voice",
        "Agents focus on high-value interactions: complex multi-destination bookings, VIP customers, and travel experience design",
        "Proactive notifications keep customers informed before they need to call (flight delays, gate changes, weather alerts)",
        "Seamless omnichannel experience - start conversation on WhatsApp, continue on phone, complete in mobile app"
      ]
    },

    accordionSections: [
      {
        title: "From Reactive to Proactive Engagement",
        color: "green",
        description: "Shifting from answering calls when problems occur to reaching out before customers encounter issues.",
        points: [
          "Predictive analytics identify potential travel disruptions 24-48 hours in advance",
          "Automated rebooking suggestions sent via preferred customer channel",
          "Pre-departure checklists sent 7 days before travel (passport validity, visa requirements, insurance)",
          "Post-trip follow-up within 48 hours with feedback request and loyalty rewards",
          "Weather monitoring for destinations with proactive itinerary suggestions"
        ]
      },
      {
        title: "Personalised Intelligence in Action",
        color: "green",
        description: "Using customer data and AI to deliver tailored experiences that feel personal, not automated.",
        points: [
          "AI recognizes repeat customers and loads full booking history before agent answers",
          "Customer preferences stored (window seat, vegetarian meals, family-friendly hotels)",
          "Dynamic pricing shown based on loyalty tier and booking history",
          "Upsell recommendations based on previous trips (customer who booked Maldives sees Seychelles offers)",
          "Multilingual support auto-detected from customer profile"
        ]
      }
    ],

    journeyMapping: {
      title: "Customer Journey Transformation",
      imageUrl: null // Placeholder - will be uploaded after journey mapping workshop
    },

    primaryThemes: [
      {
        title: "AI-Powered Self-Service eliminates 70% of inbound call volume",
        badge: "AUTOMATION",
        weighting: "very high weighting"
      },
      {
        title: "Agent upskilling from call handlers to Travel Experience Advisors",
        badge: "PEOPLE",
        weighting: "high weighting"
      },
      {
        title: "Omnichannel integration (WhatsApp, Instagram, voice, app, email)",
        badge: "CHANNELS",
        weighting: "high weighting"
      },
      {
        title: "Proactive outreach replaces reactive complaint handling",
        badge: "SHIFT",
        weighting: "medium weighting"
      }
    ],

    shiftOne: {
      title: "A joined-up end to end journey",
      description: "Currently, customers experience fragmented touchpoints across website, call centre, email, and in-person. The future state delivers a unified journey where every interaction is connected.",
      details: [
        "Single customer ID across all channels",
        "Conversation history visible to all agents",
        "No need to repeat information when switching channels"
      ]
    },

    supportingThemes: [
      {
        title: "Peak season auto-scaling handles 300% traffic surge",
        badge: "CAPACITY",
        weighting: "high weighting"
      },
      {
        title: "Real-time AI co-pilot assists agents during calls",
        badge: "ENABLEMENT",
        weighting: "medium weighting"
      },
      {
        title: "Gamification drives agent engagement and retention",
        badge: "CULTURE",
        weighting: "medium weighting"
      },
      {
        title: "Video call capability for complex destination consultations",
        badge: "INNOVATION",
        weighting: "low weighting"
      }
    ],

    shiftTwo: {
      title: "Continuity over handovers",
      description: "Instead of multiple agents handling the same customer with repeated explanations, create continuity where the 'system' remembers and the customer feels recognized.",
      details: [
        "AI maintains context across sessions",
        "Preferred agent assignment for VIP customers",
        "Warm transfers with full context shared"
      ]
    },

    horizonVision: {
      title: "Horizon Vision Alignment",
      columns: [
        {
          title: "Horizon 1: Foundation (Months 1-6)",
          points: [
            "Deploy chatbot for top 10 routine queries (booking status, flight changes, seat selection)",
            "Implement WhatsApp Business API integration",
            "Launch AI co-pilot for agents with real-time knowledge suggestions",
            "Proactive flight delay notifications via SMS and email",
            "Single customer view dashboard for agents"
          ]
        },
        {
          title: "Horizon 2: Transformation (Months 6-18)",
          points: [
            "Voice AI for inbound calls with multi-accent training",
            "Agent upskilling program: Travel Advisor certification launched",
            "Visual journey builder for customers (drag-and-drop trip planning)",
            "Predictive analytics engine for proactive engagement",
            "Video consultation feature for luxury and complex bookings"
          ]
        }
      ]
    }
  },

  constraintsContent: {
    regulatory: [
      {
        title: "GDPR Data Protection",
        description: "Customer travel data (passports, payment details, health requirements) subject to strict GDPR compliance. AI systems must not retain sensitive data beyond necessary retention periods.",
        impact: "High",
        mitigation: "Implement data minimization in AI training; use tokenization for PII; automated deletion after 24 months"
      },
      {
        title: "PCI-DSS Compliance",
        description: "Payment card data must never be spoken or typed by agents. Current IVR system is compliant but chatbot needs certification.",
        impact: "Critical",
        mitigation: "Use third-party PCI-compliant payment gateway integrated with chatbot; never store card details"
      },
      {
        title: "ATOL & ABTA Regulations",
        description: "All booking confirmations must include ATOL/ABTA protection information. AI systems must not omit regulatory disclosures.",
        impact: "Critical",
        mitigation: "Hard-code regulatory disclaimers into all automated confirmations; quality assurance checks on AI outputs"
      }
    ],
    technical: [
      {
        title: "Legacy Booking System",
        description: "Core booking platform runs on 20-year-old Oracle system with no API. Requires screen-scraping integration or complete replacement.",
        impact: "Critical",
        mitigation: "Phase 1: Screen-scraping with RPA bots; Phase 2 (Year 2): Migrate to cloud-native booking platform"
      },
      {
        title: "Peak Season Scalability",
        description: "June-August traffic is 300% of baseline. Cloud infrastructure must auto-scale without quality degradation.",
        impact: "High",
        mitigation: "AWS auto-scaling groups; load testing to 500% capacity; CDN for static content"
      },
      {
        title: "Voice Quality",
        description: "Voice AI accuracy drops below 85% with accents (Scottish, Indian English, Australian). Unacceptable for customer-facing use.",
        impact: "High",
        mitigation: "Train voice models on diverse accent datasets; offer chat fallback; human handoff when confidence <90%"
      }
    ],
    commercial: [
      {
        title: "Union Negotiations",
        description: "Contact centre staff unionized. Any headcount reduction requires 90-day consultation and redundancy packages (£15K per person).",
        impact: "High",
        mitigation: "No forced redundancies - natural attrition (42% annual) + retraining program to upskill agents as Travel Advisors"
      },
      {
        title: "Budget Approval Cycle",
        description: "IT budget allocated in October for following fiscal year. Missed deadline means 12-month delay.",
        impact: "Medium",
        mitigation: "Fast-track business case for Q3 2026 approval; show ROI of £4.7M annual savings"
      }
    ],
    organizational: [
      {
        title: "Agent Fear of Automation",
        description: "68% of agents fear AI will eliminate their jobs. Low morale and resistance to change if not addressed.",
        impact: "Critical",
        mitigation: "Communicate clearly: AI handles boring work, humans do interesting work. Guarantee no forced redundancies. Showcase career progression."
      },
      {
        title: "Change Fatigue",
        description: "Contact centre went through 3 CRM migrations in 4 years. Staff skeptical of 'next big thing'.",
        impact: "High",
        mitigation: "Pilot with 10 volunteer agents for 3 months. Let them become advocates. Gradual rollout, not big-bang."
      }
    ]
  },

  commercialContent: {
    investmentSummary: {
      totalInvestment: "£2.3M",
      paybackPeriod: "11 months",
      fiveYearROI: "487%",
      annualSavings: "£4.7M by Year 2"
    },
    deliveryPhases: [
      {
        phase: "Phase 1: AI Foundation",
        duration: "Months 1-4",
        investment: "£680K",
        scope: [
          "Deploy AI chatbot for website & mobile app (handles booking status, flight changes, FAQs)",
          "Integrate with existing Oracle booking system via RPA screen-scraping",
          "Build customer self-service portal (view bookings, download tickets, manage preferences)",
          "Pilot with 1,000 customers; train chatbot on 500 most common queries"
        ],
        outcomes: [
          "30% reduction in inbound call volume for simple queries",
          "15,000 customers using self-service portal monthly",
          "Average handling time reduced from 12 mins to 10 mins (agents spend less time on simple queries)"
        ]
      },
      {
        phase: "Phase 2: Voice AI & Agent Assist",
        duration: "Months 5-9",
        investment: "£920K",
        scope: [
          "Deploy voice AI to handle inbound calls (IVR replacement)",
          "Real-time agent assist: AI whispers suggestions, surfaces customer history, recommends upsells",
          "Smart routing: AI detects customer intent and routes to specialist (complaints, luxury, groups)",
          "Full contact centre rollout: 85 agents trained on new tools"
        ],
        outcomes: [
          "60% of inbound calls handled end-to-end by voice AI (no human transfer)",
          "Agent productivity increases 40% (handle 28 calls/day vs 20 previously)",
          "Upsell conversion rate increases from 8% to 18% (AI suggests relevant add-ons)"
        ]
      },
      {
        phase: "Phase 3: Proactive Engagement",
        duration: "Months 10-18",
        investment: "£700K",
        scope: [
          "Proactive notifications: AI detects flight delays, cancellations, weather issues and reaches out before customer calls",
          "Omnichannel expansion: WhatsApp, Instagram DM, SMS support",
          "Predictive analytics: AI identifies customers likely to book (retargeting) or cancel (retention intervention)",
          "Agent career path: 20 agents upskilled to 'Travel Experience Designers' with higher pay"
        ],
        outcomes: [
          "70% of inbound calls automated; agents focus on consultative selling",
          "£8.7M in previously lost bookings recovered (reduced call abandonment)",
          "NPS increases from 34 to 62; agent retention improves from 58% to 78%"
        ]
      }
    ],
    riskAssessment: [
      {
        risk: "AI fails to understand complex customer queries, leading to poor experience",
        probability: "Medium",
        impact: "High",
        mitigation: "Always offer human handoff within 2 clicks; monitor AI accuracy weekly; continuous training"
      },
      {
        risk: "Agent resistance and union pushback delays implementation",
        probability: "Medium",
        impact: "High",
        mitigation: "Early engagement with union; pilot with volunteers; guarantee no forced redundancies; showcase career benefits"
      },
      {
        risk: "Peak season overload causes AI system failures",
        probability: "Low",
        impact: "Critical",
        mitigation: "Load test to 500% capacity; auto-scaling infrastructure; human fallback queue; staged rollout to avoid peak season launches"
      }
    ]
  },

  summaryContent: {
    keyFindings: [
      {
        category: "Customer Pain Points",
        findings: [
          "Customers wait average 18 minutes during normal season, 45+ minutes during peak - leading to 23% call abandonment (£8.7M lost bookings annually)",
          "80% of calls are simple queries that could be self-service: booking status, flight changes, email confirmations, refund status",
          "Customers expect omnichannel (WhatsApp, chat, social) but TravelWise only offers phone + email, losing younger demographics"
        ]
      },
      {
        category: "Agent Experience",
        findings: [
          "42% annual turnover driven by repetitive work - agents spend 80% of time on routine queries, only 20% on meaningful travel advising",
          "Agents juggle 6 disconnected systems (booking, CRM, email, phone, knowledge base, refunds), wasting 10 mins per call on screen-switching",
          "No clear career progression from Customer Service Agent to Travel Advisor/Specialist - talented agents leave for travel agencies or tour operators"
        ]
      },
      {
        category: "Business Opportunity",
        findings: [
          "£4.7M annual savings possible through automation (70% of 550K annual calls @ £8.50/call = £3.1M) + productivity gains (£1.6M)",
          "Upsell opportunity: agents currently convert 8% of calls to add-ons; best-in-class travel companies achieve 22% through AI-assisted selling",
          "Peak season capacity constraint solved: AI handles volume spikes without hiring seasonal staff (saving £890K/year in temp recruitment)"
        ]
      }
    ],
    recommendedNextSteps: [
      {
        step: "Secure Executive Buy-In & Budget",
        timeframe: "Week 1-3",
        owner: "Sarah Mitchell (Contact Centre Manager)",
        actions: [
          "Present business case to CFO and COO showing £4.7M annual savings and 11-month payback",
          "Secure £2.3M budget allocation for 18-month transformation program",
          "Appoint program director and form steering committee (Operations, IT, HR, Union rep)"
        ]
      },
      {
        step: "Union & Staff Engagement",
        timeframe: "Week 4-8",
        owner: "Tom Bradley (Operations Manager) + HR Director",
        actions: [
          "Present vision to union: 'AI handles boring work, humans do interesting work'",
          "Guarantee: No forced redundancies; natural attrition (42%) + retraining to Travel Advisors",
          "Recruit 10 volunteer agents for 3-month pilot program (early adopters become champions)"
        ]
      },
      {
        step: "Technology Vendor Selection",
        timeframe: "Month 3",
        owner: "IT Director",
        actions: [
          "RFP for AI chatbot + voice AI platform (shortlist: Google Dialogflow, AWS Lex, Microsoft Bot Framework)",
          "Select CRM integration partner for Oracle legacy system (RPA screen-scraping bridge)",
          "Negotiate contracts with auto-scaling cloud infrastructure (AWS/Azure)"
        ]
      },
      {
        step: "Phase 1 Pilot Launch",
        timeframe: "Month 4",
        owner: "Program Director",
        actions: [
          "Deploy AI chatbot on website for 1,000 pilot customers",
          "Train 10 volunteer agents on new agent-assist tools",
          "Begin 3-month pilot tracking KPIs: call volume reduction, customer satisfaction, agent productivity"
        ]
      }
    ],
    successMetrics: [
      {
        metric: "Call Volume Reduction",
        baseline: "550,000 calls/year",
        target: "165,000 calls/year (70% automated)",
        measurement: "Monthly call logs"
      },
      {
        metric: "Average Handling Time",
        baseline: "12 minutes per call",
        target: "4 minutes per complex call",
        measurement: "Call recording analytics"
      },
      {
        metric: "Customer Satisfaction (NPS)",
        baseline: "34 NPS",
        target: "62 NPS by Year 2",
        measurement: "Post-interaction surveys"
      },
      {
        metric: "Agent Retention Rate",
        baseline: "58% retention (42% turnover)",
        target: "78% retention by Year 2",
        measurement: "HR attrition reports"
      },
      {
        metric: "Cost per Contact",
        baseline: "£8.50 per call",
        target: "£3.20 per contact (blended AI + human)",
        measurement: "Financial reports"
      },
      {
        metric: "Upsell Conversion Rate",
        baseline: "8% of calls result in add-on sales",
        target: "18% by Year 2",
        measurement: "Booking system analytics"
      }
    ]
  }
};
