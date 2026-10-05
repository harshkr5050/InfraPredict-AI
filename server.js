const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { getDb, initDb, hashPassword, verifyPassword, getMongoUri } = require('./db');

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const key = t.slice(0, i).trim();
    const value = t.slice(i + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, 'public');

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': data.length,
    'Cache-Control': 'no-store'
  });
  res.end(data);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => {
      raw += c;
      if (raw.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

async function tokenFor(userId) {
  const db = await getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await db.collection('sessions').insertOne({ token, user_id: userId, expires_at: expires });
  return token;
}

async function currentUser(req) {
  const db = await getDb();
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  const session = await db.collection('sessions').findOne({ token, expires_at: { $gt: new Date() } });
  if (!session) return null;
  return db.collection('users').findOne({ _id: session.user_id }, { projection: { password_hash: 0 } });
}

function safeUser(u) {
  return { id: String(u._id), name: u.name, mobile: u.mobile, email: u.email, role: u.role };
}

function departmentFor(type) {
  return ({
    Road: 'Road & Transport Department',
    Bridge: 'Public Works Department (PWD)',
    Streetlight: 'Electricity / Municipal Department',
    'Water Pipeline': 'Water Supply Department',
    Drainage: 'Municipal / Drainage Department',
    'Public Building': 'Public Works Department (PWD)'
  })[type] || 'Municipal Authority';
}

function riskFor(severity) {
  return ({ Critical: 95, High: 80, Medium: 55, Low: 25 })[severity] || 25;
}

function serveStatic(req, res) {
  let pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/') pathname = '/index.html';
  const requested = path.normalize(path.join(publicDir, pathname));
  if (!requested.startsWith(publicDir)) return false;
  if (fs.existsSync(requested) && fs.statSync(requested).isFile()) {
    const ext = path.extname(requested).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
      '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
    };
    const data = fs.readFileSync(requested);
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Content-Length': data.length });
    res.end(data);
    return true;
  }
  return false;
}

async function complaintListWithUsers(db, filter = {}) {
  return db.collection('complaints').aggregate([
    { $match: filter },
    { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $addFields: { citizen: '$user.name', mobile: '$user.mobile', email: '$user.email' } },
    { $project: { user: 0 } },
    { $sort: { risk: -1, created_at: -1 } }
  ]).toArray();
}

async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    if (!pathname.startsWith('/api/')) {
      if (serveStatic(req, res)) return;
      const index = fs.readFileSync(path.join(publicDir, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': index.length });
      return res.end(index);
    }

    if (!getMongoUri()) {
      return json(res, 503, {
        message: 'Database is not configured',
        setup: 'Add MONGODB_URI in Vercel Environment Variables and redeploy.'
      });
    }

    await initDb();
    const db = await getDb();

    if (pathname === '/api/health' && req.method === 'GET') {
      await db.command({ ping: 1 });
      return json(res, 200, { ok: true, service: 'InfraPredict AI API', database: 'mongodb-atlas' });
    }

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const { name, mobile, email, password } = await parseBody(req);
      if (!name || !mobile || !email || !password) return json(res, 400, { message: 'Please fill all fields' });
      if (!/^\d{10}$/.test(String(mobile))) return json(res, 400, { message: 'Enter a valid 10 digit mobile number' });
      if (String(password).length < 4) return json(res, 400, { message: 'Password must contain at least 4 characters' });
      const user = {
        name: String(name).trim(), mobile: String(mobile), email: String(email).trim().toLowerCase(),
        password_hash: hashPassword(String(password)), role: 'citizen', created_at: new Date()
      };
      try {
        const result = await db.collection('users').insertOne(user);
        user._id = result.insertedId;
        return json(res, 201, { message: 'Registration successful', token: await tokenFor(user._id), user: safeUser(user) });
      } catch (e) {
        if (e && e.code === 11000) return json(res, 409, { message: 'Mobile number or email is already registered' });
        throw e;
      }
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const { loginId, password, role } = await parseBody(req);
      if (!loginId || !password) return json(res, 400, { message: 'Enter login ID and password' });
      let user;
      if (role === 'admin') {
        const adminUsername = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
        if (String(loginId).trim().toLowerCase() !== adminUsername) return json(res, 401, { message: 'Invalid admin username or password' });
        user = await db.collection('users').findOne({ role: 'admin' });
      } else {
        const id = String(loginId).trim();
        user = await db.collection('users').findOne({ role: 'citizen', $or: [{ email: id.toLowerCase() }, { mobile: id }] });
      }
      if (!user || !verifyPassword(String(password), user.password_hash)) return json(res, 401, { message: 'Invalid login details' });
      return json(res, 200, { token: await tokenFor(user._id), user: safeUser(user) });
    }

    const user = await currentUser(req);
    if (!user) return json(res, 401, { message: 'Authentication required' });
    if (pathname === '/api/me' && req.method === 'GET') return json(res, 200, { user: safeUser(user) });

    if (pathname === '/api/complaints' && req.method === 'GET') {
      let rows = user.role === 'admin'
        ? await complaintListWithUsers(db)
        : await complaintListWithUsers(db, { user_id: user._id });

      if (user.role === 'admin') {
        const status = url.searchParams.get('status') || 'All';
        const department = url.searchParams.get('department') || 'All';
        const search = (url.searchParams.get('search') || '').toLowerCase();
        rows = rows.filter(c =>
          (status === 'All' || c.status === status) &&
          (department === 'All' || c.department === department) &&
          (!search || String(c.request_id).toLowerCase().includes(search) || String(c.citizen).toLowerCase().includes(search) || String(c.mobile).includes(search))
        );
      }
      return json(res, 200, { complaints: rows });
    }

    if (pathname === '/api/complaints' && req.method === 'POST') {
      if (user.role !== 'citizen') return json(res, 403, { message: 'Citizen account required' });
      const { infrastructure, severity, location, latitude, longitude, description = '' } = await parseBody(req);
      const allowed = ['Road', 'Bridge', 'Streetlight', 'Water Pipeline', 'Drainage', 'Public Building'];
      const levels = ['Critical', 'High', 'Medium', 'Low'];
      if (!allowed.includes(infrastructure) || !levels.includes(severity) || !location) return json(res, 400, { message: 'Infrastructure type, severity and location are required' });
      const complaint = {
        request_id: `REQ-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
        user_id: user._id,
        infrastructure, severity, location: String(location),
        latitude: latitude ?? null, longitude: longitude ?? null,
        description: String(description).trim(), department: departmentFor(infrastructure),
        risk: riskFor(severity), status: 'Pending', created_at: new Date(), updated_at: new Date()
      };
      const result = await db.collection('complaints').insertOne(complaint);
      complaint._id = result.insertedId;
      return json(res, 201, { message: 'Request submitted successfully', complaint });
    }

    const statusMatch = pathname.match(/^\/api\/complaints\/([^/]+)\/status$/);
    if (statusMatch && req.method === 'PATCH') {
      if (user.role !== 'admin') return json(res, 403, { message: 'Admin access required' });
      const { status } = await parseBody(req);
      if (!['Pending', 'In Progress', 'Resolved'].includes(status)) return json(res, 400, { message: 'Invalid status' });
      const id = decodeURIComponent(statusMatch[1]);
      const result = await db.collection('complaints').updateOne({ request_id: id }, { $set: { status, updated_at: new Date() } });
      return result.matchedCount ? json(res, 200, { message: 'Status updated' }) : json(res, 404, { message: 'Request not found' });
    }

    const deleteMatch = pathname.match(/^\/api\/complaints\/([^/]+)$/);
    if (deleteMatch && req.method === 'DELETE') {
      if (user.role !== 'admin') return json(res, 403, { message: 'Admin access required' });
      const id = decodeURIComponent(deleteMatch[1]);
      const result = await db.collection('complaints').deleteOne({ request_id: id });
      return result.deletedCount ? json(res, 200, { message: 'Request deleted' }) : json(res, 404, { message: 'Request not found' });
    }

    if (pathname === '/api/dashboard' && req.method === 'GET') {
      const base = user.role === 'admin' ? {} : { user_id: user._id };
      const [total, pending, progress, resolved, critical] = await Promise.all([
        db.collection('complaints').countDocuments(base),
        db.collection('complaints').countDocuments({ ...base, status: 'Pending' }),
        db.collection('complaints').countDocuments({ ...base, status: 'In Progress' }),
        db.collection('complaints').countDocuments({ ...base, status: 'Resolved' }),
        db.collection('complaints').countDocuments({ ...base, severity: 'Critical' })
      ]);
      return json(res, 200, { stats: { total, pending, progress, resolved, critical } });
    }

    if (pathname === '/api/analytics' && req.method === 'GET') {
      if (user.role !== 'admin') return json(res, 403, { message: 'Admin access required' });
      const [byInfraRaw, bySeverityRaw, priority] = await Promise.all([
        db.collection('complaints').aggregate([{ $group: { _id: '$infrastructure', value: { $sum: 1 } } }, { $sort: { value: -1 } }]).toArray(),
        db.collection('complaints').aggregate([{ $group: { _id: '$severity', value: { $sum: 1 } } }, { $sort: { value: -1 } }]).toArray(),
        db.collection('complaints').aggregate([
          { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
          { $unwind: '$user' },
          { $addFields: { citizen: '$user.name', resolved_sort: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } } },
          { $sort: { resolved_sort: 1, risk: -1, created_at: 1 } },
          { $limit: 8 },
          { $project: { request_id: 1, infrastructure: 1, severity: 1, risk: 1, status: 1, department: 1, citizen: 1 } }
        ]).toArray()
      ]);
      const byInfra = byInfraRaw.map(x => ({ label: x._id, value: x.value }));
      const bySeverity = bySeverityRaw.map(x => ({ label: x._id, value: x.value }));
      return json(res, 200, { byInfra, bySeverity, priority });
    }

    return json(res, 404, { message: 'API route not found' });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { message: 'Server error' });
    else res.end();
  }
}

if (require.main === module) {
  const server = http.createServer(handler);
  server.listen(PORT, () => console.log(`InfraPredict AI running at http://localhost:${PORT}`));
}

module.exports = handler;
