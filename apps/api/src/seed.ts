import { prisma } from "./lib/prisma";

async function main() {
  const family = await prisma.family.create({ data: { name: "Demo Family" } });

  const parent = await prisma.user.create({
    data: { familyId: family.id, name: "Demo Parent", role: "PARENT", language: "en" },
  });
  const student = await prisma.user.create({
    data: { familyId: family.id, name: "Demo Student", role: "STUDENT", language: "en" },
  });

  await prisma.xpointsLedger.create({
    data: { userId: student.id, delta: 200, reason: "initial_grant" },
  });
  await prisma.xpointsLedger.create({
    data: { userId: parent.id, delta: 200, reason: "initial_grant" },
  });

  console.log("Seeded demo family:");
  console.log(`  Family: ${family.id}`);
  console.log(`  Parent user id (use as x-user-id): ${parent.id}`);
  console.log(`  Student user id (use as x-user-id): ${student.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
