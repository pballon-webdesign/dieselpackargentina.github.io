function changeLang(lang) {
  const langs = ['es', 'pt', 'en', 'zh'];
  langs.forEach(l => {
    document.querySelectorAll('.lang-' + l).forEach(el => {
      el.classList.toggle('active', l === lang);
    });
  });
  document.querySelectorAll('.lang-switch img').forEach(img => {
    img.classList.toggle('active-lang', img.dataset.lang === lang);
  });
  localStorage.setItem('dp_lang', lang);
}

function setupMarquee(marqueeEl) {
  const track = marqueeEl.querySelector('.marquee-track');
  if (!track) return;

  // Guardamos el set original UNA sola vez. Si ya lo tenemos, lo reusamos:
  // así, sin importar cuántas veces se recalcule (resize, carga de imágenes, etc.),
  // siempre partimos del mismo punto de referencia y no vamos duplicando sobre duplicados
  // (eso era lo que generaba el "salto" al reiniciarse el loop).
  if (!marqueeEl._originalTiles) {
    marqueeEl._originalTiles = Array.from(track.children).map(el => el.cloneNode(true));
  }
  const originals = marqueeEl._originalTiles;
  if (!originals.length) return;

  track.innerHTML = '';
  originals.forEach(el => track.appendChild(el.cloneNode(true)));

  const unitWidthRaw = track.scrollWidth;
  if (!unitWidthRaw) return;
  const gapValue = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
  // El ancho de UNA vuelta completa del loop tiene que incluir el gap que conecta
  // el último elemento de este set con el primero de la repetición siguiente,
  // gap que no queda incluido al medir un solo set aislado (scrollWidth solo cuenta
  // los gaps INTERNOS, N-1, no el que lo une con la copia de al lado).
  const unitWidth = unitWidthRaw + gapValue;
  const targetWidth = Math.max(window.innerWidth, marqueeEl.getBoundingClientRect().width) * 2.2;
  let guard = 0;
  while (track.scrollWidth < targetWidth && guard < 40) {
    originals.forEach(el => track.appendChild(el.cloneNode(true)));
    guard++;
  }
  const speed = 55; // px por segundo, mismo ritmo para todos los marquees
  track.style.setProperty('--marquee-distance', unitWidth + 'px');
  track.style.setProperty('--marquee-duration', (unitWidth / speed) + 's');
}

function waitForImages(container) {
  const imgs = Array.from(container.querySelectorAll('img'));
  return Promise.all(imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }));
}

async function setupAllMarquees() {
  const marquees = Array.from(document.querySelectorAll('.marquee'));
  // Esperamos a que las imágenes de cada marquee terminen de cargar ANTES de medir,
  // así el cálculo de ancho es preciso desde el primer render (sin recalcular de más).
  await Promise.all(marquees.map(waitForImages));
  marquees.forEach(setupMarquee);
}

let marqueeResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(marqueeResizeTimer);
  marqueeResizeTimer = setTimeout(setupAllMarquees, 250);
});

function toggleNav() {
  const nav = document.querySelector('nav.main-nav');
  nav.classList.toggle('open');
}

function toggleCategory(id) {
  const panel = document.getElementById('detail-' + id);
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  document.querySelectorAll('.category-detail.open').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.category-card.active').forEach(c => c.classList.remove('active'));
  if (!isOpen) {
    panel.classList.add('open');
    const card = document.querySelector('[data-category="' + id + '"]');
    if (card) card.classList.add('active');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

document.documentElement.classList.add('js');

function setScrollbarWidthVar() {
  const sw = window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.setProperty('--scrollbar-w', Math.max(sw, 0) + 'px');
}
setScrollbarWidthVar();
window.addEventListener('resize', setScrollbarWidthVar);

document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('dp_lang') || 'es';
  changeLang(saved);

  const revealTargets = document.querySelectorAll('.reveal, .reveal-stagger');
  if ('IntersectionObserver' in window && revealTargets.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealTargets.forEach(el => io.observe(el));
    // Red de seguridad: si algo no se reveló solo (viewport raro, error puntual), forzarlo igual.
    setTimeout(() => {
      revealTargets.forEach(el => el.classList.add('revealed'));
    }, 2500);
  } else {
    revealTargets.forEach(el => el.classList.add('revealed'));
  }

  setupAllMarquees();

  const headerEl = document.querySelector('header');
  const backToTop = document.querySelector('.back-to-top');
  const floatWhatsapp = document.querySelector('.float-whatsapp');
  const footerEl = document.querySelector('footer');
  let footerVisible = false;

  function updateFloatButtons() {
    if (floatWhatsapp) floatWhatsapp.classList.toggle('float-hidden', footerVisible);
  }

  if (footerEl && 'IntersectionObserver' in window) {
    const footerIo = new IntersectionObserver((entries) => {
      entries.forEach(entry => { footerVisible = entry.isIntersecting; });
      updateFloatButtons();
    }, { threshold: 0.1 });
    footerIo.observe(footerEl);
  }

  function onScroll() {
    const y = window.scrollY;
    if (headerEl) headerEl.classList.toggle('scrolled', y > 30);
    if (backToTop) backToTop.classList.toggle('visible', y > 500 && !footerVisible);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Si venimos de un link del inicio hacia una categoría puntual, abrirla automáticamente
  const pendingCategory = localStorage.getItem('dp_open');
  const hashCategory = window.location.hash ? window.location.hash.replace('#', '') : null;
  const targetCategory = pendingCategory || hashCategory;
  if (targetCategory && document.getElementById('detail-' + targetCategory)) {
    localStorage.removeItem('dp_open');
    setTimeout(() => toggleCategory(targetCategory), 300);
  }

  const forms = document.querySelectorAll('form.contact-form');
  forms.forEach(form => {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const data = new FormData(form);
      const action = form.getAttribute('action');
      const wrap = form.closest('.lang-block');
      const success = wrap.querySelector('.form-message.success');
      const error = wrap.querySelector('.form-message.error');
      success.style.display = 'none';
      error.style.display = 'none';

      try {
        const response = await fetch(action, {
          method: 'POST',
          body: data,
          headers: { Accept: 'application/json' }
        });
        if (response.ok) {
          form.style.transition = 'opacity 0.4s ease-out';
          form.style.opacity = 0;
          setTimeout(() => {
            form.style.display = 'none';
            success.style.display = 'block';
          }, 400);
        } else {
          error.style.display = 'block';
        }
      } catch (err) {
        error.style.display = 'block';
      }
    });
  });
});
