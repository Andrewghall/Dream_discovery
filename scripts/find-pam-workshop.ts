#!/usr/bin/env npx tsx
/**
 * Find PAM Wellness workshop data — discovery emails & transcript
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/find-pam-workshop.ts
 *
 * Or if .env already has DATABASE_URL:
 *   npx tsx scripts/find-pam-workshop.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Searching for PAM Wellness workshop(s)...\n");

  // 1. Find workshop(s) matching PAM
  const workshops = await prisma.workshop.findMany({
    where: {
      OR: [
        { clientName: { contains: "pam", mode: "insensitive" } },
        { name: { contains: "pam", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      clientName: true,
      status: true,
      createdAt: true,
      scheduledDate: true,
      createdBy: { select: { email: true, name: true } },
    },
  });

  if (workshops.length === 0) {
    console.log("❌ No workshop found matching 'PAM'.");
    console.log("\nListing all workshops to help you find it:\n");

    const all = await prisma.workshop.findMany({
      select: {
        id: true,
        name: true,
        clientName: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (all.length === 0) {
      console.log("  (No workshops in database at all)");
    } else {
      for (const w of all) {
        console.log(
          `  ${w.id} | ${w.clientName ?? w.name} | ${w.status} | ${w.createdAt.toISOString()}`
        );
      }
    }

    // Check audit logs for deletion
    console.log("\n🔎 Checking audit logs for workshop deletions...\n");
    const deletions = await prisma.auditLog.findMany({
      where: {
        OR: [
          { action: { contains: "delete", mode: "insensitive" } },
          { action: { contains: "DELETE", mode: "insensitive" } },
        ],
        resourceType: "workshop",
      },
      orderBy: { timestamp: "desc" },
      take: 20,
    });

    if (deletions.length === 0) {
      console.log("  No workshop deletion events found in audit logs.");
    } else {
      console.log("  Workshop deletion events:");
      for (const d of deletions) {
        console.log(
          `  ${d.timestamp.toISOString()} | ${d.action} | resourceId: ${d.resourceId} | user: ${d.userEmail} | ${d.metadata ? JSON.stringify(d.metadata) : ""}`
        );
      }
    }

    return;
  }

  for (const ws of workshops) {
    console.log(`✅ Found workshop: ${ws.name}`);
    console.log(`   ID:      ${ws.id}`);
    console.log(`   Client:  ${ws.clientName}`);
    console.log(`   Status:  ${ws.status}`);
    console.log(`   Created: ${ws.createdAt.toISOString()}`);
    console.log(`   By:      ${ws.createdBy.name} (${ws.createdBy.email})`);
    console.log();

    // 2. Discovery emails
    const participants = await prisma.workshopParticipant.findMany({
      where: { workshopId: ws.id },
      orderBy: { createdAt: "asc" },
    });

    console.log(`📧 Discovery Emails (${participants.length} participants):`);
    console.log("-".repeat(80));
    for (const p of participants) {
      console.log(
        `  ${p.name} <${p.email}> | Role: ${p.role ?? "—"} | Dept: ${p.department ?? "—"}`
      );
      console.log(
        `    Email sent: ${p.emailSentAt?.toISOString() ?? "NOT SENT"} | Completed: ${p.responseCompletedAt?.toISOString() ?? "NOT YET"}`
      );
    }
    console.log();

    // 3. Transcript chunks
    const chunks = await prisma.transcriptChunk.findMany({
      where: { workshopId: ws.id },
      orderBy: { startTimeMs: "asc" },
    });

    if (chunks.length > 0) {
      console.log(`🎙️  Transcript Chunks (${chunks.length}):`);
      console.log("-".repeat(80));
      for (const c of chunks) {
        console.log(
          `  [${c.source}] Speaker ${c.speakerId ?? "?"} (${Number(c.startTimeMs)}ms): ${c.text}`
        );
      }
      console.log();
    }

    // 4. Conversation messages (discovery interviews)
    const sessions = await prisma.conversationSession.findMany({
      where: { workshopId: ws.id },
      include: {
        participant: { select: { name: true, email: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    });

    if (sessions.length > 0) {
      console.log(
        `💬 Conversation Sessions (${sessions.length} sessions, ${sessions.reduce((n, s) => n + s.messages.length, 0)} messages):`
      );
      console.log("-".repeat(80));
      for (const s of sessions) {
        console.log(
          `\n  Session: ${s.id} | ${s.participant.name} (${s.participant.email}) | Status: ${s.status}`
        );
        for (const m of s.messages) {
          const role = m.role === "AI" ? "🤖" : "👤";
          const preview =
            m.content.length > 200
              ? m.content.slice(0, 200) + "..."
              : m.content;
          console.log(`    ${role} [${m.phase ?? "—"}] ${preview}`);
        }
      }
    }
  }
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
