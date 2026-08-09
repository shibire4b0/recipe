(() => {
  'use strict';

  /* ============ storage ============ */
  const FOODS_KEY = 'recipenotev3_foods';
  const RECIPES_KEY = 'recipenotev3_recipes';

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

  /* ============ recipe sharing (URL link / file, no backend) ============
     A link carries the recipe as text only (name/ingredients/steps/memo)
     kept small and base64url-encoded in the hash so it survives being
     pasted into Messages/Mail on iOS. Photos are excluded from links
     (a resized JPEG would make the URL unreliable across share targets)
     but are included when sharing as a .json file via the native share
     sheet, which handles larger payloads fine. */
  function b64urlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(b64url) {
    let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function buildShareRecipePayload(recipe) {
    return {
      v: 1,
      name: recipe.name || '',
      memo: recipe.memo || '',
      ingredients: recipe.ingredients.map(ing => {
        const f = getFood(ing.foodId);
        return f ? { name: f.name, unit: f.unit, amount: ing.amount || '' } : null;
      }).filter(Boolean),
      steps: (recipe.steps || []).filter(s => s && s.trim()),
    };
  }

  function isValidSharePayload(p) {
    return !!p && typeof p === 'object' && Array.isArray(p.ingredients) && Array.isArray(p.steps);
  }

  function applyImportedRecipe(payload) {
    const foods = loadFoods();
    const ingredients = (payload.ingredients || []).map(ing => {
      let food = foods.find(f => f.name === ing.name);
      if (!food) {
        food = { id: uid(), name: ing.name, unit: ing.unit || 'その他' };
        foods.push(food);
      }
      return { foodId: food.id, amount: ing.amount || '' };
    });
    saveFoods(foods);

    const recipes = loadRecipes();
    const record = {
      id: uid(),
      name: payload.name || '無題のレシピ',
      image: payload.image || null,
      memo: payload.memo || '',
      ingredients,
      steps: (payload.steps || []).filter(s => s && s.trim()),
      createdAt: Date.now(),
    };
    recipes.push(record);
    saveRecipes(recipes);
    return record;
  }

  async function shareRecipeLink(recipe) {
    const encoded = b64urlEncode(JSON.stringify(buildShareRecipePayload(recipe)));
    const url = location.origin + location.pathname + '#/import/' + encoded;
    const title = recipe.name || 'レシピ';
    if (navigator.share) {
      try { await navigator.share({ title, text: `「${title}」のレシピをシェアします`, url }); }
      catch (e) { /* user cancelled the share sheet */ }
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        window.alert('共有リンクをコピーしました。');
        return;
      } catch (e) { /* fall through to prompt */ }
    }
    window.prompt('このリンクをコピーして共有してください', url);
  }

  async function shareRecipeFile(recipe) {
    const payload = buildShareRecipePayload(recipe);
    payload.image = recipe.image || null;
    const filename = (recipe.name || 'recipe').replace(/[\\/:*?"<>|]/g, '').trim() + '.json';
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const file = new File([blob], filename || 'recipe.json', { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: recipe.name || 'レシピ' }); return; }
      catch (e) { /* user cancelled the share sheet */ }
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'recipe.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* All-data backup: bundles every recipe (with photos) and every food
     into one .json file. Used both as a personal backup before clearing
     browser data / switching devices, and as a way to hand a whole
     collection to someone else in one go. Always additive on import
     (never overwrites existing recipes/foods) so it's safe to re-import. */
  function buildFullBackupPayload() {
    return { v: 1, type: 'backup', exportedAt: Date.now(), foods: loadFoods(), recipes: loadRecipes() };
  }

  function isValidBackupPayload(p) {
    return !!p && typeof p === 'object' && p.type === 'backup' && Array.isArray(p.foods) && Array.isArray(p.recipes);
  }

  function applyImportedBackup(payload) {
    const foods = loadFoods();
    const foodIdMap = {};
    (payload.foods || []).forEach(bf => {
      let food = foods.find(f => f.name === bf.name);
      if (!food) {
        food = { id: uid(), name: bf.name, unit: bf.unit || 'その他' };
        foods.push(food);
      }
      foodIdMap[bf.id] = food.id;
    });
    saveFoods(foods);

    const recipes = loadRecipes();
    const imported = (payload.recipes || []).map(br => ({
      id: uid(),
      name: br.name || '無題のレシピ',
      image: br.image || null,
      memo: br.memo || '',
      ingredients: (br.ingredients || [])
        .map(ing => ({ foodId: foodIdMap[ing.foodId], amount: ing.amount || '' }))
        .filter(ing => ing.foodId),
      steps: (br.steps || []).filter(s => s && s.trim()),
      createdAt: br.createdAt || Date.now(),
    }));
    saveRecipes(recipes.concat(imported));
    return imported;
  }

  async function exportAllDataFile() {
    const payload = buildFullBackupPayload();
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `recipe-note-backup-${stamp}.json`;
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'レシピノート バックアップ' }); return; }
      catch (e) { /* user cancelled the share sheet */ }
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ============ draft state (recipe being created/edited) ============ */
  let draft = null;
  function blankDraft() {
    return { editingId: null, name: '', image: null, memo: '', ingredients: [], steps: [''] };
  }
  let pendingFoodIds = [];
  // holds a decoded payload handed off from the file-import picker to
  // the #/import-preview route (a file's contents can't live in the URL)
  let filePendingImportPayload = null;

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
    if (parts[0] === 'import' && parts[1]) return renderImportPreview({ source: 'url', encoded: parts[1] });
    if (parts[0] === 'import-preview') return renderImportPreview({ source: 'file' });
    if (parts[0] === 'import-backup-preview') return renderImportBackupPreview();
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
          <div class="menu-header-row">
            <div class="eyebrow">Recipe Note</div>
            <div class="menu-header-actions">
              <button class="fab-round" id="exportAllBtn" title="全レシピをバックアップ/共有">📤</button>
              <button class="fab-round" id="importFileBtn" title="共有・バックアップファイルを読み込む">📥</button>
            </div>
            <input type="file" accept="application/json" id="importFileInput" style="display:none;">
          </div>
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

    document.getElementById('exportAllBtn').addEventListener('click', () => exportAllDataFile());
    document.getElementById('importFileBtn').addEventListener('click', () => {
      document.getElementById('importFileInput').click();
    });
    document.getElementById('importFileInput').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        if (isValidBackupPayload(payload)) {
          filePendingImportPayload = payload;
          navigate('#/import-backup-preview');
        } else if (isValidSharePayload(payload)) {
          filePendingImportPayload = payload;
          navigate('#/import-preview');
        } else {
          throw new Error('invalid');
        }
      } catch (err) {
        window.alert('ファイルを読み込めませんでした。共有・バックアップされたJSONファイルを選んでください。');
      } finally {
        e.target.value = '';
      }
    });

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
            <div class="detail-head-left">
              <button class="fab-round" id="backToMenuBtn" title="メニューに戻る">←</button>
              <h1 class="detail-title">${escapeHtml(recipe.name || '無題のレシピ')}</h1>
            </div>
            <div class="detail-actions">
              <button class="edit-fab" id="shareLinkBtn" title="リンクで共有">共有</button>
              <button class="edit-fab" data-nav-edit="${recipe.id}">編集</button>
            </div>
          </div>
          ${recipe.image ? `<img class="hero-photo" src="${recipe.image}" alt="">` : ''}
          ${recipe.image ? `<div class="share-file-row"><button class="pill-btn" id="shareFileBtn">📎 画像を含めてファイルで送る</button></div>` : ''}
          <div class="card">
            <h2>Ingredients</h2>
            ${ingredientsHtml}
          </div>
          <div class="card">
            <h2>Cooking</h2>
            ${stepsHtml}
          </div>
        </div>
      </div>
    `;

    document.getElementById('backToMenuBtn').addEventListener('click', () => navigate('#/menu'));
    document.querySelector('[data-nav-edit]').addEventListener('click', () => {
      openEditRecipe(recipe.id);
    });
    document.getElementById('shareLinkBtn').addEventListener('click', () => shareRecipeLink(recipe));
    const shareFileBtn = document.getElementById('shareFileBtn');
    if (shareFileBtn) shareFileBtn.addEventListener('click', () => shareRecipeFile(recipe));

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

  /* ============ IMPORT PREVIEW screen (from shared link or file) ============ */
  function renderImportPreview(opts) {
    let payload = null;
    if (opts.source === 'url') {
      try { payload = JSON.parse(b64urlDecode(opts.encoded)); } catch (e) { payload = null; }
    } else {
      payload = filePendingImportPayload;
    }
    if (!isValidSharePayload(payload)) {
      app.innerHTML = `
        <div class="screen">
          <div class="screen-body" style="padding-top:28px;">
            <div class="empty-msg">共有データを読み込めませんでした。${'\n'}リンクやファイルが壊れているようです。</div>
          </div>
          <div class="screen-footer">
            <button class="btn btn-accent btn-block" id="backBtn">メニューに戻る</button>
          </div>
        </div>
      `;
      document.getElementById('backBtn').addEventListener('click', () => {
        filePendingImportPayload = null;
        navigate('#/menu');
      });
      fitScreenBody();
      return;
    }

    const ingredientsHtml = payload.ingredients.map(ing => `
      <div class="ingredient-row">
        <span class="ing-name">${escapeHtml(ing.name)}</span>
        <span class="dots"></span>
        <span class="ing-amount">${escapeHtml(ing.amount || '')}</span>
        <span class="ing-unit">${escapeHtml(ing.unit || '')}</span>
      </div>`).join('') || `<div class="empty-msg">材料が登録されていません</div>`;

    const stepsHtml = payload.steps.map((s, i) => `
      <div class="step-row">
        <div class="num">${i + 1}</div>
        <div class="step-text">${escapeHtml(s)}</div>
      </div>`).join('') || `<div class="empty-msg">手順が登録されていません</div>`;

    app.innerHTML = `
      <div class="screen">
        <div class="memo-note" style="background:var(--sage-soft); color:#3c4d36;">
          <b>Shared Recipe</b>共有されたレシピです。取り込みますか？
        </div>
        <div class="screen-body" id="importBody">
          <h1 class="detail-title" style="margin-top:2px;">${escapeHtml(payload.name || '無題のレシピ')}</h1>
          ${payload.image ? `<img class="hero-photo" src="${payload.image}" alt="" style="margin-top:14px;">` : ''}
          <div class="card"><h2>Ingredients</h2>${ingredientsHtml}</div>
          <div class="card"><h2>Cooking</h2>${stepsHtml}</div>
          ${payload.memo ? `<div class="card"><h2>Memo</h2><div style="white-space:pre-wrap;line-height:1.7;">${escapeHtml(payload.memo)}</div></div>` : ''}
        </div>
        <div class="screen-footer">
          <button class="btn btn-ghost" id="discardBtn">破棄</button>
          <button class="btn btn-accent" id="importBtn">レシピを追加</button>
        </div>
      </div>
    `;

    document.getElementById('discardBtn').addEventListener('click', () => {
      filePendingImportPayload = null;
      navigate('#/menu');
    });
    document.getElementById('importBtn').addEventListener('click', () => {
      const record = applyImportedRecipe(payload);
      filePendingImportPayload = null;
      navigate('#/recipe/' + record.id);
    });
    fitScreenBody();
  }

  /* ============ IMPORT BACKUP PREVIEW screen ============ */
  function renderImportBackupPreview() {
    const payload = filePendingImportPayload;
    if (!isValidBackupPayload(payload)) {
      app.innerHTML = `
        <div class="screen">
          <div class="screen-body">
            <div class="empty-msg">バックアップデータを読み込めませんでした。${'\n'}ファイルが壊れているようです。</div>
          </div>
          <div class="screen-footer">
            <button class="btn btn-accent btn-block" id="backBtn">メニューに戻る</button>
          </div>
        </div>
      `;
      document.getElementById('backBtn').addEventListener('click', () => {
        filePendingImportPayload = null;
        navigate('#/menu');
      });
      fitScreenBody();
      return;
    }

    const recipeCount = (payload.recipes || []).length;
    const foodCount = (payload.foods || []).length;

    app.innerHTML = `
      <div class="screen">
        <div class="memo-note" style="background:var(--sage-soft); color:#3c4d36;">
          <b>Backup Data</b>バックアップファイルです。取り込みますか？
        </div>
        <div class="screen-body">
          <div class="card">
            <h2>読み込む内容</h2>
            <div class="ingredient-row">
              <span class="ing-name">レシピ</span>
              <span class="dots"></span>
              <span class="ing-amount">${recipeCount}</span>
              <span class="ing-unit">件</span>
            </div>
            <div class="ingredient-row">
              <span class="ing-name">食材</span>
              <span class="dots"></span>
              <span class="ing-amount">${foodCount}</span>
              <span class="ing-unit">件</span>
            </div>
          </div>
          <div class="empty-msg" style="text-align:left;padding:8px 4px;">現在登録済みのレシピ・食材はそのまま残り、読み込んだ内容が追加されます。同じ名前の食材は自動的に統合されます。</div>
        </div>
        <div class="screen-footer">
          <button class="btn btn-ghost" id="discardBtn">破棄</button>
          <button class="btn btn-accent" id="importBtn">読み込む</button>
        </div>
      </div>
    `;

    document.getElementById('discardBtn').addEventListener('click', () => {
      filePendingImportPayload = null;
      navigate('#/menu');
    });
    document.getElementById('importBtn').addEventListener('click', () => {
      applyImportedBackup(payload);
      filePendingImportPayload = null;
      navigate('#/menu');
    });
    fitScreenBody();
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
          <div class="add-recipe-fill">
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
            <div class="memo-block">
              <div class="field-label">メモ（任意）</div>
              <textarea class="textarea-input" id="memoInput" placeholder="保存のコツなどメモを残せます">${escapeHtml(draft.memo)}</textarea>
            </div>
          </div>
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
