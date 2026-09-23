import {getSession,authRoute} from './auth.mjs';
import {details,applyVariants,unpack,productSelect,commerceRoute} from './commerce.mjs';
import {mediaPath,mediaRoute} from './media.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const categories=['iPhone','Xiaomi','PlayStation','Xbox','Acessórios'];
const conditions=['Novo','Seminovo'];
function integer(v,min,max,label){if(!Number.isSafeInteger(v)||v<min||v>max)fail(label+' inválido.');return v;}
function text(v,max,label,required=false){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail(label+' inválido.');return v.trim();}
export function validateProduct(b){
 const p={name:text(b.name,120,'Nome',true),category:b.category,description:text(b.description,2000,'Descrição'),price:b.price===null?null:integer(b.price,0,100000000,'Preço'),stock:integer(b.stock,0,1000000,'Estoque'),low_stock:integer(b.low_stock,0,1000000,'Limite'),image:text(b.image,2000,'Imagem'),condition:b.condition};
 if(!categories.includes(p.category)||!conditions.includes(p.condition))fail('Categoria ou condição inválida.');
 if(p.image&&!mediaPath.test(p.image)){try{const u=new URL(p.image);if(u.protocol!=='https:'||u.username||u.password)fail('Foto inválida. Envie a foto novamente.');}catch{fail('Foto inválida. Envie a foto novamente.');}}
 for(const key of ['featured','published']){if(typeof b[key]!=='boolean')fail('Opção inválida.');p[key]=b[key]?1:0;}return p;
}
async function body(req){if(!req.headers.get('content-type')?.startsWith('application/json'))fail('Envie dados JSON.',415);const raw=await req.text();if(raw.length>50000)fail('Dados muito grandes.',413);try{const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw 0;return b;}catch{fail('Dados inválidos.');}}
export function createWorker(assets,schema){
 let initialized;
 async function init(db){if(!db)fail('Armazenamento indisponível. Tente novamente em instantes.',503);if(!initialized)initialized=(async()=>{for(const sql of schema.split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();})().catch(e=>{initialized=null;throw e;});await initialized;}
 return {async fetch(req,env){
  try{
   const url=new URL(req.url),path=url.pathname;
   if(path.startsWith('/api/')){
    await init(env.DB);
    if(path.startsWith('/api/auth/'))return await authRoute(req,env,path,body);
    const admin=path.startsWith('/api/admin/');
    const session=admin||path.startsWith('/api/favorites')?await getSession(req,env):null;
    if(admin&&session?.role!=='admin')return json({error:'Entre com a conta administradora para continuar.'},403);
    if(!['GET','HEAD'].includes(req.method)){
     if(!admin&&!path.startsWith('/api/favorites'))fail('Método não permitido.',405);
     if(req.headers.get('origin')!==url.origin)fail('Origem não autorizada.',403);
    }
    if(path==='/api/admin/session'&&req.method==='GET')return json({user:session});
    await init(env.DB);
    const db=env.DB;
    if(path==='/api/admin/media'||mediaPath.test(path))return await mediaRoute(req,env,path);
    const commerce=await commerceRoute(req,env,path,session,body);if(commerce)return commerce;
    if(path==='/api/catalog'&&req.method==='GET'){
     const results=await db.prepare(productSelect+' WHERE p.archived=0 AND p.published=1 ORDER BY p.featured DESC,p.created_at DESC').all();
     return json({products:results.results.map(unpack),settings:await db.prepare('SELECT theme,accent FROM settings WHERE id=1').first()});
    }
    if(path==='/api/admin/products'&&req.method==='GET')return json({products:(await db.prepare(productSelect+' ORDER BY p.created_at DESC').all()).results.map(unpack)});
    if(path==='/api/admin/products'&&req.method==='POST'){
     const b=await body(req),d=details(b.details),p=applyVariants(validateProduct(b),d);const id=crypto.randomUUID(),now=new Date().toISOString();
     await db.batch([db.prepare('INSERT INTO products(id,name,category,description,price,stock,low_stock,image,condition,featured,published,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,...Object.values(p),now,now),db.prepare('INSERT INTO product_details(product_id,data) VALUES(?,?)').bind(id,JSON.stringify(d))]);
     return json({product:unpack(await db.prepare(productSelect+' WHERE p.id=?').bind(id).first())},201);
    }
    const match=path.match(/^\/api\/admin\/products\/([a-zA-Z0-9-]+)$/);
    if(match&&req.method==='PUT'){
     const b=await body(req),d=details(b.details),p=applyVariants(validateProduct(b),d);integer(b.version,1,1e9,'Versão');
     const [r]=await db.batch([db.prepare('UPDATE products SET name=?,category=?,description=?,price=?,stock=?,low_stock=?,image=?,condition=?,featured=?,published=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND archived=0').bind(...Object.values(p),new Date().toISOString(),match[1],b.version),db.prepare('INSERT INTO product_details(product_id,data) SELECT ?,? WHERE changes()>0 ON CONFLICT(product_id) DO UPDATE SET data=excluded.data').bind(match[1],JSON.stringify(d))]);
     if(!r.meta.changes)fail('Este produto mudou em outra aba. Atualize a lista e tente novamente.',409);
     return json({product:unpack(await db.prepare(productSelect+' WHERE p.id=?').bind(match[1]).first())});
    }
    if(match&&req.method==='PATCH'){
     const b=await body(req);if(typeof b.archived!=='boolean')fail('Ação inválida.');integer(b.version,1,1e9,'Versão');
     const r=await db.prepare('UPDATE products SET archived=?,updated_at=?,version=version+1 WHERE id=? AND version=?').bind(b.archived?1:0,new Date().toISOString(),match[1],b.version).run();
     if(!r.meta.changes)fail('O produto mudou em outra aba. Atualize e tente novamente.',409);return json({ok:true});
    }
    if(path==='/api/admin/settings'&&req.method==='GET')return json(await db.prepare('SELECT * FROM settings WHERE id=1').first());
    if(path==='/api/admin/settings'&&req.method==='PUT'){
     const b=await body(req);if(!['light','dark','system'].includes(b.theme)||!['orange','blue','violet','green'].includes(b.accent))fail('Tema inválido.');integer(b.version,1,1e9,'Versão');
     const r=await db.prepare('UPDATE settings SET theme=?,accent=?,version=version+1 WHERE id=1 AND version=?').bind(b.theme,b.accent,b.version).run();if(!r.meta.changes)fail('O tema mudou em outra aba. Atualize para continuar.',409);return json(await db.prepare('SELECT * FROM settings WHERE id=1').first());
    }
    return json({error:'Endereço não encontrado.'},404);
   }
   if(path==='/admin'||path==='/admin/'){
    await init(env.DB);
    const user=await getSession(req,env);
    if(user?.role!=='admin')return new Response(null,{status:302,headers:{Location:'/conta?acesso=restrito','Cache-Control':'no-store'}});
   }
   const key=path==='/'?'/index.html':(/^\/produto\/[a-zA-Z0-9-]+\/?$/.test(path)?'/product.html':(path==='/conta'||path==='/conta/'?'/account.html':(path==='/admin'||path==='/admin/'?'/admin.html':path)));
   if(path==='/admin.html')return new Response('Não encontrado',{status:404});
   const asset=assets[path==='/admin'||path==='/admin/'?'/admin.html':key];
   if(!asset)return new Response('Não encontrado',{status:404});
   if(!['GET','HEAD'].includes(req.method))return new Response('Método não permitido',{status:405});
   return new Response(req.method==='HEAD'?null:(asset.binary?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body),{headers:{'Content-Type':asset.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"frame-ancestors 'self' https://*.chatgpt.com https://chatgpt.com https://*.openai.com"}});
  }catch(e){if(!e.status)console.error('Request failed',e.message);return json({error:e.status?e.message:'Não foi possível salvar ou carregar. Tente novamente.'},e.status||500);}
 }};
}
