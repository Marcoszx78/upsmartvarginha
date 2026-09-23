import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import handler from '../api/index.js';

function createMockReqRes({ method = 'GET', url = '/', headers = {}, body = null }) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = headers;

  const res = {
    statusCode: 200,
    headers: {},
    body: [],
    setHeader(key, val) {
      this.headers[key.toLowerCase()] = val;
    },
    end(chunk) {
      if (chunk) this.body.push(chunk);
      this.emit('finish');
    }
  };
  Object.assign(res, EventEmitter.prototype);
  EventEmitter.call(res);

  process.nextTick(() => {
    if (body) {
      req.emit('data', Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
    }
    req.emit('end');
  });

  return { req, res };
}

test('Vercel API handler registers account and checks session', async () => {
  const customer = {
    username: 'vercel_user_test',
    password: 'vercel-password-123',
    name: 'Vercel Test User'
  };

  const { req: regReq, res: regRes } = createMockReqRes({
    method: 'POST',
    url: '/api/auth/register',
    headers: {
      'content-type': 'application/json',
      'origin': 'https://localhost'
    },
    body: customer
  });

  const regFinish = new Promise(resolve => regRes.on('finish', resolve));
  await handler(regReq, regRes);
  await regFinish;

  assert.equal(regRes.statusCode, 200);
  const regBody = JSON.parse(Buffer.concat(regRes.body).toString());
  assert.equal(regBody.user.username, 'vercel_user_test');
  assert.ok(regRes.headers['set-cookie']);

  const cookie = Array.isArray(regRes.headers['set-cookie']) ? regRes.headers['set-cookie'][0] : regRes.headers['set-cookie'];
  const sessionCookie = cookie.split(';')[0];

  // Test /api/auth/session with cookie
  const { req: sessReq, res: sessRes } = createMockReqRes({
    method: 'GET',
    url: '/api/auth/session',
    headers: {
      'cookie': sessionCookie
    }
  });

  const sessFinish = new Promise(resolve => sessRes.on('finish', resolve));
  await handler(sessReq, sessRes);
  await sessFinish;

  assert.equal(sessRes.statusCode, 200);
  const sessBody = JSON.parse(Buffer.concat(sessRes.body).toString());
  assert.equal(sessBody.user.username, 'vercel_user_test');
});
