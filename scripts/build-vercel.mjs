import fs from 'node:fs/promises';
process.env.DEPLOY_TARGET='vercel';
await import('./build.mjs');
// All requests go through the application, including the protected admin page.
await fs.mkdir('vercel-public',{recursive:true});
await fs.writeFile('vercel-public/.gitkeep','');
