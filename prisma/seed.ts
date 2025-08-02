import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create default admin user
  const hashedPassword = await bcrypt.hash('12345', 10)
  
  const admin = await prisma.user.upsert({
    where: { email: 'Kasymbek0v650@gmail.com' },
    update: {},
    create: {
      email: 'Kasymbek0v650@gmail.com',
      password: hashedPassword,
      name: 'Admin User',
    },
  })

  console.log('Created admin user:', admin)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
