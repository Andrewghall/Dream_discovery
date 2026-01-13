import 'dotenv/config';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const participant = await prisma.workshopParticipant.findFirst({
    include: {
      workshop: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (participant) {
    console.log('\n=== Participant Info ===');
    console.log('Name:', participant.name);
    console.log('Email:', participant.email);
    console.log('Workshop ID:', participant.workshop.id);
    console.log('Workshop Name:', participant.workshop.name);
    console.log('Discovery Token:', participant.discoveryToken);
    console.log('\n=== Discovery URL ===');
    console.log(`http://localhost:3000/discovery/${participant.workshop.id}/${participant.discoveryToken}`);
  } else {
    console.log('No participants found');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
