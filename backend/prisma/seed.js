/**
 * Seeds the admin account into the database.
 * Run once: npm run seed:admin
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('../generated/prisma-v2');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Set a valid ADMIN_EMAIL before creating the admin account.');
  }
  if (!password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Set ADMIN_PASSWORD to a unique password of at least 12 characters and no more than 72 UTF-8 bytes before creating the admin account.');
  }
  const name = 'Admin';

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin account already exists.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.admin.create({
    data: { email, passwordHash, name, ratePerBoy: 20 },
  });

  console.log('Admin account created successfully.');
  console.log(`   ID: ${admin.id}`);
}

main()
  .catch((error) => {
    console.error('Admin seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
