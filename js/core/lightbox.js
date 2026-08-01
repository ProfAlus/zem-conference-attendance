// ============================================================
// LIGHTBOX — full-screen image viewer with prev/next navigation.
// Reused by the Speakers page (single photo) and the Gallery
// page (many photos, arrow-key + on-screen navigation).
// ============================================================

let currentImages = [];
let currentIndex = 0;

/**
 * Open the lightbox.
 * @param {{url: string, caption?: string}[]} images
 * @param {number} startIndex
 */
export function openLightbox(images, startIndex = 0) {
  currentImages = images;
  currentIndex = startIndex;

  let backdrop = document.getElementById('lightboxBackdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'lightboxBackdrop';
    backdrop.className = 'lightbox-backdrop';
    backdrop.innerHTML = `
      <button class="lightbox-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
      <button class="lightbox-nav lightbox-prev" aria-label="Previous image"><i class="fa-solid fa-chevron-left"></i></button>
      <div class="lightbox-content">
        <img class="lightbox-img" alt="">
        <div class="lightbox-caption"></div>
      </div>
      <button class="lightbox-nav lightbox-next" aria-label="Next image"><i class="fa-solid fa-chevron-right"></i></button>
    `;
    document.body.appendChild(backdrop);

    backdrop.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeLightbox(); });
    backdrop.querySelector('.lightbox-prev').addEventListener('click', () => step(-1));
    backdrop.querySelector('.lightbox-next').addEventListener('click', () => step(1));
    document.addEventListener('keydown', handleKeydown);
  }

  render();
  backdrop.classList.add('open');
}

function handleKeydown(e) {
  const backdrop = document.getElementById('lightboxBackdrop');
  if (!backdrop || !backdrop.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
}

function step(delta) {
  if (currentImages.length < 2) return;
  currentIndex = (currentIndex + delta + currentImages.length) % currentImages.length;
  render();
}

function render() {
  const backdrop = document.getElementById('lightboxBackdrop');
  const img = backdrop.querySelector('.lightbox-img');
  const caption = backdrop.querySelector('.lightbox-caption');
  const current = currentImages[currentIndex];
  img.src = current.url;
  img.alt = current.caption || '';
  caption.textContent = current.caption || '';
  caption.style.display = current.caption ? 'block' : 'none';

  const multi = currentImages.length > 1;
  backdrop.querySelector('.lightbox-prev').style.display = multi ? 'flex' : 'none';
  backdrop.querySelector('.lightbox-next').style.display = multi ? 'flex' : 'none';
}

function closeLightbox() {
  document.getElementById('lightboxBackdrop')?.classList.remove('open');
}
