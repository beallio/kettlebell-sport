const search = document.getElementById('search');
const count = document.getElementById('searchCount');
const noResults = document.getElementById('noResults');
const items = [...document.querySelectorAll('.resource-item[data-resource="true"]')];
const sections = [...document.querySelectorAll('.resource-section')];

function filterResources() {
  const q = search.value.trim().toLowerCase();
  let visible = 0;

  items.forEach((item) => {
    const haystack = item.dataset.search || item.textContent.toLowerCase();
    const match = !q || haystack.includes(q);
    item.classList.toggle('is-hidden', !match);
    if (match) visible += 1;
  });

  sections.forEach((section) => {
    const sectionItems = [...section.querySelectorAll('.resource-item[data-resource="true"]')];
    const hasVisibleItem = sectionItems.some((item) => !item.classList.contains('is-hidden'));
    section.classList.toggle('is-empty', !hasVisibleItem);
  });

  count.textContent = String(visible);
  noResults.hidden = visible !== 0;
}

search?.addEventListener('input', filterResources);

window.addEventListener('keydown', (event) => {
  const target = event.target;
  const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
  if (event.key === '/' && !typing && search) {
    event.preventDefault();
    search.focus();
    search.select();
  }
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
} else {
  document.querySelectorAll('.reveal').forEach((element) => element.classList.add('in'));
}

filterResources();


const menuToggle = document.querySelector('.menu-toggle');
const primaryNav = document.getElementById('primaryNav');

function closeMenu() {
  if (!menuToggle || !primaryNav) return;
  menuToggle.setAttribute('aria-expanded', 'false');
  primaryNav.classList.remove('is-open');
  document.body.classList.remove('menu-open');
}

menuToggle?.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!open));
  primaryNav?.classList.toggle('is-open', !open);
  document.body.classList.toggle('menu-open', !open);
});

primaryNav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
window.addEventListener('resize', () => { if (window.innerWidth > 980) closeMenu(); });
window.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });
