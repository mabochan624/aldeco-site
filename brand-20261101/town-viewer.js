(() => {
  'use strict';

  const views = {
    all: { label: '全体', x: .5, y: .5 },
    construction: { label: '施工の手元', x: .21, y: .66 },
    workshop: { label: '道具づくり', x: .16, y: .31 },
    development: { label: 'アプリ開発', x: .89, y: .72 }
  };
  const mobileViews = {
    all: views.all,
    construction: { label: '施工の手元', x: .24, y: .61 },
    workshop: { label: '道具づくり', x: .18, y: .34 },
    development: { label: 'アプリ開発', x: .85, y: .76 }
  };
  let viewer;
  let stage;
  let canvas;
  let artwork;
  let description;
  let hint;
  let trigger;
  let artworkViews = views;
  let activeView = 'all';
  let imageRequest = 0;
  let ready = false;

  function frameArtwork() {
    if (!viewer?.open || !ready || !stage.clientWidth || !stage.clientHeight) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const naturalWidth = artwork.naturalWidth;
    const naturalHeight = artwork.naturalHeight;
    const fit = Math.min(width / naturalWidth, height / naturalHeight, 1);
    const detailWidth = Math.min(naturalWidth, window.matchMedia('(max-width: 640px)').matches ? 1200 : 1672);
    const scale = activeView === 'all' ? fit : Math.max(fit, detailWidth / naturalWidth);
    const imageWidth = Math.round(naturalWidth * scale);
    const imageHeight = Math.round(naturalHeight * scale);
    const canvasWidth = Math.max(width, imageWidth);
    const canvasHeight = Math.max(height, imageHeight);
    artwork.style.width = `${imageWidth}px`;
    artwork.style.height = `${imageHeight}px`;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    const view = artworkViews[activeView];
    stage.scrollLeft = Math.max(0, (canvasWidth - imageWidth) / 2 + imageWidth * view.x - width / 2);
    stage.scrollTop = Math.max(0, (canvasHeight - imageHeight) / 2 + imageHeight * view.y - height / 2);
  }

  function selectView(name) {
    activeView = name;
    viewer.querySelectorAll('[data-town-view]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.townView === name));
    });
    hint.textContent = name === 'all'
      ? 'まち全体を表示しています。上のボタンから、それぞれの仕事を近くで見られます。'
      : `${artworkViews[name].label}を表示しています。画像の上をスクロールして、まわりの様子も見られます。`;
    frameArtwork();
  }

  function createViewer() {
    viewer = document.createElement('dialog');
    viewer.id = 'town-dialog';
    viewer.className = 'town-viewer';
    viewer.setAttribute('aria-labelledby', 'town-viewer-title');
    viewer.setAttribute('aria-describedby', 'town-viewer-caption');
    viewer.innerHTML = `
      <header class="town-viewer__header">
        <div><p class="town-viewer__eyebrow">ALDECO / THE TOWN</p><h2 id="town-viewer-title">まちを、近くで見る。</h2></div>
        <button type="button" class="town-viewer__close" aria-label="まちのイラストを閉じる" autofocus>閉じる <span aria-hidden="true">×</span></button>
      </header>
      <div class="town-viewer__controls" role="group" aria-label="見る場所">
        ${Object.entries(views).map(([key, view]) => `<button type="button" data-town-view="${key}" aria-pressed="${key === 'all'}" aria-controls="town-viewer-stage">${view.label}</button>`).join('')}
      </div>
      <div id="town-viewer-stage" class="town-viewer__stage" role="region" aria-label="拡大できるまちのイラスト" aria-describedby="town-viewer-hint" tabindex="0">
        <div class="town-viewer__canvas"><img class="town-viewer__art" alt="" draggable="false"></div>
      </div>
      <footer class="town-viewer__footer"><p id="town-viewer-caption"></p><p id="town-viewer-hint" role="status" aria-live="polite"></p></footer>`;
    document.body.append(viewer);
    stage = viewer.querySelector('.town-viewer__stage');
    canvas = viewer.querySelector('.town-viewer__canvas');
    artwork = viewer.querySelector('.town-viewer__art');
    description = viewer.querySelector('#town-viewer-caption');
    hint = viewer.querySelector('#town-viewer-hint');

    viewer.querySelector('.town-viewer__close').addEventListener('click', () => viewer.close());
    viewer.querySelectorAll('[data-town-view]').forEach(button => {
      button.addEventListener('click', () => selectView(button.dataset.townView));
    });
    viewer.addEventListener('click', event => {
      if (event.target !== viewer) return;
      const bounds = viewer.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.close();
    });
    viewer.addEventListener('close', () => {
      imageRequest += 1;
      document.body.classList.remove('town-viewer-is-open');
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    });
    if ('ResizeObserver' in window) {
      new ResizeObserver(frameArtwork).observe(stage);
    } else {
      window.addEventListener('resize', frameArtwork);
    }
  }

  async function openViewer(button) {
    if (!viewer) createViewer();
    if (viewer.open) return;
    trigger = button;
    const request = ++imageRequest;
    ready = false;
    artwork.hidden = true;
    description.textContent = button.dataset.caption || 'ALDECOが目指すまちのイラスト';
    artwork.alt = button.querySelector('img')?.alt || '施工、道具づくり、アプリ開発が一つにつながる、ALDECOのまちのイラスト';
    const mobileArtwork = button.dataset.townArtMobile;
    const useMobileArtwork = Boolean(mobileArtwork) && window.matchMedia('(max-width:760px)').matches;
    // Keep the chosen composition and its focal points together until the viewer closes.
    artworkViews = useMobileArtwork ? mobileViews : views;
    artwork.src = useMobileArtwork ? mobileArtwork : button.dataset.townArt;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    stage.scrollLeft = 0;
    stage.scrollTop = 0;
    document.body.classList.add('town-viewer-is-open');
    viewer.showModal();
    selectView('all');
    hint.textContent = 'イラストを読み込んでいます。';
    try {
      await artwork.decode();
      if (request !== imageRequest || !viewer.open) return;
      ready = true;
      artwork.hidden = false;
      selectView(activeView);
    } catch {
      if (request === imageRequest && viewer.open) hint.textContent = 'イラストを読み込めませんでした。一度閉じて、もう一度お試しください。';
    }
  }

  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('[data-town-art]') : null;
    if (!button) return;
    event.preventDefault();
    openViewer(button);
  });
})();
