import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hash} from 'bcryptjs';
import {PGlite} from '@electric-sql/pglite';
import worker from '../dist/server/index.js';
import {createHandler,getEnvironment} from '../api/index.js';
import {postgresDatabase} from '../scripts/postgres-adapter.mjs';
import {initializePostgres} from '../scripts/postgres-schema.mjs';
import {supabaseBucket} from '../scripts/supabase-bucket.mjs';

test('Vercel uses real SQL transactions and protects admin, profiles and route content',async()=>{
 const client=new PGlite(),pool={query:(sql,args)=>client.query(sql,args),connect:async()=>({query:(sql,args)=>client.query(sql,args),release(){}})},DB=postgresDatabase(pool,()=>initializePostgres(pool));
 try{
  const env={DB,ADMIN_USERNAME:'testadmin',ADMIN_PASSWORD_HASH:await hash('vercel-test-123',10)};
  const handler=createHandler(worker,()=>env);
  const call=async(url,method='GET',body,cookie='',extra={})=>{const req={url,method,body,headers:{host:'upsmart.test',origin:'https://upsmart.test','content-type':'application/json',cookie,'x-forwarded-for':'192.0.2.1',...extra}};const res={headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(b){this.body=b?.toString()||'';}};await handler(req,res);return res;};
  assert.equal((await call('/privacidade')).statusCode,200);assert.equal((await call('/comparar')).statusCode,200);
  assert.equal((await call('/admin')).statusCode,302);assert.equal((await call('/admin.html')).statusCode,404);assert.equal((await call('/api/admin/products')).statusCode,403);
  const registered=await call('/api/auth/register','POST',{username:'customer',name:'Cliente',password:'customer-test-123'});assert.equal(registered.statusCode,200);
  const cookie=registered.headers['set-cookie'][0].split(';')[0];assert.match(registered.headers['set-cookie'][0],/HttpOnly/);assert.match(registered.headers['set-cookie'][0],/Secure/);
  assert.equal(JSON.parse((await call('/api/auth/session','GET',undefined,cookie)).body).user.username,'customer');
  assert.equal((await call('/api/admin/products','GET',undefined,cookie)).statusCode,403);
  const login=await call('/api/auth/login','POST',{username:'testadmin',password:'vercel-test-123'}),admin=login.headers['set-cookie'][0].split(';')[0];
  const product={name:'Teste',category:'iPhone',description:'',price:1200,stock:1,low_stock:1,image:'',condition:'Novo',featured:false,published:true,details:{color:'Preto'}};
  const created=await call('/api/admin/products','POST',product,admin);assert.equal(created.statusCode,201);const id=JSON.parse(created.body).product.id;
  assert.equal((await call('/api/admin/products/'+id,'PUT',{...product,version:1,details:{color:'Azul'}},admin)).statusCode,200);
  assert.equal((await call('/api/admin/products/'+id,'PUT',{...product,version:1,details:{color:'Vermelho'}},admin)).statusCode,409);
  assert.equal(JSON.parse((await call('/api/products/'+id)).body).product.details.color,'Azul');
  let recovery;for(let i=0;i<2;i++){const result=await call('/api/auth/recovery-key','POST',{password:'vercel-test-123'},admin);assert.equal(result.statusCode,200);recovery=JSON.parse(result.body).code;}
  assert.equal((await call('/api/auth/reset-password','POST',{username:'testadmin',code:recovery,password:'new-vercel-test-123'})).statusCode,200);
  assert.equal(JSON.parse((await call('/api/auth/session','GET',undefined,admin)).body).user,null);
  assert.equal((await call('/api/auth/login','POST',{username:'testadmin',password:'new-vercel-test-123'})).statusCode,200);
  await assert.rejects(DB.batch([DB.prepare('UPDATE settings SET accent=? WHERE id=1').bind('blue'),DB.prepare('INSERT INTO nonexistent_table VALUES(1)')]));
  assert.equal((await DB.prepare('SELECT * FROM settings WHERE id=1').first()).accent,'orange');
  let observed;await createHandler({fetch:async req=>{observed=req.headers.get('cf-connecting-ip');return new Response('ok');}},()=>({}))({url:'/',method:'GET',headers:{host:'upsmart.test','cf-connecting-ip':'spoofed','x-forwarded-for':'192.0.2.5'}},{setHeader(){},end(){}});assert.equal(observed,'192.0.2.5');
 }finally{await client.close();}
});
test('deployment has no default admin password or disposable database',()=>{assert.throws(()=>getEnvironment({}));assert.throws(()=>getEnvironment({TURSO_DATABASE_URL:'file:/tmp/test.sqlite',TURSO_AUTH_TOKEN:'x',ADMIN_USERNAME:'admin',ADMIN_PASSWORD_HASH:'x',BLOB_READ_WRITE_TOKEN:'x'}));});
test('all stored images are private and media keys cannot escape the allowed folders',async()=>{
 const calls=[],bucket=supabaseBucket({storage:{getBucket:async()=>({data:{public:false}}),from:()=>({upload:async(...args)=>{calls.push(args);return {};},download:async()=>({error:{statusCode:404,message:'Object not found'}})})}});
 await bucket.put('avatars/test.jpg',new Uint8Array([1]));assert.equal(calls[0][2].upsert,false);
 assert.equal(await bucket.get('shop/missing.jpg'),null);await assert.rejects(bucket.get('../private'));await assert.rejects(bucket.put('other/file.jpg',new Uint8Array()));
});
