const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

function makeToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
}

router.post('/register', async (req, res) => {
  try {
    const { name, mobile, email, password } = req.body;
    if (!name || !/^\d{10}$/.test(mobile || '') || !email || !password || password.length < 4) {
      return res.status(400).json({ message: 'Valid name, 10-digit mobile, email and 4+ character password are required' });
    }
    const [existing] = await db.execute('SELECT id FROM users WHERE mobile=? OR email=?', [mobile, email.toLowerCase()]);
    if (existing.length) return res.status(409).json({ message: 'Mobile or email is already registered' });
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.execute('INSERT INTO users (name,mobile,email,password,role) VALUES (?,?,?,?,?)', [name.trim(), mobile, email.toLowerCase(), hash, 'citizen']);
    res.status(201).json({ success: true, message: 'Registration successful', userId: result.insertId });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
});

router.post('/login', async (req, res) => {
  try {
    const { login, password, role } = req.body;
    if (!login || !password) return res.status(400).json({ message: 'Login and password are required' });
    let sql, params;
    if (role === 'admin') {
      sql = "SELECT * FROM users WHERE (username=? OR email=?) AND role='admin' LIMIT 1";
      params = [login, login.toLowerCase()];
    } else {
      sql = "SELECT * FROM users WHERE (mobile=? OR email=?) AND role='citizen' LIMIT 1";
      params = [login, login.toLowerCase()];
    }
    const [rows] = await db.execute(sql, params);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password))) return res.status(401).json({ message: 'Invalid login details' });
    const user = rows[0];
    const token = makeToken(user);
    res.json({ success: true, token, user: { id:user.id, name:user.name, username:user.username, mobile:user.mobile, email:user.email, role:user.role } });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
