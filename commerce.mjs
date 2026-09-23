import {mediaPath} from './media.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const str=(v,max=500)=>{if(typeof v!=='string'||v.length>max)fail('Texto inválido ou muito longo.');return v.trim();};
function url(v){v=str(v,2000);if(v&&!mediaPath.test(v)){try{const u=new URL(v);if(u.protocol!=='https:'||u.username||u.password)throw 0;}catch{fail('Foto inválida. Envie a foto novamente.');}}return v;}
export function details(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Detalhes inválidos.');
 const d={gallery:[],capacity:str(input.capacity??'',80),color:str(input.color??'',80),warranty:str(input.warranty??'',1000),specs:str(input.specs??'',3000),battery:input.battery??null,variants:[]};
 if(d.battery!==null&&(!Number.isInteger(d.battery)||d.battery<0||d.battery>100))fail('Saúde da bateria deve estar entre 0 e 100%.');
 if(!Array.isArray(input.gallery??[])||(input.gallery??[]).length>5)fail('Use até cinco fotos adicionais.');
 d.gallery=[...new Set((input.gallery??[]).map(url).filter(Boolean))];
 if(!Array.isArray(input.variants??[])||(input.variants??[]).length>20)fail('Use até 20 opções por produto.');
 const seen=new Set();
 d.variants=(input.variants??[]).map(v=>{const x={color:str(v.color??'',80),capacity:str(v.capacity??'',80),price:v.price,stock:v.stock};if(!x.color&&!x.capacity)fail('Informe a cor ou capacidade de cada opção.');const key=(x.color+'|'+x.capacity).toLowerCase();if(seen.has(key))fail('Há opções repetidas.');seen.add(key);if(x.price!==null&&(!Number.isSafeInteger(x.price)||x.price<0||x.price>100000000))fail('Preço da opção inválido.');if(!Number.isSafeInteger(x.stock)||x.stock<0||x.stock>1000000)fail('Estoque da opção inválido.');return x;});
 return d;
}
export function applyVariants(p,d){if(d.variants.length){p.stock=d.variants.reduce((n,v)=>n+v.stock,0);if(p.stock>1000000)fail('Estoque total muito grande.');p.price=d.variants.some(v=>v.price===null)?null:Math.min(...d.variants.map(v=>v.price));}return p;}
export const unpack=p=>{if(!p)return null;const {detail_json,...product}=p;return {...product,details:detail_json?JSON.parse(detail_json):details()};};
export const productSelect='SELECT p.*,d.data AS detail_json FROM products p LEFT JOIN product_details d ON p.id=d.product_id';
function reviewContent(b){
 if(!b||typeof b!=='object'||Array.isArray(b))fail('Avaliações inválidas.');
 const content={};
 if(!Array.isArray(b.reviews??[])||(b.reviews??[]).length>10)fail('Use até dez avaliações.');
 content.reviews=(b.reviews??[]).map(r=>{if(!r||typeof r!=='object')fail('Avaliação inválida.');const name=str(r.name,80),text=str(r.text,1000);if(!name||!text||r.approved!==true)fail('Publique apenas avaliações com nome, texto e autorização confirmada.');return {name,text,approved:true};});return content;
}
export async function commerceRoute(req,env,path,user,readBody){
 const db=env.DB,method=req.method;
 const product=path.match(/^\/api\/products\/([a-zA-Z0-9-]+)$/);
 if(product&&method==='GET'){const p=unpack(await db.prepare(productSelect+' WHERE p.id=? AND p.archived=0 AND p.published=1').bind(product[1]).first());if(!p)fail('Este produto não está disponível na vitrine.',404);return json({product:p});}
 if(path==='/api/reviews'&&method==='GET'){const row=await db.prepare('SELECT data FROM store_content WHERE id=1').first();return json({reviews:(row?JSON.parse(row.data).reviews:[])?.filter(r=>r.approved===true)||[]});}
 if(path==='/api/admin/reviews'){
  if(user?.role!=='admin')fail('Acesso restrito.',403);
  const row=await db.prepare('SELECT * FROM store_content WHERE id=1').first();
  if(method==='GET')return json({content:{reviews:row?JSON.parse(row.data).reviews||[]:[]},version:row?.version??0});
  if(method==='PUT'){const b=await readBody(req),content=reviewContent(b.content);if(!Number.isInteger(b.version)||b.version<0)fail('Versão inválida.');const data=JSON.stringify({...row?JSON.parse(row.data):{},...content});const r=b.version===0?await db.prepare('INSERT OR IGNORE INTO store_content(id,data,version) VALUES(1,?,1)').bind(data).run():await db.prepare('UPDATE store_content SET data=?,version=version+1 WHERE id=1 AND version=?').bind(data,b.version).run();if(!r.meta.changes)fail('As avaliações mudaram em outra aba. Reabra esta seção para atualizar.',409);return json({content,version:b.version+1});}
  fail('Método não permitido.',405);
 }
 if(path==='/api/favorites'||path.startsWith('/api/favorites/')){
  if(!user)fail('Entre na sua conta para guardar favoritos.',401);
  const key=user.role+':'+user.id;
  if(path==='/api/favorites'&&method==='GET'){const result=await db.prepare('SELECT f.product_id AS id,p.name,p.image,p.price,p.stock,p.published,p.archived FROM account_favorites f LEFT JOIN products p ON p.id=f.product_id WHERE f.account_key=? ORDER BY f.created_at DESC').bind(key).all();return json({products:result.results.map(p=>({id:p.id,available:!!p.published&&!p.archived,...(p.published&&!p.archived?{name:p.name,image:p.image,price:p.price,stock:p.stock}:{name:'Produto indisponível'})}))});}
  const m=path.match(/^\/api\/favorites\/([a-zA-Z0-9-]+)$/);if(!m)fail('Endereço não encontrado.',404);
  if(method==='PUT'){const p=await db.prepare('SELECT id FROM products WHERE id=? AND published=1 AND archived=0').bind(m[1]).first();if(!p)fail('Produto indisponível.',404);const count=await db.prepare('SELECT COUNT(*) AS count FROM account_favorites WHERE account_key=?').bind(key).first();if(count.count>=200)fail('Você já salvou 200 favoritos. Remova um para adicionar outro.');await db.prepare('INSERT OR IGNORE INTO account_favorites(account_key,product_id,created_at) VALUES(?,?,?)').bind(key,m[1],Date.now()).run();return json({ok:true});}
  if(method==='DELETE'){await db.prepare('DELETE FROM account_favorites WHERE account_key=? AND product_id=?').bind(key,m[1]).run();return json({ok:true});}fail('Método não permitido.',405);
 }
 return null;
}
