import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')
  const user = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
    },
  })
  console.log('User created/updated:', user.username)

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
