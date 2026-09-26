(() => {
 const el=document.querySelector('#customer-reviews');if(!el)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const stars=rating=>Number.isInteger(rating)&&rating>=1&&rating<=5?`<div class="review-rating" role="img" aria-label="${rating} de 5 estrelas"><span class="review-stars" aria-hidden="true">${[1,2,3,4,5].map(n=>`<span class="${n<=rating?'filled':''}">${n<=rating?'★':'☆'}</span>`).join('')}</span><span class="review-score" aria-hidden="true">${rating}/5</span></div>`:'';
 fetch('/api/reviews').then(r=>{if(!r.ok)throw Error();return r.json();}).then(({reviews})=>{if(!reviews?.length)return;el.innerHTML='<p class="eyebrow dark">QUEM JÁ ESCOLHEU A UP</p><h2>Avaliações dos clientes</h2><div class="trust-grid">'+reviews.map(r=>`<figure>${stars(r.rating)}<blockquote>${esc(r.text)}</blockquote><figcaption>${esc(r.name)}</figcaption></figure>`).join('')+'</div>';el.hidden=false;}).catch(()=>{});
})();
