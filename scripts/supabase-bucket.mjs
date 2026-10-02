export function supabaseBucket(client){
 const bucket='upsmart-media';let ready;
 const init=()=>ready??=(async()=>{const existing=await client.storage.getBucket(bucket);if(existing.data){if(existing.data.public)throw Error('Expected private media bucket');return;}const created=await client.storage.createBucket(bucket,{public:false,fileSizeLimit:1048576,allowedMimeTypes:['image/jpeg']});if(created.error){const retry=await client.storage.getBucket(bucket);if(!retry.data||retry.data.public)throw Error('Media storage unavailable');}})().catch(e=>{ready=null;throw e;});
 const keyOf=key=>{if(!/^(avatars|shop)\/[a-zA-Z0-9-]+\.jpg$/.test(key))throw Error('Invalid media key');return key;};
 return {
  async get(key){key=keyOf(key);await init();const {data,error}=await client.storage.from(bucket).download(key);if(error){if(['404','400'].includes(String(error.statusCode))&&/not found|does not exist/i.test(error.message))return null;throw Error('Media unavailable');}return {body:data.stream()};},
  async put(key,bytes){key=keyOf(key);await init();const {error}=await client.storage.from(bucket).upload(key,bytes,{contentType:'image/jpeg',upsert:false});if(error)throw Error('Media upload failed');},
  async delete(key){key=keyOf(key);await init();const {error}=await client.storage.from(bucket).remove([key]);if(error)throw Error('Media deletion failed');}
 };
}
