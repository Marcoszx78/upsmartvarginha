import {DatabaseSync} from 'node:sqlite';
export function database(file=':memory:'){
 const db=new DatabaseSync(file);
 return {exec(sql){db.exec(sql);return Promise.resolve({success:true});},prepare(sql){let values=[];return {bind(...args){values=args;return this;},async all(){return {results:db.prepare(sql).all(...values)};},async first(){return db.prepare(sql).get(...values)||null;},async run(){const r=db.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}};}};},close(){db.close();}};
}
