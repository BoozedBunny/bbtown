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

  const TOWNS = [
    { id: 1, name: "HangoverHollow" },
    { id: 2, name: "TipsyToadstool" },
    { id: 3, name: "RumTumbleWeed" },
  ];

  for (const townData of TOWNS) {
    const town = await prisma.town.upsert({
      where: { id: townData.id },
      update: { name: townData.name },
      create: {
        id: townData.id,
        name: townData.name,
      },
    })
    console.log('Town created/updated:', town.name)
  }

  // Special buildings that shouldn't be for sale
  const SPECIAL_BUILDINGS = ["21", "24", "25", "26"];
  const HARDCODED_BUILDINGS = [
    { id: "8" }, { id: "9" }, { id: "10" }, { id: "11" },
    { id: "12" }, { id: "13" }, { id: "14" }, { id: "15" },
    { id: "16" }, { id: "17" }, { id: "18" }, { id: "19" },
    { id: "20" }, { id: "21" }, { id: "22" }, { id: "23" },
    { id: "24" }, { id: "25" }, { id: "26" }, { id: "27" }
  ];

  // Create BuildingStates for various buildings
  console.log('Creating BuildingStates...')

  for (const townData of TOWNS) {
    for (const building of HARDCODED_BUILDINGS) {
      const isSpecial = SPECIAL_BUILDINGS.includes(building.id);

      const stateId = `${townData.id}_${building.id}`;

      await prisma.buildingState.upsert({
        where: { id: stateId },
        update: {},
        create: {
          id: stateId,
          townId: townData.id.toString(),
          price: 5000 + (parseInt(building.id) * 100),
          employees: 0,
          ownerId: null,
          forSale: !isSpecial,
        }
      })
    }
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
