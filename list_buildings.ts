import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const buildings = await prisma.buildingState.findMany();
  console.log(JSON.stringify(buildings, null, 2));
}
main();
