import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create dummy users
  const player1 = await prisma.user.upsert({
    where: { username: 'Player1' },
    update: {},
    create: {
      username: 'Player1',
    },
  })
  console.log('User created/updated:', player1.username)

  const player2 = await prisma.user.upsert({
    where: { username: 'Player2' },
    update: {},
    create: {
      username: 'Player2',
    },
  })
  console.log('User created/updated:', player2.username)

  // Create default town
  const town = await prisma.town.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Capital City',
    },
  })
  console.log('Town created/updated:', town.name)

  const gameState = await prisma.gameState.create({
    data: {
      state: JSON.stringify({ players: [], objects: [] }),
    },
  })
  console.log('Game state created:', gameState.id)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
