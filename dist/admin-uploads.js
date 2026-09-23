(() => {
 let pending=0;
 const $=s=>document.querySelector(s);
 window.adminPhotosBusy=()=>pending>0;
 const lock=on=>{for(const el of document.querySelectorAll('#save-product,#save-store,[data-close="product-dialog"]')){if(on){el.dataset.uploadWasDisabled=String(el.disabled);el.disabled=true;}else{el.disabled=el.dataset.uploadWasDisabled==='true';delete el.dataset.uploadWasDisabled;}}};
 $('#product-dialog').addEventListener('cancel',e=>{if(pending)e.preventDefault();});
 async function prepare(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Escolha uma foto JPG, PNG ou WebP.');
  if(file.size>10*1024*1024)throw Error('Cada foto pode ter até 10 MB.');
  const src=URL.createObjectURL(file),img=new Image();
  try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Não foi possível abrir esta foto. Escolha outro arquivo.'));img.src=src;});
   const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   for(const quality of [.86,.72,.55]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=1024*1024)return blob;}throw Error('Não foi possível ajustar esta foto. Escolha uma imagem menor.');
  }finally{URL.revokeObjectURL(src);}
 }
 function picker(input,title,max){
  const original=input.closest('label');original.hidden=true;if(input.tagName==='INPUT')input.type='hidden';
  const box=document.createElement('div');box.className='photo-uploader full';box.innerHTML=`<span class="upload-title">${title}</span><div class="upload-preview"></div><label class="upload-pick"><span>+ Escolher ${max===1?'foto':'fotos'}</span><input type="file" accept="image/jpeg,image/png,image/webp" ${max>1?'multiple':''} aria-label="${title}"></label><small>JPG, PNG ou WebP · até 10 MB por foto${max>1?' · máximo de '+max:''}</small><p class="upload-status" role="status" aria-live="polite"></p>`;original.after(box);
  const choose=box.querySelector('input'),preview=box.querySelector('.upload-preview'),status=box.querySelector('.upload-status');let epoch=0,busy=false;
  const values=()=>input.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const write=items=>{input.value=items.join('\n');render();};
  function render(){preview.replaceChildren();values().forEach((src,i)=>{const card=document.createElement('div');card.className='upload-photo';const img=new Image();img.src=src;img.alt=title+' '+(i+1);img.referrerPolicy='no-referrer';img.onerror=()=>{img.alt='Não foi possível exibir esta foto';};const remove=document.createElement('button');remove.type='button';remove.textContent='Remover';remove.setAttribute('aria-label','Remover '+title.toLowerCase()+' '+(i+1));remove.disabled=busy;remove.onclick=()=>write(values().filter((_,n)=>n!==i));card.append(img,remove);preview.append(card);});choose.disabled=busy||(max>1&&values().length>=max);box.querySelector('.upload-pick span').textContent=max===1&&values().length?'Substituir foto':'+ Escolher '+(max===1?'foto':'fotos');}
  choose.onchange=async()=>{const files=[...choose.files];if(!files.length)return;const current=values();if(max>1&&current.length+files.length>max){status.textContent='Você pode adicionar até '+max+' fotos. Remova uma para substituir.';choose.value='';return;}const thisEpoch=epoch;busy=true;if(pending++===0)lock(true);render();
   try{for(let i=0;i<files.length;i++){status.textContent='Preparando e enviando foto '+(i+1)+' de '+files.length+'…';const blob=await prepare(files[i]);const r=await fetch('/api/admin/media',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:blob});let data;try{data=await r.json();}catch{throw Error('Não foi possível enviar. Verifique sua conexão e tente novamente.');}if(!r.ok)throw Error(data.error||'Não foi possível enviar a foto.');if(epoch!==thisEpoch)break;write(max===1?[data.url]:[...values(),data.url]);}if(epoch===thisEpoch)status.textContent='Foto'+(files.length>1?'s enviadas':' enviada')+'. Salve as alterações para exibir na loja.';
   }catch(e){if(epoch===thisEpoch)status.textContent=e.message;}finally{busy=false;choose.value='';if(--pending===0)lock(false);render();}
  };
  return ()=>{epoch++;status.textContent='';render();};
 }
 const main=picker($('#product-form').elements.image,'Foto principal',1),gallery=picker($('#detail-gallery'),'Galeria do produto',5),team=picker($('#store-form').elements.teamPhotos,'Fotos da equipe',4);
 const populate=window.populateProductDetails;window.populateProductDetails=p=>{populate(p);main();gallery();};
 const load=window.loadStoreContent;window.loadStoreContent=async()=>{await load();team();};$('#reload-store').onclick=window.loadStoreContent;
})();
