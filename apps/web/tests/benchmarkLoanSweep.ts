import { prisma } from "../lib/prisma";
import { runLoanDelinquencySweep } from "../lib/treasury/loanService";
import { LoanStatus } from "@prisma/client";
import { toUtcDateKey, addUtcDays } from "../lib/treasury/utils";
import { treasuryConfig } from "../lib/treasury/config";
import fs from "fs";

async function seed(count: number) {
  console.log(`Seeding ${count} characters and loans...`);

  // Ensure town exists
  await prisma.town.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: "Test Town", bankBalance: 1000000 }
  });

  const now = new Date();

  for (let i = 0; i < count; i++) {
    const username = `user_bench_${i}`;
    const user = await prisma.user.upsert({
      where: { username },
      update: {},
      create: {
        username,
        character: {
          create: {
            name: `Char ${i}`,
            appearanceColor: "#000000",
            avatar: "bunny",
            wallet: 1000,
          }
        }
      },
      include: { character: true }
    });

    const characterId = user.character!.id;

    // Create a loan that is definitely past due
    // We want some to be delinquent and some to be defaulted.
    // delinquentDays = daysLate - loanGraceDays
    // shouldDefault = delinquentDays >= loanDefaultDays

    // loanGraceDays is typically 1. loanDefaultDays is typically 5.
    // If daysLate = 2, delinquentDays = 1 (DELINQUENT)
    // If daysLate = 10, delinquentDays = 9 (DEFAULTED)

    const daysLate = (i % 10) + 1; // 1 to 10 days late
    const dueDate = addUtcDays(now, -daysLate);

    await prisma.characterLoan.create({
      data: {
        characterId,
        townId: 1,
        status: LoanStatus.ACTIVE,
        principalOrigin: 1000,
        remainingPrincipal: 1000,
        aprBps: 1200,
        dailyInterestBps: Math.floor(1200 / 365),
        dueAt: new Date(`${toUtcDateKey(dueDate)}T00:00:00.000Z`),
        nextDueDateKey: toUtcDateKey(dueDate),
        lastInterestAccrualDateKey: toUtcDateKey(dueDate),
      }
    });
  }
}

async function main() {
  const count = 500;

  // Clean up previous benchmark data if any
  await prisma.characterLoan.deleteMany({ where: { character: { user: { username: { startsWith: "user_bench_" } } } } });
  await prisma.character.deleteMany({ where: { user: { username: { startsWith: "user_bench_" } } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: "user_bench_" } } });

  await seed(count);

  console.log("Starting benchmark...");
  const start = performance.now();
  await runLoanDelinquencySweep(new Date());
  const end = performance.now();
  const duration = end - start;

  const result = `Execution time for ${count} loans: ${duration.toFixed(2)}ms\n`;
  console.log(result);
  fs.writeFileSync("baseline_results.txt", result);

  // Optional: check one to see if it worked
  const sample = await prisma.characterLoan.findFirst({
     where: { character: { user: { username: "user_bench_5" } } }
  });
  console.log("Sample loan status after sweep:", sample?.status);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
