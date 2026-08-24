// VoiceCart app logic. Everything lives here for now — no build step, no modules.
// Rough layout: NLPParser (turns transcript text into intent+item+qty), ShoppingStore
// (state + localStorage), SuggestionEngine, VoiceEngine (Web Speech API wrapper),
// UIRenderer, CommandProcessor, then the init() at the bottom that wires it all up.

'use strict';

// constants & data

const LANGUAGES = [
  { code: 'en-IN', label: 'English (India)', flag: '🇮🇳' },
  { code: 'hi-IN', label: 'हिन्दी',          flag: '🇮🇳' },
];

const CATEGORIES = {
  produce:       { icon: '🥦', label: 'Produce',         keywords: ['apple','banana','orange','lemon','lime','grape','strawberry','blueberry','mango','pineapple','watermelon','melon','peach','pear','plum','cherry','kiwi','avocado','tomato','potato','onion','garlic','carrot','broccoli','spinach','lettuce','cabbage','celery','cucumber','pepper','capsicum','mushroom','zucchini','eggplant','beet','radish','corn','peas','beans','salad','herbs','ginger','leek','asparagus','artichoke'] },
  dairy:         { icon: '🥛', label: 'Dairy',           keywords: ['milk','cheese','butter','yogurt','yoghurt','cream','sour cream','ice cream','cheddar','mozzarella','parmesan','feta','brie','gouda','ricotta','cottage','whipped','condensed','evaporated','half','almond milk','oat milk','soy milk'] },
  meat:          { icon: '🥩', label: 'Meat & Seafood',  keywords: ['chicken','beef','pork','lamb','turkey','duck','fish','salmon','tuna','shrimp','prawn','crab','lobster','scallop','clam','oyster','squid','sausage','bacon','ham','steak','mince','ground','chop','fillet','wing','breast','thigh','leg'] },
  bakery:        { icon: '🍞', label: 'Bakery',           keywords: ['bread','loaf','roll','bun','bagel','muffin','croissant','cake','pie','pastry','donut','cookie','cracker','toast','pita','naan','tortilla','wrap','sourdough','rye','whole wheat','white bread'] },
  snacks:        { icon: '🍿', label: 'Snacks',           keywords: ['chips','crisps','popcorn','pretzel','nuts','peanut','cashew','almond','walnut','pistachio','trail mix','granola bar','energy bar','chocolate','candy','gummy','lollipop','marshmallow','protein bar','rice cake','cracker','biscuit','wafer'] },
  beverages:     { icon: '🧃', label: 'Beverages',        keywords: ['water','juice','soda','cola','pepsi','sprite','coffee','tea','espresso','latte','cappuccino','beer','wine','whiskey','vodka','gin','rum','liquor','kombucha','smoothie','milkshake','lemonade','energy drink','sports drink','hot chocolate','cocoa'] },
  frozen:        { icon: '🧊', label: 'Frozen',           keywords: ['frozen','ice cream','popsicle','sorbet','frozen pizza','frozen meal','frozen vegetable','frozen fruit','frozen chicken','frozen fish','frozen shrimp','waffles','tater tots'] },
  grains:        { icon: '🌾', label: 'Grains & Pasta',   keywords: ['rice','pasta','noodle','spaghetti','penne','macaroni','fettuccine','linguine','quinoa','oats','oatmeal','cereal','flour','cornmeal','barley','couscous','bulgur','ramen','udon','vermicelli'] },
  personal_care: { icon: '🧴', label: 'Personal Care',    keywords: ['shampoo','conditioner','soap','body wash','toothpaste','toothbrush','deodorant','antiperspirant','razor','shaving','lotion','moisturizer','sunscreen','sunblock','perfume','cologne','makeup','lipstick','mascara','foundation','cotton','tampon','pad','diaper','baby','wipe','tissue','toilet paper','paper towel','paper','napkin'] },
  household:     { icon: '🏠', label: 'Household',        keywords: ['detergent','bleach','cleaner','spray','sponge','scrub','mop','broom','vacuum','bag','garbage','trash','dishwasher','laundry','fabric softener','air freshener','candle','lightbulb','battery','foil','plastic wrap','zip lock','container','bag','ziplock'] },
  other:         { icon: '📦', label: 'Other',             keywords: [] },
};

const SEASONAL_ITEMS = {
  // Month-based seasonal items (0=Jan, 11=Dec)
  0:  ['Hot cocoa', 'Winter squash', 'Clementines', 'Pomegranate', 'Blood oranges'],
  1:  ['Valentine\'s chocolates', 'Strawberries', 'Grapefruit', 'Brussels sprouts'],
  2:  ['Artichokes', 'Asparagus', 'Spring onions', 'Peas', 'Leeks'],
  3:  ['Pineapple', 'Mangoes', 'Spinach', 'Radishes', 'Watercress'],
  4:  ['Cherries', 'Blueberries', 'Apricots', 'Rhubarb', 'Strawberries'],
  5:  ['Watermelon', 'Peaches', 'Raspberries', 'Corn', 'Zucchini'],
  6:  ['Cantaloupe', 'Blackberries', 'Plums', 'Eggplant', 'Tomatoes'],
  7:  ['Figs', 'Grapes', 'Bell peppers', 'Sweet corn', 'Cucumbers'],
  8:  ['Apples', 'Pears', 'Pumpkin', 'Butternut squash', 'Sweet potato'],
  9:  ['Cranberries', 'Chestnuts', 'Brussels sprouts', 'Cauliflower', 'Parsnip'],
  10: ['Pears', 'Quince', 'Turnips', 'Celeriac', 'Kale'],
  11: ['Pomelo', 'Dates', 'Chestnuts', 'Winter salad', 'Parsnip'],
};

