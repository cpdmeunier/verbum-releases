// The landing's two moving parts: the hero orb that "hears" a few phrases, and the How it works gallery.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Hero: the app's orb (orb.js) breathes with a voice saying these phrases, word by word, as in a
  // session: what is heard is white, the last words still forming are grey. Paused off screen.
  const PHRASES = [
    "let's try three directions for the onboarding",
    'import the onboarding from the app, then make it dark',
    'the button should take the full width',
    'no, not that, keep the old header',
  ];
  const WORD_MS = 230, HOLD_MS = 1400, FADE_MS = 400, FORMING = 3;
  const box = document.getElementById('orbBox'), canvas = document.getElementById('orb');
  const phrase = document.getElementById('phrase');
  if (canvas && window.Orb) {
    Orb.mount(canvas);
    Orb.off(false);
    if (!still) {
      let n = 1, word = 0, timer = 0, visible = true;
      const show = (words, heard) => {
        phrase.textContent = words.slice(0, heard).join(' ') + ' ';
        const rest = document.createElement('span'), caret = document.createElement('span');
        rest.className = 'rest'; caret.className = 'caret';
        rest.textContent = words.slice(heard, word).join(' ');
        phrase.append(rest, caret);
      };
      const step = () => {
        const words = PHRASES[n].split(' ');
        if (word < words.length) {
          word++;
          show(words, Math.max(0, word - FORMING));
          Orb.level(0.35 + Math.random() * 0.5);
          timer = setTimeout(step, WORD_MS + Math.random() * 120);
        } else if (word === words.length) {
          // A pause: everything heard, the orb goes quiet, then the phrase fades and the next one starts.
          word++;
          show(words, words.length);
          Orb.level(0);
          timer = setTimeout(() => { phrase.classList.add('fade'); timer = setTimeout(step, FADE_MS); }, HOLD_MS);
        } else {
          n = (n + 1) % PHRASES.length; word = 0;
          phrase.textContent = '';
          phrase.classList.remove('fade');
          timer = setTimeout(step, 300);
        }
      };
      // Off screen: no drawing (a hidden canvas stops the orb) and no phrase; back in view, it goes on.
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting === visible) return;
        visible = e.isIntersecting;
        canvas.style.display = visible ? 'block' : 'none';
        clearTimeout(timer);
        if (visible) timer = setTimeout(step, 400);
      }).observe(box);
      word = PHRASES[n].split(' ').length; // the page opens on a phrase already heard
      timer = setTimeout(step, 1200);
    }
  }

  // --- How it works: a tab, a dot or a card behind brings its step to the front; the others follow in order.
  const tabs = [...document.querySelectorAll('.tab')], dots = [...document.querySelectorAll('.dot')];
  const cards = [...document.querySelectorAll('.card')], stack = document.getElementById('stack');
  if (!tabs.length) return;
  const select = (active, focus) => {
    tabs.forEach((t, i) => { t.setAttribute('aria-selected', i === active); t.tabIndex = i === active ? 0 : -1; });
    dots.forEach((d, i) => d.setAttribute('aria-current', i === active));
    cards.forEach((c) => { c.dataset.pos = (Number(c.dataset.step) - active + 3) % 3; });
    stack.setAttribute('aria-labelledby', tabs[active].id);
    if (focus) tabs[active].focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', (e) => {
      const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      select((to + tabs.length) % tabs.length, true);
    });
  });
  dots.forEach((d, i) => d.addEventListener('click', () => select(i)));
  cards.forEach((c) => c.addEventListener('click', () => select(Number(c.dataset.step))));
})();
