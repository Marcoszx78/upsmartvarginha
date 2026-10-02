const tables=['products','settings','accounts','account_profiles','account_sessions','auth_attempts','account_favorites','account_security','product_details','store_content'];
export function postgresSQL(source){
 let sql=source.replace(/`([^`]+)`/g,'"$1"'),index=0;
 sql=sql.replace(/'(?:''|[^'])*'|\?/g,part=>part==='?'?'$'+(++index):part);
 if(/^\s*INSERT OR IGNORE INTO/i.test(sql))sql=sql.replace(/INSERT OR IGNORE INTO/i,'INSERT INTO')+' ON CONFLICT DO NOTHING';
 if(sql.startsWith('INSERT INTO auth_attempts'))sql=sql.replace(/\bexpires_at(?=<=)/g,'auth_attempts.expires_at').replace(/ELSE expires_at /g,'ELSE auth_attempts.expires_at ').replace(/\bcount(?=\+1)/g,'auth_attempts.count');
 if(sql.startsWith('INSERT INTO account_security'))sql=sql.replace(/WHEN base_hash=/g,'WHEN account_security.base_hash=').replace(/THEN password_hash /g,'THEN account_security.password_hash ');
 const names=tables.join('|');
 sql=sql.replace(new RegExp('\\b(FROM|JOIN|INTO|UPDATE|TABLE IF NOT EXISTS|TABLE)\\s+('+names+')\\b','gi'),(_,keyword,table)=>`${keyword} "upsmart"."${table}"`);
 return sql;
}
const convert=r=>({results:r.rows,meta:{changes:r.rowCount??r.affectedRows??0}});
export function postgresDatabase(pool,initialize=async()=>{}){
 let ready;
 const init=()=>ready??=(initialize().catch(e=>{ready=null;throw e;}));
 const run=async(sql,args=[])=>{await init();return convert(await pool.query(postgresSQL(sql),args));};
 return {
  async exec(sql){await init();for(const part of sql.split(';').map(s=>s.trim()).filter(Boolean))await pool.query(postgresSQL(part));return {success:true};},
  prepare(sql){let args=[];return {get statement(){return {sql,args};},bind(...values){args=values;return this;},all(){return run(sql,args);},async first(){return (await run(sql,args)).results[0]||null;},run(){return run(sql,args);}};},
  async batch(statements){await init();const client=await pool.connect();try{await client.query('BEGIN');const results=[];for(const {statement:{sql,args}} of statements){
    if(sql.includes('changes()>0')&&!results.at(-1)?.meta.changes){results.push({results:[],meta:{changes:0}});continue;}
    results.push(convert(await client.query(postgresSQL(sql.replaceAll('changes()>0','TRUE')),args)));
   }await client.query('COMMIT');return results;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}},
  close(){return pool.end();}
 };
}
