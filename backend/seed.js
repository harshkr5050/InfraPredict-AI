const bcrypt = require('bcryptjs');
const db = require('./db');
require('dotenv').config();

(async()=>{
  try{
    const hash=await bcrypt.hash('admin123',10);
    await db.execute(`INSERT INTO users (name,username,email,password,role) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE password=VALUES(password),role='admin'`,['System Administrator','admin','admin@infrapredict.local',hash,'admin']);
    console.log('Admin ready: username=admin password=admin123');
  }catch(e){console.error(e);process.exitCode=1;}finally{await db.end();}
})();
