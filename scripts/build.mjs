import fs from 'node:fs/promises';
const assets={};
for(const name of ['index.html','styles.css','app.js','admin.html','admin.css','admin.js','theme.js','catalog.css','assets/iphone-pro.jpg','assets/iphone-colors.jpg']){
 const b=await fs.readFile('dist/'+name);const ext=name.split('.').pop();const binary=ext==='jpg';assets['/'+name]={body:binary?b.toString('base64'):b.toString('utf8'),binary,type:({html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',jpg:'image/jpeg'})[ext]};
}
const worker=await fs.readFile('worker.mjs','utf8'),schema=await fs.readFile('db/schema.sql','utf8');
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});
await fs.writeFile('dist/server/index.js',worker+'\nexport default createWorker('+JSON.stringify(assets)+','+JSON.stringify(schema)+');\n');
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built Worker with '+Object.keys(assets).length+' embedded assets.');
