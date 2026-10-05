const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware');
const router = express.Router();

router.get('/requests', auth, adminOnly, async (req,res)=>{
  try { const [rows] = await db.execute('SELECT * FROM complaints ORDER BY created_at DESC'); res.json(rows); }
  catch(e){ console.error(e); res.status(500).json({message:'Server error'}); }
});

router.put('/requests/:id/status', auth, adminOnly, async (req,res)=>{
  try {
    const allowed=['Pending','In Progress','Resolved'];
    if(!allowed.includes(req.body.status)) return res.status(400).json({message:'Invalid status'});
    await db.execute('UPDATE complaints SET status=? WHERE id=?',[req.body.status,req.params.id]);
    res.json({success:true,message:'Status updated'});
  } catch(e){ console.error(e); res.status(500).json({message:'Server error'}); }
});

router.delete('/requests/:id', auth, adminOnly, async (req,res)=>{
  try { await db.execute('DELETE FROM complaints WHERE id=?',[req.params.id]); res.json({success:true,message:'Request deleted'}); }
  catch(e){ console.error(e); res.status(500).json({message:'Server error'}); }
});

router.get('/analytics', auth, adminOnly, async (req,res)=>{
  try {
    const [rows] = await db.execute(`SELECT COUNT(*) total, SUM(status='Pending') pending, SUM(status='In Progress') progress, SUM(status='Resolved') resolved, SUM(severity='Critical') critical FROM complaints`);
    res.json(rows[0]);
  } catch(e){ console.error(e); res.status(500).json({message:'Server error'}); }
});

module.exports = router;
