(() => {
 const subject=document.querySelector('#privacy-subject'),link=document.querySelector('#privacy-whatsapp');
 const messages={access:'Gostaria de confirmar o tratamento e solicitar acesso ou cópia dos meus dados.',correct:'Gostaria de solicitar a correção dos meus dados.',delete:'Gostaria de solicitar a exclusão da minha conta ou dos meus dados.',review:'Gostaria de solicitar a revisão ou retirada da minha avaliação.',consent:'Gostaria de revogar um consentimento para uso dos meus dados.',other:'Gostaria de esclarecer uma dúvida ou exercer um direito relacionado aos meus dados.'};
 const update=()=>{link.href='https://wa.me/553591558356?text='+encodeURIComponent('Olá! Vim pela página de privacidade da Up Smart. '+(messages[subject.value]||messages.other)+' Como posso prosseguir?');};
 subject.addEventListener('change',update);update();
 const preference=()=>{try{return localStorage.getItem('up-visitor-theme')||'default';}catch{return 'default';}};
 let settings={theme:'system',accent:'orange'};
 const paint=()=>{const mode=preference();applyTheme({...settings,theme:mode==='default'?settings.theme:mode});};paint();
 fetch('/api/catalog').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{settings=data.settings;paint();}).catch(()=>{});
 matchMedia('(prefers-color-scheme: dark)').addEventListener('change',paint);
})();
