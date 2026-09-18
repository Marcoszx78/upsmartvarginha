document.querySelectorAll('[data-wa]').forEach(link => {
  link.href = 'https://wa.me/553591558356?text=' + encodeURIComponent(link.dataset.wa);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
});
