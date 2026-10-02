import {schemaStatements} from './postgres-schema-data.mjs';
export async function initializePostgres(pool){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(829104725)');
  await client.query('CREATE SCHEMA IF NOT EXISTS upsmart');
  await client.query('REVOKE ALL ON SCHEMA upsmart FROM PUBLIC');
  await client.query('SET LOCAL search_path TO upsmart');
  for(const statement of schemaStatements)await client.query(statement);
  for(const table of ['products','settings','accounts','account_profiles','account_sessions','auth_attempts','account_favorites','account_security','product_details','store_content'])await client.query(`ALTER TABLE upsmart.${table} ENABLE ROW LEVEL SECURITY`);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
