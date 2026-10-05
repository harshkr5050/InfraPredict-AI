const express = require('express');
const db = require('../db');
const { auth } = require('../middleware');
const router = express.Router();

const departments = {
  Road:'Road & Transport Department', Bridge:'Public Works Department (PWD)', Streetlight:'Electricity / Municipal Department',
  'Water Pipeline':'Water Supply Department', Drainage:'Municipal / Drainage Department', 'Public Building':'Public Works Department (PWD)'
};
const risks = { Critical:95, High:80, Medium:55, Low:25 };

router.post('/', auth, async (req,res) => {
  try {
    const { infrastructure, severity, location, latitude, longitude, description } = req.body;
    if (!infrastructure || !severity) return res.status(400).json({message:'Infrastructure and severity are required'});
    const [users] = await db.execute('SELECT id,name,mobile,email FROM users WHERE id=? AND role="citizen"', [req.user.id]);
    if (!users.length) return res.status(404).json({message:'Citizen not found'});
    const u = users[0];
    const requestId = 'REQ-' + Date.now().toString(36).toUpperCase();
    const department = departments[infrastructure] || 'Municipal Department';
    const risk = risks[severity] || 25;
    await db.execute(`INSERT INTO complaints (request_id,user_id,citizen_name,citizen_mobile,citizen_email,infrastructure,severity,location,latitude,longitude,description,department,risk,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [requestId,u.id,u.name,u.mobile,u.email,infrastructure,severity,location||'',latitude||null,longitude||null,description||'',department,risk,'Pending']);
    res.status(201).json({success:true, requestId, department, risk, status:'Pending'});
  } catch(e){ console.error(e); res.status(500).json({message:'Server error'}); }
});

router.get('/my', auth, async (req,res)=>{
  try { const [rows] = await db.execute('SELECT * FROM complaints WHERE user_id=? ORDER BY created_at DESC',[req.user.id]); res.json(rows); }
  catch(e){ console.error(e); res.status(500).json({message:'Server error'}); }
});

module.exports = router;
