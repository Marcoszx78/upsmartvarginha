(() => {
  const $=s=>document.querySelector(s), form=$('#account-form');
  let mode='login',currentUser=null;
  const showError=message=>{const el=$('#account-error');if(el){el.textContent=message;el.hidden=!message;}else if(message)alert(message);};
  async function api(path,data){
    const res=await fetch('/api/auth/'+path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});
    let body;try{body=await res.json();}catch{throw new Error('Não foi possível acessar sua conta. Tente novamente.');}
    if(!res.ok)throw new Error(body.error||'Não foi possível continuar.');return body;
  }
  function paint(user){
    document.querySelectorAll('[data-admin-link]').forEach(el=>el.hidden=user?.role!=='admin');
    document.querySelectorAll('[data-account-link]').forEach(el=>{
      el.textContent=user?'Meu perfil':'Entrar';
      if(!el.classList.contains('header-account'))return;
      el.setAttribute('aria-label',user?'Abrir meu perfil: '+user.name:'Entrar ou criar conta');
      const circle=document.createElement('span');circle.className='header-avatar';circle.setAttribute('aria-hidden','true');
      if(user){circle.textContent=user.name.trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();if(user.avatar){const img=new Image();img.alt='';img.src=user.avatar;img.onerror=()=>img.remove();circle.append(img);}}
      else circle.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>';
      const label=document.createElement('span');label.className='header-account-label';label.textContent=user?'Meu perfil':'Entrar';el.replaceChildren(circle,label);
    });
    if(user&&$('#account-name')){$('#account-name').textContent=user.name;$('#account-username').textContent='@'+user.username;$('#account-role').textContent=user.role==='admin'?'Administrador':'Cliente Up Smart';}
  }
  document.addEventListener('up:profile-changed',event=>{if(currentUser){currentUser={...currentUser,...event.detail};paint(currentUser);}});
  function render(user){
    currentUser=user;paint(user);
    if(!form)return;
    $('#account-loading').hidden=true;$('#retry-session').hidden=true;$('#auth-forms').hidden=!!user;$('#signed-account').hidden=!user;
    document.body.classList.toggle('profile-active',!!user);
    document.dispatchEvent(new CustomEvent('up:account',{detail:user}));
  }
  async function load(){try{showError('');const {user}=await api('session');render(user);if(form&&new URLSearchParams(location.search).get('acesso')==='restrito'&&user?.role!=='admin')showError('O painel é exclusivo da administração. Entre com a conta administradora para continuar.');}catch(e){if(form){$('#account-loading').hidden=true;$('#retry-session').hidden=false;showError(e.message);}}}
  if(form){
    $('#retry-session').onclick=load;
    document.querySelectorAll('[data-account-mode]').forEach(button=>button.onclick=()=>{
      mode=button.dataset.accountMode;const registering=mode==='register';showError('');
      document.querySelectorAll('[data-account-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      $('#name-field').hidden=!registering;form.elements.name.disabled=!registering;form.elements.name.required=registering;
      $('#confirm-field').hidden=!registering;form.elements.confirmation.disabled=!registering;form.elements.confirmation.required=registering;
      $('#password-hint').hidden=!registering;form.elements.password.autocomplete=registering?'new-password':'current-password';
      $('#form-heading').textContent=registering?'Sua conta começa aqui.':'Bem-vindo de volta.';
      $('#form-description').textContent=registering?'Escolha um usuário e uma senha para entrar.':'Informe seu usuário e sua senha.';
      $('#account-submit').textContent=registering?'Criar minha conta ↗':'Entrar na conta ↗';
    });
    $('#toggle-password').onclick=()=>{const show=form.elements.password.type==='password';form.elements.password.type=show?'text':'password';$('#toggle-password').textContent=show?'Ocultar':'Mostrar';$('#toggle-password').setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');$('#toggle-password').setAttribute('aria-pressed',String(show));};
    form.onsubmit=async event=>{event.preventDefault();showError('');const data=Object.fromEntries(new FormData(form));if(mode==='register'&&data.password!==data.confirmation){showError('As senhas não são iguais. Confira e tente novamente.');return;}const button=$('#account-submit');button.disabled=true;button.textContent='Aguarde…';try{const {user}=await api(mode,data);form.reset();const next=new URLSearchParams(location.search).get('returnTo');if(next&&next.startsWith('/')&&!next.startsWith('//')&&!next.includes('\\')&&!/[\r\n]/.test(next)){const target=new URL(next,location.origin);if(target.origin===location.origin){location.assign(target.href);return;}}if(user.role==='admin'){location.assign('/admin');return;}render(user);}catch(e){showError(e.message);}finally{button.disabled=false;button.textContent=mode==='register'?'Criar minha conta ↗':'Entrar na conta ↗';}};
  }
  document.querySelectorAll('[data-logout]').forEach(button=>button.onclick=async event=>{event.preventDefault();button.disabled=true;try{await api('logout',{});location.assign('/conta');}catch(e){showError(e.message);button.disabled=false;}});
  load();
})();
