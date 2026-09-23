import {DatabaseSync} from 'node:sqlite';
export function database(file=':memory:'){
 const db=new DatabaseSync(file);
 return {exec(sql){db.exec(sql);return Promise.resolve({success:true});},async batch(statements){db.exec('BEGIN');try{const r=statements.map(s=>s.execute());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}},prepare(sql){let values=[];const execute=()=>{const r=db.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}};};return {bind(...args){values=args;return this;},async all(){return {results:db.prepare(sql).all(...values)};},async first(){return db.prepare(sql).get(...values)||null;},async run(){return execute();},execute};},close(){db.close();}};
}
