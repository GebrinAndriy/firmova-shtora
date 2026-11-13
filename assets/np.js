(function () {
  'use strict';
  const city = document.getElementById('kvCity');
  const branch = document.getElementById('kvBranch');
  if (!city || !branch) return;

  let cityRef = '';
  let working = true;

  const esc = s => String(s).replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function debounce(fn, ms) {
    let t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  async function ask(params) {
    try {
      const r = await fetch('/api/np?' + params, { headers: { Accept: 'application/json' } });
      if (!r.ok) { working = false; return null; }
      const d = await r.json();
      if (!d || d.ok === false) { working = false; return null; }
      return d.items || [];
    } catch (e) { working = false; return null; }
  }

  function makePop(input) {
    const wrap = input.closest('.ck-f') || input.parentElement;
    wrap.classList.add('np-wrap');
    const pop = document.createElement('div');
    pop.className = 'np-pop';
    pop.hidden = true;
    wrap.appendChild(pop);
    return pop;
  }

  function show(pop, items, onPick) {
    if (!items || !items.length) { pop.hidden = true; pop.innerHTML = ''; return; }
    pop.innerHTML = items.map((it, i) =>
      '<button type="button" class="np-opt" data-i="' + i + '">' + esc(it.name) + '</button>').join('');
    pop.hidden = false;
    pop.querySelectorAll('.np-opt').forEach(b => {

      b.addEventListener('mousedown', e => { e.preventDefault(); onPick(items[+b.dataset.i]); });
    });
  }

  const cityPop = makePop(city);
  const branchPop = makePop(branch);

  const searchCity = debounce(async () => {
    const q = city.value.trim();
    if (q.length < 2) { cityPop.hidden = true; return; }
    const items = await ask('type=cities&q=' + encodeURIComponent(q));
    if (items == null) return;
    show(cityPop, items, it => {
      city.value = it.name;
      cityRef = it.ref;
      cityPop.hidden = true;
      branch.value = '';
      branch.focus();
    });
  }, 220);

  const searchBranch = debounce(async () => {
    if (!cityRef) { branchPop.hidden = true; return; }
    const items = await ask('type=warehouses&ref=' + encodeURIComponent(cityRef) +
      '&q=' + encodeURIComponent(branch.value.trim()));
    if (items == null) return;
    show(branchPop, items, it => { branch.value = it.name; branchPop.hidden = true; });
  }, 220);

  city.addEventListener('input', () => { cityRef = ''; if (working) searchCity(); });
  branch.addEventListener('input', () => { if (working) searchBranch(); });
  branch.addEventListener('focus', () => { if (working && cityRef) searchBranch(); });

  document.addEventListener('click', e => {
    if (e.target !== city && !cityPop.contains(e.target)) cityPop.hidden = true;
    if (e.target !== branch && !branchPop.contains(e.target)) branchPop.hidden = true;
  });
})();
