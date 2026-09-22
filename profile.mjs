const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const json=data=>Response.json(data,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const avatarURL=profile=>profile?.avatar_key?'/api/auth/avatar?v='+encodeURIComponent(profile.avatar_key.split('/').pop()):'';
export async function withProfile(db,user){
 if(!user)return null;
 const key=user.role+':'+user.id;
 const profile=await db.prepare('SELECT name,avatar_key FROM account_profiles WHERE key=?').bind(key).first();
 return {...user,profileKey:key,name:profile?.name||user.name,avatar:avatarURL(profile)};
}
async function readProfile(db,user){
 const row=await db.prepare('SELECT * FROM account_profiles WHERE key=?').bind(user.profileKey).first();
 return row||{key:user.profileKey,name:user.name,email:'',phone:'',city:'',state:'',avatar_key:'',version:0,updated_at:null};
}
const visible=(row,user)=>({name:row.name,email:row.email,phone:row.phone,city:row.city,state:row.state,avatar:avatarURL(row),version:row.version,updatedAt:row.updated_at,username:user.username,role:user.role,memberSince:user.created_at||null});
const states='AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
function validate(b){
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['name','email','phone','city','state','version'].includes(k)))fail('Dados do perfil inválidos.');
 const p={};
 for(const [key,max] of Object.entries({name:80,email:254,phone:25,city:80,state:2})){
  if(typeof b[key]!=='string'||b[key].length>max)fail('Confira os campos do perfil.');p[key]=b[key].trim();
 }
 if(!p.name)fail('Informe seu nome.');
 if(p.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))fail('Informe um e-mail válido.');
 if(p.phone&&(!/^[+\d() .-]+$/.test(p.phone)||p.phone.replace(/\D/g,'').length<10||p.phone.replace(/\D/g,'').length>15))fail('Informe um telefone válido, incluindo o DDD.');
 if(p.state&&!states.includes(p.state))fail('Escolha um estado válido.');
 if(!Number.isSafeInteger(b.version)||b.version<0)fail('Versão inválida.');
 return p;
}
async function photoBytes(req){
 if(req.headers.get('content-type')!=='image/jpeg')fail('Envie uma foto JPEG.',415);
 const chunks=[];let size=0;const reader=req.body?.getReader();if(!reader)fail('Selecione uma foto.');
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>128*1024){await reader.cancel();fail('Foto muito grande. Escolha outra imagem.',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 if(size<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255||bytes[size-2]!==255||bytes[size-1]!==217)fail('O arquivo não é uma foto válida.');
 return bytes;
}
export async function profileRoute(req,env,path,user,body){
 if(!user)fail('Sua sessão expirou. Entre novamente para acessar seu perfil.',401);
 if(!['GET','PUT','POST','DELETE'].includes(req.method))fail('Método não permitido.',405);
 if(req.method!=='GET'&&req.headers.get('origin')!==new URL(req.url).origin)fail('Origem não autorizada.',403);
 const db=env.DB,row=await readProfile(db,user);
 if(path==='/api/auth/profile'){
  if(req.method==='GET')return json({profile:visible(row,user)});
  if(req.method!=='PUT')fail('Método não permitido.',405);
  const b=await body(req),p=validate(b),now=Date.now();
  let result;
  if(b.version===0){
   result=await db.prepare('INSERT OR IGNORE INTO account_profiles(key,name,email,phone,city,state,updated_at) VALUES(?,?,?,?,?,?,?)').bind(user.profileKey,...Object.values(p),now).run();
  }else{
   result=await db.prepare('UPDATE account_profiles SET name=?,email=?,phone=?,city=?,state=?,version=version+1,updated_at=? WHERE key=? AND version=?').bind(...Object.values(p),now,user.profileKey,b.version).run();
  }
  if(!result.meta.changes)fail('Seu perfil foi atualizado em outra aba. Recarregue a página antes de salvar.',409);
  return json({profile:visible(await readProfile(db,user),user)});
 }
 if(!env.BUCKET)fail('As fotos estão temporariamente indisponíveis. Tente novamente.',503);
 if(req.method==='GET'){
  if(!row.avatar_key)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  const file=await env.BUCKET.get(row.avatar_key);if(!file)return new Response(null,{status:404});
  return new Response(file.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'}});
 }
 if(!['POST','DELETE'].includes(req.method))fail('Método não permitido.',405);
 const bytes=req.method==='POST'?await photoBytes(req):null;
 if(!row.version){await db.prepare('INSERT OR IGNORE INTO account_profiles(key,name,updated_at) VALUES(?,?,?)').bind(user.profileKey,user.name,Date.now()).run();}
 const key=bytes?'avatars/'+crypto.randomUUID()+'.jpg':'';
 if(bytes)await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
 try{
  const result=await db.prepare('UPDATE account_profiles SET avatar_key=?,updated_at=? WHERE key=? AND avatar_key=?').bind(key,Date.now(),user.profileKey,row.avatar_key).run();
  if(!result.meta.changes)fail('Sua foto mudou em outra aba. Atualize o perfil.',409);
 }catch(e){if(key)await env.BUCKET.delete(key);throw e;}
 // Deleting an old object is cleanup; the newly saved profile remains usable if cleanup fails.
 if(row.avatar_key)await env.BUCKET.delete(row.avatar_key).catch(()=>{});
 return json({profile:visible(await readProfile(db,user),user)});
}
