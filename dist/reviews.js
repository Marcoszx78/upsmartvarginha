(() => {
 const el=document.querySelector('#customer-reviews');if(!el)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 fetch('/api/reviews').then(r=>{if(!r.ok)throw Error();return r.json();}).then(({reviews})=>{if(!reviews?.length)return;el.innerHTML='<p class="eyebrow dark">QUEM JÁ ESCOLHEU A UP</p><h2>Avaliações dos clientes</h2><div class="trust-grid">'+reviews.map(r=>`<figure><blockquote>${esc(r.text)}</blockquote><figcaption>${esc(r.name)}</figcaption></figure>`).join('')+'</div>';el.hidden=false;}).catch(()=>{});
})();
