// Private operational probe: fixed read-only SQL; never echo configuration/errors.
async function check() {
  if (process.env.NODE_ENV !== 'production') {
    console.error('PRODUCTION_NODE_ENV_REQUIRED');
    process.exitCode = 1;
    return;
  }

  const timeout = setTimeout(() => {
    console.error('PRODUCTION_DATABASE_CHECK_TIMEOUT');
    process.exit(1);
  }, 15000);
  let prisma;
  try {
    const { PrismaService } = require('../dist/src/prisma/prisma.service.js');
    prisma = new PrismaService();
    await prisma.$connect();
    const rows = await prisma.$queryRaw`SELECT 1 AS ok`;
    if (rows.length !== 1 || rows[0].ok !== 1) {
      throw new Error('UNEXPECTED_PROBE_RESULT');
    }
    console.log('PRODUCTION_DATABASE_CHECK_OK');
  } catch {
    console.error('PRODUCTION_DATABASE_CHECK_FAILED');
    process.exitCode = 1;
  } finally {
    try {
      if (prisma) await prisma.$disconnect();
    } catch {
      console.error('PRODUCTION_DATABASE_CHECK_FAILED');
      process.exitCode = 1;
    }
    clearTimeout(timeout);
  }
}

void check();
