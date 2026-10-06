const {MongoClient}=require('mongodb');
const bcrypt=require('bcryptjs');
const crypto=require('node:crypto');
let connection;
const DB='xpertone_storefront',COOKIE='xo_admin_session';
function secret(){const s=process.env.ADMIN_SESSION_SECRET;if(!s||s.length<32)throw Error('CONFIG');return s;}
async function database(){
  if(!process.env.MONGODB_URI)throw Error('CONFIG');
  if(!connection)connection=new MongoClient(process.env.MONGODB_URI,{maxPoolSize:3,minPoolSize:0,serverSelectionTimeoutMS:7000}).connect().catch(e=>{connection=null;throw e});
  return (await connection).db(DB);
}
function digest(value){return crypto.createHmac('sha256',secret()).update(value).digest('base64url');}
function token(user){const payload=Buffer.from(JSON.stringify({id:user._id,exp:Math.floor(Date.now()/1000)+28800,pv:digest(user.password_hash)})).toString('base64url');return payload+'.'+digest(payload);}
function readToken(value){
  if(typeof value!=='string'||value.length>1500)return null;
  const [payload,signature,extra]=value.split('.');if(extra||!payload||!signature)return null;
  const expected=Buffer.from(digest(payload)),provided=Buffer.from(signature);
  if(provided.length!==expected.length||!crypto.timingSafeEqual(provided,expected))return null;
  try{const p=JSON.parse(Buffer.from(payload,'base64url'));return typeof p.id==='string'&&p.exp>Date.now()/1000?p:null}catch{return null}
}
function body(req){const b=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!b||typeof b!=='object'||Array.isArray(b)||JSON.stringify(b).length>200000)throw Error('INVALID');return b;}
function sameOrigin(req){return req.headers.origin==='https://'+req.headers.host;}
function cookie(res,value,age=28800){res.setHeader('Set-Cookie',COOKIE+'='+value+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age='+age);}
function answer(res,status,data){return res.status(status).json(data);}
function clean(row){if(!row)return null;const {_id,password_hash,...rest}=row;return rest;}
async function authenticated(req,db){
  const match=(req.headers.cookie||'').match(/(?:^|;\s*)xo_admin_session=([^;]+)/);
  const claims=readToken(match?.[1]);if(!claims)throw Error('UNAUTHORIZED');
  const u=await db.collection('admin_users').findOne({_id:claims.id,is_active:true,role:'admin'});
  if(!u||claims.pv!==digest(u.password_hash))throw Error('UNAUTHORIZED');return u;
}
async function limited(db,req,email){
  const ip=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
  const key=digest(ip+'|'+email.toLowerCase()),bucket=Math.floor(Date.now()/900000);
  const row=await db.collection('login_limits').findOneAndUpdate({_id:key+'|'+bucket},{$inc:{attempts:1},$setOnInsert:{expiresAt:new Date(Date.now()+1800000)}},{upsert:true,returnDocument:'after',includeResultMetadata:false});
  if(row.attempts>8)throw Error('RATE_LIMIT');
  // Expired counters are pruned without retaining visitor IP addresses.
  await db.collection('login_limits').deleteMany({expiresAt:{$lt:new Date()}});
}
const tables=new Set(['products','categories','settings','profiles']);
const filters=new Set(['id','slug','sku','category_slug','is_active','is_hidden']);
const fields={products:new Set(['title','supplier_code','category_slug','cost_price','price_override','markup_pct','images','sizes','features','subtitle','description','material','colour','origin','standard','packing','gsm','dimensions','attribute','is_active','is_hidden','stock_total','stock_by_size','sort_order','subcategory','subcategory_slug','unit','carton_qty']),categories:new Set(['name','markup_pct','sort_order','is_active','display_image_url']),settings:new Set(['default_markup_pct','vat_rate','moq','free_delivery_threshold','delivery_fee','price_note'])};
function filter(query){const out={deleted_at:{$exists:false}};for(const f of query.filters||[]){if(!filters.has(f.field))throw Error('INVALID');if(f.kind==='eq'&&['string','number','boolean'].includes(typeof f.value))out[f.field]=f.value;else if(f.kind==='in'&&Array.isArray(f.value)&&f.value.length<=1000&&f.value.every(x=>typeof x==='string'))out[f.field]={$in:f.value};else throw Error('INVALID');}return out;}
function validate(table,input){
  if(!input||Array.isArray(input)||typeof input!=='object')throw Error('INVALID');
  const out={};for(const [k,v]of Object.entries(input)){if(!fields[table]?.has(k))throw Error('INVALID');out[k]=v;}
  for(const k of ['cost_price','price_override','markup_pct','stock_total','sort_order','vat_rate','moq','delivery_fee','free_delivery_threshold','default_markup_pct','carton_qty'])if(k in out&&out[k]!==null&&(!Number.isFinite(out[k])||out[k]<0))throw Error('INVALID');
  for(const k of ['is_active','is_hidden'])if(k in out&&typeof out[k]!=='boolean')throw Error('INVALID');
  for(const k of ['images','sizes','features'])if(k in out&&(!Array.isArray(out[k])||out[k].length>100||out[k].some(x=>typeof x!=='string'||x.length>20000)))throw Error('INVALID');
  if(out.images?.some(u=>!/^https:\/\//.test(u)&&!u.startsWith('/assets/img/')))throw Error('INVALID');
  if(out.title!==undefined&&(typeof out.title!=='string'||!out.title.trim()||out.title.length>1000))throw Error('INVALID');
  out.updated_at=new Date().toISOString();return out;
}
function sellingPrice(p){
  if(p.price_override!==null&&p.price_override!==undefined)return Math.max(Math.round(Number(p.price_override)),1);
  if(p.cost_price===null||p.cost_price===undefined)return 1;
  const c=Number(p.cost_price);let n=p.category_slug==='safety-vests'?(c<=5?12:c<=9?20:c<=15?25:c+10):p.category_slug==='safety-shoes'?c+15:c*2;
  return Math.max(Math.round(n),1);
}
function publicProduct(p,c){
  const keys=['sku','title','slug','subcategory','subcategory_slug','sizes','images','attribute','description','subtitle','features','material','colour','origin','standard','packing','unit','gsm','dimensions','carton_qty','stock_total','stock_by_size','stock_updated_at'];
  const out={};for(const k of keys)out[k]=p[k];
  return {...out,id:p.sku,uid:p.category_slug+'-'+String(p.sku).toLowerCase(),source:'remart',category:p.category_slug,categoryName:c.name,price:sellingPrice(p),priceStatus:p.price_override!=null?'fixed':'indicative',imageSource:'remart',page:p.catalogue_page||0};
}
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  try{
    const action=req.query.action,db=await database();
    if(action==='catalogue'){
      const origin=req.headers.origin;if(['https://www.xpertonecreative.com','https://xpertonecreative.com'].includes(origin))res.setHeader('Access-Control-Allow-Origin',origin);
      res.setHeader('Vary','Origin');if(req.method==='OPTIONS')return res.status(204).end();if(req.method!=='GET')return answer(res,405,{error:'Method not allowed'});
      const categories=await db.collection('categories').find({is_active:true}).toArray(),cats=new Map(categories.map(c=>[c.slug,c]));
      const products=await db.collection('products').find({is_active:true,is_hidden:false,deleted_at:{$exists:false},category_slug:{$in:[...cats.keys()]}}).sort({sort_order:1,sku:1}).toArray();
      res.setHeader('Cache-Control','public, max-age=0, s-maxage=60, stale-while-revalidate=60');return answer(res,200,products.map(p=>publicProduct(p,cats.get(p.category_slug))));
    }
    if(req.method!=='GET'&&!sameOrigin(req))return answer(res,403,{error:'Origin not allowed'});
    if(action==='session'){
      if(req.method==='DELETE'){cookie(res,'',0);return answer(res,200,{data:null,error:null});}
      if(req.method==='POST'){
        const b=body(req);if(typeof b.email!=='string'||typeof b.password!=='string'||b.email.length>254||b.password.length>1024)throw Error('INVALID');
        await limited(db,req,b.email);const u=await db.collection('admin_users').findOne({email:b.email.toLowerCase().trim(),role:'admin',is_active:true});
        if(!u||!(await bcrypt.compare(b.password,u.password_hash)))return answer(res,401,{data:null,error:{message:'Email or password is incorrect.'}});
        cookie(res,token(u));return answer(res,200,{data:{user:{id:u._id,email:u.email}},error:null});
      }
      if(req.method!=='GET')return answer(res,405,{error:'Method not allowed'});
      const u=await authenticated(req,db);return answer(res,200,{data:{user:{id:u._id,email:u.email}},error:null});
    }
    if(action!=='query'||req.method!=='POST')return answer(res,404,{error:'Not found'});
    const user=await authenticated(req,db),q=body(req);if(!tables.has(q.table))throw Error('INVALID');
    if(q.table==='profiles')return answer(res,200,{data:q.single?{id:user._id,role:'admin',full_name:user.full_name,is_active:true}:[{id:user._id,role:'admin',full_name:user.full_name,is_active:true}],error:null});
    const collection=db.collection(q.table),where=filter(q);
    if(q.op==='select'){
      let cursor=collection.find(where);if(q.order&&['sort_order','sku','title','updated_at'].includes(q.order))cursor=cursor.sort({[q.order]:1});
      const from=Number.isInteger(q.from)&&q.from>=0?q.from:0,to=Number.isInteger(q.to)?q.to:from+999;
      const rows=await cursor.skip(from).limit(Math.max(1,Math.min(1000,to-from+1))).toArray();return answer(res,200,{data:q.single?clean(rows[0]):rows.map(clean),error:null});
    }
    if(q.op==='insert'&&q.table==='products'){
      const {sku,slug,supplier,sort_order,...input}=q.values;const p=validate('products',input);
      if(!/^XO[0-9]{7}$/.test(sku)||typeof slug!=='string'||slug.length>150)throw Error('INVALID');
      p.id=crypto.randomUUID();p._id=p.id;p.sku=sku;p.slug=slug;p.supplier='XpertOne';p.sort_order=Number(sort_order)||0;p.created_at=p.updated_at;
      await collection.insertOne(p);return answer(res,200,{data:[clean(p)],error:null});
    }
    if(!q.filters?.length)throw Error('INVALID');
    if(q.op==='update'){await collection.updateMany(where,{$set:validate(q.table,q.values)});return answer(res,200,{data:[],error:null});}
    if(q.op==='delete'&&q.table==='products'){const rows=await collection.find(where,{projection:{id:1}}).toArray();await collection.updateMany(where,{$set:{deleted_at:new Date().toISOString(),is_active:false,is_hidden:true}});return answer(res,200,{data:rows.map(clean),error:null});}
    throw Error('INVALID');
  }catch(e){const code=e.message;const status=code==='UNAUTHORIZED'?401:code==='RATE_LIMIT'?429:code==='INVALID'?400:503;return answer(res,status,{data:null,error:{message:code==='UNAUTHORIZED'?'Please sign in.':code==='RATE_LIMIT'?'Too many sign-in attempts. Try again in 15 minutes.':code==='INVALID'?'Invalid request.':'Admin service is temporarily unavailable.'}});}
};
module.exports._test={sellingPrice,publicProduct,readToken,token,validate,filter};
