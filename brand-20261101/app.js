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
