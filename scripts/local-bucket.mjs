import fs from 'node:fs/promises';
import path from 'node:path';
export function localBucket(directory){
 const root=path.resolve(directory);
 const file=key=>{if(!/^avatars\/[a-zA-Z0-9-]+\.jpg$/.test(key))throw Error('Invalid object key');return path.join(root,path.basename(key));};
 return {
  async get(key){try{return {body:await fs.readFile(file(key))};}catch(e){if(e.code==='ENOENT')return null;throw e;}},
  async put(key,bytes){await fs.mkdir(root,{recursive:true});await fs.writeFile(file(key),bytes);},
  async delete(key){await fs.unlink(file(key)).catch(e=>{if(e.code!=='ENOENT')throw e;});},
 };
}
