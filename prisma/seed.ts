import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create dummy users with characters
  const player1 = await prisma.user.upsert({
    where: { username: 'Player1' },
    update: {},
    create: {
      username: 'Player1',
      character: {
        create: {
          name: 'Player1Char',
          appearanceColor: '#BD00FF',
          wallet: 1500,
        }
      }
    },
    include: { character: true }
  })
  console.log('User created/updated:', player1.username)

  const player2 = await prisma.user.upsert({
    where: { username: 'Player2' },
    update: {},
    create: {
      username: 'Player2',
      character: {
        create: {
          name: 'Player2Char',
          appearanceColor: '#FFB800',
          wallet: 1000,
        }
      }
    },
    include: { character: true }
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

  // Create BuildingStates for IDs "1" through "6"
  console.log('Creating BuildingStates...')
  for (let i = 1; i <= 7; i++) {
    const buildingId = i.toString()
    await prisma.buildingState.upsert({
      where: { id: buildingId },
      update: {},
      create: {
        id: buildingId,
        townId: town.id.toString(),
        price: 5000,
        employees: 0,
        ownerId: i === 1 ? player1.character?.id : null,
      }
    })
  }
  console.log('BuildingStates created.')
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
