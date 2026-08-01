const body = document.body;
const search = document.getElementById('search');
const searchCount = document.getElementById('searchCount');
const noResults = document.getElementById('noResults');
const resourceItems = [...document.querySelectorAll('[data-resource="true"]')];
const searchGroups = [...document.querySelectorAll('[data-search-group="true"]')];
const searchSections = [...document.querySelectorAll('[data-search-section="true"]')];
const documentSections = [...document.querySelectorAll('[data-section]')];
const sectionLinks = [...document.querySelectorAll('[data-section-link]')];

function setSearchCount(count) {
  if (!searchCount) return;
  searchCount.textContent = String(count);
  searchCount.setAttribute('aria-label', `${count} matching resource${count === 1 ? '' : 's'}`);
}

function filterResources() {
  if (!search) return;

  const query = search.value.trim().toLowerCase();
  const searching = query.length > 0;
  let visibleCount = 0;

  body.classList.toggle('searching', searching);

  for (const item of resourceItems) {
    const haystack = item.dataset.search || item.textContent.toLowerCase();
    const matches = !searching || haystack.includes(query);
    item.classList.toggle('is-hidden', !matches);
    if (matches) visibleCount += 1;
  }

  for (const group of searchGroups) {
    const items = [...group.querySelectorAll('[data-resource="true"]')];
    const hasMatch = items.some((item) => !item.classList.contains('is-hidden'));
    group.classList.toggle('is-empty', searching && !hasMatch);
  }

  for (const section of searchSections) {
    const groups = [...section.querySelectorAll('[data-search-group="true"]')];
    let parentGroup = null;

    for (const group of groups) {
      const level = Number(group.dataset.headingLevel || 0);
      if (level === 2) parentGroup = group;
      else if (searching && level > 2 && !group.classList.contains('is-empty')) {
        parentGroup?.classList.remove('is-empty');
      }
    }

    const items = [...section.querySelectorAll('[data-resource="true"]')];
    const hasMatch = items.some((item) => !item.classList.contains('is-hidden'));
    section.classList.toggle('is-empty', searching && !hasMatch);
  }

  setSearchCount(visibleCount);
  if (noResults) noResults.hidden = !searching || visibleCount > 0;
  scheduleActiveSectionUpdate();
}

search?.addEventListener('input', filterResources);

window.addEventListener('keydown', (event) => {
  const target = event.target;
  const typing = target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target?.isContentEditable;

  if (event.key === '/' && !typing && search) {
    event.preventDefault();
    if (mobileBreakpoint.matches && !body.classList.contains('sidebar-open')) setSidebar(true);
    search.focus({ preventScroll: true });
    search.select();
  }

  if (event.key === 'Escape') {
    if (body.classList.contains('sidebar-open')) {
      closeSidebar(true);
      return;
    }

    if (search?.value && document.activeElement === search) {
      search.value = '';
      filterResources();
    }
  }
});

const menuButton = document.querySelector('.mobile-menu-button');
const menuButtonLabel = menuButton?.querySelector('.sr-only');
const mobileHeader = document.querySelector('.mobile-header');
const sidebar = document.querySelector('.sidebar');
const sidebarScrim = document.querySelector('.sidebar-scrim');
const siteMain = document.querySelector('.site-main');
const mobileBreakpoint = window.matchMedia('(max-width: 880px)');

function setSidebar(open, restoreFocus = false) {
  const drawerOpen = mobileBreakpoint.matches && open;

  body.classList.toggle('sidebar-open', drawerOpen);
  menuButton?.setAttribute('aria-expanded', String(drawerOpen));
  if (menuButtonLabel) menuButtonLabel.textContent = drawerOpen ? 'Close navigation' : 'Open navigation';

  sidebarScrim?.setAttribute('tabindex', drawerOpen ? '0' : '-1');
  sidebarScrim?.setAttribute('aria-hidden', String(!drawerOpen));

  if (mobileBreakpoint.matches) {
    sidebar?.toggleAttribute('inert', !drawerOpen);
    sidebar?.setAttribute('aria-hidden', String(!drawerOpen));
    mobileHeader?.toggleAttribute('inert', drawerOpen);
    siteMain?.toggleAttribute('inert', drawerOpen);
  } else {
    sidebar?.removeAttribute('inert');
    sidebar?.removeAttribute('aria-hidden');
    mobileHeader?.removeAttribute('inert');
    siteMain?.removeAttribute('inert');
  }

  if (drawerOpen) {
    sidebar?.querySelector('.toc-link')?.focus({ preventScroll: true });
  } else if (restoreFocus) {
    menuButton?.focus({ preventScroll: true });
  }
}

function closeSidebar(restoreFocus = false) {
  setSidebar(false, restoreFocus);
}

menuButton?.addEventListener('click', () => {
  setSidebar(!body.classList.contains('sidebar-open'));
});

sidebarScrim?.addEventListener('click', () => closeSidebar(true));

sectionLinks.forEach((link) => {
  link.addEventListener('click', () => {
    setActiveSection(link.dataset.sectionLink || '');
    if (mobileBreakpoint.matches) closeSidebar(true);
  });
});

mobileBreakpoint.addEventListener?.('change', () => closeSidebar(false));

function setActiveSection(id) {
  for (const link of sectionLinks) {
    const active = link.dataset.sectionLink === id;
    if (active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}

let activeSectionFrame = 0;

function updateActiveSection() {
  activeSectionFrame = 0;
  const visibleSections = documentSections.filter((section) => (
    !section.classList.contains('is-empty')
    && getComputedStyle(section).display !== 'none'
  ));

  if (!visibleSections.length) {
    setActiveSection('');
    return;
  }

  const scrollingElement = document.scrollingElement || document.documentElement;
  const atPageEnd = scrollingElement.scrollTop > 0
    && scrollingElement.scrollTop + window.innerHeight >= scrollingElement.scrollHeight - 2;

  if (atPageEnd) {
    setActiveSection(visibleSections.at(-1).id);
    return;
  }

  const offset = mobileBreakpoint.matches ? 92 : 42;
  let active = visibleSections[0].id;

  for (const section of visibleSections) {
    if (section.getBoundingClientRect().top <= offset) active = section.id;
    else break;
  }

  setActiveSection(active);
}

function scheduleActiveSectionUpdate() {
  if (activeSectionFrame) return;
  activeSectionFrame = requestAnimationFrame(updateActiveSection);
}

window.addEventListener('scroll', scheduleActiveSectionUpdate, { passive: true });
window.addEventListener('resize', scheduleActiveSectionUpdate);
window.addEventListener('hashchange', scheduleActiveSectionUpdate);

setSidebar(false);
filterResources();
scheduleActiveSectionUpdate();
