// Complete demo workshop data for Retail Store Transformation
// A UK high-street retailer exploring digital-first customer engagement

export const retailTransformationData = {
  workshopName: "RetailCo Digital Transformation Workshop",
  workshopDate: "February 2026",
  organization: "RetailCo UK",
  facilitator: "Upstream Works",

  execSummary: {
    title: "Executive Summary",
    overview: "A strategic workshop exploring how RetailCo can evolve from a legacy high-street retailer struggling with declining footfall into a digitally-enabled omnichannel brand that unifies in-store experience with online convenience. The workshop engaged 12 stakeholders across store operations, digital, supply chain, and customer experience who identified critical fractures between physical and digital channels and envisioned a unified commerce platform where the store becomes a showroom, fulfilment hub, and community space — not just a point of sale.",
    keyFindings: [
      {
        title: "Channel Fragmentation is Destroying Loyalty",
        description: "Online and in-store operate as separate businesses with different inventory, pricing, and loyalty systems. 34% of customers who buy online never visit stores, and 41% of in-store customers have never used the app. The two halves of the business compete rather than complement each other.",
        impact: "Critical"
      },
      {
        title: "Store Associates Are the Untapped Advantage",
        description: "Store staff have deep product knowledge and customer relationships but zero digital tools. They cannot check online stock, access customer purchase history, or process click-and-collect efficiently. Competitors like John Lewis and Zara equip associates with tablets and real-time data.",
        impact: "High"
      },
      {
        title: "Inventory Blindness Costs £14M Annually",
        description: "No single view of stock across 180 stores and 2 warehouses. 23% of online orders show 'out of stock' when the item exists in a nearby store. Returns processing takes 14 days vs industry best-practice of 3 days, locking up £14M in working capital.",
        impact: "Critical"
      },
      {
        title: "Personalisation Gap vs Digital-Native Competitors",
        description: "RetailCo sends the same promotions to all 2.8M loyalty members. ASOS, Amazon, and Shein deliver hyper-personalised recommendations that drive 35% of their revenue. RetailCo's email open rate is 12% vs industry average of 22%.",
        impact: "Transformational"
      },
      {
        title: "Store-as-Experience Hub Opportunity",
        description: "Workshops identified that stores generating the highest footfall growth (+8%) are those running community events, styling sessions, and click-and-collect. The future store is part showroom, part fulfilment centre, part community hub — driving 3x the revenue per square foot.",
        impact: "Transformational"
      }
    ],
    metrics: {
      participantsEngaged: 12,
      domainsExplored: 5,
      insightsGenerated: 156,
      transformationalIdeas: 24
    }
  },

  discoveryOutput: {
    participants: [
      { name: "Claire Hawkins", role: "Chief Customer Officer", yearsExperience: 15 },
      { name: "Raj Mehta", role: "Head of Digital", yearsExperience: 10 },
      { name: "Sophie Turner", role: "Regional Store Manager", yearsExperience: 12 },
      { name: "James O'Brien", role: "Supply Chain Director", yearsExperience: 14 },
      { name: "Fatima Al-Said", role: "Loyalty & CRM Manager", yearsExperience: 7 },
      { name: "Tom Whitfield", role: "Store Associate (Top Performer)", yearsExperience: 4 },
      { name: "Hannah Price", role: "eCommerce Manager", yearsExperience: 8 },
      { name: "David Okafor", role: "Head of Merchandising", yearsExperience: 11 },
      { name: "Emily Chen", role: "Customer Insights Analyst", yearsExperience: 5 },
      { name: "Marcus Williams", role: "IT Infrastructure Lead", yearsExperience: 9 },
      { name: "Sarah Blackwood", role: "Visual Merchandising Lead", yearsExperience: 6 },
      { name: "Peter Donaldson", role: "Finance Director", yearsExperience: 18 }
    ],
    totalUtterances: 312,
    sections: [
      {
        domain: "Customer Experience",
        icon: "🛍️",
        color: "blue",
        utteranceCount: 84,
        topThemes: ["Omnichannel", "Personalisation", "Loyalty", "Returns", "Discovery"],
        wordCloud: [
          { word: "Omnichannel", size: 4, frequency: 34 },
          { word: "Click & Collect", size: 3, frequency: 27 },
          { word: "Personalisation", size: 3, frequency: 25 },
          { word: "Returns", size: 3, frequency: 23 },
          { word: "Loyalty App", size: 2, frequency: 19 },
          { word: "In-store Experience", size: 2, frequency: 17 },
          { word: "Social Commerce", size: 2, frequency: 15 },
          { word: "Same-day Delivery", size: 2, frequency: 14 },
          { word: "Product Discovery", size: 1, frequency: 11 }
        ],
        quotes: [
          {
            text: "A customer walks in holding their phone showing a product from our website and asks if we have it. Our store team can't even look it up — they have to physically walk around the shop floor. It's embarrassing in 2026.",
            author: "Sophie Turner, Regional Store Manager",
            sentiment: "frustrated"
          },
          {
            text: "Our returns process is broken. Online returns to store take 14 days to credit. Customers return in-store, then buy the same item online because the store can't exchange for a different size from another branch. We're literally pushing people to competitors.",
            author: "Claire Hawkins, Chief Customer Officer",
            sentiment: "concerned"
          },
          {
            text: "We send 2.8 million people the same email every Tuesday. ASOS knows what I browsed last night and shows me those exact items when I open the app. We're bringing a knife to a gunfight on personalisation.",
            author: "Fatima Al-Said, Loyalty & CRM Manager",
            sentiment: "frustrated"
          },
          {
            text: "The stores running community events — Saturday styling sessions, kids' craft mornings, seasonal workshops — are seeing footfall up 8% while the rest decline 3%. The store of the future isn't a shop, it's a destination.",
            author: "Sarah Blackwood, Visual Merchandising Lead",
            sentiment: "optimistic"
          }
        ],
        sentiment: {
          optimistic: 42,
          neutral: 28,
          concerned: 30
        },
        consensusLevel: 91
      },
      {
        domain: "Operations & Supply Chain",
        icon: "📦",
        color: "purple",
        utteranceCount: 72,
        topThemes: ["Inventory visibility", "Ship-from-store", "Returns", "Fulfilment speed", "Demand forecasting"],
        wordCloud: [
          { word: "Unified Inventory", size: 4, frequency: 31 },
          { word: "Ship from Store", size: 3, frequency: 26 },
          { word: "Returns Processing", size: 3, frequency: 22 },
          { word: "Demand Forecasting", size: 2, frequency: 18 },
          { word: "Last Mile Delivery", size: 2, frequency: 16 },
          { word: "RFID Tracking", size: 2, frequency: 14 },
          { word: "Markdown Optimisation", size: 2, frequency: 13 },
          { word: "Warehouse Automation", size: 1, frequency: 10 }
        ],
        quotes: [
          {
            text: "We have 180 stores acting as 180 separate warehouses with no visibility between them. A customer in Manchester can't buy a jacket that's sitting in 3 Birmingham stores 90 miles away. That's £14M in lost sales annually.",
            author: "James O'Brien, Supply Chain Director",
            sentiment: "frustrated"
          },
          {
            text: "Ship-from-store could turn every branch into a mini fulfilment centre. Zara does this brilliantly — 60% of their online orders ship from the nearest store. Our network could offer same-day delivery to 78% of UK postcodes.",
            author: "Hannah Price, eCommerce Manager",
            sentiment: "optimistic"
          },
          {
            text: "We mark down £42M of stock annually because we can't move it between stores fast enough. AI-powered demand forecasting and automated transfers could cut that by 40%, saving £17M in margin erosion.",
            author: "David Okafor, Head of Merchandising",
            sentiment: "optimistic"
          },
          {
            text: "RFID would give us real-time stock accuracy of 98% vs our current 72%. Every major competitor has deployed it. We're making decisions on inventory data that's 3 days old.",
            author: "James O'Brien, Supply Chain Director",
            sentiment: "concerned"
          }
        ],
        sentiment: {
          optimistic: 48,
          neutral: 24,
          concerned: 28
        },
        consensusLevel: 88
      },
      {
        domain: "People & Culture",
        icon: "👥",
        color: "green",
        utteranceCount: 58,
        topThemes: ["Digital skills", "Associate empowerment", "Retention", "Role evolution", "Culture shift"],
        wordCloud: [
          { word: "Digital Upskilling", size: 4, frequency: 28 },
          { word: "Associate Tablets", size: 3, frequency: 24 },
          { word: "Career Progression", size: 3, frequency: 20 },
          { word: "Customer Advisor Role", size: 2, frequency: 17 },
          { word: "Retention", size: 2, frequency: 15 },
          { word: "Incentive Redesign", size: 2, frequency: 13 },
          { word: "Knowledge Sharing", size: 1, frequency: 10 },
          { word: "Community Champions", size: 2, frequency: 14 }
        ],
        quotes: [
          {
            text: "I know our products inside out — I can tell you the fabric weight, the fit difference between our slim and regular, which colours sell best. But I have zero tools to help me. Give me a tablet with customer history and stock data and I'll double my conversion rate.",
            author: "Tom Whitfield, Store Associate (Top Performer)",
            sentiment: "optimistic"
          },
          {
            text: "We lose our best people to Zara and John Lewis because they offer better tools and training. Our associates feel like checkout operators, not retail professionals. The role needs to evolve from 'till monkey' to 'customer advisor'.",
            author: "Sophie Turner, Regional Store Manager",
            sentiment: "concerned"
          },
          {
            text: "Store associates earn commission on in-store sales only. If they help a customer who later buys online, they get nothing. The incentive structure actively discourages omnichannel behaviour.",
            author: "Claire Hawkins, Chief Customer Officer",
            sentiment: "frustrated"
          },
          {
            text: "The stores with the best performance are the ones where associates run Instagram content and styling sessions. We should be hiring for personality and product passion, then giving them the tech to amplify it.",
            author: "Sarah Blackwood, Visual Merchandising Lead",
            sentiment: "optimistic"
          }
        ],
        sentiment: {
          optimistic: 45,
          neutral: 30,
          concerned: 25
        },
        consensusLevel: 85
      },
      {
        domain: "Technology",
        icon: "💻",
        color: "orange",
        utteranceCount: 56,
        topThemes: ["Unified commerce platform", "Data integration", "Mobile-first", "AI/ML", "Legacy modernisation"],
        wordCloud: [
          { word: "Unified Commerce", size: 4, frequency: 30 },
          { word: "API Integration", size: 3, frequency: 22 },
          { word: "Real-time Data", size: 3, frequency: 20 },
          { word: "Mobile POS", size: 2, frequency: 17 },
          { word: "AI Recommendations", size: 2, frequency: 15 },
          { word: "Cloud Migration", size: 2, frequency: 14 },
          { word: "Legacy ERP", size: 2, frequency: 16 },
          { word: "Customer Data Platform", size: 2, frequency: 13 }
        ],
        quotes: [
          {
            text: "We run SAP for finance, Magento for eCommerce, a custom POS from 2014, and spreadsheets for stock transfers. Nothing talks to anything else. We need one platform, not four silos glued together with hope.",
            author: "Marcus Williams, IT Infrastructure Lead",
            sentiment: "frustrated"
          },
          {
            text: "A Customer Data Platform would let us finally unify the 2.8M loyalty members with online browsing data and in-store purchase history. Right now, online and offline are different people in our systems.",
            author: "Emily Chen, Customer Insights Analyst",
            sentiment: "optimistic"
          },
          {
            text: "Our tech debt is crippling. Every new feature takes 6 months because we're working around a POS system that hasn't been updated since 2017. Competitors deploy weekly. We deploy quarterly if we're lucky.",
            author: "Raj Mehta, Head of Digital",
            sentiment: "concerned"
          },
          {
            text: "Mobile POS would transform the in-store experience. Associates could check out customers anywhere on the floor, check stock at other locations, and pull up purchase history — all from a tablet. No more queuing at tills.",
            author: "Tom Whitfield, Store Associate (Top Performer)",
            sentiment: "optimistic"
          }
        ],
        sentiment: {
          optimistic: 55,
          neutral: 22,
          concerned: 23
        },
        consensusLevel: 83
      },
      {
        domain: "Regulation & Compliance",
        icon: "📋",
        color: "indigo",
        utteranceCount: 42,
        topThemes: ["Data privacy", "Consumer rights", "Sustainability", "Accessibility", "Product safety"],
        wordCloud: [
          { word: "GDPR", size: 3, frequency: 22 },
          { word: "Consumer Rights Act", size: 3, frequency: 18 },
          { word: "Sustainability Reporting", size: 2, frequency: 15 },
          { word: "Accessibility Standards", size: 2, frequency: 14 },
          { word: "Product Labelling", size: 2, frequency: 12 },
          { word: "Payment Security", size: 2, frequency: 13 },
          { word: "Modern Slavery Act", size: 1, frequency: 9 },
          { word: "ESG Compliance", size: 2, frequency: 11 }
        ],
        quotes: [
          {
            text: "Unifying customer data across channels means combining consent from different touchpoints. GDPR requires explicit consent for each purpose. We can't just merge online and in-store profiles without proper legal basis.",
            author: "Emily Chen, Customer Insights Analyst",
            sentiment: "concerned"
          },
          {
            text: "The new CSRD sustainability reporting requirements mean we need full supply chain traceability by 2027. Our current systems can't even tell us where 40% of our products are manufactured.",
            author: "James O'Brien, Supply Chain Director",
            sentiment: "concerned"
          },
          {
            text: "Our website accessibility score is 62/100. The Equality Act requires reasonable adjustments. If we're going digital-first, the digital experience must be accessible to everyone — that's not optional.",
            author: "Raj Mehta, Head of Digital",
            sentiment: "concerned"
          },
          {
            text: "Consumer Rights Act gives customers 30-day return rights. Our 14-day processing time is a brand disaster waiting to happen. Customers post on social media about waiting 3 weeks for a refund.",
            author: "Claire Hawkins, Chief Customer Officer",
            sentiment: "frustrated"
          }
        ],
        sentiment: {
          optimistic: 25,
          neutral: 35,
          concerned: 40
        },
        consensusLevel: 79
      }
    ],
    overallConsensus: 85
  },

  reimagineContent: {
    title: "The Connected Retail Experience",
    description: "The Reimagine session focused on defining what RetailCo looks like when digital and physical become one seamless experience — where the store is a destination, not just a distribution point.",
    subtitle: "The workshop explored how RetailCo can transform from a traditional high-street chain into a digitally-enabled experience brand where every touchpoint — app, web, store, social — delivers a unified, personalised customer journey.",

    supportingSection: {
      title: "From Transactions to Relationships",
      description: "Moving from a product-push retail model to a relationship-driven experience where every interaction deepens customer understanding and loyalty.",
      points: [
        "Unified customer profile across all channels — associates see full purchase history, preferences, and browsing behaviour on their tablets",
        "AI-powered personalisation drives 35% of revenue through relevant recommendations across web, app, email, and in-store screens",
        "Store associates evolve from checkout operators to customer advisors with real-time data, commission on omnichannel sales, and styling expertise",
        "Stores become community hubs: styling sessions, product launches, sustainability workshops, and click-and-collect drive footfall and brand loyalty"
      ]
    },

    accordionSections: [
      {
        title: "From Channels to a Single Experience",
        color: "green",
        description: "Eliminating the divide between online and in-store so customers experience one brand, one inventory, one loyalty programme.",
        points: [
          "Start browsing on phone, try on in store, buy online — with persistent basket and preferences across all touchpoints",
          "Ship-from-store turns 180 locations into fulfilment centres, enabling same-day delivery to 78% of UK postcodes",
          "Returns accepted anywhere, refunded instantly — online purchases returned in-store get immediate credit",
          "In-store kiosks show full online range including sizes and colours not stocked locally, with home delivery from store",
          "Social commerce integration: shop directly from Instagram and TikTok content created by store associates"
        ]
      },
      {
        title: "Data-Driven Decisions at Every Level",
        color: "green",
        description: "Using real-time data to drive merchandising, staffing, and customer engagement decisions — replacing gut feel with intelligence.",
        points: [
          "RFID-enabled real-time stock visibility across all 180 stores and 2 warehouses — 98% accuracy vs current 72%",
          "AI demand forecasting predicts store-level demand 8 weeks ahead, reducing markdowns by 40% (£17M annually)",
          "Heat mapping and footfall analytics optimise store layouts and staffing in real-time",
          "Customer Data Platform unifies 2.8M loyalty profiles with online behaviour for true personalisation",
          "Automated stock transfers between stores based on sell-through rates, eliminating manual spreadsheet management"
        ]
      }
    ],

    journeyMapping: {
      title: "Customer Journey Transformation",
      imageUrl: null
    },

    primaryThemes: [
      {
        title: "Unified commerce platform replaces siloed channels",
        badge: "PLATFORM",
        weighting: "very high weighting",
        description: "Replace 4 disconnected systems (SAP, Magento, custom POS, spreadsheets) with a single unified commerce platform that provides one view of inventory, customers, and orders across all channels.",
        details: [
          "Single stock pool visible to all channels — no more 'out of stock online, available in store' frustration",
          "One customer profile across loyalty, web, app, and in-store POS",
          "Real-time order management handles click-and-collect, ship-from-store, and returns seamlessly",
          "Associates see full customer context on mobile tablets during in-store interactions"
        ]
      },
      {
        title: "Store associates become omnichannel customer advisors",
        badge: "PEOPLE",
        weighting: "high weighting",
        description: "Transform the store associate role with mobile tools, training, and incentives that reward omnichannel engagement rather than just till transactions.",
        details: [
          "Mobile POS tablets with customer history, stock lookup, and clienteling features",
          "Commission structure rewards all sales influenced by the associate, regardless of channel",
          "Structured training: product expertise, styling, digital tools, and customer engagement",
          "Career path from Associate to Customer Advisor to Store Experience Manager"
        ]
      },
      {
        title: "AI-powered personalisation drives relevance and revenue",
        badge: "DATA",
        weighting: "high weighting",
        description: "Deploy a Customer Data Platform and AI recommendation engine to deliver hyper-personalised experiences across email, app, web, and in-store screens — targeting 35% of revenue from personalised recommendations.",
        details: [
          "Customer Data Platform unifies loyalty, browsing, purchase, and in-store behaviour data",
          "AI recommendations in email, app, and website based on individual style preferences and purchase history",
          "In-store digital screens show personalised suggestions when loyalty app detected nearby",
          "Triggered campaigns: browse abandonment, restock reminders, seasonal wardrobe suggestions"
        ]
      },
      {
        title: "Ship-from-store and unified inventory unlock £14M",
        badge: "SUPPLY CHAIN",
        weighting: "high weighting",
        description: "Enable every store to fulfil online orders and provide real-time cross-network inventory visibility using RFID, unlocking £14M in currently lost sales and reducing markdowns by £17M.",
        details: [
          "RFID deployment across all 180 stores for 98% stock accuracy",
          "Ship-from-store capability serving 78% of UK postcodes for same-day delivery",
          "Automated inter-store transfers based on AI demand signals",
          "Unified returns processing: refund in 24 hours regardless of purchase channel"
        ]
      }
    ],

    shiftOne: {
      title: "From product push to customer pull",
      description: "Currently, RetailCo buys stock centrally and pushes it to stores hoping customers want it. The future state uses demand signals from browse data, social trends, and local events to pull the right products to the right locations.",
      details: [
        "Demand sensing from web browse patterns, social media trends, and local event calendars",
        "Store-specific ranging based on local demographics and purchase patterns",
        "Test-and-learn capability: small runs, fast feedback, scale winners"
      ]
    },

    supportingThemes: [
      {
        title: "Stores as experience and community hubs drive footfall",
        badge: "EXPERIENCE",
        weighting: "high weighting",
        description: "Transform underperforming floor space into experience zones that drive footfall, brand affinity, and social media content — from styling sessions to sustainability workshops.",
        details: [
          "Saturday styling sessions and seasonal lookbook events",
          "Community workshops (e.g., clothing repair cafes, sustainable fashion talks)",
          "Content creation corners for customer and associate social media",
          "Flexible fixtures allow rapid layout changes for events and pop-ups"
        ]
      },
      {
        title: "Sustainability as brand differentiator and compliance driver",
        badge: "ESG",
        weighting: "medium weighting",
        description: "Build full supply chain traceability ahead of 2027 CSRD requirements while using sustainability credentials as a competitive differentiator with increasingly conscious consumers.",
        details: [
          "Product provenance tracking from raw material to store shelf",
          "Carbon footprint labelling on product pages and in-store tags",
          "Circular fashion programme: repair, resale, and recycling partnerships"
        ]
      },
      {
        title: "Social commerce bridges digital engagement and store visits",
        badge: "CHANNELS",
        weighting: "medium weighting",
        description: "Enable store associates to create shoppable social content that drives both online sales and store visits, turning every associate into a micro-influencer for local audiences.",
        details: [
          "Associate-created TikTok and Instagram content with product tagging",
          "Shop-the-look features linking social posts to product pages",
          "Local events promoted through geo-targeted social campaigns"
        ]
      }
    ],

    shiftTwo: {
      title: "From store-centric to customer-centric measurement",
      description: "Stop measuring stores purely on in-store revenue. Measure the total customer value influenced by each store — including online sales to customers who visited, click-and-collect volume, and community engagement.",
      details: [
        "Omnichannel attribution: stores credited for online sales they influenced",
        "Customer Lifetime Value becomes the primary store-level KPI",
        "Footfall-to-engagement ratio replaces footfall-to-sale as the leading indicator"
      ]
    },

    horizonVision: {
      title: "Horizon Vision Alignment",
      columns: [
        {
          title: "Horizon 1: Foundation (Months 1-6)",
          points: [
            "Deploy RFID across top 40 stores for real-time stock accuracy",
            "Launch mobile POS tablets for 200 top-performing associates",
            "Implement Customer Data Platform to unify loyalty + online profiles",
            "Pilot ship-from-store in 20 locations for same-day delivery",
            "Redesign associate commission to include omnichannel sales attribution"
          ]
        },
        {
          title: "Horizon 2: Transformation (Months 6-18)",
          points: [
            "Roll out unified commerce platform across all 180 stores",
            "Launch AI personalisation engine for email, app, and in-store screens",
            "Full ship-from-store capability across entire network",
            "Transform 30 stores into experience hub format with community spaces",
            "Social commerce integration with associate content creation programme"
          ]
        }
      ]
    }
  },

  constraintsContent: {
    regulatory: [
      {
        title: "GDPR & Customer Data Unification",
        description: "Merging online and in-store customer profiles requires valid legal basis under GDPR. Different consent was obtained at different touchpoints, and retrospective unification without fresh consent risks ICO enforcement action.",
        impact: "Critical",
        mitigation: "Progressive consent campaign through loyalty app re-enrolment; privacy-by-design architecture for CDP; legal review of legitimate interest basis for analytics"
      },
      {
        title: "CSRD Sustainability Reporting (2027 Deadline)",
        description: "EU Corporate Sustainability Reporting Directive requires full supply chain environmental and social impact disclosure. Current systems cannot trace 40% of product origins.",
        impact: "High",
        mitigation: "Prioritise traceability for top 100 SKUs (70% of revenue); partner with supply chain transparency platform; phase full compliance over 18 months"
      },
      {
        title: "Consumer Rights Act - Returns Processing",
        description: "14-day return processing time risks breaching 30-day statutory right to refund. Customer complaints about refund delays are escalating on social media and with Trading Standards.",
        impact: "High",
        mitigation: "Unified returns system with instant credit on receipt of goods; automated refund processing within 24 hours; interim: extend voluntary return window to 45 days"
      }
    ],
    technical: [
      {
        title: "Legacy POS System (2014 Vintage)",
        description: "Custom POS system hasn't been updated since 2017. No API layer, no mobile capability, no integration with eCommerce. Every enhancement requires custom development costing £200K+.",
        impact: "Critical",
        mitigation: "Phase 1: API wrapper layer for POS integration; Phase 2: migrate to cloud-native POS (Shopify POS or Adyen) over 12 months; no big-bang replacement"
      },
      {
        title: "Data Integration Across 4 Platforms",
        description: "SAP (finance), Magento (eCommerce), custom POS, and Excel-based stock management create data inconsistencies. Real-time synchronisation is impossible with current architecture.",
        impact: "Critical",
        mitigation: "Event-driven integration layer (Kafka/RabbitMQ) as middleware; incremental data migration; unified commerce platform replaces 3 of 4 systems by Month 12"
      },
      {
        title: "RFID Infrastructure Deployment",
        description: "Rolling out RFID across 180 stores requires hardware installation, SKU tagging at source, and associate training. Full deployment is a 12-month programme.",
        impact: "Medium",
        mitigation: "Phase 1: Top 40 stores (60% of revenue) in 6 months; mandate RFID tagging at supplier level; parallel training programme"
      }
    ],
    commercial: [
      {
        title: "£8.2M Capital Investment Required",
        description: "Board appetite for capital expenditure is constrained after 2 years of declining margins. The CFO requires payback within 18 months for approval.",
        impact: "High",
        mitigation: "Phased investment: £2.8M in Year 1 with measurable ROI gates before Phase 2 release; demonstrate quick wins (ship-from-store, RFID) that pay back in 8 months"
      },
      {
        title: "Margin Pressure from Online Competitors",
        description: "Online-only retailers operate at 15-20% lower cost base. Price-matching erodes margins further. The transformation must reduce cost-to-serve while increasing customer value.",
        impact: "High",
        mitigation: "Focus on experience differentiation rather than price competition; drive premium through personalisation and in-store service; reduce cost-to-serve through automation"
      }
    ],
    organizational: [
      {
        title: "Online vs Store Channel Rivalry",
        description: "Digital and store teams operate with separate P&Ls, targets, and incentives. Store managers perceive online as cannibalising their sales. Digital team sees stores as cost centres.",
        impact: "Critical",
        mitigation: "Unified P&L under Chief Customer Officer; omnichannel attribution model; shared incentives; joint planning sessions; CEO mandate on 'one brand, one team'"
      },
      {
        title: "Digital Skills Gap in Store Teams",
        description: "Average store associate age is 34, with limited digital tool experience. 45% have never used a tablet for work. Training programme required before tool deployment.",
        impact: "High",
        mitigation: "2-week digital bootcamp per store; buddy system pairing digital-native and experienced associates; gamified learning app; ongoing support from digital champions"
      },
      {
        title: "Change Fatigue from Previous Failed Initiatives",
        description: "Two previous digital transformation attempts (2019 app launch, 2021 CRM project) were abandoned mid-implementation. Staff are sceptical about 'another transformation'.",
        impact: "High",
        mitigation: "Start with visible quick wins (tablets, ship-from-store) that associates experience directly; weekly progress communications; avoid using the word 'transformation' internally"
      }
    ]
  },

  potentialSolution: {
    overview: "The proposed solution centres on a Unified Commerce Platform that collapses the artificial divide between online and in-store into a single, customer-centric operating model. Rather than treating stores and digital as separate channels, the platform enables every touchpoint to access the same inventory, customer data, and order management capabilities. Combined with RFID-powered stock visibility, mobile-enabled store associates, and AI-driven personalisation, this creates a retail experience that leverages RetailCo's physical network as an advantage over pure-play competitors.",
    enablers: [
      {
        title: "Unified Commerce Platform",
        domain: "Technology",
        priority: "HIGH",
        description: "Single platform replacing Magento, custom POS, and stock management spreadsheets. Provides one view of inventory, customers, and orders across all channels.",
        dependencies: ["API wrapper for SAP finance integration", "Data migration from 3 legacy systems"]
      },
      {
        title: "Customer Data Platform (CDP)",
        domain: "Data",
        priority: "HIGH",
        description: "Unifies 2.8M loyalty profiles with online browsing and in-store transaction data. Enables AI personalisation and omnichannel customer recognition.",
        dependencies: ["GDPR consent re-capture", "Loyalty app redesign"]
      },
      {
        title: "RFID Stock Visibility",
        domain: "Operations",
        priority: "HIGH",
        description: "Real-time inventory accuracy of 98% across all stores. Enables ship-from-store, cross-store availability checks, and automated replenishment.",
        dependencies: ["Supplier RFID tagging mandate", "In-store hardware installation"]
      },
      {
        title: "Mobile POS & Associate Tablets",
        domain: "People",
        priority: "HIGH",
        description: "Equips store associates with tablets for clienteling, stock lookup, mobile checkout, and customer history. Eliminates the fixed till as the only point of sale.",
        dependencies: ["In-store WiFi upgrade", "Associate training programme"]
      },
      {
        title: "Ship-from-Store Capability",
        domain: "Supply Chain",
        priority: "HIGH",
        description: "Enables any store to fulfil online orders, turning 180 locations into last-mile fulfilment centres. Same-day delivery to 78% of UK postcodes.",
        dependencies: ["RFID deployment", "Store pick-pack process design", "Carrier integration"]
      },
      {
        title: "AI Recommendation Engine",
        domain: "Data",
        priority: "MEDIUM",
        description: "Personalised product recommendations across email, app, web, and in-store screens. Target: 35% of online revenue from AI-driven suggestions.",
        dependencies: ["CDP data feeds", "6-month learning period for model accuracy"]
      },
      {
        title: "Omnichannel Attribution Model",
        domain: "Commercial",
        priority: "MEDIUM",
        description: "Measures total customer value influenced by each touchpoint. Replaces store-only P&L with customer-centric measurement that credits omnichannel influence.",
        dependencies: ["CDP implementation", "Finance system updates", "Change management"]
      }
    ],
    implementationPath: [
      {
        phase: "Phase 1: Quick Wins & Foundation",
        timeframe: "Months 1-6",
        actions: [
          "Deploy RFID in top 40 stores (60% of revenue)",
          "Launch mobile POS tablets for 200 top associates",
          "Implement Customer Data Platform with loyalty app re-enrolment",
          "Pilot ship-from-store in 20 urban locations",
          "Redesign associate commission for omnichannel attribution",
          "Install API integration layer for legacy system connectivity"
        ],
        outcomes: [
          "Stock accuracy improves from 72% to 95% in RFID stores",
          "Click-and-collect processing time reduced from 4 hours to 30 minutes",
          "Associate-influenced online sales trackable for the first time",
          "Same-day delivery available in 12 city centres"
        ]
      },
      {
        phase: "Phase 2: Platform & Scale",
        timeframe: "Months 7-12",
        actions: [
          "Migrate to unified commerce platform (replace Magento + POS)",
          "Roll out RFID to remaining 140 stores",
          "Full ship-from-store across entire network",
          "Launch AI personalisation engine for email and app",
          "Transform 15 stores into experience hub format",
          "Deploy in-store digital screens with personalised content"
        ],
        outcomes: [
          "Single view of inventory across all 180 stores and 2 warehouses",
          "Online 'out of stock' rate drops from 23% to 5%",
          "Email open rates increase from 12% to 22% through personalisation",
          "Experience hub stores show 15% footfall growth"
        ]
      },
      {
        phase: "Phase 3: Intelligence & Experience",
        timeframe: "Months 13-18",
        actions: [
          "Full AI demand forecasting for store-level ranging and markdown optimisation",
          "Social commerce integration (shoppable Instagram/TikTok content)",
          "Associate content creation programme (micro-influencer training)",
          "Sustainability traceability for top 100 SKUs",
          "Advanced clienteling: AI-powered next-best-action for associates"
        ],
        outcomes: [
          "Markdowns reduced by 40% (£17M saving)",
          "Social commerce drives 8% of online revenue",
          "Full CSRD compliance for sustainability reporting",
          "Customer Lifetime Value increases 25% for omnichannel customers"
        ]
      }
    ]
  },

  customerJourney: {
    stages: ["Discovery", "Browsing", "Try / Compare", "Purchase", "Fulfilment", "Post-Purchase"],
    actors: [
      { name: "Online Shopper", role: "Customer who primarily shops via web/app" },
      { name: "In-Store Customer", role: "Customer who prefers physical store experience" },
      { name: "Store Associate", role: "Front-line retail staff with product expertise" },
      { name: "Omnichannel Customer", role: "Customer who uses both online and in-store" },
      { name: "Loyalty Member", role: "Engaged customer with loyalty programme membership" }
    ],
    interactions: [
      { actor: "Online Shopper", stage: "Discovery", action: "Sees personalised recommendations in app", sentiment: "positive", context: "AI engine serves relevant products based on browsing history", isPainPoint: false, isMomentOfTruth: false },
      { actor: "Online Shopper", stage: "Browsing", action: "Cannot see in-store stock availability", sentiment: "concerned", context: "Website shows 'out of stock' while item sits in 3 nearby stores", isPainPoint: true, isMomentOfTruth: false },
      { actor: "Online Shopper", stage: "Purchase", action: "Chooses click-and-collect for same-day", sentiment: "positive", context: "Ship-from-store enables 2-hour collection at nearest branch", isPainPoint: false, isMomentOfTruth: true },
      { actor: "Online Shopper", stage: "Post-Purchase", action: "Waits 14 days for online return refund", sentiment: "critical", context: "Returns processing backlog causes customer frustration and social media complaints", isPainPoint: true, isMomentOfTruth: false },
      { actor: "In-Store Customer", stage: "Discovery", action: "Walks into store attracted by window display", sentiment: "positive", context: "Visual merchandising drives initial footfall", isPainPoint: false, isMomentOfTruth: false },
      { actor: "In-Store Customer", stage: "Browsing", action: "Asks associate for size not on shelf", sentiment: "concerned", context: "Associate cannot check other stores or online stock without leaving customer", isPainPoint: true, isMomentOfTruth: false },
      { actor: "In-Store Customer", stage: "Try / Compare", action: "Tries on items in fitting room", sentiment: "positive", context: "Physical try-on experience is RetailCo's key advantage over online-only competitors", isPainPoint: false, isMomentOfTruth: true },
      { actor: "In-Store Customer", stage: "Purchase", action: "Queues at fixed till point", sentiment: "concerned", context: "3-5 minute queue during busy periods when mobile POS could eliminate waiting", isPainPoint: true, isMomentOfTruth: false },
      { actor: "Store Associate", stage: "Discovery", action: "Greets regular customer but has no history", sentiment: "neutral", context: "No access to purchase history or preferences — treats loyal customer as stranger", isPainPoint: true, isMomentOfTruth: false },
      { actor: "Store Associate", stage: "Browsing", action: "Helps customer find products using personal knowledge", sentiment: "positive", context: "Deep product expertise is the associate's superpower — needs data to amplify it", isPainPoint: false, isMomentOfTruth: false },
      { actor: "Store Associate", stage: "Try / Compare", action: "Provides styling advice and cross-sell suggestions", sentiment: "positive", context: "This is where associates add most value — personalised advice competitors can't replicate", isPainPoint: false, isMomentOfTruth: true },
      { actor: "Store Associate", stage: "Post-Purchase", action: "Gets no credit for customer who buys online later", sentiment: "critical", context: "Commission only on till transactions — actively discourages omnichannel behaviour", isPainPoint: true, isMomentOfTruth: false },
      { actor: "Omnichannel Customer", stage: "Discovery", action: "Browses on phone then visits store to try on", sentiment: "positive", context: "Sees outfit online, checks store stock on app, visits to try before buying", isPainPoint: false, isMomentOfTruth: false },
      { actor: "Omnichannel Customer", stage: "Browsing", action: "Basket doesn't sync between app and store", sentiment: "concerned", context: "Items saved in online basket not visible to store associate — customer must re-explain", isPainPoint: true, isMomentOfTruth: false },
      { actor: "Omnichannel Customer", stage: "Purchase", action: "Buys in-store but loyalty points split between systems", sentiment: "concerned", context: "Online and in-store loyalty balances are separate — customer sees different points totals", isPainPoint: true, isMomentOfTruth: false },
      { actor: "Omnichannel Customer", stage: "Fulfilment", action: "Returns online purchase in-store for instant exchange", sentiment: "positive", context: "Future state: instant credit and exchange from unified system", isPainPoint: false, isMomentOfTruth: true },
      { actor: "Loyalty Member", stage: "Discovery", action: "Receives generic promotional email", sentiment: "neutral", context: "Same email sent to 2.8M members — no personalisation based on purchase history", isPainPoint: true, isMomentOfTruth: false },
      { actor: "Loyalty Member", stage: "Purchase", action: "Scans loyalty card but associate can't see history", sentiment: "concerned", context: "Loyalty data not surfaced to associate tablet — missed opportunity for personalised service", isPainPoint: true, isMomentOfTruth: false },
      { actor: "Loyalty Member", stage: "Post-Purchase", action: "Receives personalised follow-up with styling suggestions", sentiment: "positive", context: "Future state: AI sends relevant recommendations based on purchase + browse data", isPainPoint: false, isMomentOfTruth: false }
    ],
    painPointSummary: "Pain points cluster around three core failures: (1) inventory blindness — customers and associates cannot see stock across channels, leading to lost sales and frustration; (2) system fragmentation — loyalty, basket, and purchase history don't sync between online and in-store, forcing customers to repeat themselves; and (3) broken incentives — associates are not rewarded for omnichannel influence, creating active resistance to digital engagement.",
    momentOfTruthSummary: "The critical moments of truth centre on the in-store try-on experience and the click-and-collect handover — the two touchpoints where RetailCo's physical presence creates genuine competitive advantage over pure-play online retailers. The fitting room and the associate's styling advice are irreplaceable. The risk is that system friction before and after these moments erodes the goodwill they generate."
  },

  commercialContent: {
    investmentSummary: {
      totalInvestment: "£8.2M",
      paybackPeriod: "14 months",
      fiveYearROI: "520%",
      annualSavings: "£31M by Year 3"
    },
    deliveryPhases: [
      {
        phase: "Phase 1: Foundation & Quick Wins",
        duration: "Months 1-6",
        investment: "£2.8M",
        scope: [
          "RFID deployment in top 40 stores (hardware, tagging, training)",
          "Mobile POS tablets for 200 associates with clienteling software",
          "Customer Data Platform implementation with loyalty re-enrolment",
          "Ship-from-store pilot in 20 urban locations",
          "API integration layer connecting legacy POS to new platform"
        ],
        outcomes: [
          "£4.2M recovered from ship-from-store reducing 'out of stock' lost sales",
          "Click-and-collect processing reduced from 4 hours to 30 minutes",
          "15% increase in associate-influenced sales in tablet-enabled stores"
        ]
      },
      {
        phase: "Phase 2: Platform Transformation",
        duration: "Months 7-12",
        investment: "£3.4M",
        scope: [
          "Unified commerce platform deployment (replacing Magento + legacy POS)",
          "Full RFID rollout to remaining 140 stores",
          "AI personalisation engine for email, app, and in-store screens",
          "15 stores converted to experience hub format",
          "Omnichannel attribution model implementation"
        ],
        outcomes: [
          "£14M unlocked from unified inventory visibility across all locations",
          "Email engagement up from 12% to 22% open rate through personalisation",
          "Experience hub stores deliver 15% footfall growth vs control group"
        ]
      },
      {
        phase: "Phase 3: Intelligence & Scale",
        duration: "Months 13-18",
        investment: "£2.0M",
        scope: [
          "AI demand forecasting and automated markdown optimisation",
          "Social commerce integration (Instagram, TikTok)",
          "Full sustainability traceability for CSRD compliance",
          "Advanced clienteling and next-best-action for all associates",
          "30 additional experience hub store conversions"
        ],
        outcomes: [
          "£17M saved from 40% markdown reduction through AI forecasting",
          "Social commerce contributes 8% of online revenue",
          "Full CSRD sustainability reporting compliance achieved"
        ]
      }
    ],
    riskAssessment: [
      {
        risk: "Legacy POS migration causes store disruption during peak trading",
        probability: "Medium",
        impact: "Critical",
        mitigation: "Phase migration outside peak trading windows (avoid Nov-Jan); parallel running for 4 weeks; rollback capability; 24/7 support during cutover"
      },
      {
        risk: "Store associate adoption of digital tools is slower than planned",
        probability: "Medium",
        impact: "High",
        mitigation: "Start with volunteer early adopters; gamified training app; peer champions; commission benefit visible within first month; dedicated in-store support for 8 weeks"
      },
      {
        risk: "CDP data quality issues delay personalisation accuracy",
        probability: "High",
        impact: "Medium",
        mitigation: "6-month learning period for AI model; manual curation of initial segments; progressive data enrichment; A/B testing before full rollout"
      },
      {
        risk: "RFID supplier mandating causes pushback from smaller suppliers",
        probability: "Medium",
        impact: "Medium",
        mitigation: "Phase mandate starting with top 20 suppliers (80% of volume); offer tagging subsidies for SME suppliers; 12-month transition period; alternative barcode bridge for exceptions"
      }
    ]
  },

  summaryContent: {
    keyFindings: [
      {
        category: "Customer Experience",
        findings: [
          "Channel fragmentation is the single biggest barrier to customer loyalty — online and in-store operate as separate businesses with different inventory, pricing, and loyalty systems",
          "34% of online customers never visit stores and 41% of in-store customers have never used the app — RetailCo is serving two separate customer bases instead of one unified audience",
          "Returns processing (14-day refund cycle) is generating escalating social media complaints and Trading Standards attention, creating brand risk",
          "Stores running community events and experience formats show 8% footfall growth vs 3% decline in traditional format — the future store is a destination, not just a shop"
        ]
      },
      {
        category: "Operations & Supply Chain",
        findings: [
          "Inventory blindness across 180 stores costs £14M annually in lost online sales where stock exists in nearby physical locations",
          "£42M in annual markdowns driven by inability to redistribute stock between stores — AI demand forecasting could save £17M",
          "Ship-from-store capability would enable same-day delivery to 78% of UK postcodes using existing store network as fulfilment centres",
          "RFID deployment would improve stock accuracy from 72% to 98%, enabling real-time inventory decisions that are currently based on 3-day-old data"
        ]
      },
      {
        category: "People & Technology",
        findings: [
          "Store associates are the untapped competitive advantage — deep product knowledge and customer relationships but zero digital tools to amplify their impact",
          "Commission structures actively discourage omnichannel behaviour: associates get nothing for sales they influence that complete online",
          "4 disconnected tech systems (SAP, Magento, custom POS, spreadsheets) create a 6-month feature deployment cycle vs competitors' weekly releases",
          "Digital skills gap: 45% of associates have never used a tablet for work — training and change management are prerequisites for any tech deployment"
        ]
      }
    ],
    recommendedNextSteps: [
      {
        step: "Board Business Case & Budget Approval",
        timeframe: "Weeks 1-4",
        owner: "Claire Hawkins, Chief Customer Officer",
        actions: [
          "Present £8.2M investment case to Board showing 14-month payback and £31M annual value by Year 3",
          "Propose unified Customer Officer P&L structure replacing separate online/store targets",
          "Appoint Transformation Programme Director with cross-functional authority"
        ]
      },
      {
        step: "Technology Partner Selection & Architecture",
        timeframe: "Months 2-3",
        owner: "Marcus Williams, IT Infrastructure Lead",
        actions: [
          "RFP for unified commerce platform (shortlist: Shopify Plus, commercetools, Salesforce Commerce Cloud)",
          "Select CDP vendor (Segment, Bloomreach, or Tealium) and begin data integration planning",
          "Negotiate RFID hardware and tagging contracts with phased deployment schedule"
        ]
      },
      {
        step: "People & Change Programme Launch",
        timeframe: "Month 3",
        owner: "Sophie Turner, Regional Store Manager",
        actions: [
          "Recruit 20 volunteer associates as digital pioneers for Phase 1 pilot",
          "Design new commission structure rewarding omnichannel influence",
          "Develop 2-week digital bootcamp curriculum for associate tablet training"
        ]
      },
      {
        step: "Phase 1 Pilot Execution",
        timeframe: "Months 4-6",
        owner: "Programme Director",
        actions: [
          "Deploy RFID and mobile POS in 10 pilot stores with 50 trained associates",
          "Launch ship-from-store in 5 urban locations with same-day delivery promise",
          "Begin CDP data ingestion from loyalty, web, and in-store POS systems",
          "Measure and publish weekly KPIs: stock accuracy, associate sales, customer satisfaction"
        ]
      }
    ],
    successMetrics: [
      {
        metric: "Online 'Out of Stock' Rate",
        baseline: "23% of searches show out-of-stock",
        target: "5% with unified inventory visibility",
        measurement: "eCommerce platform analytics"
      },
      {
        metric: "Annual Markdown Cost",
        baseline: "£42M in markdowns",
        target: "£25M (40% reduction) through AI demand forecasting",
        measurement: "Finance reports and merchandising system data"
      },
      {
        metric: "Customer Satisfaction (NPS)",
        baseline: "38 NPS across all channels",
        target: "58 NPS by Month 18",
        measurement: "Post-interaction and post-purchase surveys"
      },
      {
        metric: "Store Associate Retention",
        baseline: "65% annual retention",
        target: "82% retention with new tools and career paths",
        measurement: "HR quarterly reports"
      },
      {
        metric: "Email Open Rate",
        baseline: "12% (generic batch sends)",
        target: "22% with AI personalisation",
        measurement: "Email marketing platform analytics"
      },
      {
        metric: "Omnichannel Customer Revenue",
        baseline: "Omnichannel customers spend 2.1x vs single-channel",
        target: "3.2x multiplier with unified experience",
        measurement: "CDP customer cohort analysis"
      }
    ]
  }
};
