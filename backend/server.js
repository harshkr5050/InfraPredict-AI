const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const authRoutes = require('./routes/auth');
const complaintRoutes = require('./routes/complaints');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors());
app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(__dirname,'../frontend')));

app.get('/api/health',(req,res)=>res.json({success:true,service:'InfraPredict AI API',status:'running'}));
app.use('/api/auth',authRoutes);
app.use('/api/complaints',complaintRoutes);
app.use('/api/admin',adminRoutes);
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'../frontend/index.html')));

const PORT=Number(process.env.PORT||5000);
app.listen(PORT,()=>console.log(`InfraPredict AI running on http://localhost:${PORT}`));
