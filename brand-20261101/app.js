const dialog = document.querySelector('#photo-dialog');
const image = dialog.querySelector('img');
const caption = dialog.querySelector('p');
document.querySelectorAll('[data-photo]').forEach(button => {
  button.addEventListener('click', () => {
    image.src = button.dataset.photo;
    image.alt = button.dataset.caption;
    caption.textContent = button.dataset.caption;
    dialog.showModal();
  });
});
dialog.querySelector('button').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target === dialog) {
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  }
});

const menuToggle = document.querySelector('.mobile-menu-toggle');
const mainNavigation = document.querySelector('#main-navigation');
if (menuToggle && mainNavigation) {
  const header = menuToggle.closest('header');
  const narrowScreen = window.matchMedia('(max-width:760px)');
  const setMenu = open => {
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    menuToggle.querySelector('.mobile-menu-label').textContent = open ? '閉じる' : 'メニュー';
    document.body.classList.toggle('mobile-menu-open', open);
  };
  document.body.classList.add('mobile-nav-ready');
  menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
  mainNavigation.addEventListener('click', event => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menuToggle.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) setMenu(false);
  });
  narrowScreen.addEventListener('change', () => setMenu(false));
}
