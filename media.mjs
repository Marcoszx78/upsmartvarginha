const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export const mediaPath=/^\/api\/media\/[a-f0-9-]{36}\.jpg$/;
export async function mediaRoute(req,env,path){
 if(!env.BUCKET)fail('Não foi possível acessar as fotos. Tente novamente em instantes.',503);
 if(mediaPath.test(path)){
  if(!['GET','HEAD'].includes(req.method))fail('Método não permitido.',405);
  const file=await env.BUCKET.get('shop/'+path.split('/').pop());if(!file)return new Response(null,{status:404});
  return new Response(req.method==='HEAD'?null:file.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'}});
 }
 if(req.method!=='POST')fail('Método não permitido.',405);
 if(req.headers.get('content-type')!=='image/jpeg')fail('Escolha uma foto JPG, PNG ou WebP.',415);
 const reader=req.body?.getReader();if(!reader)fail('Selecione uma foto.');const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024*1024){await reader.cancel();fail('A foto ficou muito grande. Escolha outra imagem.',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 if(size<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255||bytes[size-2]!==255||bytes[size-1]!==217)fail('Este arquivo não é uma foto válida.');
 const filename=crypto.randomUUID()+'.jpg';await env.BUCKET.put('shop/'+filename,bytes,{httpMetadata:{contentType:'image/jpeg'}});
 return Response.json({url:'/api/media/'+filename},{status:201,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
