const crypto = require('node:crypto');
const { MongoClient } = require('mongodb');

let clientPromise;
let initPromise;

function getMongoUri() {
  return process.env.MONGODB_URI || process.env.MONGO_URL || '';
}

function getDbName() {
  return process.env.MONGODB_DB || 'infrapredict';
}

async function getDb() {
  const uri = getMongoUri();
  if (!uri) throw new Error('MONGODB_URI is not configured');
  if (!clientPromise) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
    clientPromise = client.connect();
  }
  const client = await clientPromise;
  return client.db(getDbName());
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
    const db = await getDb();
    const users = db.collection('users');
    const complaints = db.collection('complaints');
    const sessions = db.collection('sessions');

    await Promise.all([
      users.createIndex({ mobile: 1 }, { unique: true }),
      users.createIndex({ email: 1 }, { unique: true }),
      complaints.createIndex({ request_id: 1 }, { unique: true }),
      complaints.createIndex({ user_id: 1 }),
      complaints.createIndex({ status: 1 }),
      complaints.createIndex({ department: 1 }),
      sessions.createIndex({ token: 1 }, { unique: true }),
      sessions.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 })
    ]);

    await users.updateOne(
      { mobile: '9876543210' },
      { $setOnInsert: {
        name: 'Demo Citizen',
        mobile: '9876543210',
        email: 'demo@example.com',
        password_hash: hashPassword('1234'),
        role: 'citizen',
        created_at: new Date()
      } },
      { upsert: true }
    );

    const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminEmail = `${adminUsername}@infrapredict.local`;
    const existingAdmin = await users.findOne({ role: 'admin' });
    const adminData = {
      name: 'Administrator',
      mobile: '0000000000',
      email: adminEmail,
      password_hash: hashPassword(adminPassword),
      role: 'admin'
    };

    if (existingAdmin) {
      await users.updateOne({ _id: existingAdmin._id }, { $set: adminData });
    } else {
      await users.updateOne(
        { mobile: '0000000000' },
        { $set: adminData, $setOnInsert: { created_at: new Date() } },
        { upsert: true }
      );
    }
  })().catch(err => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

module.exports = { getDb, initDb, hashPassword, verifyPassword, getMongoUri };
