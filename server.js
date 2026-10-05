const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, ensureSeedData, hashPassword, verifyPassword } = require('./db');


function loadEnvFile(){
  const envPath=path.join(__dirname,'.env');
  if(!fs.existsSync(envPath))return;
  for(const line of fs.readFileSync(envPath,'utf8').split(/\r?\n/)){
    const t=line.trim(); if(!t||t.startsWith('#')||!t.includes('='))continue;
    const i=t.indexOf('='); const key=t.slice(0,i).trim(); const value=t.slice(i+1).trim();
    if(!(key in process.env))process.env[key]=value;
  }
}
loadEnvFile();
ensureSeedData();
const PORT = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, 'public');

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Content-Length':data.length,'Cache-Control':'no-store'});
  res.end(data);
}
function parseBody(req) {
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data',c=>{raw+=c;if(raw.length>1_000_000){reject(new Error('Payload too large'));req.destroy();}});
    req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(new Error('Invalid JSON'))}});
    req.on('error',reject);
  });
}
function tokenFor(userId){
  const token=crypto.randomBytes(32).toString('hex');
  const expires=Date.now()+12*60*60*1000;
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)').run(token,userId,expires);
  return token;
}
function currentUser(req){
  const h=req.headers.authorization||'';
  const token=h.startsWith('Bearer ')?h.slice(7):'';
  if(!token)return null;
  const row=db.prepare(`SELECT u.id,u.name,u.mobile,u.email,u.role,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?`).get(token);
  if(!row||row.expires_at<Date.now()){if(row)db.prepare('DELETE FROM sessions WHERE token=?').run(token);return null;}
  return row;
}
function safeUser(u){return {id:u.id,name:u.name,mobile:u.mobile,email:u.email,role:u.role};}
function departmentFor(type){return ({'Road':'Road & Transport Department','Bridge':'Public Works Department (PWD)','Streetlight':'Electricity / Municipal Department','Water Pipeline':'Water Supply Department','Drainage':'Municipal / Drainage Department','Public Building':'Public Works Department (PWD)'})[type]||'Municipal Authority';}
function riskFor(severity){return ({Critical:95,High:80,Medium:55,Low:25})[severity]||25;}
function complaintRows(sql, params=[]){return db.prepare(sql).all(...params);}
function serveStatic(req,res){
  let pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/')pathname='/index.html';
  const requested=path.normalize(path.join(publicDir,pathname));
  if(!requested.startsWith(publicDir))return false;
  if(fs.existsSync(requested)&&fs.statSync(requested).isFile()){
    const ext=path.extname(requested).toLowerCase();
    const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
    const data=fs.readFileSync(requested);res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Content-Length':data.length});res.end(data);return true;
  }
  return false;
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    const pathname=url.pathname;
    if(pathname==='/api/health'&&req.method==='GET')return json(res,200,{ok:true,service:'InfraPredict AI API'});

    if(pathname==='/api/auth/register'&&req.method==='POST'){
      const {name,mobile,email,password}=await parseBody(req);
      if(!name||!mobile||!email||!password)return json(res,400,{message:'Please fill all fields'});
      if(!/^\d{10}$/.test(String(mobile)))return json(res,400,{message:'Enter a valid 10 digit mobile number'});
      if(String(password).length<4)return json(res,400,{message:'Password must contain at least 4 characters'});
      try{
        const info=db.prepare('INSERT INTO users(name,mobile,email,password_hash,role) VALUES(?,?,?,?,?)').run(String(name).trim(),String(mobile),String(email).trim().toLowerCase(),hashPassword(String(password)),'citizen');
        const user=db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
        return json(res,201,{message:'Registration successful',token:tokenFor(user.id),user:safeUser(user)});
      }catch(e){if(String(e.message).includes('UNIQUE'))return json(res,409,{message:'Mobile number or email is already registered'});throw e;}
    }

    if(pathname==='/api/auth/login'&&req.method==='POST'){
      const {loginId,password,role}=await parseBody(req);
      if(!loginId||!password)return json(res,400,{message:'Enter login ID and password'});
      let user;
      if(role==='admin'){
        const adminUsername=(process.env.ADMIN_USERNAME||'admin').toLowerCase();
        if(String(loginId).trim().toLowerCase()!==adminUsername)return json(res,401,{message:'Invalid admin username or password'});
        user=db.prepare("SELECT * FROM users WHERE role='admin' LIMIT 1").get();
      }else user=db.prepare("SELECT * FROM users WHERE role='citizen' AND (lower(email)=lower(?) OR mobile=?)").get(String(loginId).trim(),String(loginId).trim());
      if(!user||!verifyPassword(String(password),user.password_hash))return json(res,401,{message:'Invalid login details'});
      return json(res,200,{token:tokenFor(user.id),user:safeUser(user)});
    }

    const user=currentUser(req);
    if(pathname.startsWith('/api/')&&!user)return json(res,401,{message:'Authentication required'});
    if(pathname==='/api/me'&&req.method==='GET')return json(res,200,{user:safeUser(user)});

    if(pathname==='/api/complaints'&&req.method==='GET'){
      if(user.role==='admin'){
        const status=url.searchParams.get('status')||'All', department=url.searchParams.get('department')||'All', search=url.searchParams.get('search')||'';
        let sql=`SELECT c.*,u.name citizen,u.mobile,u.email FROM complaints c JOIN users u ON u.id=c.user_id WHERE 1=1`;const params=[];
        if(status!=='All'){sql+=' AND c.status=?';params.push(status)} if(department!=='All'){sql+=' AND c.department=?';params.push(department)}
        if(search){sql+=' AND (lower(c.request_id) LIKE ? OR lower(u.name) LIKE ? OR u.mobile LIKE ?)';const q=`%${search.toLowerCase()}%`;params.push(q,q,`%${search}%`)}
        sql+=' ORDER BY c.risk DESC,c.id DESC';return json(res,200,{complaints:complaintRows(sql,params)});
      }
      return json(res,200,{complaints:complaintRows(`SELECT c.*,u.name citizen,u.mobile,u.email FROM complaints c JOIN users u ON u.id=c.user_id WHERE c.user_id=? ORDER BY c.id DESC`,[user.id])});
    }

    if(pathname==='/api/complaints'&&req.method==='POST'){
      if(user.role!=='citizen')return json(res,403,{message:'Citizen account required'});
      const {infrastructure,severity,location,latitude,longitude,description=''}=await parseBody(req);
      const allowed=['Road','Bridge','Streetlight','Water Pipeline','Drainage','Public Building'], levels=['Critical','High','Medium','Low'];
      if(!allowed.includes(infrastructure)||!levels.includes(severity)||!location)return json(res,400,{message:'Infrastructure type, severity and location are required'});
      const requestId=`REQ-${Date.now()}-${Math.floor(Math.random()*900+100)}`;
      db.prepare(`INSERT INTO complaints(request_id,user_id,infrastructure,severity,location,latitude,longitude,description,department,risk,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
        .run(requestId,user.id,infrastructure,severity,String(location),latitude??null,longitude??null,String(description).trim(),departmentFor(infrastructure),riskFor(severity),'Pending');
      return json(res,201,{message:'Request submitted successfully',complaint:db.prepare('SELECT * FROM complaints WHERE request_id=?').get(requestId)});
    }

    const statusMatch=pathname.match(/^\/api\/complaints\/([^/]+)\/status$/);
    if(statusMatch&&req.method==='PATCH'){
      if(user.role!=='admin')return json(res,403,{message:'Admin access required'});
      const {status}=await parseBody(req);if(!['Pending','In Progress','Resolved'].includes(status))return json(res,400,{message:'Invalid status'});
      const info=db.prepare('UPDATE complaints SET status=?,updated_at=CURRENT_TIMESTAMP WHERE request_id=?').run(status,decodeURIComponent(statusMatch[1]));
      return info.changes?json(res,200,{message:'Status updated'}):json(res,404,{message:'Request not found'});
    }
    const deleteMatch=pathname.match(/^\/api\/complaints\/([^/]+)$/);
    if(deleteMatch&&req.method==='DELETE'){
      if(user.role!=='admin')return json(res,403,{message:'Admin access required'});
      const info=db.prepare('DELETE FROM complaints WHERE request_id=?').run(decodeURIComponent(deleteMatch[1]));
      return info.changes?json(res,200,{message:'Request deleted'}):json(res,404,{message:'Request not found'});
    }

    if(pathname==='/api/dashboard'&&req.method==='GET'){
      const row=user.role==='admin'?db.prepare(`SELECT COUNT(*) total,SUM(status='Pending') pending,SUM(status='In Progress') progress,SUM(status='Resolved') resolved,SUM(severity='Critical') critical FROM complaints`).get():db.prepare(`SELECT COUNT(*) total,SUM(status='Pending') pending,SUM(status='In Progress') progress,SUM(status='Resolved') resolved,SUM(severity='Critical') critical FROM complaints WHERE user_id=?`).get(user.id);
      return json(res,200,{stats:{total:row.total||0,pending:row.pending||0,progress:row.progress||0,resolved:row.resolved||0,critical:row.critical||0}});
    }
    if(pathname==='/api/analytics'&&req.method==='GET'){
      if(user.role!=='admin')return json(res,403,{message:'Admin access required'});
      const byInfra=db.prepare('SELECT infrastructure label,COUNT(*) value FROM complaints GROUP BY infrastructure ORDER BY value DESC').all();
      const bySeverity=db.prepare('SELECT severity label,COUNT(*) value FROM complaints GROUP BY severity ORDER BY value DESC').all();
      const priority=db.prepare(`SELECT c.request_id,c.infrastructure,c.severity,c.risk,c.status,c.department,u.name citizen FROM complaints c JOIN users u ON u.id=c.user_id ORDER BY CASE WHEN c.status='Resolved' THEN 1 ELSE 0 END,c.risk DESC,c.id ASC LIMIT 8`).all();
      return json(res,200,{byInfra,bySeverity,priority});
    }

    if(pathname.startsWith('/api/'))return json(res,404,{message:'API route not found'});
    if(serveStatic(req,res))return;
    const index=fs.readFileSync(path.join(publicDir,'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':index.length});res.end(index);
  }catch(e){console.error(e);if(!res.headersSent)json(res,500,{message:'Server error'});else res.end();}
});
server.listen(PORT,()=>console.log(`InfraPredict AI running at http://localhost:${PORT}`));
