import { hash, compare } from 'bcryptjs';

const duration = 12 * 60 * 60;
const encoder = new TextEncoder();
const response = (data, status = 200, headers = {}) => Response.json(data, {
  status, headers: {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff', ...headers},
});
const error = (message, status = 400) => { throw Object.assign(new Error(message), {status}); };
const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), b => b.toString(16).padStart(2,'0')).join('');
const cookieName = req => new URL(req.url).protocol === 'https:' ? '__Host-up_session' : 'up_session';
const cookie = (req, value, age) => `${cookieName(req)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
const token = req => (req.headers.get('cookie') || '').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName(req)+'='))?.slice(cookieName(req).length+1) || '';
const adminName = env => env.ADMIN_USERNAME?.toLowerCase();
const publicUser = user => user ? {name:user.name,username:user.username,role:user.role} : null;

export async function getSession(req, env) {
  const value = token(req);
  if (!/^[a-f0-9]{64}$/.test(value)) return null;
  const session = await env.DB.prepare('SELECT * FROM account_sessions WHERE token_hash=? AND expires_at>?').bind(await digest(value), Date.now()).first();
  if (!session) return null;
  if (session.role === 'admin') {
    if (!env.ADMIN_PASSWORD_HASH || !env.ADMIN_USERNAME || session.account_id !== adminName(env) || session.credential_version !== await digest(env.ADMIN_PASSWORD_HASH)) return null;
    return {username:adminName(env),name:'Up Smart',role:'admin'};
  }
  const user = await env.DB.prepare('SELECT username,name FROM accounts WHERE id=?').bind(session.account_id).first();
  return user && {...user, role:'customer'};
}

async function startSession(req, env, user) {
  const now = Date.now();
  await env.DB.prepare('DELETE FROM account_sessions WHERE expires_at<=?').bind(now).run();
  const old = token(req);
  if (old) await env.DB.prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(await digest(old)).run();
  const value = Array.from(crypto.getRandomValues(new Uint8Array(32)), b=>b.toString(16).padStart(2,'0')).join('');
  await env.DB.prepare('INSERT INTO account_sessions(token_hash,account_id,role,credential_version,expires_at) VALUES(?,?,?,?,?)')
    .bind(await digest(value),user.id,user.role,user.role==='admin'?await digest(env.ADMIN_PASSWORD_HASH):null,now+duration*1000).run();
  return response({user:publicUser(user)},200,{'Set-Cookie':cookie(req,value,duration)});
}

async function limit(db, key, max) {
  const now = Date.now();
  const row = await db.prepare(`INSERT INTO auth_attempts(key,count,expires_at) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
    expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count`).bind(key,now+15*60*1000,now,now).first();
  if (row.count > max) error('Muitas tentativas. Aguarde 15 minutos e tente novamente.',429);
}

export async function authRoute(req, env, path, readBody) {
  if (path==='/api/auth/session' && req.method==='GET') return response({user:publicUser(await getSession(req,env))});
  if (req.method!=='POST') return response({error:'Método não permitido.'},405);
  if (req.headers.get('origin')!==new URL(req.url).origin) return response({error:'Origem não autorizada.'},403);
  if (path==='/api/auth/logout') {
    const value=token(req);
    if(value) await env.DB.prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(await digest(value)).run();
    return response({ok:true},200,{'Set-Cookie':cookie(req,'',0)});
  }
  if (!['/api/auth/login','/api/auth/register'].includes(path)) return response({error:'Endereço não encontrado.'},404);
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD_HASH) error('Login indisponível no momento. Tente novamente mais tarde.',503);
  const b=await readBody(req);
  if(!b||typeof b!=='object'||Array.isArray(b)) error('Dados inválidos.');
  const username=typeof b.username==='string'?b.username.trim().toLowerCase():'';
  if(!/^[a-z0-9_.-]{3,40}$/.test(username)) error('Use um usuário de 3 a 40 letras, números, pontos, traços ou sublinhados.');
  if(typeof b.password!=='string'||b.password.length<8||encoder.encode(b.password).length>72) error('A senha deve ter no mínimo 8 caracteres e no máximo 72 bytes.');
  const db=env.DB, registering=path.endsWith('/register');
  await db.prepare('DELETE FROM auth_attempts WHERE expires_at<=?').bind(Date.now()).run();
  // CF-Connecting-IP is supplied by the hosting edge; never trust forwarded client IP headers.
  const ip=req.headers.get('cf-connecting-ip')||'unknown';
  await limit(db,'ip:'+await digest(ip),registering?15:60);
  await limit(db,'user:'+await digest(username),10);
  if(registering){
    const name=typeof b.name==='string'?b.name.trim():'';
    if(!name||name.length>80) error('Informe seu nome, com até 80 caracteres.');
    if(username===adminName(env)) error('Este usuário não está disponível. Escolha outro.',409);
    const user={id:crypto.randomUUID(),name,username,role:'customer'};
    const passwordHash=await hash(b.password,12);
    const result=await db.prepare('INSERT OR IGNORE INTO accounts(id,username,name,password_hash,created_at) VALUES(?,?,?,?,?)').bind(user.id,username,name,passwordHash,Date.now()).run();
    if(!result.meta.changes) error('Este usuário não está disponível. Escolha outro.',409);
    return startSession(req,env,user);
  }
  const isAdmin=username===adminName(env);
  const account=isAdmin?null:await db.prepare('SELECT * FROM accounts WHERE username=?').bind(username).first();
  // Use a real hash for unknown users too, so verification always performs the same work.
  const verified=await compare(b.password,isAdmin?env.ADMIN_PASSWORD_HASH:(account?.password_hash||env.ADMIN_PASSWORD_HASH));
  if(!verified||(!isAdmin&&!account)) error('Usuário ou senha incorretos.',401);
  await db.prepare('DELETE FROM auth_attempts WHERE key=?').bind('user:'+await digest(username)).run();
  return startSession(req,env,isAdmin?{id:username,username,name:'Up Smart',role:'admin'}:{...account,role:'customer'});
}