const SUBSTITUTES = {
  'milk':        ['Almond milk', 'Oat milk', 'Soy milk', 'Coconut milk', 'Rice milk'],
  'butter':      ['Margarine', 'Coconut oil', 'Olive oil', 'Avocado'],
  'sugar':       ['Honey', 'Maple syrup', 'Stevia', 'Agave nectar'],
  'egg':         ['Flax egg', 'Chia egg', 'Aquafaba', 'Applesauce'],
  'flour':       ['Almond flour', 'Oat flour', 'Coconut flour', 'Rice flour'],
  'white rice':  ['Brown rice', 'Cauliflower rice', 'Quinoa', 'Couscous'],
  'pasta':       ['Zucchini noodles', 'Chickpea pasta', 'Rice noodles', 'Lentil pasta'],
  'beef':        ['Turkey', 'Chicken', 'Lentils', 'Black beans', 'Mushrooms'],
  'cheese':      ['Nutritional yeast', 'Cashew cheese', 'Tofu cream cheese'],
  'cream':       ['Coconut cream', 'Greek yogurt', 'Silken tofu'],
  'bread':       ['Lettuce wraps', 'Cauliflower bread', 'Rice cakes', 'Portobello'],
  'coffee':      ['Chicory coffee', 'Matcha', 'Yerba mate', 'Dandelion root'],
  'chips':       ['Rice cakes', 'Kale chips', 'Veggie straws', 'Popcorn'],
  'soda':        ['Sparkling water', 'Kombucha', 'Sparkling juice', 'Herbal tea'],
  'chocolate':   ['Cacao nibs', 'Carob chips', 'Dark chocolate (70%+)'],
  'oil':         ['Avocado oil', 'Coconut oil', 'Olive oil', 'Ghee'],
};

const COMMON_ITEMS = [
  'Milk', 'Eggs', 'Bread', 'Butter', 'Cheese', 'Yogurt', 'Orange juice',
  'Chicken', 'Beef', 'Salmon', 'Rice', 'Pasta', 'Cereal', 'Coffee', 'Tea',
  'Apples', 'Bananas', 'Tomatoes', 'Onions', 'Garlic', 'Potatoes', 'Carrots',
  'Broccoli', 'Spinach', 'Lettuce', 'Chocolate', 'Chips', 'Water', 'Soap',
  'Shampoo', 'Toothpaste', 'Detergent', 'Trash bags',
];

// nlp parser

