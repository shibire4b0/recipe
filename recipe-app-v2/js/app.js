(() => {
  'use strict';

  /* ============ storage ============ */
  const FOODS_KEY = 'recipenote_foods';
  const RECIPES_KEY = 'recipenote_recipes';

  const NUMERIC_UNITS = ['ミリリットル', 'CC', 'グラム'];
  const ALL_UNITS = ['ミリリットル', 'CC', '個', '大さじ', '小さじ', 'カップ', '合', 'グラム', 'その他'];
  const AMOUNT_CHOICES = ['1/4', '1/3', '1/2', '2/3', '3/4', '1', '1.5', '2', '2.5', '3', '4', '5', '6', '7', '8', '9', '10'];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function loadFoods() {
    try { return JSON.parse(localStorage.getItem(FOODS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveFoods(foods) { localStorage.setItem(FOODS_KEY, JSON.stringify(foods)); }

  function loadRecipes() {
    try { return JSON.parse(localStorage.getItem(RECIPES_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveRecipes(recipes) { localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes)); }

  function seedIfEmpty() {
    if (loadFoods().length === 0) {
      const seedFoods = [
        { id: uid(), name: '鶏むね肉', unit: 'グラム' },
        { id: uid(), name: '鶏もも肉', unit: 'グラム' },
        { id: uid(), name: '牛肉', unit: 'グラム' },
        { id: uid(), name: '醤油', unit: '大さじ' },
        { id: uid(), name: '砂糖', unit: '大さじ' },
        { id: uid(), name: '塩', unit: '小さじ' },
        { id: uid(), name: '白菜', unit: '個' },
        { id: uid(), name: 'ほうれん草', unit: '個' },
        { id: uid(), name: '豆腐', unit: '個' },
        { id: uid(), name: '牛乳', unit: 'ミリリットル' },
        { id: uid(), name: 'たまご', unit: '個' },
        { id: uid(), name: '水', unit: 'ミリリットル' },
      ];
      saveFoods(seedFoods);

      if (loadRecipes().length === 0) {
        const f = name => seedFoods.find(x => x.name === name).id;
        saveRecipes([{
          id: uid(),
          name: '鶏肉のうま煮',
          image: null,
          memo: '冷蔵庫で3日ほど保存可能',
          ingredients: [
            { foodId: f('牛乳'), amount: '300' },
            { foodId: f('たまご'), amount: '2' },
            { foodId: f('鶏むね肉'), amount: '350' },
            { foodId: f('醤油'), amount: '1/2' },
            { foodId: f('水'), amount: '1000' },
          ],
          steps: [
            '鶏肉を1cmサイズに切り、鍋で焦げ目がつくまで炒める。',
            '玉ねぎを飴色になるまで炒め先ほど炒めた鶏肉と混ぜる、水を入れ弱火にし蓋をして10分ほど蒸らす。',
          ],
          createdAt: Date.now(),
        }]);
      }
    }
  }

  function getFood(id) { return loadFoods().find(f => f.id === id); }

  /* ============ image resize helper ============ */
  function fileToResizedDataUrl(file, maxSize = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > maxSize) {
            height = Math.round(height * (maxSize / width));
            width = maxSize;
          } else if (height >= width && height > maxSize) {
            width = Math.round(width * (maxSize / height));
            height = maxSize;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
  }

  /* ============ draft state (recipe being created/edited) ============ */
  let draft = null;
  function blankDraft() {
    return { editingId: null, name: '', image: null, memo: '', ingredients: [], steps: [''] };
  }
  let pendingFoodIds = [];

  /* ============ router ============ */
  const app = document.getElementById('app');
  function navigate(hash) { location.hash = hash; }
  function currentRoute() {
    const h = location.hash.replace(/^#\/?/, '');
    return h.split('/').filter(Boolean);
  }

  function render() {
    seedIfEmpty();
    const parts = currentRoute();
    window.scrollTo(0, 0);

    if (parts.length === 0 || parts[0] === 'menu') return renderMenu();
    if (parts[0] === 'recipe' && parts[1]) return renderRecipeDetail(parts[1]);
    if (parts[0] === 'foods' && parts[1] === 'new') return renderFoodNew();
    if (parts[0] === 'add-recipe') {
      if (!draft) draft = blankDraft();
      if (parts[1] === 'foods') return renderAddFoodSelect();
      if (parts[1] === 'units') return renderAddUnit();
      if (parts[1] === 'steps') return renderAddStep();
      if (parts[1] === 'finish') return renderFinish();
      return renderAddRecipe();
    }
    return renderMenu();
  }
  window.addEventListener('hashchange', render);

  /* ============ MENU screen ============ */
  function renderMenu() {
    const recipes = loadRecipes().sort((a, b) => b.createdAt - a.createdAt);
    app.innerHTML = `
      <div class="screen">
        <div class="screen-header">
          <div class="eyebrow">Recipe Note</div>
          <input id="searchInput" class="search-bar" type="text" placeholder="料理名・材料・手順で検索" value="${escapeHtml(window.__lastQuery || '')}">
        </div>
        <div class="screen-body">
          <div id="recipeList" class="recipe-list"></div>
        </div>
        <div class="screen-footer">
          <button class="btn btn-ghost" data-nav="#/foods/new">食材登録</button>
          <button class="btn btn-accent" data-nav="#/add-recipe">レシピ作成</button>
        </div>
      </div>
    `;

    const listEl = document.getElementById('recipeList');
    const searchEl = document.getElementById('searchInput');

    function ingredientText(r) {
      return r.ingredients.map(ing => {
        const f = getFood(ing.foodId);
        return f ? f.name : '';
      }).filter(Boolean).join(' ・ ');
    }

    function matches(r, q) {
      if (!q) return true;
      q = q.toLowerCase();
      if (r.name.toLowerCase().includes(q)) return true;
      if (r.ingredients.some(ing => {
        const f = getFood(ing.foodId);
        return f && f.name.toLowerCase().includes(q);
      })) return true;
      if (r.steps.some(s => s.toLowerCase().includes(q))) return true;
      return false;
    }

    function draw() {
      const q = searchEl.value.trim();
      window.__lastQuery = q;
      const filtered = recipes.filter(r => matches(r, q));
      if (filtered.length === 0) {
        listEl.innerHTML = `<div class="empty-msg">${recipes.length === 0 ? 'まだレシピがありません。\n「レシピ作成」から追加しましょう。' : '該当するレシピが見つかりません。'}</div>`;
        return;
      }
      listEl.innerHTML = filtered.map(r => {
        const preview = ingredientText(r) || (r.steps[0] || '');
        const thumb = r.image
          ? `<img class="thumb" src="${r.image}" alt="">`
          : `<div class="thumb-fallback">🍽</div>`;
        return `
          <div class="recipe-card ${r.image ? 'with-photo' : 'no-photo'}" data-open="${r.id}">
            ${thumb}
            <div class="info">
              <div class="name">${escapeHtml(r.name || '無題のレシピ')}</div>
              <div class="preview">${escapeHtml(preview)}</div>
            </div>
          </div>`;
      }).join('');
    }

    draw();
    searchEl.addEventListener('input', draw);
    listEl.addEventListener('click', e => {
      const card = e.target.closest('[data-open]');
      if (card) navigate('#/recipe/' + card.dataset.open);
    });
    bindNavButtons();
    fitScreenBody();
  }

  /* ============ RECIPE DETAIL screen ============ */
  function renderRecipeDetail(id) {
    const recipes = loadRecipes();
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) { navigate('#/menu'); return; }

    const ingredientsHtml = recipe.ingredients.map((ing, i) => {
      const f = getFood(ing.foodId);
      if (!f) return '';
      return `
        <div class="ingredient-row" data-ing="${i}">
          <span class="ing-name">${escapeHtml(f.name)}</span>
          <span class="dots"></span>
          <span class="ing-amount">${escapeHtml(ing.amount || '')}</span>
          <span class="ing-unit">${escapeHtml(f.unit)}</span>
        </div>`;
    }).join('') || `<div class="empty-msg">材料が登録されていません</div>`;

    const stepsHtml = recipe.steps.map((s, i) => `
      <div class="step-row">
        <div class="num">${i + 1}</div>
        <div class="step-text" data-step="${i}">${escapeHtml(s)}</div>
      </div>
    `).join('') || `<div class="empty-msg">手順が登録されていません</div>`;

    app.innerHTML = `
      <div class="screen">
        ${recipe.memo ? `<div class="memo-note"><b>Memo</b>${escapeHtml(recipe.memo)}</div>` : ''}
        <div class="screen-body" id="detailBody">
          <div class="detail-head">
            <h1 class="detail-title">${escapeHtml(recipe.name || '無題のレシピ')}</h1>
            <button class="edit-fab" data-nav-edit="${recipe.id}">編集</button>
          </div>
          ${recipe.image ? `<img class="hero-photo" src="${recipe.image}" alt="">` : ''}
          <div class="card">
            <h2>Ingredients</h2>
            ${ingredientsHtml}
          </div>
          <div class="card">
            <h2>Cooking</h2>
            ${stepsHtml}
          </div>
          <div class="back-hint">◀ 右にスワイプでメニューに戻る</div>
        </div>
      </div>
    `;

    document.querySelector('[data-nav-edit]').addEventListener('click', () => {
      openEditRecipe(recipe.id);
    });

    document.getElementById('detailBody').addEventListener('click', e => {
      const stepEl = e.target.closest('[data-step]');
      if (stepEl) {
        const wasActive = stepEl.classList.contains('active');
        document.querySelectorAll('.step-text.active').forEach(el => el.classList.remove('active'));
        if (!wasActive) stepEl.classList.add('active');
        return;
      }
      const ingEl = e.target.closest('[data-ing]');
      if (ingEl) {
        const wasActive = ingEl.classList.contains('active');
        document.querySelectorAll('.ingredient-row.active').forEach(el => el.classList.remove('active'));
        if (!wasActive) ingEl.classList.add('active');
      }
    });

    attachSwipeBack(document.getElementById('detailBody'), () => navigate('#/menu'));
    fitScreenBody();
  }

  function attachSwipeBack(el, cb) {
    let startX = null, startY = null;
    el.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener('touchend', e => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (dx > 90 && Math.abs(dy) < 60) cb();
      startX = null;
    }, { passive: true });
  }

  function openEditRecipe(id) {
    const recipe = loadRecipes().find(r => r.id === id);
    if (!recipe) return;
    draft = {
      editingId: recipe.id,
      name: recipe.name,
      image: recipe.image,
      memo: recipe.memo,
      ingredients: recipe.ingredients.map(i => ({ ...i })),
      steps: recipe.steps.length ? [...recipe.steps] : [''],
    };
    navigate('#/add-recipe');
  }

  /* ============ ADD RECIPE (main) screen ============ */
  function renderAddRecipe() {
    const ingCount = draft.ingredients.length;
    const ingHtml = `<div class="count">${ingCount ? ingCount + '件登録済み' : 'まだ未登録'}</div>`;

    const filledSteps = draft.steps.filter(s => s.trim());
    const stepHtml = `<div class="count">${filledSteps.length ? filledSteps.length + '件登録済み' : 'まだ未登録'}</div>`;

    app.innerHTML = `
      <div class="screen">
        <div class="screen-header">
          <div class="eyebrow">New Recipe</div>
          <h1 class="screen-title">レシピを作る</h1>
        </div>
        <div class="screen-body">
          <label class="image-upload-box" id="imageBox">
            ${draft.image ? `<img src="${draft.image}" alt="">` : '📷　料理の画像をアップロード'}
            <input type="file" accept="image/*" id="imageInput" style="display:none;">
          </label>
          <div class="section-grid">
            <div class="section-box" data-nav="#/add-recipe/foods">
              <div class="icon">🥕</div>
              <div class="title">食材を追加</div>
              ${ingHtml}
            </div>
            <div class="section-box" data-nav="#/add-recipe/steps">
              <div class="icon">📝</div>
              <div class="title">手順を追加</div>
              ${stepHtml}
            </div>
          </div>
          <div class="field-label">メモ（任意）</div>
          <textarea class="textarea-input" id="memoInput" placeholder="保存のコツなどメモを残せます">${escapeHtml(draft.memo)}</textarea>
        </div>
        <div class="screen-footer">
          <button class="btn btn-ghost" id="cancelBtn">取り消し</button>
          <button class="btn btn-accent" id="nextBtn">材料登録</button>
        </div>
      </div>
    `;

    document.getElementById('imageBox').addEventListener('click', e => {
      if (e.target.tagName !== 'INPUT') document.getElementById('imageInput').click();
    });
    document.getElementById('imageInput').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        draft.image = await fileToResizedDataUrl(file);
        renderAddRecipe();
      } catch (err) { /* ignore invalid image */ }
    });
    document.getElementById('memoInput').addEventListener('input', e => { draft.memo = e.target.value; });

    document.getElementById('cancelBtn').addEventListener('click', () => {
      draft = null;
      navigate('#/menu');
    });
    document.getElementById('nextBtn').addEventListener('click', () => {
      navigate('#/add-recipe/finish');
    });

    bindNavButtons();
    fitScreenBody();
  }

  /* ============ ADD FOOD (select ingredients) screen ============ */
  function renderAddFoodSelect() {
    pendingFoodIds = draft.ingredients.map(i => i.foodId);
    const foods = loadFoods();

    app.innerHTML = `
      <div class="screen">
        <div class="screen-header">
          <div class="eyebrow">Ingredients</div>
          <h1 class="screen-title">食材を選ぶ</h1>
          <input id="foodSearch" class="search-bar" type="text" placeholder="食材名で検索">
        </div>
        <div class="screen-body">
          <div id="foodGrid" class="food-grid"></div>
        </div>
        <div class="screen-footer">
          <button class="btn btn-ghost" id="cancelBtn">取り消し</button>
          <button class="btn btn-accent" id="confirmBtn">材料登録</button>
        </div>
      </div>
    `;

    const gridEl = document.getElementById('foodGrid');
    function draw() {
      const q = document.getElementById('foodSearch').value.trim().toLowerCase();
      const list = foods.filter(f => !q || f.name.toLowerCase().includes(q));
      if (list.length === 0) {
        gridEl.innerHTML = `<div class="empty-msg" style="grid-column:1/-1;">食材が見つかりません。\nメニュー画面の「食材登録」から追加してください。</div>`;
        return;
      }
      gridEl.innerHTML = list.map(f => `
        <div class="food-chip ${pendingFoodIds.includes(f.id) ? 'selected' : ''}" data-food="${f.id}">${escapeHtml(f.name)}</div>
      `).join('');
    }
    draw();
    document.getElementById('foodSearch').addEventListener('input', draw);
    gridEl.addEventListener('click', e => {
      const chip = e.target.closest('[data-food]');
      if (!chip) return;
      const id = chip.dataset.food;
      const idx = pendingFoodIds.indexOf(id);
      if (idx >= 0) pendingFoodIds.splice(idx, 1);
      else pendingFoodIds.push(id);
      draw();
    });

    document.getElementById('cancelBtn').addEventListener('click', () => {
      pendingFoodIds = [];
      navigate('#/add-recipe');
    });
    document.getElementById('confirmBtn').addEventListener('click', () => {
      navigate('#/add-recipe/units');
    });
    fitScreenBody();
  }

  /* ============ ADD UNIT (amounts) screen ============ */
  function renderAddUnit() {
    if (pendingFoodIds.length === 0) pendingFoodIds = draft.ingredients.map(i => i.foodId);
    const existingAmounts = {};
    draft.ingredients.forEach(i => { existingAmounts[i.foodId] = i.amount; });

    const rows = pendingFoodIds.map(id => {
      const f = getFood(id);
      if (!f) return '';
      const amount = existingAmounts[id] || '';
      let control;
      if (NUMERIC_UNITS.includes(f.unit)) {
        control = `<input type="number" step="any" min="0" data-amount="${id}" placeholder="数量を入力" value="${escapeHtml(amount)}">`;
      } else {
        const options = AMOUNT_CHOICES.map(v => `<option value="${v}" ${v === amount ? 'selected' : ''}>${v}</option>`).join('');
        control = `<select data-amount="${id}"><option value="">選択してください</option>${options}</select>`;
      }
      return `
        <div class="unit-row">
          <div class="food-pill">${escapeHtml(f.name)}</div>
          <div class="unit-control">
            <span class="unit-tag">${escapeHtml(f.unit)}</span>
            ${control}
          </div>
        </div>`;
    }).join('') || `<div class="empty-msg">食材が選択されていません</div>`;

    app.innerHTML = `
      <div class="screen">
        <div class="screen-header">
          <div class="eyebrow">Ingredients</div>
          <h1 class="screen-title">分量を決める</h1>
        </div>
        <div class="screen-body">${rows}</div>
        <div class="screen-footer">
          <button class="btn btn-ghost" id="cancelBtn">取り消し</button>
          <button class="btn btn-accent" id="confirmBtn">材料登録</button>
        </div>
      </div>
    `;

    document.getElementById('cancelBtn').addEventListener('click', () => {
      pendingFoodIds = [];
      navigate('#/add-recipe');
    });
    document.getElementById('confirmBtn').addEventListener('click', () => {
      const newIngredients = pendingFoodIds.map(id => {
        const input = document.querySelector(`[data-amount="${id}"]`);
        return { foodId: id, amount: input ? input.value.trim() : '' };
      });
      draft.ingredients = newIngredients;
      pendingFoodIds = [];
      navigate('#/add-recipe');
    });
    fitScreenBody();
  }

  /* ============ ADD STEP screen ============ */
  function renderAddStep() {
    let steps = draft.steps.length ? [...draft.steps] : [''];

    function draw() {
      const body = document.getElementById('stepBody');
      body.innerHTML = steps.map((s, i) => `
        <div class="step-edit-box">
          <div class="field-label">STEP ${i + 1}</div>
          <textarea class="textarea-input" data-step-index="${i}" placeholder="手順を入力">${escapeHtml(s)}</textarea>
        </div>
      `).join('');
      body.querySelectorAll('textarea').forEach(t => {
        t.addEventListener('input', e => { steps[+e.target.dataset.stepIndex] = e.target.value; });
      });
    }

    app.innerHTML = `
      <div class="screen">
        <div class="screen-header">
          <div class="eyebrow">How to cook</div>
          <h1 class="screen-title">手順を書く</h1>
        </div>
        <div class="screen-body" id="stepBody"></div>
        <div class="screen-footer-stack">
          <div class="footer-row">
            <button class="btn btn-muted" id="removeBtn">STEPを消す</button>
            <button class="btn btn-muted" id="addBtn">STEPを追加</button>
          </div>
          <div class="footer-row">
            <button class="btn btn-ghost" id="cancelBtn">取り消し</button>
            <button class="btn btn-accent" id="confirmBtn">手順登録</button>
          </div>
        </div>
      </div>
    `;
    draw();
    fitScreenBody();

    document.getElementById('addBtn').addEventListener('click', () => { steps.push(''); draw(); fitScreenBody(); });
    document.getElementById('removeBtn').addEventListener('click', () => {
      if (steps.length > 1) steps.pop();
      draw();
      fitScreenBody();
    });
    document.getElementById('cancelBtn').addEventListener('click', () => navigate('#/add-recipe'));
    document.getElementById('confirmBtn').addEventListener('click', () => {
      draft.steps = steps.filter(s => s.trim()).length ? steps : [''];
      navigate('#/add-recipe');
    });
  }

  /* ============ finish (name + register) screen ============ */
  function renderFinish() {
    const ingredientsHtml = draft.ingredients.map(ing => {
      const f = getFood(ing.foodId);
      if (!f) return '';
      return `
        <div class="ingredient-row">
          <span class="ing-name">${escapeHtml(f.name)}</span>
          <span class="dots"></span>
          <span class="ing-amount">${escapeHtml(ing.amount || '')}</span>
          <span class="ing-unit">${escapeHtml(f.unit)}</span>
        </div>`;
    }).join('') || `<div class="empty-msg">材料が登録されていません</div>`;

    const filledSteps = draft.steps.filter(s => s.trim());
    const stepsHtml = filledSteps.map((s, i) => `
      <div class="step-row">
        <div class="num">${i + 1}</div>
        <div class="step-text">${escapeHtml(s)}</div>
      </div>
    `).join('') || `<div class="empty-msg">手順が登録されていません</div>`;

    app.innerHTML = `
      <div class="screen">
        ${draft.memo ? `<div class="memo-note"><b>Memo</b>${escapeHtml(draft.memo)}</div>` : ''}
        <div class="screen-body">
          ${draft.image ? `<img class="hero-photo" src="${draft.image}" alt="" style="margin-top:14px;">` : ''}
          <div class="card">
            <h2>Ingredients</h2>
            ${ingredientsHtml}
          </div>
          <div class="card">
            <h2>Cooking</h2>
            ${stepsHtml}
          </div>
        </div>
        <div class="screen-footer-stack">
          <div class="footer-row">
            <input id="nameInput" class="text-input" type="text" placeholder="料理名を入力" value="${escapeHtml(draft.name)}">
          </div>
          <div class="footer-row">
            <button class="btn btn-accent btn-block" id="registerBtn">レシピを登録する</button>
          </div>
        </div>
      </div>
    `;

    const nameInput = document.getElementById('nameInput');
    nameInput.addEventListener('input', e => { draft.name = e.target.value; });

    document.getElementById('registerBtn').addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      const recipes = loadRecipes();
      const record = {
        id: draft.editingId || uid(),
        name,
        image: draft.image,
        memo: draft.memo.trim(),
        ingredients: draft.ingredients.filter(i => getFood(i.foodId)),
        steps: draft.steps.filter(s => s.trim()),
        createdAt: draft.editingId
          ? (recipes.find(r => r.id === draft.editingId)?.createdAt || Date.now())
          : Date.now(),
      };
      const idx = recipes.findIndex(r => r.id === record.id);
      if (idx >= 0) recipes[idx] = record; else recipes.push(record);
      saveRecipes(recipes);
      draft = null;
      navigate('#/recipe/' + record.id);
    });
    fitScreenBody();
  }

  /* ============ INGREDIENTS (register new food) screen ============ */
  function renderFoodNew() {
    let selectedUnit = null;
    let name = '';

    app.innerHTML = `
      <div class="screen">
        <div class="screen-header">
          <div class="eyebrow">New Ingredient</div>
          <h1 class="screen-title">食材を登録</h1>
        </div>
        <div class="screen-body">
          <input id="foodNameInput" class="text-input" type="text" placeholder="登録する材料名を入力" style="margin-bottom:18px;">
          <div class="field-label">単位を選ぶ</div>
          <div class="unit-select-grid" id="unitGrid">
            ${ALL_UNITS.filter(u => u !== 'その他').map(u => `<div class="unit-btn" data-unit="${u}">${u}</div>`).join('')}
            <div class="unit-btn wide" data-unit="その他">その他</div>
          </div>
        </div>
        <div class="screen-footer">
          <button class="btn btn-ghost" id="cancelBtn">取り消し</button>
          <button class="btn btn-accent" id="confirmBtn">材料登録</button>
        </div>
      </div>
    `;

    document.getElementById('foodNameInput').addEventListener('input', e => { name = e.target.value; });
    document.getElementById('unitGrid').addEventListener('click', e => {
      const btn = e.target.closest('[data-unit]');
      if (!btn) return;
      selectedUnit = btn.dataset.unit;
      document.querySelectorAll('.unit-btn').forEach(b => b.classList.toggle('selected', b === btn));
    });
    document.getElementById('cancelBtn').addEventListener('click', () => navigate('#/menu'));
    document.getElementById('confirmBtn').addEventListener('click', () => {
      const trimmed = name.trim();
      const nameInput = document.getElementById('foodNameInput');
      if (!trimmed) { nameInput.focus(); return; }
      if (!selectedUnit) { return; }
      const foods = loadFoods();
      foods.push({ id: uid(), name: trimmed, unit: selectedUnit });
      saveFoods(foods);
      navigate('#/menu');
    });
    fitScreenBody();
  }

  /* ============ shared nav binding ============ */
  function bindNavButtons() {
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.nav));
    });
  }

  /* topbar/header/memo-note and footer float over .screen-body; pad it
     so nothing starts out hidden underneath them. */
  function fitScreenBody() {
    const body = document.querySelector('.screen-body');
    if (!body) return;
    const topH = ['.screen-header', '.memo-note'].reduce((sum, sel) => {
      const el = document.querySelector(sel);
      return sum + (el ? el.offsetHeight : 0);
    }, 0);
    const footerEl = document.querySelector('.screen-footer-stack') || document.querySelector('.screen-footer');
    const bottomH = footerEl ? footerEl.offsetHeight : 0;
    body.style.paddingTop = (topH + 14) + 'px';
    body.style.paddingBottom = (bottomH + 16) + 'px';
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitScreenBody);
  }

  render();
})();
