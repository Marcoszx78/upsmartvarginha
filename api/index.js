import fs from 'node:fs';
import path from 'node:path';
import { database } from '../scripts/sqlite-adapter.mjs';
import { localBucket } from '../scripts/local-bucket.mjs';
import { createWorker } from '../worker.mjs';

let schema = '';
try {
  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    schema += fs.readFileSync(schemaPath, 'utf8') + '\n';
  }
  const drizzleDir = path.join(process.cwd(), 'drizzle');
  if (fs.existsSync(drizzleDir)) {
    const files = fs.readdirSync(drizzleDir).filter(f => f.endsWith('.sql')).sort();
    for (const f of files) {
      schema += fs.readFileSync(path.join(drizzleDir, f), 'utf8') + '\n';
    }
  }
} catch (e) {
  console.error('Error loading SQL schema:', e);
}

const worker = createWorker({}, schema);

const dbPath = process.env.SQLITE_PATH || path.join('/tmp', 'upsmart.sqlite');
const bucketPath = process.env.BUCKET_PATH || path.join('/tmp', 'upsmart-bucket');

let dbInstance = null;
let bucketInstance = null;

function getEnv() {
  if (!dbInstance) dbInstance = database(dbPath);
  if (!bucketInstance) bucketInstance = localBucket(bucketPath);
  return {
    DB: dbInstance,
    BUCKET: bucketInstance,
    ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'upsmartvarginha',
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || '$2b$12$0v7tb/9Kr81XVohDdO5GPOFblxC48hl1VuZHY5r5NX2Gzg//ZOm/.'
  };
}

export default async function handler(req, res) {
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['host'] || 'localhost';
    const fullUrl = `${proto}://${host}${req.url}`;

    let body = null;
    if (!['GET', 'HEAD'].includes(req.method)) {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }

    const headers = new Headers();
    for (const [key, val] of Object.entries(req.headers)) {
      if (Array.isArray(val)) {
        val.forEach(v => headers.append(key, v));
      } else if (val !== undefined) {
        headers.set(key, val);
      }
    }

    if (!headers.has('cf-connecting-ip')) {
      const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';
      headers.set('cf-connecting-ip', clientIp);
    }

    const webReq = new Request(fullUrl, {
      method: req.method,
      headers,
      body
    });

    const env = getEnv();
    const response = await worker.fetch(webReq, env);

    res.statusCode = response.status;
    
    if (typeof response.headers.getSetCookie === 'function') {
      const cookies = response.headers.getSetCookie();
      if (cookies && cookies.length > 0) {
        res.setHeader('Set-Cookie', cookies);
      }
    }
    
    response.headers.forEach((val, key) => {
      if (key.toLowerCase() === 'set-cookie' && typeof response.headers.getSetCookie === 'function') {
        return;
      }
      res.setHeader(key, val);
    });

    const arrayBuffer = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('API Error:', err);
    res.statusCode = err.status || 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Erro interno no servidor.' }));
  }
}
