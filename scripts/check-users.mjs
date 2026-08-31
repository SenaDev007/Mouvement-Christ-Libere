import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const users = await db.user.findMany({ select: { id: true, name: true, email: true, role: true, avatarUrl: true, image: true } })
console.log('USERS:', JSON.stringify(users, null, 2))
const servants = await db.servant.findMany()
console.log('SERVANTS:', JSON.stringify(servants.map(s => ({ id: s.id, code: s.code, fullName: s.fullName, portraitUrl: s.portraitUrl })), null, 2))
await db.$disconnect()