class NLPParser {
  static INTENTS = {
    add:    [/\b(?:add|buy|get|purchase|pick up|i need|i want|we need|we want|grab|order|put|include|place|let'?s get|get me|bring|fetch|want to buy|going to buy|need to buy|would like)\b/i, /^\s*(?:\d+\s+)?[a-z]/i],
    remove: [/\b(?:remove|delete|drop|take off|take out|scratch|cancel|erase|eliminate|don'?t need|no more|forget|ditch|pull)\b/i],
    check:  [/\b(?:check(?: off)?|mark(?: as)?(?: done| complete| bought)?|done|bought|got|finished|tick(?: off)?|complete)\b/i],
    clear:  [/\b(?:clear|wipe|reset|empty|start over|start fresh|delete all|remove all|clean)\b.*\b(?:list|everything|all)\b/i],
    search: [/\b(?:search|find|look for|show me|where can i find|is there|do you have|locate|get me)\b/i],
    undo:   [/\b(?:undo|oops|mistake|revert|go back|cancel that|never mind)\b/i],
  };

  static QUANTITY_PATTERNS = [
    /(\d+(?:\.\d+)?)\s*(kg|kilog?r?a?m?s?|lb?s?|pound?s?|oz|ounces?|g|grams?|ml|millilitres?|l|litres?|liters?|gallon?s?|pint?s?|quart?s?|cup?s?|pack?s?|bag?s?|bottle?s?|can?s?|box(?:es)?|dozen?s?|bunch(?:es)?|head|loaf|loaves|piece?s?|slice?s?|roll?s?|sheet?s?|pair?s?|stick?s?|bar?s?|jar?s?|tube?s?|tin?s?)/i,
    /(\d+(?:\.\d+)?)\s+(?:of\s+)?(?=[a-z])/i,
    /\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|half a?|couple of|few|dozen|several)\b\s+(?:of\s+)?/i,
  ];

  static WORD_NUMBERS = { a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, dozen:12, half:0.5 };

  static STOP_WORDS = new Set(['the','my','our','some','just','please','quickly','now','today','tomorrow','maybe','also','and','to','for','from','me','us','them','those','these','this','that','its','it','is','are','was','on','in','at','of','a','an','by','with','about','as','into','through']);

  static NOISE_PHRASES = [
    /\b(?:my|our|the)\s+(?:shopping\s+)?list\b/gi,
    /\b(?:from\s+)?(?:my|our|the)\s+list\b/gi,
    /\b(?:please|kindly|quickly|now|today|immediately)\b/gi,
    /\b(?:i(?:'m going to| want to| need to| would like to| am going to))\b/gi,
    /\b(?:can you |could you |please )\b/gi,
  ];

  // returns { intent, item, qty, raw } or null if there's nothing to work with
  static parse(text) {
    if (!text || !text.trim()) return null;
    const raw = text.trim();
    let lower = raw.toLowerCase();

    // Detect intent
    let intent = 'add'; // default
    for (const [name, patterns] of Object.entries(this.INTENTS)) {
      if (patterns.some(p => p.test(lower))) {
        intent = name;
        break;
      }
    }

    // Extract quantity
    let qty = null;
    let cleaned = raw;
    for (const pattern of this.QUANTITY_PATTERNS) {
      const m = cleaned.match(pattern);
      if (m) {
        const num = parseFloat(m[1]) || this.WORD_NUMBERS[m[1]?.toLowerCase()] || 1;
        const unit = m[2] ? m[2].toLowerCase() : '';
        qty = unit ? `${num} ${unit}` : `${num}`;
        cleaned = cleaned.replace(m[0], ' ').trim();
        break;
      }
    }

    // Strip intent-trigger words
    let item = cleaned;
    const intentStripPatterns = [
      /^(?:add|buy|get|purchase|pick up|i need|i want|we need|we want|grab|order|include|bring|fetch|let'?s get|get me)\s+/i,
      /^(?:remove|delete|drop|take off|scratch|cancel|erase|eliminate)\s+/i,
      /^(?:check(?: off)?|mark(?: as)?(?: done| complete| bought)?|done|bought|got)\s+/i,
      /^(?:search for|find|look for|show me|locate)\s+/i,
      /\b(?:want to buy|going to buy|need to buy|would like to buy|i want to buy)\s+/i,
    ];
    for (const p of intentStripPatterns) {
      item = item.replace(p, '').trim();
    }

    // Strip noise phrases
    for (const p of this.NOISE_PHRASES) item = item.replace(p, ' ').trim();

    // Clean up extra spaces and punctuation
    item = item.replace(/\s+/g, ' ').replace(/^[,.\s]+|[,.\s]+$/g, '').trim();

    // Capitalize first letter
    if (item) item = item.charAt(0).toUpperCase() + item.slice(1);

    return { intent, item: item || null, qty, raw };
  }

  static detectCategory(itemName) {
    if (!itemName) return 'other';
    const lower = itemName.toLowerCase();
    for (const [catKey, cat] of Object.entries(CATEGORIES)) {
      if (cat.keywords.some(kw => lower.includes(kw))) return catKey;
    }
    return 'other';
  }
}

// shopping store

class ShoppingStore {
  constructor() {
    this._items = [];
    this._history = [];
    this._listeners = [];
    this._load();
  }

  // Subscribe to state changes
  onChange(fn) { this._listeners.push(fn); }
  _emit() {
    this._save();
    this._listeners.forEach(fn => fn(this._items));
  }

  // Persistence
  _save() {
    try {
      localStorage.setItem('voicecart_items', JSON.stringify(this._items));
      localStorage.setItem('voicecart_history', JSON.stringify(this._history.slice(-100)));
    } catch (_) {}
  }
  _load() {
    try {
      this._items   = JSON.parse(localStorage.getItem('voicecart_items'))   || [];
      this._history = JSON.parse(localStorage.getItem('voicecart_history')) || [];
    } catch (_) {
      this._items = []; this._history = [];
    }
  }

  // CRUD

  addItem({ name, qty = null, category = null, note = '' }) {
    if (!name || !name.trim()) return null;
    const normalized = name.trim();

    // Check for duplicate (case-insensitive)
    const existing = this._items.find(it => it.name.toLowerCase() === normalized.toLowerCase());
    if (existing) {
      // Increase qty if numeric or just bump count
      if (qty) {
        existing.qty = qty;
      } else {
        const cur = parseFloat(existing.qty);
        existing.qty = isNaN(cur) ? existing.qty : String(cur + 1);
      }
      existing.updatedAt = Date.now();
      this._emit();
      return { action: 'updated', item: existing };
    }

    const item = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      name: normalized,
      qty: qty || '1',
      category: category || NLPParser.detectCategory(normalized),
      note,
      checked: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this._items.push(item);
    this._history.push({ name: normalized, ts: Date.now() });
    this._emit();
    return { action: 'added', item };
  }

  removeItem(nameOrId) {
    const lower = nameOrId.toLowerCase();
    const idx = this._items.findIndex(it => it.id === nameOrId || it.name.toLowerCase().includes(lower));
    if (idx === -1) return null;
    const [removed] = this._items.splice(idx, 1);
    this._emit();
    return removed;
  }

  toggleCheck(id) {
    const item = this._items.find(it => it.id === id);
    if (!item) return;
    item.checked = !item.checked;
    item.updatedAt = Date.now();
    this._emit();
  }

  checkItemByName(name) {
    const lower = name.toLowerCase();
    const item = this._items.find(it => it.name.toLowerCase().includes(lower));
    if (!item) return null;
    item.checked = true;
    item.updatedAt = Date.now();
    this._emit();
    return item;
  }

  updateItem(id, { name, qty, category, note }) {
    const item = this._items.find(it => it.id === id);
    if (!item) return null;
    if (name !== undefined)     item.name     = name;
    if (qty !== undefined)      item.qty      = qty;
    if (category !== undefined) item.category = category;
    if (note !== undefined)     item.note     = note;
    item.updatedAt = Date.now();
    this._emit();
    return item;
  }

  clearAll() {
    this._items = [];
    this._emit();
  }

  getAll()     { return [...this._items]; }
  getHistory() { return [...this._history]; }

  getByCategory() {
    const map = {};
    for (const item of this._items) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return map;
  }

  stats() {
    const total   = this._items.length;
    const checked = this._items.filter(i => i.checked).length;
    const cats    = new Set(this._items.map(i => i.category)).size;
    const pct     = total ? Math.round((checked / total) * 100) : 0;
    return { total, checked, categories: cats, progress: pct };
  }
}

// suggestion engine

class SuggestionEngine {
  constructor(store) {
    this.store = store;
  }

  // Personalized recommendations based on history & current list
  getRecommendations() {
    const history = this.store.getHistory();
    const current = new Set(this.store.getAll().map(i => i.name.toLowerCase()));

    // Frequency map from history
    const freq = {};
    for (const h of history) {
      const key = h.name.toLowerCase();
      freq[key] = (freq[key] || 0) + 1;
    }

    // Sort by frequency, exclude items already in list
    const candidates = Object.entries(freq)
      .filter(([k]) => !current.has(k))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));

    // Pad with common items if needed
    const needed = 8 - candidates.length;
    if (needed > 0) {
      const common = COMMON_ITEMS
        .filter(c => !current.has(c.toLowerCase()) && !candidates.some(ca => ca.toLowerCase() === c.toLowerCase()))
        .slice(0, needed);
      candidates.push(...common);
    }

    return candidates.slice(0, 8);
  }

  // Seasonal suggestions based on current month
  getSeasonalSuggestions() {
    const month = new Date().getMonth();
    const current = new Set(this.store.getAll().map(i => i.name.toLowerCase()));
    return (SEASONAL_ITEMS[month] || []).filter(s => !current.has(s.toLowerCase()));
  }

  // Substitutes for items currently on the list
  getSubstitutes() {
    const items = this.store.getAll();
    const subs = [];
    for (const item of items) {
      const key = item.name.toLowerCase();
      for (const [trigger, alts] of Object.entries(SUBSTITUTES)) {
        if (key.includes(trigger)) {
          alts.forEach(alt => subs.push({ original: item.name, sub: alt }));
        }
      }
    }
    return subs.slice(0, 6);
  }
}

// voice engine

class VoiceEngine {
  constructor({ onResult, onInterim, onStart, onEnd, onError }) {
    this.callbacks   = { onResult, onInterim, onStart, onEnd, onError };
    this.isListening = false;
    this.lang        = 'en-IN';
    this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supported   = !!this.SpeechRecognition;
  }

  // has to be a fresh instance every time - reusing one that already finished
  // throws InvalidStateError in Chrome, learned that one the hard way
  _buildInstance() {
    const rec = new this.SpeechRecognition();
    rec.continuous      = false;   // single utterance per tap
    rec.interimResults  = true;    // show live transcript
    rec.maxAlternatives = 1;
    rec.lang            = this.lang;

    rec.onstart = () => {
      this.isListening = true;
      this.callbacks.onStart?.();
    };

    rec.onend = () => {
      this.isListening = false;
      this.callbacks.onEnd?.();
    };

    rec.onerror = (e) => {
      this.isListening = false;
      this.callbacks.onError?.(e.error);
    };

    rec.onresult = (event) => {
      let interim = '', final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim) this.callbacks.onInterim?.(interim);
      if (final)   this.callbacks.onResult?.(final.trim());
    };

    return rec;
  }

  setLang(langCode) {
    this.lang = langCode;
  }

  start() {
    if (!this.supported) {
      this.callbacks.onError?.('not-supported');
      return;
    }
    // Toggle off if already listening
    if (this.isListening) {
      this.stop();
      return;
    }
    // Always create a fresh instance — avoids InvalidStateError in Chrome
    try {
      this._rec = this._buildInstance();
      this._rec.start();
    } catch (e) {
      this.isListening = false;
      this.callbacks.onError?.(e.message || 'start-failed');
    }
  }

  stop() {
    if (this._rec && this.isListening) {
      try { this._rec.stop(); } catch (_) {}
    }
  }
}

// toast system

function showToast({ title, sub = '', type = 'info', icon = null, duration = 3500 }) {
  const container = document.getElementById('toast-container');
  const ICONS = { success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icon || ICONS[type]}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${sub ? `<div class="toast-sub">${sub}</div>` : ''}
    </div>
  `;

  const dismiss = () => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 350);
  };
  toast.addEventListener('click', dismiss);
  container.appendChild(toast);
  setTimeout(dismiss, duration);
}

// ui renderer

class UIRenderer {
  constructor(store, suggEngine) {
    this.store      = store;
    this.suggEngine = suggEngine;
    this.currentFilter = 'all';
    this.editingItemId = null;
  }

  // Render the full shopping list
  renderList(filter = this.currentFilter) {
    this.currentFilter = filter;
    const categoryList = document.getElementById('category-list');
    const emptyState   = document.getElementById('empty-state');
    const items        = this.store.getAll();

    // Filter
    let filtered = items;
    if (filter === 'active') filtered = items.filter(i => !i.checked);
    if (filter === 'done')   filtered = items.filter(i => i.checked);

    if (filtered.length === 0) {
      categoryList.innerHTML = '';
      categoryList.appendChild(this._makeEmptyState(filter));
      return;
    }

    // Group by category
    const grouped = {};
    for (const item of filtered) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    // Preserve collapse state
    const collapsed = new Set(
      [...categoryList.querySelectorAll('.category-section.collapsed')]
        .map(el => el.dataset.category)
    );

    categoryList.innerHTML = '';
    for (const [catKey, catItems] of Object.entries(grouped)) {
      const cat     = CATEGORIES[catKey] || CATEGORIES.other;
      const section = document.createElement('div');
      section.className   = `category-section${collapsed.has(catKey) ? ' collapsed' : ''}`;
      section.dataset.category = catKey;

      section.innerHTML = `
        <div class="category-header" data-cat="${catKey}">
          <span class="category-icon">${cat.icon}</span>
          <span class="category-name">${cat.label}</span>
          <span class="category-count">${catItems.length}</span>
          <span class="category-toggle">▾</span>
        </div>
        <div class="category-items" id="cat-items-${catKey}"></div>
      `;

      const itemsContainer = section.querySelector('.category-items');
      for (const item of catItems) {
        itemsContainer.appendChild(this._makeItemEl(item));
      }

      section.querySelector('.category-header').addEventListener('click', () => {
        section.classList.toggle('collapsed');
      });

      categoryList.appendChild(section);
    }
  }

  _makeEmptyState(filter) {
    const el = document.createElement('div');
    el.className = 'empty-state';
    const msgs = {
      all:    ['🛒', 'Your list is empty.', 'Use voice or type a command to get started!'],
      active: ['✅', 'All done!', 'Every item is checked off.'],
      done:   ['📝', 'Nothing checked yet.', 'Check off items as you shop!'],
    };
    const [icon, title, sub] = msgs[filter] || msgs.all;
    el.innerHTML = `<span class="empty-icon">${icon}</span><p>${title}</p><p class="empty-sub">${sub}</p>`;
    return el;
  }

  _makeItemEl(item) {
    const el = document.createElement('div');
    el.className  = `list-item${item.checked ? ' checked' : ''}`;
    el.dataset.id = item.id;

    const checkIcon = item.checked ? '✓' : '';
    const metaParts = [];
    if (item.qty && item.qty !== '1') metaParts.push(item.qty);
    if (item.note) metaParts.push(item.note);
    const meta = metaParts.join(' · ');

    el.innerHTML = `
      <button class="item-check${item.checked ? ' checked' : ''}" data-id="${item.id}" aria-label="Toggle ${item.name}" title="Toggle done">${checkIcon}</button>
      <div class="item-info">
        <div class="item-name">${this._escHtml(item.name)}</div>
        ${meta ? `<div class="item-meta">${this._escHtml(meta)}</div>` : ''}
      </div>
      ${(item.qty && item.qty !== '1') ? `<span class="item-qty-badge">× ${this._escHtml(item.qty)}</span>` : ''}
      <div class="item-actions">
        <button class="item-act-btn edit" data-id="${item.id}" title="Edit item" aria-label="Edit ${item.name}">✏️</button>
        <button class="item-act-btn delete" data-id="${item.id}" title="Remove item" aria-label="Remove ${item.name}">🗑</button>
      </div>
    `;

    el.querySelector('.item-check').addEventListener('click', (e) => {
      e.stopPropagation();
      this.store.toggleCheck(item.id);
    });
    el.querySelector('.item-act-btn.edit').addEventListener('click', (e) => {
      e.stopPropagation();
      this.openEditModal(item.id);
    });
    el.querySelector('.item-act-btn.delete').addEventListener('click', (e) => {
      e.stopPropagation();
      this.store.removeItem(item.id);
      showToast({ title: `Removed "${item.name}"`, type: 'warn', icon: '🗑️' });
    });

    return el;
  }

  // Stats
  renderStats() {
    const s = this.store.stats();
    document.getElementById('stat-total').textContent      = s.total;
    document.getElementById('stat-checked').textContent    = s.checked;
    document.getElementById('stat-categories').textContent = s.categories;
    document.getElementById('stat-progress').textContent   = `${s.progress}%`;
    document.getElementById('progress-bar').style.width    = `${s.progress}%`;
  }

  // Smart suggestions
  renderSuggestions() {
    this._renderRecommendations();
    this._renderSeasonal();
    this._renderSubstitutes();
  }

  _renderRecommendations() {
    const panel = document.getElementById('panel-recommendations');
    const recs  = this.suggEngine.getRecommendations();
    panel.innerHTML = recs.map(name =>
      `<button class="sug-chip" data-action="add" data-name="${this._escAttr(name)}">
         <span class="chip-name">${this._escHtml(name)}</span>
         <span class="chip-plus">+ Add</span>
       </button>`
    ).join('');
    panel.querySelectorAll('.sug-chip').forEach(btn => {
      btn.addEventListener('click', () => this._addFromSuggestion(btn.dataset.name));
    });
  }

  _renderSeasonal() {
    const panel    = document.getElementById('panel-seasonal');
    const seasonal = this.suggEngine.getSeasonalSuggestions();
    if (seasonal.length === 0) {
      panel.innerHTML = '<p style="color:var(--clr-muted);font-size:.82rem;">No seasonal suggestions right now.</p>';
      return;
    }
    panel.innerHTML = seasonal.map(name =>
      `<button class="sug-chip" data-name="${this._escAttr(name)}">
         <span class="chip-name">${this._escHtml(name)}</span>
         <span class="chip-badge seasonal">In Season</span>
       </button>`
    ).join('');
    panel.querySelectorAll('.sug-chip').forEach(btn => {
      btn.addEventListener('click', () => this._addFromSuggestion(btn.dataset.name));
    });
  }

  _renderSubstitutes() {
    const panel = document.getElementById('panel-substitutes');
    const subs  = this.suggEngine.getSubstitutes();
    if (subs.length === 0) {
      panel.innerHTML = '<p style="color:var(--clr-muted);font-size:.82rem;">Add items to see substitutes.</p>';
      return;
    }
    panel.innerHTML = subs.map(({ original, sub }) =>
      `<button class="sug-chip" data-name="${this._escAttr(sub)}">
         <span class="chip-name">${this._escHtml(sub)}</span>
         <span class="chip-badge sub">Instead of ${this._escHtml(original)}</span>
       </button>`
    ).join('');
    panel.querySelectorAll('.sug-chip').forEach(btn => {
      btn.addEventListener('click', () => this._addFromSuggestion(btn.dataset.name));
    });
  }

  _addFromSuggestion(name) {
    const result = this.store.addItem({ name });
    if (result) {
      showToast({ title: `Added "${name}"`, type: 'success', icon: '✨' });
      this.renderSuggestions();
    }
  }

  // Search results
  renderSearch(query) {
    const resultsEl = document.getElementById('search-results');
    if (!query.trim()) { resultsEl.innerHTML = ''; return; }

    const lower = query.toLowerCase();
    const matches = COMMON_ITEMS
      .filter(item => item.toLowerCase().includes(lower))
      .slice(0, 10);

    if (matches.length === 0) {
      // Offer to add the searched term directly
      resultsEl.innerHTML = `
        <button class="search-chip" data-name="${this._escAttr(query)}">
          <span>${this._escHtml(query)}</span>
          <span class="chip-add">+ Add</span>
        </button>`;
    } else {
      resultsEl.innerHTML = matches.map(name =>
        `<button class="search-chip" data-name="${this._escAttr(name)}">
           <span>${this._escHtml(name)}</span>
           <span class="chip-add">+ Add</span>
         </button>`
      ).join('');
    }

    resultsEl.querySelectorAll('.search-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        this.store.addItem({ name: btn.dataset.name });
        showToast({ title: `Added "${btn.dataset.name}"`, type: 'success', icon: '🔍' });
        document.getElementById('search-input').value = '';
        resultsEl.innerHTML = '';
      });
    });
  }

  // Edit Modal
  openEditModal(id) {
    const item = this.store.getAll().find(i => i.id === id);
    if (!item) return;
    this.editingItemId = id;
    document.getElementById('edit-name').value     = item.name;
    document.getElementById('edit-qty').value      = item.qty || '';
    document.getElementById('edit-category').value = item.category;
    document.getElementById('edit-note').value     = item.note || '';
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('edit-name').focus();
  }

  closeEditModal() {
    this.editingItemId = null;
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  saveEditModal() {
    if (!this.editingItemId) return;
    const name     = document.getElementById('edit-name').value.trim();
    const qty      = document.getElementById('edit-qty').value.trim();
    const category = document.getElementById('edit-category').value;
    const note     = document.getElementById('edit-note').value.trim();
    if (!name) { showToast({ title: 'Item name is required', type: 'error' }); return; }
    this.store.updateItem(this.editingItemId, { name, qty, category, note });
    showToast({ title: `Updated "${name}"`, type: 'success', icon: '✏️' });
    this.closeEditModal();
  }

  // Utilities
  _escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  _escAttr(s) { return String(s).replace(/"/g,'&quot;'); }
}

// command processor

class CommandProcessor {
  constructor(store, renderer) {
    this.store    = store;
    this.renderer = renderer;
  }

  // Process a raw text command; returns { success, message, icon, type }
  process(text) {
    if (!text || !text.trim()) return null;
    const parsed = NLPParser.parse(text);
    if (!parsed) return { success: false, message: 'Could not understand command', type: 'error', icon: '❓' };

    const { intent, item, qty, raw } = parsed;

    switch (intent) {
      case 'add': {
        if (!item) return { success: false, message: 'What item would you like to add?', type: 'warn', icon: '🤔' };
        const result = this.store.addItem({ name: item, qty });
        if (!result) return { success: false, message: 'Could not add item', type: 'error', icon: '❌' };
        if (result.action === 'updated') {
          return { success: true, message: `Updated quantity of "${item}"`, type: 'success', icon: '🔄' };
        }
        return { success: true, message: qty ? `Added ${qty} × "${item}"` : `Added "${item}"`, type: 'success', icon: '✅' };
      }
      case 'remove': {
        if (!item) return { success: false, message: 'What item should I remove?', type: 'warn', icon: '🤔' };
        const removed = this.store.removeItem(item);
        if (!removed) return { success: false, message: `"${item}" not found in list`, type: 'error', icon: '🔍' };
        return { success: true, message: `Removed "${removed.name}"`, type: 'success', icon: '🗑️' };
      }
      case 'check': {
        if (!item) return { success: false, message: 'Which item to check off?', type: 'warn', icon: '🤔' };
        const checked = this.store.checkItemByName(item);
        if (!checked) return { success: false, message: `"${item}" not found`, type: 'error', icon: '🔍' };
        return { success: true, message: `Checked off "${checked.name}"`, type: 'success', icon: '✅' };
      }
      case 'clear': {
        this.store.clearAll();
        return { success: true, message: 'Shopping list cleared!', type: 'warn', icon: '🧹' };
      }
      case 'search': {
        if (!item) return { success: false, message: 'What are you looking for?', type: 'warn', icon: '🤔' };
        document.getElementById('search-input').value = item;
        this.renderer.renderSearch(item);
        return { success: true, message: `Searching for "${item}"`, type: 'info', icon: '🔍' };
      }
      case 'undo': {
        return { success: false, message: 'Undo is not supported yet', type: 'warn', icon: '↩️' };
      }
      default:
        return { success: false, message: 'Unknown command', type: 'error', icon: '❓' };
    }
  }
}

// app bootstrap

(function init() {
  const store      = new ShoppingStore();
  const suggEngine = new SuggestionEngine(store);
  const renderer   = new UIRenderer(store, suggEngine);
  const cmdProc    = new CommandProcessor(store, renderer);

  // State change handler
  store.onChange(() => {
    renderer.renderList();
    renderer.renderStats();
    renderer.renderSuggestions();
  });

  // Initial render
  renderer.renderList();
  renderer.renderStats();
  renderer.renderSuggestions();
  buildLanguageUI();

  // file:// protocol warning
  if (location.protocol === 'file:') {
    const banner = document.createElement('div');
    banner.id = 'protocol-banner';
    banner.style.cssText = [
      'position:fixed','top:0','left:0','right:0','z-index:9999',
      'background:linear-gradient(90deg,#f59e0b,#ef4444)',
      'color:#fff','font-size:.85rem','font-weight:600',
      'padding:10px 20px','text-align:center','line-height:1.5',
      'box-shadow:0 4px 20px rgba(0,0,0,.4)',
    ].join(';');
    banner.innerHTML = `
      ⚠️ <strong>Voice won't work when opening via file://</strong> &nbsp;·&nbsp;
      Serve the folder locally instead:
      &nbsp;<code style="background:rgba(0,0,0,.25);padding:2px 8px;border-radius:4px;font-size:.8rem">
        npx serve .
      </code>&nbsp; then open <strong>http://localhost:3000</strong>
      &nbsp;<button onclick="this.parentElement.remove()" style="margin-left:16px;background:rgba(0,0,0,.25);border:none;color:#fff;cursor:pointer;padding:3px 10px;border-radius:6px;font-size:.8rem">✕ Dismiss</button>
    `;
    document.body.prepend(banner);
    // Push app content down so banner doesn't overlap
    document.getElementById('app').style.paddingTop = '54px';
  }

  // Voice Engine
  const voice = new VoiceEngine({
    onStart() {
      document.getElementById('mic-btn').classList.add('listening');
      document.getElementById('mic-btn').setAttribute('aria-pressed','true');
      document.getElementById('mic-icon').textContent = '⏹️';
      document.getElementById('status-dot').className  = 'status-dot listening';
      document.getElementById('status-label').textContent = 'Listening…';
      document.getElementById('waveform').classList.add('active');
      document.getElementById('transcript-text').textContent = '';
      document.getElementById('transcript-hint').classList.remove('hidden');
      document.getElementById('voice-action').classList.add('hidden');
    },
    onEnd() {
      document.getElementById('mic-btn').classList.remove('listening');
      document.getElementById('mic-btn').setAttribute('aria-pressed','false');
      document.getElementById('mic-icon').textContent = '🎙️';
      document.getElementById('status-dot').className  = 'status-dot';
      document.getElementById('status-label').textContent = 'Tap the mic to start';
      document.getElementById('waveform').classList.remove('active');
    },
    onInterim(text) {
      document.getElementById('transcript-hint').classList.add('hidden');
      document.getElementById('transcript-text').textContent = text;
      document.getElementById('status-label').textContent = 'Listening…';
    },
    onResult(text) {
      document.getElementById('transcript-text').textContent = text;
      document.getElementById('status-dot').className = 'status-dot processing';
      document.getElementById('status-label').textContent = 'Processing…';
      handleCommand(text);
    },
    onError(err) {
      document.getElementById('mic-btn').classList.remove('listening');
      document.getElementById('mic-btn').setAttribute('aria-pressed','false');
      document.getElementById('mic-icon').textContent = '🎙️';
      document.getElementById('waveform').classList.remove('active');
      document.getElementById('status-dot').className = 'status-dot error';

      const msgs = {
        'not-supported'      : '🚫 Voice not supported. Please use Chrome or Edge.',
        'not-allowed'        : '🔒 Microphone blocked. Click the 🔒 icon in the address bar and allow microphone access, then refresh.',
        'no-speech'          : '🤫 No speech detected. Please speak clearly and try again.',
        'network'            : '📡 Network error. Voice requires internet — please check your connection.',
        'audio-capture'      : '🎤 No microphone found. Please connect a mic and try again.',
        'service-not-allowed': '⛔ Speech service not allowed. Try serving via localhost or HTTPS.',
        'aborted'            : '↩️ Listening cancelled.',
        'start-failed'       : '⚠️ Could not start microphone. Please try again.',
        'language-not-supported': '🌐 Selected language not supported. Try switching to English.',
      };
      const msg = msgs[err] || `Voice error: ${err}. Try refreshing the page.`;
      document.getElementById('status-label').textContent = 'Error – tap to retry';
      showVoiceAction({ icon: '❌', msg, type: 'error' });
      // Don't show a toast for 'aborted' (user just stopped intentionally)
      if (err !== 'aborted') {
        showToast({ title: 'Voice Error', sub: msg, type: 'error', duration: 6000 });
      }
    },
  });

  // Command handler
  function handleCommand(text) {
    if (!text || !text.trim()) return;
    const result = cmdProc.process(text);
    if (!result) return;

    showVoiceAction({ icon: result.icon, msg: result.message, type: result.type });
    showToast({ title: result.message, type: result.type, icon: result.icon });

    if (result.success) {
      // Speak feedback if TTS supported
      if ('speechSynthesis' in window) {
        const utt = new SpeechSynthesisUtterance(result.message);
        utt.rate   = 1.1;
        utt.volume = 0.7;
        window.speechSynthesis.speak(utt);
      }
    }
  }

  function showVoiceAction({ icon, msg, type }) {
    const va = document.getElementById('voice-action');
    va.className = `voice-action ${type}`;
    document.getElementById('va-icon').textContent = icon;
    document.getElementById('va-msg').textContent  = msg;
    va.classList.remove('hidden');
    clearTimeout(va._timeout);
    va._timeout = setTimeout(() => va.classList.add('hidden'), 4000);
  }

  // Language UI
  function buildLanguageUI() {
    // Language chips in panel
    const grid   = document.getElementById('lang-grid');
    const select = document.getElementById('vc-lang-select');
    grid.innerHTML   = '';
    select.innerHTML = '';

    LANGUAGES.forEach(lang => {
      // Panel chip
      const chip = document.createElement('button');
      chip.className = `lang-chip${lang.code === 'en-IN' ? ' active' : ''}`;
      chip.textContent = `${lang.flag} ${lang.label}`;
      chip.addEventListener('click', () => {
        document.querySelectorAll('.lang-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        voice.setLang(lang.code);
        document.getElementById('lang-btn').querySelector('.btn-label').textContent = lang.code.split('-')[0].toUpperCase();
        document.getElementById('lang-panel').classList.add('hidden');
        showToast({ title: `Language set to ${lang.label}`, type: 'info', icon: lang.flag });
      });
      grid.appendChild(chip);

      // Select option
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = `${lang.flag} ${lang.label}`;
      if (lang.code === 'en-IN') opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      voice.setLang(select.value);
      const lang = LANGUAGES.find(l => l.code === select.value);
      if (lang) showToast({ title: `Language: ${lang.label}`, type: 'info', icon: lang.flag });
    });
  }

  // Mic button
  document.getElementById('mic-btn').addEventListener('click', () => voice.start());

  // Manual input
  function submitManual() {
    const input = document.getElementById('manual-input');
    const text  = input.value.trim();
    if (!text) return;
    document.getElementById('transcript-text').textContent = text;
    document.getElementById('transcript-hint').classList.add('hidden');
    handleCommand(text);
    input.value = '';
  }
  document.getElementById('send-btn').addEventListener('click', submitManual);
  document.getElementById('manual-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitManual();
  });

  // Search
  const searchInput = document.getElementById('search-input');
  let searchDebounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => renderer.renderSearch(searchInput.value), 250);
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') renderer.renderSearch(searchInput.value);
  });
  document.getElementById('search-btn').addEventListener('click', () => {
    // Voice search
    const origResult = voice.callbacks.onResult;
    voice.callbacks.onResult = (text) => {
      searchInput.value = text;
      renderer.renderSearch(text);
      voice.callbacks.onResult = origResult;
    };
    voice.start();
    showToast({ title: 'Say what to search for…', type: 'info', icon: '🎙️' });
  });

  // List filter buttons
  document.querySelectorAll('.list-ctrl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.list-ctrl-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderer.renderList(btn.dataset.view);
    });
  });

  // Suggestion tabs
  document.querySelectorAll('.sug-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sug-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.sug-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // Language panel toggle
  document.getElementById('lang-btn').addEventListener('click', () => {
    document.getElementById('lang-panel').classList.toggle('hidden');
  });

  // Clear all
  document.getElementById('clear-all-btn').addEventListener('click', () => {
    if (store.getAll().length === 0) { showToast({ title: 'List is already empty', type: 'info' }); return; }
    if (confirm('Clear your entire shopping list?')) {
      store.clearAll();
      showToast({ title: 'Shopping list cleared', type: 'warn', icon: '🧹' });
    }
  });

  // Share list
  document.getElementById('share-btn').addEventListener('click', async () => {
    const items = store.getAll();
    if (items.length === 0) { showToast({ title: 'Nothing to share yet', type: 'warn' }); return; }
    const text = `🛒 My Shopping List:\n\n${items.map(i => `• ${i.name}${i.qty && i.qty !== '1' ? ` (${i.qty})` : ''}`).join('\n')}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'My Shopping List', text }); }
      catch (_) {}
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
      showToast({ title: 'List copied to clipboard!', type: 'success', icon: '📋' });
    }
  });

  // Edit modal
  document.getElementById('modal-cancel').addEventListener('click', () => renderer.closeEditModal());
  document.getElementById('modal-save').addEventListener('click', () => renderer.saveEditModal());
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) renderer.closeEditModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') renderer.closeEditModal();
  });

  // Keyboard shortcut: Space to toggle mic
  document.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Spacebar') && e.altKey) {
      e.preventDefault();
      voice.start();
    }
  });

  // Lazy populate search placeholder hints
  const searchPlaceholders = [
    'Search items (e.g. "organic apples")',
    'Try "toothpaste under $5"',
    'Find "almond milk"',
    'Search "whole wheat bread"',
  ];
  let phIdx = 0;
  setInterval(() => {
    phIdx = (phIdx + 1) % searchPlaceholders.length;
    searchInput.setAttribute('placeholder', searchPlaceholders[phIdx]);
  }, 4000);

  // Service Worker registration (for PWA/offline)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Show welcome hint on first load
  const isFirst = !localStorage.getItem('voicecart_visited');
  if (isFirst) {
    localStorage.setItem('voicecart_visited', '1');
    setTimeout(() => {
      showToast({ title: 'Welcome to VoiceCart! 🛒', sub: 'Tap the mic or type to add items', type: 'info', icon: '👋', duration: 5000 });
    }, 800);
    // Add a few demo items for first-time users
    setTimeout(() => {
      [
        { name: 'Organic Milk', qty: '2 bottles' },
        { name: 'Sourdough Bread', qty: '1 loaf' },
        { name: 'Avocados', qty: '3' },
        { name: 'Greek Yogurt', qty: '500g' },
        { name: 'Sparkling Water', qty: '1 case' },
      ].forEach(item => store.addItem(item));
    }, 1200);
  }

})();
