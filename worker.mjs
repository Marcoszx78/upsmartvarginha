const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const categories=['iPhone','Xiaomi','PlayStation','Xbox','Acessórios'];
const conditions=['Novo','Seminovo'];
function integer(v,min,max,label){if(!Number.isSafeInteger(v)||v<min||v>max)fail(label+' inválido.');return v;}
function text(v,max,label,required=false){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail(label+' inválido.');return v.trim();}
export function validateProduct(b){
 const p={name:text(b.name,120,'Nome',true),category:b.category,description:text(b.description,2000,'Descrição'),price:b.price===null?null:integer(b.price,0,100000000,'Preço'),stock:integer(b.stock,0,1000000,'Estoque'),low_stock:integer(b.low_stock,0,1000000,'Limite'),image:text(b.image,2000,'Imagem'),condition:b.condition};
 if(!categories.includes(p.category)||!conditions.includes(p.condition))fail('Categoria ou condição inválida.');
 if(p.image){try{const u=new URL(p.image);if(u.protocol!=='https:'||u.username||u.password)fail('Use um link HTTPS para a imagem.');}catch{fail('Use um link HTTPS válido para a imagem.');}}
 for(const key of ['featured','published']){if(typeof b[key]!=='boolean')fail('Opção inválida.');p[key]=b[key]?1:0;}return p;
}
export function isAdmin(req,env){return Boolean(env.ADMIN_EMAIL&&req.headers.get('oai-authenticated-user-id')&&req.headers.get('oai-authenticated-user-email')?.toLowerCase()===env.ADMIN_EMAIL.toLowerCase());}
async function body(req){if(!req.headers.get('content-type')?.startsWith('application/json'))fail('Envie dados JSON.',415);const raw=await req.text();if(raw.length>12000)fail('Dados muito grandes.',413);try{return JSON.parse(raw);}catch{fail('Dados inválidos.');}}
export function createWorker(assets,schema){
 let initialized;
 async function init(db){if(!db)fail('Armazenamento indisponível. Tente novamente em instantes.',503);if(!initialized)initialized=db.exec(schema).catch(e=>{initialized=null;throw e;});await initialized;}
 return {async fetch(req,env){
  try{
   const url=new URL(req.url),path=url.pathname;
   if(path.startsWith('/api/')){
    const admin=path.startsWith('/api/admin/');
    if(admin&&!isAdmin(req,env))return json({error:'Entre com a conta administradora para continuar.'},403);
    if(!['GET','HEAD'].includes(req.method)){
     if(!admin)fail('Método não permitido.',405);
     if(req.headers.get('origin')!==url.origin)fail('Origem não autorizada.',403);
    }
    if(path==='/api/admin/session'&&req.method==='GET')return json({name:'Administrador',email:req.headers.get('oai-authenticated-user-email')});
    await init(env.DB);
    const db=env.DB;
    if(path==='/api/catalog'&&req.method==='GET'){
     const results=await db.prepare('SELECT id,name,category,description,price,stock,image,condition,featured FROM products WHERE archived=0 AND published=1 ORDER BY featured DESC,created_at DESC').all();
     return json({products:results.results,settings:await db.prepare('SELECT theme,accent FROM settings WHERE id=1').first()});
    }
    if(path==='/api/admin/products'&&req.method==='GET')return json({products:(await db.prepare('SELECT * FROM products ORDER BY created_at DESC').all()).results});
    if(path==='/api/admin/products'&&req.method==='POST'){
     const p=validateProduct(await body(req));const id=crypto.randomUUID(),now=new Date().toISOString();
     await db.prepare('INSERT INTO products(id,name,category,description,price,stock,low_stock,image,condition,featured,published,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,...Object.values(p),now,now).run();
     return json({product:await db.prepare('SELECT * FROM products WHERE id=?').bind(id).first()},201);
    }
    const match=path.match(/^\/api\/admin\/products\/([a-zA-Z0-9-]+)$/);
    if(match&&req.method==='PUT'){
     const b=await body(req),p=validateProduct(b);integer(b.version,1,1e9,'Versão');
     const r=await db.prepare('UPDATE products SET name=?,category=?,description=?,price=?,stock=?,low_stock=?,image=?,condition=?,featured=?,published=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND archived=0').bind(...Object.values(p),new Date().toISOString(),match[1],b.version).run();
     if(!r.meta.changes)fail('Este produto mudou em outra aba. Atualize a lista e tente novamente.',409);
     return json({product:await db.prepare('SELECT * FROM products WHERE id=?').bind(match[1]).first()});
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
    if(!isAdmin(req,env)){
     if(!req.headers.get('oai-authenticated-user-id'))return Response.redirect(url.origin+'/signin-with-chatgpt?return_to=%2Fadmin',302);
     return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Acesso restrito</title><body style="font:18px Arial;padding:40px"><h1>Acesso restrito</h1><p>Entre com a conta administradora para gerenciar a loja.</p><a href="/signout-with-chatgpt?return_to=%2Fadmin">Trocar de conta</a> · <a href="/">Voltar à loja</a></body></html>',{status:403,headers:{'Content-Type':'text/html; charset=utf-8'}});
    }
   }
   const key=path==='/'?'/index.html':(path==='/admin'||path==='/admin/'?'/admin.html':path);
   if(path==='/admin.html')return new Response('Não encontrado',{status:404});
   const asset=assets[path==='/admin'||path==='/admin/'?'/admin.html':key];
   if(!asset)return new Response('Não encontrado',{status:404});
   if(!['GET','HEAD'].includes(req.method))return new Response('Método não permitido',{status:405});
   return new Response(req.method==='HEAD'?null:(asset.binary?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body),{headers:{'Content-Type':asset.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"frame-ancestors 'self' https://*.chatgpt.com https://chatgpt.com https://*.openai.com"}});
  }catch(e){if(!e.status)console.error('Request failed',e.message);return json({error:e.status?e.message:'Não foi possível salvar ou carregar. Tente novamente.'},e.status||500);}
 }};
}
