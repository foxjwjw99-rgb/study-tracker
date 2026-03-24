import { PrismaClient } from "../../node_modules/.prisma/client"

const REQUIRED_DELEGATES = [
  "vocabularyWord",
  "vocabularyReviewLog",
] as const satisfies readonly (keyof PrismaClient)[]

const prismaClientSingleton = () => new PrismaClient()

function hasRequiredDelegates(client: PrismaClient) {
  return REQUIRED_DELEGATES.every((delegate) => delegate in client)
}

declare global {
  var prismaGlobal: PrismaClient | undefined
}

const existingClient = globalThis.prismaGlobal
const prisma =
  existingClient && hasRequiredDelegates(existingClient)
    ? existingClient
    : prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma
}
