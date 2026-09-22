import http from 'node:http';
import fs from 'node:fs/promises';
import {database} from './sqlite-adapter.mjs';
import {localBucket} from './local-bucket.mjs';
const {default:worker}=await import('../dist/server/index.js');
await fs.mkdir('work',{recursive:true});
const localEnv=Object.fromEntries((await fs.readFile('.env','utf8').catch(()=>'' )).split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const env={DB:database('work/local.sqlite'),BUCKET:localBucket('work/local-avatars'),...localEnv};
for(const file of (await fs.readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()){
 await env.DB.exec(await fs.readFile('drizzle/'+file,'utf8').then(sql=>sql.replaceAll('CREATE TABLE ','CREATE TABLE IF NOT EXISTS ').replaceAll('CREATE UNIQUE INDEX ','CREATE UNIQUE INDEX IF NOT EXISTS ').replaceAll('CREATE INDEX ','CREATE INDEX IF NOT EXISTS ')));
}
const port=Number(process.env.PORT||4175);
const server=http.createServer(async(req,res)=>{
 try{const url='http://127.0.0.1:'+port+req.url;
 const headers=new Headers(req.headers);headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');
 headers.set('cf-connecting-ip',req.socket.remoteAddress);
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const response=await worker.fetch(new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),env);
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){res.writeHead(500);res.end('Local preview error');}
});server.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
