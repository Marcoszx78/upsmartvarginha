import http from 'node:http';
import fs from 'node:fs/promises';
import {database} from './sqlite-adapter.mjs';
const {default:worker}=await import('../dist/server/index.js');
await fs.mkdir('work',{recursive:true});
const env={DB:database('work/local.sqlite'),ADMIN_EMAIL:'local@upsmart.test'};
const server=http.createServer(async(req,res)=>{
 try{const url='http://127.0.0.1:4173'+req.url;
 if(req.url.startsWith('/signin-with-chatgpt')){res.writeHead(302,{'Location':'/admin','Set-Cookie':'up_local=1; HttpOnly; SameSite=Lax; Path=/'});return res.end();}
 if(req.url.startsWith('/signout-with-chatgpt')){res.writeHead(302,{'Location':'/','Set-Cookie':'up_local=; Max-Age=0; Path=/'});return res.end();}
 const headers=new Headers(req.headers);headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');
 if((req.headers.cookie||'').split(';').some(v=>v.trim()==='up_local=1')){headers.set('oai-authenticated-user-id','local_test');headers.set('oai-authenticated-user-email',env.ADMIN_EMAIL);}
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const response=await worker.fetch(new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),env);
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){res.writeHead(500);res.end('Local preview error');}
});server.listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173 — local sign-in simulator only.'));
