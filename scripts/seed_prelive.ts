import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function assertPrelive() {
  const r = await prisma.$queryRawUnsafe<Array<{ s: string }>>("select current_schema() as s");
  if (r?.[0]?.s !== "Ethenta_Dream_prelive") {
    throw new Error(`ABORT: current_schema=${r?.[0]?.s}`);
  }
}

async function main() {
  await assertPrelive();

  // Org + user
  const org = await prisma.organization.upsert({
    where: { id: "synthetic-org-1" },
    update: {},
    create: { id: "synthetic-org-1", name: "Ethenta Synthetic" },
  });

  const user = await prisma.user.upsert({
    where: { email: "synthetic.admin@ethenta.com" },
    update: {},
    create: {
      email: "synthetic.admin@ethenta.com",
      name: "Synthetic Admin",
      organizationId: org.id,
    },
  });

  // Workshop
  const workshop = await prisma.workshop.create({
    data: {
      organizationId: org.id,
      createdById: user.id,
      name: "Synthetic Workshop – Live Room Test",
      description: "Synthetic data for hemisphere + workboard testing",
      status: "IN_PROGRESS",
      workshopType: "CUSTOM",
      includeRegulation: true,
    },
  });

  // 10 participants
  const roles = [
    ["Exec Sponsor", "Leadership"],
    ["CX Manager", "Customer"],
    ["Operations Lead", "Operations"],
    ["IT Architect", "Technology"],
    ["Data Lead", "Technology"],
    ["Compliance Lead", "Regulation"],
    ["Finance Lead", "Business"],
    ["Product Owner", "Business"],
    ["Team Leader", "People"],
    ["Agent Rep", "People"],
  ];

  const participants = [];
  for (let i = 0; i < roles.length; i++) {
    const [name, dept] = roles[i];
    const p = await prisma.workshopParticipant.create({
      data: {
        workshopId: workshop.id,
        email: `p${i + 1}@synthetic.local`,
        name,
        role: name,
        department: dept,
        attributionPreference: "NAMED",
      },
    });
    participants.push(p);

    // One session each so you can test per-participant dialogue
    await prisma.conversationSession.create({
      data: {
        workshopId: workshop.id,
        participantId: p.id,
        status: "IN_PROGRESS",
        currentPhase: "live",
        phaseProgress: 0,
        language: "en",
        voiceEnabled: true,
        includeRegulation: true,
      },
    });
  }

  // Grab sessions for linking
  const sessions = await prisma.conversationSession.findMany({
    where: { workshopId: workshop.id },
    orderBy: { createdAt: "asc" },
  });

  // 3 dialogue phases worth of utterances, diverse
  const dialogue = [
    // REIMAGINE (opportunity heavy)
    ["REIMAGINE", "VISIONARY", "If we reimagined service, what would ‘frictionless’ look like for customers?"],
    ["REIMAGINE", "OPPORTUNITY", "We could deflect simple contacts with a guided flow that still feels personal."],
    ["REIMAGINE", "INSIGHT", "Knowledge lives in people’s heads and inboxes; that’s the real bottleneck."],
    ["REIMAGINE", "OPPORTUNITY", "A single intelligence layer could power chat, email, QA, and agent assist."],
    ["REIMAGINE", "QUESTION", "What outcome would make you say this was worth it in 90 days?"],

    // CONSTRAINTS (risk + challenge + enablers)
    ["CONSTRAINTS", "RISK", "We need clarity on what data is stored, where it is stored, and retention."],
    ["CONSTRAINTS", "CONSTRAINT", "Our CRM integration points are brittle; changes break downstream systems."],
    ["CONSTRAINTS", "CONSTRAINT", "Teams work differently; forcing one process will create resistance."],
    ["CONSTRAINTS", "QUESTION", "Can we do this without sending sensitive data outside our environment?"],
    ["CONSTRAINTS", "ENABLER", "If we start with one journey and one channel, we can reduce integration risk."],

    // DEFINE_APPROACH (decisions + actions)
    ["DEFINE_APPROACH", "ACTION", "Agree a single pilot journey and define success metrics before build starts."],
    ["DEFINE_APPROACH", "ACTION", "Create a weekly steering group to unblock decisions fast."],
    ["DEFINE_APPROACH", "INSIGHT", "Without clear owners per function, adoption will stall even if tech works."],
    ["DEFINE_APPROACH", "RISK", "If governance is unclear, model behaviour will become a compliance concern."],
    ["DEFINE_APPROACH", "OPPORTUNITY", "Once the pilot works, we can replicate across journeys quickly."],
  ] as const;

  const now = Date.now();

  for (let i = 0; i < dialogue.length; i++) {
    const [phase, primaryType, text] = dialogue[i];
    const participant = participants[i % participants.length];
    const session = sessions[i % sessions.length];

    const start = i * 4500;
    const end = start + 2500;

    const tc = await prisma.transcriptChunk.create({
      data: {
        workshopId: workshop.id,
        speakerId: participant.id,
        startTimeMs: start,
        endTimeMs: end,
        text,
        confidence: 0.97,
        source: "DEEPGRAM",
        createdAt: new Date(now + i * 4500),
      },
    });

    const dp = await prisma.dataPoint.create({
      data: {
        workshopId: workshop.id,
        transcriptChunkId: tc.id,
        rawText: text,
        source: "SPEECH",
        speakerId: participant.id,
        sessionId: session.id,
        participantId: participant.id,
        createdAt: new Date(now + i * 4500 + 250),
      },
    });

    await prisma.dataPointClassification.create({
      data: {
        dataPointId: dp.id,
        primaryType, // must be one of DataPointPrimaryType
        confidence: 0.8,
        keywords: text.split(/\s+/).slice(0, 8),
        suggestedArea: phase,
      },
    });
  }

  console.log("Seed complete:", {
    workshopId: workshop.id,
    participants: participants.length,
    sessions: sessions.length,
    datapoints: dialogue.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });