import {compare,hash} from 'bcryptjs';
const enc=new TextEncoder();
export const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function effectiveHash(db,key,base){const row=await db.prepare('SELECT * FROM account_security WHERE key=?').bind(key).first();return row?.base_hash===await digest(base)?row.password_hash||base:base;}
export async function securityRoute(req,env,path,user,readBody,limit){
 const b=await readBody(req),db=env.DB;
 await limit(db,'recovery-ip:'+await digest(req.headers.get('cf-connecting-ip')||'unknown'),15);
 if(path==='/api/auth/recovery-key'){
  if(!user)fail('Entre novamente para continuar.',401);
  const base=user.role==='admin'?env.ADMIN_PASSWORD_HASH:(await db.prepare('SELECT password_hash FROM accounts WHERE id=?').bind(user.id).first())?.password_hash;
  const key=user.role+':'+user.id;
  await limit(db,'recovery-key:'+key,5);
  if(typeof b.password!=='string'||enc.encode(b.password).length>72||!await compare(b.password,await effectiveHash(db,key,base)))fail('Senha atual incorreta.',401);
  const code=Array.from(crypto.getRandomValues(new Uint8Array(24)),v=>v.toString(16).padStart(2,'0')).join('');
  await db.prepare('INSERT INTO account_security(key,base_hash,recovery_hash) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET password_hash=CASE WHEN base_hash=excluded.base_hash THEN password_hash ELSE NULL END,base_hash=excluded.base_hash,recovery_hash=excluded.recovery_hash').bind(key,await digest(base),await digest(code)).run();
  return Response.json({code:code.match(/.{1,6}/g).join('-')},{headers:{'Cache-Control':'no-store'}});
 }
 const username=typeof b.username==='string'?b.username.trim().toLowerCase():'';
 if(!/^[a-z0-9_.-]{3,40}$/.test(username))fail('Usuário ou chave de recuperação inválidos.',401);
 await limit(db,'recovery-user:'+await digest(username),5);
 if(typeof b.password!=='string'||b.password.length<8||enc.encode(b.password).length>72)fail('A nova senha deve ter pelo menos 8 caracteres e no máximo 72 bytes.');
 const admin=username===env.ADMIN_USERNAME?.toLowerCase();
 const account=admin?{id:username,password_hash:env.ADMIN_PASSWORD_HASH}:await db.prepare('SELECT id,password_hash FROM accounts WHERE username=?').bind(username).first();
 const key=(admin?'admin:':'customer:')+(account?.id||'unknown'),code=typeof b.code==='string'?b.code.replaceAll('-','').trim().toLowerCase():'';
 const row=await db.prepare('SELECT * FROM account_security WHERE key=?').bind(key).first(),codeHash=await digest(code);
 if(!account||!row?.recovery_hash||!/^[a-f0-9]{48}$/.test(code)||row.recovery_hash!==codeHash||row.base_hash!==await digest(account.password_hash))fail('Usuário ou chave de recuperação inválidos.',401);
 const passwordHash=await hash(b.password,12);
 const [r]=await db.batch([db.prepare('UPDATE account_security SET password_hash=?,recovery_hash=NULL WHERE key=? AND recovery_hash=? AND base_hash=?').bind(passwordHash,key,codeHash,row.base_hash),db.prepare('DELETE FROM account_sessions WHERE account_id=? AND role=? AND changes()>0').bind(account.id,admin?'admin':'customer')]);
 if(!r.meta.changes)fail('Usuário ou chave de recuperação inválidos.',401);
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
