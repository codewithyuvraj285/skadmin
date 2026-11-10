'use strict';
/* Print backend: zero dependencies. API + admin panel + image uploads. Node 18+ */
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,DIR=path.resolve(process.env.DATA_DIR||path.join(__dirname,'data')),UP=path.join(DIR,'uploads'),ADMIN=['admin-v2','admin-concept','admin'].map(d=>path.join(__dirname,d)).find(d=>fs.existsSync(path.join(d,d.endsWith('admin-v2')?'index.html':'pqadmin.html')))||path.join(__dirname,'admin');
const ORIGINS=(process.env.ALLOWED_ORIGINS||'*').split(',').map(s=>s.trim()),USER=process.env.ADMIN_USER||'admin';
let PASS=process.env.ADMIN_PASS;if(!PASS){PASS=crypto.randomBytes(5).toString('hex');console.log('\n[PRINT] ADMIN_PASS not set. Temporary password: '+PASS+'\n')}
fs.mkdirSync(UP,{recursive:true});const DBF=path.join(DIR,'db.json');let db;
const BK=path.join(DIR,'backups');let lastBk=0;const backup=()=>{if(Date.now()-lastBk<864e5)return;lastBk=Date.now();try{fs.mkdirSync(BK,{recursive:true});fs.copyFileSync(DBF,path.join(BK,'db-'+new Date().toISOString().slice(0,10)+'.json'));fs.readdirSync(BK).sort().slice(0,-14).forEach(f=>fs.unlinkSync(path.join(BK,f)))}catch(e){}};
const save=()=>{fs.writeFileSync(DBF+'.tmp',JSON.stringify(db));fs.renameSync(DBF+'.tmp',DBF);backup()};
try{db=JSON.parse(fs.readFileSync(DBF,'utf8'))}catch(e){db=JSON.parse(fs.readFileSync(path.join(__dirname,'seed.json'),'utf8'))}
const SECRET=process.env.SECRET||(db.secret=db.secret||crypto.randomBytes(24).toString('hex'));save();
const S=(v,n=300)=>String(v==null?'':v).trim().slice(0,n),N=v=>Math.max(0,Number(v)||0),arr=v=>(Array.isArray(v)?v:String(v||'').split(',')).map(x=>S(x,500)).filter(Boolean).slice(0,30);
const STK=v=>v===''||v==null?null:Math.max(0,parseInt(v,10)||0),ids=(v,n)=>(Array.isArray(v)?v:[]).map(x=>parseInt(x,10)).filter(x=>x>0).slice(0,n),SEC=['hero','trust','categories','new','featured','best','occasions','lookbook','story','journal','social','newsletter'],EML=/^[^\s@]{1,64}@[^\s@]{1,200}\.[^\s@]{2,}$/;
const cleanHtml=h=>String(h||'').slice(0,60000).replace(/<\s*(script|style|iframe|object|embed|link|meta|form)[\s\S]*?(<\/\s*\1\s*>|$)/gi,'').replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta|form)[^>]*>/gi,'').replace(/([\s\/"'])on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,'$1').replace(/(href|src)\s*=\s*(["']?)\s*(javascript|data|vbscript):/gi,'$1=$2#');
const slug=s=>S(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const CLEAN={
products:b=>{const im=arr(b.images);return{name:S(b.name),category:S(b.category),occasion:S(b.occasion),price:N(b.price),mrp:N(b.mrp),image:im[0]||'',images:im,colors:arr(b.colors).filter(c=>/^#[0-9a-f]{3,8}$/i.test(c)),sizes:arr(b.sizes).map(x=>x.slice(0,20)),desc:S(b.desc,3000),featured:!!b.featured,active:b.active!==false,status:b.status==='draft'?'draft':'published',stock:STK(b.stock),sku:S(b.sku,40),fabric:S(b.fabric,120),care:S(b.care,300),sold:N(b.sold)}},
categories:b=>({name:S(b.name),slug:slug(b.slug||b.name),image:S(b.image,500),description:S(b.description,400),visible:b.visible!==false,order:b.order===''||b.order==null?null:N(b.order)}),
blogs:b=>({title:S(b.title),cat:S(b.cat),date:S(b.date,10)||new Date().toISOString().slice(0,10),image:S(b.image,500),excerpt:S(b.excerpt,500),body:(Array.isArray(b.body)?b.body:String(b.body||'').split(/\n\s*\n/)).map(x=>S(x,4000)).filter(Boolean),published:b.published!==false,html:cleanHtml(b.html),seoTitle:S(b.seoTitle,70),seoDesc:S(b.seoDesc,160)}),
orders:b=>({status:['new','contacted','completed','cancelled'].includes(b.status)?b.status:'new'}),
settings:b=>({brand:S(b.brand,60),tagline:S(b.tagline,160),announcement:S(b.announcement),phone:S(b.phone,20).replace(/\D/g,''),address:S(b.address),instagram:S(b.instagram,200),website:S(b.website,200),occasions:arr(b.occasions),heroSlides:(Array.isArray(b.heroSlides)?b.heroSlides:[]).slice(0,3).map(h=>({eyebrow:S(h.eyebrow,60),title:S(h.title,120),button:S(h.button,30),link:S(h.link,200),image:S(h.image,500)})),
email:S(b.email,120),hours:S(b.hours,120),logo:S(b.logo,500),footerText:S(b.footerText,300),
nav:(Array.isArray(b.nav)?b.nav:[]).slice(0,8).map(n=>({label:S(n.label,30),url:S(n.url,200)})).filter(n=>n.label&&n.url&&!/^\s*(javascript|data):/i.test(n.url)),
sections:(Array.isArray(b.sections)?b.sections:[]).filter(x=>x&&SEC.includes(x.key)).map(x=>({key:x.key,on:x.on!==false})),
featuredProductIds:ids(b.featuredProductIds,24),featuredCategoryIds:ids(b.featuredCategoryIds,12),
lookbook:(Array.isArray(b.lookbook)?b.lookbook:[]).slice(0,3).map(l=>({image:S(l.image,500),title:S(l.title,60),link:S(l.link,200)})),
story:{eyebrow:S((b.story||{}).eyebrow,40),title:S((b.story||{}).title,120),text:S((b.story||{}).text,600),image:S((b.story||{}).image,500),button:S((b.story||{}).button,30),link:S((b.story||{}).link,200)},
trust:arr(b.trust).slice(0,4).map(x=>x.slice(0,60)),instagramImages:arr(b.instagramImages).slice(0,6)})};
const b64=s=>Buffer.from(s).toString('base64url'),mac=s=>crypto.createHmac('sha256',SECRET).update(s).digest('base64url');
const sign=()=>{const p=b64(JSON.stringify({u:USER,v:(db.auth&&db.auth.v)||0,e:Date.now()+6048e5}));return p+'.'+mac(p)};
const hpw=(p,salt)=>crypto.scryptSync(String(p),salt,32),pwOk=p=>db.auth?crypto.timingSafeEqual(hpw(p,db.auth.salt),Buffer.from(db.auth.hash,'hex')):crypto.timingSafeEqual(sha(p),sha(PASS));
const verify=t=>{try{const[p,s]=String(t).split('.');if(!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(mac(p))))return false;const j=JSON.parse(Buffer.from(p,'base64url'));return j.e>Date.now()&&(j.v||0)===((db.auth&&db.auth.v)||0)}catch(e){return false}};
const sha=x=>crypto.createHash('sha256').update(String(x)).digest(),hits=new Map();
const rl=(k,max,ms)=>{const n=Date.now(),a=(hits.get(k)||[]).filter(t=>n-t<ms);a.push(n);hits.set(k,a);return a.length>max};
const body=(req,max=9e6)=>new Promise((ok,no)=>{let n=0;const c=[];req.on('data',d=>{n+=d.length;if(n>max){no(Object.assign(new Error('File too large'),{code:413}));req.destroy()}else c.push(d)});req.on('end',()=>{try{ok(c.length?JSON.parse(Buffer.concat(c)):{})}catch(e){no(Object.assign(new Error('Bad request'),{code:400}))}})});
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
function serve(res,root,rel){let f=path.normalize(path.join(root,rel));if(!f.startsWith(root)){res.writeHead(403);return res.end()}
try{if(fs.statSync(f).isDirectory())f=path.join(f,fs.existsSync(path.join(f,'pqadmin.html'))?'pqadmin.html':'index.html');const b=fs.readFileSync(f);res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':root===UP?'public,max-age=31536000,immutable':'no-cache'});res.end(b)}catch(e){res.writeHead(404);res.end('Not found')}}
http.createServer(async(req,res)=>{
const base=process.env.BASE_URL||((req.headers['x-forwarded-proto']||'http')+'://'+req.headers.host);
const json=(c,d,abs)=>{res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(d,abs?(k,v)=>typeof v==='string'&&v.startsWith('/uploads/')?base+v:v:null))};
try{const p=decodeURIComponent(new URL(req.url,'http://x').pathname),o=req.headers.origin,m=req.method,ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim();
res.setHeader('X-Content-Type-Options','nosniff');
if(ORIGINS.includes('*'))res.setHeader('Access-Control-Allow-Origin','*');else if(ORIGINS.includes(o)){res.setHeader('Access-Control-Allow-Origin',o);res.setHeader('Vary','Origin')}
res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
if(m==='OPTIONS'){res.writeHead(204);return res.end()}
if(p==='/'||p==='/admin'){res.writeHead(302,{Location:'/admin/'});return res.end()}
if(p.startsWith('/uploads/'))return serve(res,UP,p.slice(9));if(p.startsWith('/admin/'))return serve(res,ADMIN,p.slice(7));
if(p==='/sitemap.xml'){const w=String(db.settings.website||'').replace(/\/$/,'');if(!w){res.writeHead(404);return res.end('Set Website address in admin settings')}const u=['','shop.html','blog.html','contact.html',...db.products.filter(x=>x.active&&x.status!=='draft').map(x=>'product.html?id='+x.id),...db.blogs.filter(x=>x.published).map(x=>'post.html?id='+x.id)];const X=t=>t.replace(/&/g,'&amp;');res.writeHead(200,{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public,max-age=3600'});return res.end('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+u.map(x=>'<url><loc>'+X(w+'/'+x)+'</loc></url>').join('')+'</urlset>')}
if(!p.startsWith('/api/'))return json(404,{error:'Not found'});const seg=p.slice(5).split('/');
if(m==='GET'&&seg[0]==='public'){res.setHeader('Cache-Control','public,max-age=20');return json(200,{settings:db.settings,categories:db.categories,products:db.products.filter(x=>x.active&&x.status!=='draft').reverse(),blogs:db.blogs.filter(x=>x.published).sort((a,b)=>b.date.localeCompare(a.date))},true)}
if(m==='POST'&&seg[0]==='login'){if(rl('l'+ip,10,6e5))return json(429,{error:'Too many attempts. Try later.'});const b=await body(req);
return crypto.timingSafeEqual(sha(b.user),sha(USER))&&pwOk(b.pass)?json(200,{token:sign()}):json(401,{error:'Wrong username or password'})}
if(m==='POST'&&seg[0]==='orders'){if(rl('o'+ip,20,6e5))return json(429,{error:'Too many requests'});const b=await body(req,2e5);
const items=(Array.isArray(b.items)?b.items:[]).slice(0,30).map(i=>{const q=db.products.find(x=>x.id===N(i.id));if(!q||q.status==='draft'||!q.active)return null;const qty=Math.min(99,N(i.qty)||1);if(q.stock!=null&&qty>q.stock)return null;return{id:q.id,name:q.name,size:S(i.size,20),color:/^#[0-9a-f]{3,8}$/i.test(i.color||'')?i.color:'',qty,price:q.price}}).filter(Boolean);
if(Array.isArray(b.items)&&b.items.length&&items.length<Math.min(b.items.length,30))return json(400,{error:'Some items are out of stock or no longer available. Please refresh your bag.'});
const tot={};for(const i of items){tot[i.id]=(tot[i.id]||0)+i.qty;const q=db.products.find(x=>x.id===i.id);if(q.stock!=null&&tot[i.id]>q.stock)return json(400,{error:'Some items are out of stock or no longer available. Please refresh your bag.'})}
const o={id:++db.seq,type:['order','enquiry','subscribe'].includes(b.type)?b.type:'order',name:S(b.name,80),phone:S(b.phone,20),email:EML.test(S(b.email,120))?S(b.email,120):'',city:S(b.city,80),address:S(b.address,300),note:S(b.note,1000),items,total:items.reduce((a,i)=>a+i.price*i.qty,0),status:'new',createdAt:new Date().toISOString()};
if(!items.length&&!o.phone&&!o.note)return json(400,{error:'Empty'});db.orders.push(o);db.orders=db.orders.slice(-3000);save();return json(200,{ok:1})}
if(seg[0]!=='admin')return json(404,{error:'Not found'});
if(!verify((req.headers.authorization||'').replace('Bearer ','')))return json(401,{error:'Please log in'});
const col=seg[1],id=+seg[2];
if(col==='all'&&m==='GET')return json(200,{settings:db.settings,categories:db.categories,products:db.products,blogs:db.blogs,orders:db.orders.slice().reverse()});
if(col==='upload'&&m==='POST'){const b=await body(req),x=/^data:image\/(jpeg|png|webp);base64,/.exec(b.data||'');if(!x)return json(400,{error:'Only JPG, PNG or WebP images'});
const f=crypto.randomBytes(8).toString('hex')+(x[1]==='jpeg'?'.jpg':'.'+x[1]);fs.writeFileSync(path.join(UP,f),Buffer.from(b.data.slice(x[0].length),'base64'));return json(200,{url:'/uploads/'+f})}
if(col==='password'&&m==='POST'){if(rl('p'+ip,8,6e5))return json(429,{error:'Too many attempts'});const b=await body(req,1e4);if(!pwOk(b.current))return json(400,{error:'Current password is wrong'});if(String(b.next||'').length<8)return json(400,{error:'New password must be at least 8 characters'});const salt=crypto.randomBytes(16).toString('hex');db.auth={salt,hash:hpw(b.next,salt).toString('hex'),v:((db.auth&&db.auth.v)||0)+1};save();return json(200,{token:sign()})}
if(col==='settings'&&m==='PUT'){const bb=await body(req),c=CLEAN.settings(bb);['brand','tagline','nav','sections','featuredProductIds','featuredCategoryIds','lookbook','story','trust','instagramImages','email','hours','logo','footerText'].forEach(k=>{if(bb[k]===undefined)delete c[k]});db.settings=c;save();return json(200,db.settings)}
if(!['products','categories','blogs','orders'].includes(col))return json(404,{error:'Not found'});const L=db[col];
if(m==='POST'&&col!=='orders'){const d=CLEAN[col](await body(req));if(!(d.name||d.title))return json(400,{error:'Name is required'});const it={id:++db.seq,createdAt:new Date().toISOString(),...d};L.push(it);save();return json(200,it)}
const i=L.findIndex(x=>x.id===id);if(i<0)return json(404,{error:'Not found'});
if(col==='orders'&&m==='PUT'){const d=CLEAN.orders(await body(req)),o=L[i],mv=k=>(o.items||[]).forEach(t=>{const q=db.products.find(x=>x.id===t.id);if(q){if(q.stock!=null)q.stock=Math.max(0,q.stock+k*-t.qty);q.sold=Math.max(0,(q.sold||0)+k*t.qty)}});
if(d.status==='completed'&&o.type==='order'&&!o.stockApplied){mv(1);o.stockApplied=true}else if(d.status!=='completed'&&o.stockApplied){mv(-1);o.stockApplied=false}o.status=d.status;save();return json(200,o)}
if(m==='PUT'){const d=CLEAN[col](await body(req));if(col!=='orders'&&!(d.name||d.title))return json(400,{error:'Name is required'});L[i]={...L[i],...d};save();return json(200,L[i])}
if(m==='DELETE'){L.splice(i,1);save();return json(200,{ok:1})}
json(405,{error:'Method not allowed'})}catch(e){json(e.code||500,{error:e.code?e.message:'Server error'})}
}).listen(PORT,()=>console.log('[PRINT] running on http://localhost:'+PORT+'  admin: /admin/'));
