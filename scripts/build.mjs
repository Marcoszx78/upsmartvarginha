import fs from 'node:fs/promises';
import {build} from 'esbuild';
const assets={};
for(const name of ['index.html','styles.css','app.js','admin.html','admin.css','admin.js','admin-uploads.js','account.html','account.css','account.js','profile.js','profile.css','theme.js','catalog.css','commerce.css','admin-extras.js','product.html','product.js','favorites.js','reviews.js','compare.html','compare.js','compare.css','security.js','assets/iphone-pro.jpg','assets/iphone-colors.jpg','assets/xiaomi.png','assets/playstation.png','assets/xbox.png','assets/fachada-up-smart.png']){
 const b=await fs.readFile('dist/'+name);const ext=name.split('.').pop();const binary=['jpg','png'].includes(ext);assets['/'+name]={body:binary?b.toString('base64'):b.toString('utf8'),binary,type:({html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',jpg:'image/jpeg',png:'image/png'})[ext]};
}
const schema=await fs.readFile('db/schema.sql','utf8');
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});
await build({stdin:{contents:'import {createWorker} from "./worker.mjs";\nexport default createWorker('+JSON.stringify(assets)+','+JSON.stringify(schema)+');',resolveDir:process.cwd(),sourcefile:'site-entry.js'},bundle:true,platform:'browser',format:'esm',target:'es2022',outfile:'dist/server/index.js'});
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await fs.cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Built Worker with '+Object.keys(assets).length+' embedded assets.');
