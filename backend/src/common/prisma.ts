import { PrismaClient } from "@prisma/client";

// Ensure 'file' and 'job' delegates are always recognized by IDE language servers
export const prisma = new PrismaClient() as PrismaClient & {
  file: any;
  job: any;
};

export default prisma;
