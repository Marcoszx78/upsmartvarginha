const palette={orange:'#ff671f',blue:'#5796ff',violet:'#b28aff',green:'#43c99c'};
window.applyTheme=function(settings){const mode=settings.theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):settings.theme;document.documentElement.dataset.theme=mode;document.documentElement.style.setProperty('--orange',palette[settings.accent]||palette.orange);};
