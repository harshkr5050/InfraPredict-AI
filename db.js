const crypto = require('node:crypto');
const { neon } = require('@neondatabase/serverless');

let sqlClient = null;
let initPromise = null;

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || '';
}

function sql() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) throw new Error('No Postgres connection string is configured');
  if (!sqlClient) sqlClient = neon(databaseUrl);
  return sqlClient;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, original] = stored.split(':');
    const check = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(original, 'hex');
    return check.length === expected.length && crypto.timingSafeEqual(check, expected);
  } catch {
    return false;
  }
}

async function initDb() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const q = sql();

    await q`CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'citizen' CHECK(role IN ('citizen','admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;

    await q`CREATE TABLE IF NOT EXISTS complaints (
      id BIGSERIAL PRIMARY KEY,
      request_id TEXT NOT NULL UNIQUE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      infrastructure TEXT NOT NULL,
      severity TEXT NOT NULL,
      location TEXT NOT NULL,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      description TEXT,
      department TEXT NOT NULL,
      risk INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','In Progress','Resolved')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;

    await q`CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at BIGINT NOT NULL
    )`;

    await q`CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(user_id)`;
    await q`CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status)`;
    await q`CREATE INDEX IF NOT EXISTS idx_complaints_department ON complaints(department)`;

    await q`INSERT INTO users(name,mobile,email,password_hash,role)
            VALUES('Demo Citizen','9876543210','demo@example.com',${hashPassword('1234')},'citizen')
            ON CONFLICT (mobile) DO NOTHING`;

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'change-me-before-deploy';
    const adminEmail = `${adminUsername}@infrapredict.local`;
    const adminHash = hashPassword(adminPassword);

    const adminRows = await q`SELECT id FROM users WHERE role='admin' LIMIT 1`;
    if (!adminRows.length) {
      await q`INSERT INTO users(name,mobile,email,password_hash,role)
              VALUES('Administrator','0000000000',${adminEmail},${adminHash},'admin')
              ON CONFLICT (mobile) DO UPDATE SET
                name='Administrator', email=${adminEmail}, password_hash=${adminHash}, role='admin'`;
    } else {
      await q`UPDATE users SET email=${adminEmail},password_hash=${adminHash},name='Administrator'
              WHERE id=${adminRows[0].id}`;
    }
  })().catch(err => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

module.exports = { sql, initDb, hashPassword, verifyPassword, getDatabaseUrl };
