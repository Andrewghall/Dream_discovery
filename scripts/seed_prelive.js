const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function assertPrelive() {
  const r = await prisma.$queryRawUnsafe("select current_schema() as s");
  if (r[0].s !== "Ethenta_Dream_prelive") throw new Error(`ABORT schema=${r[0].s}`);
}

async function main() {
  await assertPrelive();

  const orgId = "org_synth";
  const userId = "user_synth";
  const workshopId = "workshop_synth";

  await prisma.organization.upsert({
    where: { id: orgId },
    update: { name: "Ethenta Synthetic" },
    create: { id: orgId, name: "Ethenta Synthetic" },
  });

  await prisma.user.upsert({
    where: { email: "synthetic.admin@ethenta.com" },
    update: { name: "Synthetic Admin", organizationId: orgId },
    create: {
      id: userId,
      email: "synthetic.admin@ethenta.com",
      name: "Synthetic Admin",
      organizationId: orgId,
    },
  });

  const workshop = await prisma.workshop.upsert({
    where: { id: workshopId },
    update: { status: "IN_PROGRESS" },
    create: {
      id: workshopId,
      organizationId: orgId,
      createdById: userId,
      name: "Synthetic Workshop – Live Room Test",
      description: "Synthetic data for hemisphere testing",
      status: "IN_PROGRESS",
      workshopType: "CUSTOM",
      includeRegulation: true,
    },
  });

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
  }

  const sessions = [];
  for (let i = 0; i < participants.length; i++) {
    const s = await prisma.conversationSession.create({
      data: {
        workshopId: workshop.id,
        participantId: participants[i].id,
        status: "IN_PROGRESS",
        currentPhase: "live",
        phaseProgress: 0,
        language: "en",
        voiceEnabled: true,
        includeRegulation: true,
      },
    });
    sessions.push(s);
  }

  const dialogue = [
    ["REIMAGINE", "VISIONARY", "If we reimagined service, what would frictionless feel like?"],
    ["REIMAGINE", "OPPORTUNITY", "We could deflect simple contacts with a guided flow that still feels personal."],
    ["REIMAGINE", "INSIGHT", "Knowledge is scattered; that is the real bottleneck."],
    ["REIMAGINE", "OPPORTUNITY", "One intelligence layer could power chat, email, QA, and agent assist."],
    ["REIMAGINE", "QUESTION", "What outcome would define success in 90 days?"],

    ["CONSTRAINTS", "RISK", "We need clarity on what data is stored, where, and retention."],
    ["CONSTRAINTS", "CONSTRAINT", "CRM integrations are brittle; changes break downstream systems."],
    ["CONSTRAINTS", "CONSTRAINT", "Teams work differently; forcing one process will create resistance."],
    ["CONSTRAINTS", "QUESTION", "Can this operate inside our environment without data leaving?"],
    ["CONSTRAINTS", "ENABLER", "Start with one journey and one channel to reduce integration risk."],

    ["DEFINE_APPROACH", "ACTION", "Agree one pilot journey and success metrics before build starts."],
    ["DEFINE_APPROACH", "ACTION", "Set a weekly steering group to unblock decisions fast."],
    ["DEFINE_APPROACH", "INSIGHT", "Without clear owners per function, adoption will stall."],
    ["DEFINE_APPROACH", "RISK", "If governance is unclear, model behaviour becomes a compliance issue."],
    ["DEFINE_APPROACH", "OPPORTUNITY", "Once the pilot works, replicate across journeys quickly."],
  ];

  const now = Date.now();

  for (let i = 0; i < dialogue.length; i++) {
    const [phase, primaryType, text] = dialogue[i];
    const p = participants[i % participants.length];
    const s = sessions[i % sessions.length];
    const start = i * 4500;
    const end = start + 2500;

    const tc = await prisma.transcriptChunk.create({
      data: {
        workshopId: workshop.id,
        speakerId: p.id,
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
        speakerId: p.id,
        sessionId: s.id,
        participantId: p.id,
        createdAt: new Date(now + i * 4500 + 250),
      },
    });

    await prisma.dataPointClassification.create({
      data: {
        dataPointId: dp.id,
        primaryType, // string is fine in JS
        confidence: 0.8,
        keywords: text.split(/\s+/).slice(0, 8),
        suggestedArea: phase,
      },
    });
  }

  console.log("Seed complete", { workshopId: workshop.id, participants: participants.length, datapoints: dialogue.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());