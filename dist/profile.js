(() => {
 const form=document.querySelector('#profile-form');if(!form)return;
 const $=s=>document.querySelector(s),fields=['name','email','phone','city','state'];
 let saved=null,currentUser=null,working=false,photoBusy=false;
 const initials=name=>(name||'UP').trim().split(/\s+/).slice(0,2).map(v=>v[0]).join('').toUpperCase();
 function message(text,error=false){const el=$('#profile-message');el.textContent=text;el.hidden=!text;el.classList.toggle('is-error',error);}
 function report(error){message(error.message,true);$('#profile-relogin').hidden=error.status!==401;}
 async function request(path,options={}){const r=await fetch('/api/auth/'+path,options);let data;try{data=await r.json();}catch{throw Error('Não foi possível carregar seu perfil. Tente novamente.');}if(!r.ok)throw Object.assign(Error(data.error||'Não foi possível salvar.'),{status:r.status});return data;}
 function avatar(profile){const el=$('#profile-avatar');el.replaceChildren();el.textContent=initials(profile.name);if(profile.avatar){const img=new Image();img.alt='Foto de '+profile.name;img.src=profile.avatar;img.onerror=()=>{el.textContent=initials(profile.name);};el.replaceChildren(img);}$('#remove-avatar').hidden=!profile.avatar;}
 function broadcast(profile){document.dispatchEvent(new CustomEvent('up:profile-changed',{detail:{name:profile.name,avatar:profile.avatar}}));}
 function fill(profile){fields.forEach(key=>form.elements[key].value=profile[key]||'');}
 function show(profile){saved=profile;fill(profile);avatar(profile);broadcast(profile);$('#profile-since').textContent=profile.memberSince?'Na Up Smart desde '+new Date(profile.memberSince).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):'Administração da loja';}
 async function load(){message('');$('#profile-retry').hidden=true;$('#profile-loading').hidden=false;$('#profile-fields').disabled=true;try{const {profile}=await request('profile');show(profile);$('#profile-fields').disabled=false;}catch(e){report(e);$('#profile-retry').hidden=false;}finally{$('#profile-loading').hidden=true;}}
 document.addEventListener('up:account',event=>{currentUser=event.detail;if(currentUser)load();});
 $('#profile-retry').onclick=load;
 $('#cancel-profile').onclick=()=>{if(saved){fill(saved);message('Alterações descartadas.');}};
 form.onsubmit=async event=>{event.preventDefault();if(!saved||working||photoBusy)return;working=true;message('');$('#save-profile').disabled=true;$('#save-profile').textContent='Salvando…';const data=Object.fromEntries(fields.map(k=>[k,form.elements[k].value]));data.version=saved.version;try{const {profile}=await request('profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});show(profile);message('Perfil atualizado com sucesso.');}catch(e){report(e);}finally{working=false;$('#save-profile').disabled=false;$('#save-profile').textContent='Salvar alterações ↗';}};
 async function preparePhoto(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Escolha uma imagem JPG, PNG ou WebP.');
  if(file.size>5*1024*1024)throw Error('Escolha uma foto com até 5 MB.');
  const url=URL.createObjectURL(file),img=new Image();
  try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Não foi possível abrir essa imagem.'));img.src=url;});const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d'),side=Math.min(img.naturalWidth,img.naturalHeight);ctx.fillStyle='#fff';ctx.fillRect(0,0,256,256);ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,256,256);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));if(!blob)throw Error('Não foi possível preparar a foto.');return blob;}finally{URL.revokeObjectURL(url);}
 }
 async function updatePhoto(file){
  if(photoBusy||working||!saved)return;photoBusy=true;$('#avatar-file').disabled=true;$('#remove-avatar').disabled=true;$('#save-profile').disabled=true;$('#photo-status').textContent=file?'Salvando foto…':'Removendo foto…';
  try{const options=file?{method:'POST',headers:{'Content-Type':'image/jpeg'},body:await preparePhoto(file)}:{method:'DELETE'};const {profile}=await request('avatar',options);saved={...saved,avatar:profile.avatar,version:profile.version};avatar(profile);broadcast(profile);$('#photo-status').textContent=file?'Foto atualizada.':'Foto removida.';}catch(e){$('#photo-status').textContent=e.message;if(e.status===401)$('#profile-relogin').hidden=false;}finally{photoBusy=false;$('#avatar-file').disabled=false;$('#remove-avatar').disabled=false;$('#save-profile').disabled=false;$('#avatar-file').value='';}
 }
 $('#avatar-file').onchange=e=>{const file=e.target.files[0];if(file)updatePhoto(file);};$('#remove-avatar').onclick=()=>updatePhoto(null);
 window.addEventListener('beforeunload',event=>{if(working||photoBusy||(saved&&fields.some(k=>form.elements[k].value!==(saved[k]||'')))){event.preventDefault();event.returnValue='';}});
})();
