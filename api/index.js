import worker from '../dist/server/index.js';
import pg from 'pg';
import fs from 'node:fs';
import {rootCertificates} from 'node:tls';
import {createClient} from '@supabase/supabase-js';
import {postgresDatabase} from '../scripts/postgres-adapter.mjs';
import {supabaseBucket} from '../scripts/supabase-bucket.mjs';
import {initializePostgres} from '../scripts/postgres-schema.mjs';
let environment;
export function getEnvironment(config=process.env){
 if(environment&&config===process.env)return environment;
 const required={POSTGRES_URL:/^postgres(?:ql)?:\/\//.test(config.POSTGRES_URL||''),SUPABASE_URL:!!config.SUPABASE_URL,SUPABASE_SERVER_KEY:!!(config.SUPABASE_SECRET_KEY||config.SUPABASE_SERVICE_ROLE_KEY),ADMIN_USERNAME:!!config.ADMIN_USERNAME,ADMIN_PASSWORD_HASH:!!config.ADMIN_PASSWORD_HASH};
 if(Object.values(required).some(v=>!v)){console.error('Missing deployment configuration:',Object.keys(required).filter(k=>!required[k]).join(', '));throw Error('Missing deployment configuration');}
 const databaseURL=new URL(config.POSTGRES_URL);for(const key of ['sslmode','sslrootcert','sslcert','sslkey'])databaseURL.searchParams.delete(key);
 const ca=fs.readFileSync(new URL('../scripts/supabase-ca.crt',import.meta.url),'utf8');
 const pool=new pg.Pool({connectionString:databaseURL.toString(),ssl:{rejectUnauthorized:true,ca:[...rootCertificates,ca]},max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,types:{getTypeParser:(oid,format)=>oid===20?value=>Number(value):pg.types.getTypeParser(oid,format)}});
 const storage=createClient(config.SUPABASE_URL,config.SUPABASE_SECRET_KEY||config.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const bucket=supabaseBucket(storage);
 const env={DB:postgresDatabase(pool,()=>initializePostgres(pool)),BUCKET:bucket,ADMIN_USERNAME:config.ADMIN_USERNAME,ADMIN_PASSWORD_HASH:config.ADMIN_PASSWORD_HASH};
 if(config===process.env)environment=env;return env;
}
export function createHandler(app,getEnv){return async(req,res)=>{
 try{
  const headers=new Headers();for(const [key,value] of Object.entries(req.headers)){if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);}
  // Vercel replaces x-forwarded-for at its edge. Never accept a client's Cloudflare header.
  headers.set('cf-connecting-ip',String(req.headers['x-forwarded-for']||'unknown').split(',')[0].trim());
  const host=String(req.headers.host||'localhost');if(!/^[a-zA-Z0-9.:-]+$/.test(host))throw Error('Invalid host');
  const url=new URL(req.url,'https://'+host);if(url.host!==host)throw Error('Invalid request URL');
  let body;
  if(!['GET','HEAD'].includes(req.method)){
   if(req.body!==undefined&&req.body!==null)body=Buffer.isBuffer(req.body)?req.body:Buffer.from(typeof req.body==='string'?req.body:JSON.stringify(req.body));
   else{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1100000){res.statusCode=413;res.end('Arquivo muito grande');return;}chunks.push(chunk);}body=Buffer.concat(chunks);}
   if(body.length>1100000){res.statusCode=413;res.end('Arquivo muito grande');return;}
  }
  const response=await app.fetch(new Request(url,{method:req.method,headers,...(body?{body}:{} )}),getEnv());
  res.statusCode=response.status;response.headers.forEach((value,key)=>{if(key!=='set-cookie')res.setHeader(key,value);});
  const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
  res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){
  console.error('Vercel handler failed',error.name,error.code||'RUNTIME');
  res.statusCode=503;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({error:'O site está sendo configurado. Tente novamente em instantes.'}));
 }
};}
export default createHandler(worker,()=>getEnvironment());
