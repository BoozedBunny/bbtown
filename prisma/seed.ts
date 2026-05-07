import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create dummy users with characters
  const player1 = await prisma.user.upsert({
    where: { username: 'Player1' },
    update: {
      character: {
        update: {
          name: 'Player1',
          avatar: 'bunny',
          wallet: 5000,
        }
      }
    },
    create: {
      username: 'Player1',
      character: {
        create: {
          name: 'Player1',
          appearanceColor: '#BD00FF',
          avatar: 'bunny',
          wallet: 5000,
        }
      }
    },
    include: { character: true }
  })
  console.log('User created/updated:', player1.username)

  const player2 = await prisma.user.upsert({
    where: { username: 'Player2' },
    update: {
      character: {
        update: {
          name: 'Player2',
          avatar: 'cowie',
          wallet: 2000,
        }
      }
    },
    create: {
      username: 'Player2',
      character: {
        create: {
          name: 'Player2',
          appearanceColor: '#FFB800',
          avatar: 'cowie',
          wallet: 2000,
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

  // Create BuildingStates for various buildings
  console.log('Creating BuildingStates...')

  // Building 1 owned by bunny
  await prisma.buildingState.upsert({
    where: { id: "1" },
    update: { ownerId: player1.character?.id, forSale: false },
    create: {
      id: "1",
      townId: "1",
      price: 5000,
      employees: 2,
      ownerId: player1.character?.id,
      forSale: false,
    }
  })

  // Building 2 owned by cowie
  await prisma.buildingState.upsert({
    where: { id: "2" },
    update: { ownerId: player2.character?.id, forSale: false },
    create: {
      id: "2",
      townId: "1",
      price: 8000,
      employees: 5,
      ownerId: player2.character?.id,
      forSale: false,
    }
  })

  // Other buildings for sale
  for (let i = 3; i <= 21; i++) {
    const buildingId = i.toString()
    await prisma.buildingState.upsert({
      where: { id: buildingId },
      update: {},
      create: {
        id: buildingId,
        townId: "1",
        price: 5000 + (i * 100),
        employees: 0,
        ownerId: null,
        forSale: true,
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
