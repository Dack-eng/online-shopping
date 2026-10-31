const STORAGE_KEYS = {
  products: "nomad-market-products",
  cart: "nomad-market-cart",
};

const currency = new Intl.NumberFormat("mn-MN", {
  style: "currency",
  currency: "MNT",
  maximumFractionDigits: 0,
});

const categoryPalette = {
  Хувцас: ["#d6653c", "#9a3d1c"],
  Аксесуар: ["#325647", "#4c7b67"],
  Технологи: ["#5940aa", "#34719b"],
  "Гоо сайхан": ["#c04a84", "#e17d6d"],
  default: ["#c95b2d", "#325647"],
};

const state = {
  products: loadProducts(),
  cart: loadCart(),
  editingId: null,
  uploadedImage: "",
  currentImage: "",
  filters: {
    query: "",
    category: "all",
    sort: "newest",
  },
};

const refs = {
  productGrid: document.getElementById("productGrid"),
  featuredStrip: document.getElementById("featuredStrip"),
  inventoryList: document.getElementById("inventoryList"),
  emptyState: document.getElementById("emptyState"),
  categoryFilter: document.getElementById("categoryFilter"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  productForm: document.getElementById("productForm"),
  nameInput: document.getElementById("nameInput"),
  categoryInput: document.getElementById("categoryInput"),
  priceInput: document.getElementById("priceInput"),
  comparePriceInput: document.getElementById("comparePriceInput"),
  stockInput: document.getElementById("stockInput"),
  imageUrlInput: document.getElementById("imageUrlInput"),
  imageFileInput: document.getElementById("imageFileInput"),
  descriptionInput: document.getElementById("descriptionInput"),
  featuredInput: document.getElementById("featuredInput"),
  imagePreview: document.getElementById("imagePreview"),
  formTitle: document.getElementById("formTitle"),
  submitBtn: document.getElementById("submitBtn"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  resetBtn: document.getElementById("resetBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  cartDrawer: document.getElementById("cartDrawer"),
  cartItems: document.getElementById("cartItems"),
  cartToggle: document.getElementById("cartToggle"),
  closeCartBtn: document.getElementById("closeCartBtn"),
  checkoutBtn: document.getElementById("checkoutBtn"),
  cartCount: document.getElementById("cartCount"),
  cartTotalItems: document.getElementById("cartTotalItems"),
  cartTotalPrice: document.getElementById("cartTotalPrice"),
  totalProducts: document.getElementById("totalProducts"),
  featuredProducts: document.getElementById("featuredProducts"),
  categoryCount: document.getElementById("categoryCount"),
  inStockCount: document.getElementById("inStockCount"),
  toast: document.getElementById("toast"),
};

init();

function init() {
  bindEvents();
  render();
  updatePreview();
}

function bindEvents() {
  refs.searchInput.addEventListener("input", (event) => {
    state.filters.query = event.target.value.trim().toLowerCase();
    renderProducts();
  });

  refs.categoryFilter.addEventListener("change", (event) => {
    state.filters.category = event.target.value;
    renderProducts();
  });

  refs.sortSelect.addEventListener("change", (event) => {
    state.filters.sort = event.target.value;
    renderProducts();
  });

  refs.productForm.addEventListener("submit", handleSubmit);
  refs.cancelEditBtn.addEventListener("click", resetForm);
  refs.resetBtn.addEventListener("click", restoreDemoData);
  refs.exportBtn.addEventListener("click", exportProducts);
  refs.importInput.addEventListener("change", importProducts);

  refs.imageUrlInput.addEventListener("input", () => {
    if (!state.uploadedImage) {
      updatePreview();
    }
  });

  refs.imageFileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) {
      state.uploadedImage = "";
      updatePreview();
      return;
    }

    state.uploadedImage = await readFileAsDataUrl(file);
    updatePreview();
  });

  refs.inventoryList.addEventListener("click", handleInventoryClick);
  refs.productGrid.addEventListener("click", handleProductGridClick);
  refs.cartItems.addEventListener("click", handleCartClick);
  refs.cartToggle.addEventListener("click", () => toggleCart(true));
  refs.closeCartBtn.addEventListener("click", () => toggleCart(false));
  refs.checkoutBtn.addEventListener("click", handleCheckout);

  document.addEventListener("click", (event) => {
    if (!refs.cartDrawer.classList.contains("open")) {
      return;
    }

    const clickedInsideCart = refs.cartDrawer.contains(event.target);
    const clickedToggle = refs.cartToggle.contains(event.target);

    if (!clickedInsideCart && !clickedToggle) {
      toggleCart(false);
    }
  });
}

function render() {
  renderFilters();
  renderFeatured();
  renderProducts();
  renderInventory();
  renderCart();
  renderStats();
}

function renderFilters() {
  const categories = getCategories();
  refs.categoryFilter.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "Бүх ангилал";
  refs.categoryFilter.appendChild(allOption);

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    refs.categoryFilter.appendChild(option);
  });

  refs.categoryFilter.value = categories.includes(state.filters.category)
    ? state.filters.category
    : "all";
}

function renderFeatured() {
  const featured = state.products.filter((product) => product.featured).slice(0, 4);

  refs.featuredStrip.innerHTML = featured.length
    ? featured.map((product) => `
        <article class="featured-card">
          <div class="featured-image">
            <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
          </div>
          <div class="featured-copy">
            <div class="pill-row">
              <span class="pill featured">Онцлох</span>
              <span class="pill category">${escapeHtml(product.category)}</span>
            </div>
            <h3>${escapeHtml(product.name)}</h3>
            <p class="subtle">${escapeHtml(product.description)}</p>
            <div class="price-row">
              <span class="price">${formatPrice(product.price)}</span>
              ${product.comparePrice ? `<span class="compare-price">${formatPrice(product.comparePrice)}</span>` : ""}
            </div>
          </div>
        </article>
      `).join("")
    : `
      <article class="empty-state">
        <h3>Онцлох бараа алга</h3>
        <p>Admin хэсгээс бараанд “Онцлох” сонголт өгөөд энд харуулж болно.</p>
      </article>
    `;
}

function renderProducts() {
  const products = getFilteredProducts();

  refs.productGrid.innerHTML = products.map((product) => `
    <article class="product-card">
      <div class="product-image">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
      </div>
      <div class="product-copy">
        <div class="pill-row">
          <span class="pill category">${escapeHtml(product.category)}</span>
          ${product.featured ? '<span class="pill featured">Онцлох</span>' : ""}
          <span class="pill ${getStockClass(product.stock)}">${getStockLabel(product.stock)}</span>
        </div>
        <div>
          <h3>${escapeHtml(product.name)}</h3>
          <p class="subtle">${escapeHtml(product.description)}</p>
        </div>
        <div class="price-row">
          <span class="price">${formatPrice(product.price)}</span>
          ${product.comparePrice ? `<span class="compare-price">${formatPrice(product.comparePrice)}</span>` : ""}
        </div>
        <div class="product-meta">
          <span class="subtle">Нөөц: ${product.stock}</span>
          <button
            type="button"
            class="primary-button"
            data-action="add-to-cart"
            data-id="${product.id}"
            ${product.stock === 0 ? "disabled" : ""}
          >
            ${product.stock === 0 ? "Дууссан" : "Сагсанд хийх"}
          </button>
        </div>
      </div>
    </article>
  `).join("");

  refs.emptyState.classList.toggle("hidden", products.length !== 0);
}

function renderInventory() {
  const sorted = [...state.products].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  refs.inventoryList.innerHTML = sorted.map((product) => `
    <article class="inventory-item">
      <div class="inventory-title-row">
        <div>
          <h4>${escapeHtml(product.name)}</h4>
          <p class="inventory-meta">${escapeHtml(product.category)} · ${formatPrice(product.price)} · Нөөц ${product.stock}</p>
        </div>
        <div class="inventory-actions">
          <button type="button" class="text-button" data-action="edit" data-id="${product.id}">Засах</button>
          <button type="button" class="text-button" data-action="delete" data-id="${product.id}">Устгах</button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderCart() {
  const cartItems = state.cart.map((entry) => {
    const product = state.products.find((item) => item.id === entry.productId);
    if (!product) {
      return null;
    }

    return { ...entry, product };
  }).filter(Boolean);

  refs.cartItems.innerHTML = cartItems.length
    ? cartItems.map((entry) => `
        <article class="cart-item">
          <div class="cart-item-row">
            <div>
              <h4>${escapeHtml(entry.product.name)}</h4>
              <p class="subtle">${formatPrice(entry.product.price)} / ширхэг</p>
            </div>
            <strong>${formatPrice(entry.product.price * entry.quantity)}</strong>
          </div>
          <div class="quantity-controls">
            <button type="button" data-action="decrease" data-id="${entry.product.id}">−</button>
            <span>${entry.quantity}</span>
            <button type="button" data-action="increase" data-id="${entry.product.id}">+</button>
            <button type="button" class="text-button" data-action="remove" data-id="${entry.product.id}">Устгах</button>
          </div>
        </article>
      `).join("")
    : `
      <div class="empty-state">
        <h3>Сагс хоосон байна</h3>
        <p>Дэлгүүр хэсгээс бараа сонгоод сагсандаа нэмээрэй.</p>
      </div>
    `;

  const totalItems = state.cart.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalPrice = cartItems.reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);

  refs.cartCount.textContent = String(totalItems);
  refs.cartTotalItems.textContent = String(totalItems);
  refs.cartTotalPrice.textContent = formatPrice(totalPrice);
}

function renderStats() {
  refs.totalProducts.textContent = String(state.products.length);
  refs.featuredProducts.textContent = String(state.products.filter((product) => product.featured).length);
  refs.categoryCount.textContent = String(getCategories().length);
  refs.inStockCount.textContent = String(state.products.filter((product) => product.stock > 0).length);
}

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(refs.productForm);
  const product = {
    id: state.editingId || crypto.randomUUID(),
    name: String(formData.get("name") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    price: Number(formData.get("price") || 0),
    comparePrice: Number(formData.get("comparePrice") || 0) || 0,
    stock: Number(formData.get("stock") || 0),
    description: String(formData.get("description") || "").trim() || "Тайлбар нэмээгүй байна.",
    featured: Boolean(formData.get("featured")),
    image: state.uploadedImage || String(formData.get("imageUrl") || "").trim() || state.currentImage,
    createdAt: getCreatedAt(state.editingId),
  };

  if (!product.image) {
    product.image = createPlaceholder(product.name, product.category);
  }

  if (state.editingId) {
    state.products = state.products.map((item) => item.id === state.editingId ? product : item);
    showToast("Барааны мэдээлэл шинэчлэгдлээ.");
  } else {
    state.products = [product, ...state.products];
    showToast("Шинэ бараа амжилттай нэмэгдлээ.");
  }

  persistProducts();
  resetForm();
  render();
}

function handleInventoryClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const productId = button.dataset.id;
  const action = button.dataset.action;

  if (action === "edit") {
    startEdit(productId);
    return;
  }

  if (action === "delete") {
    const product = state.products.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    state.products = state.products.filter((item) => item.id !== productId);
    state.cart = state.cart.filter((item) => item.productId !== productId);
    persistProducts();
    persistCart();
    render();
    showToast(`"${product.name}" барааг устгалаа.`);
  }
}

function handleProductGridClick(event) {
  const button = event.target.closest("button[data-action='add-to-cart']");
  if (!button) {
    return;
  }

  addToCart(button.dataset.id);
}

function handleCartClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const productId = button.dataset.id;
  const action = button.dataset.action;

  if (action === "increase") {
    updateCartQuantity(productId, 1);
    return;
  }

  if (action === "decrease") {
    updateCartQuantity(productId, -1);
    return;
  }

  if (action === "remove") {
    state.cart = state.cart.filter((item) => item.productId !== productId);
    persistCart();
    renderCart();
    showToast("Барааг сагснаас хаслаа.");
  }
}

function addToCart(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product || product.stock === 0) {
    return;
  }

  const existing = state.cart.find((item) => item.productId === productId);
  const currentQuantity = existing?.quantity || 0;

  if (currentQuantity >= product.stock) {
    showToast("Нөөцөөс хэтэрсэн тоо сонгох боломжгүй.");
    return;
  }

  state.cart = existing
    ? state.cart.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item)
    : [...state.cart, { productId, quantity: 1 }];

  persistCart();
  renderCart();
  toggleCart(true);
  showToast("Сагсанд нэмэгдлээ.");
}

function updateCartQuantity(productId, change) {
  const product = state.products.find((item) => item.id === productId);
  const existing = state.cart.find((item) => item.productId === productId);

  if (!product || !existing) {
    return;
  }

  const nextQuantity = existing.quantity + change;

  if (nextQuantity <= 0) {
    state.cart = state.cart.filter((item) => item.productId !== productId);
  } else if (nextQuantity <= product.stock) {
    state.cart = state.cart.map((item) => item.productId === productId ? { ...item, quantity: nextQuantity } : item);
  } else {
    showToast("Нөөц хүрэлцэхгүй байна.");
    return;
  }

  persistCart();
  renderCart();
}

function startEdit(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    return;
  }

  state.editingId = product.id;
  state.uploadedImage = "";
  state.currentImage = product.image;

  refs.nameInput.value = product.name;
  refs.categoryInput.value = product.category;
  refs.priceInput.value = String(product.price);
  refs.comparePriceInput.value = product.comparePrice ? String(product.comparePrice) : "";
  refs.stockInput.value = String(product.stock);
  refs.imageUrlInput.value = product.image.startsWith("data:image") ? "" : product.image;
  refs.descriptionInput.value = product.description;
  refs.featuredInput.checked = product.featured;
  refs.formTitle.textContent = "Бараа засах";
  refs.submitBtn.textContent = "Өөрчлөлт хадгалах";
  refs.cancelEditBtn.classList.remove("hidden");
  updatePreview();
  document.getElementById("admin").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  state.editingId = null;
  state.uploadedImage = "";
  state.currentImage = "";
  refs.productForm.reset();
  refs.formTitle.textContent = "Шинэ бараа нэмэх";
  refs.submitBtn.textContent = "Бараа хадгалах";
  refs.cancelEditBtn.classList.add("hidden");
  refs.imageFileInput.value = "";
  updatePreview();
}

function toggleCart(open) {
  refs.cartDrawer.classList.toggle("open", open);
  refs.cartDrawer.setAttribute("aria-hidden", open ? "false" : "true");
}

function handleCheckout() {
  if (!state.cart.length) {
    showToast("Эхлээд сагсандаа бараа нэмнэ үү.");
    return;
  }

  showToast("Энэ prototype дээр checkout demo хэлбэртэй байна. Дараа нь payment холбож болно.");
}

function restoreDemoData() {
  state.products = seedProducts();
  state.cart = [];
  persistProducts();
  persistCart();
  resetForm();
  render();
  showToast("Demo бүтээгдэхүүнүүд сэргээгдлээ.");
}

function exportProducts() {
  const payload = {
    exportedAt: new Date().toISOString(),
    products: state.products,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = "nomad-market-products.json";
  anchor.click();

  URL.revokeObjectURL(url);
  showToast("Барааны JSON файл export хийгдлээ.");
}

async function importProducts(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const items = Array.isArray(parsed) ? parsed : parsed.products;

    if (!Array.isArray(items)) {
      throw new Error("JSON format invalid");
    }

    state.products = items.map(normalizeImportedProduct);
    persistProducts();
    render();
    showToast("JSON import амжилттай боллоо.");
  } catch (error) {
    showToast("Import амжилтгүй. JSON файлаа шалгана уу.");
  } finally {
    event.target.value = "";
  }
}

function normalizeImportedProduct(product) {
  const name = product.name || "Шинэ бараа";
  const category = product.category || "Бусад";

  return {
    id: product.id || crypto.randomUUID(),
    name,
    category,
    price: Number(product.price || 0),
    comparePrice: Number(product.comparePrice || 0),
    stock: Number(product.stock || 0),
    description: product.description || "Тайлбар нэмээгүй байна.",
    featured: Boolean(product.featured),
    image: product.image || createPlaceholder(name, category),
    createdAt: product.createdAt || new Date().toISOString(),
  };
}

function getFilteredProducts() {
  return [...state.products]
    .filter((product) => {
      const matchesQuery = !state.filters.query
        || `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(state.filters.query);
      const matchesCategory = state.filters.category === "all" || product.category === state.filters.category;
      return matchesQuery && matchesCategory;
    })
    .sort(sortProducts);
}

function sortProducts(a, b) {
  switch (state.filters.sort) {
    case "price-asc":
      return a.price - b.price;
    case "price-desc":
      return b.price - a.price;
    case "stock-desc":
      return b.stock - a.stock;
    case "newest":
    default:
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  }
}

function getCategories() {
  return [...new Set(state.products.map((product) => product.category))].sort((a, b) => a.localeCompare(b, "mn"));
}

function getStockLabel(stock) {
  if (stock === 0) {
    return "Дууссан";
  }

  if (stock <= 5) {
    return "Цөөн үлдсэн";
  }

  return "Бэлэн";
}

function getStockClass(stock) {
  if (stock === 0) {
    return "stock-out";
  }

  if (stock <= 5) {
    return "stock-low";
  }

  return "stock-ok";
}

function updatePreview(image) {
  const src = image || state.uploadedImage || refs.imageUrlInput.value.trim() || state.currentImage;
  refs.imagePreview.innerHTML = src
    ? `<img src="${escapeHtml(src)}" alt="Product preview">`
    : "<span>Зураг preview энд харагдана.</span>";
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => refs.toast.classList.remove("show"), 2300);
}

function getCreatedAt(id) {
  if (!id) {
    return new Date().toISOString();
  }

  return state.products.find((product) => product.id === id)?.createdAt || new Date().toISOString();
}

function persistProducts() {
  localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(state.products));
}

function persistCart() {
  localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(state.cart));
}

function loadProducts() {
  const saved = localStorage.getItem(STORAGE_KEYS.products);
  if (!saved) {
    const seeded = seedProducts();
    localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      throw new Error("Invalid saved products");
    }

    return parsed.map(normalizeImportedProduct);
  } catch (error) {
    const seeded = seedProducts();
    localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(seeded));
    return seeded;
  }
}

function loadCart() {
  const saved = localStorage.getItem(STORAGE_KEYS.cart);
  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function seedProducts() {
  return [
    {
      id: crypto.randomUUID(),
      name: "Nomad Leather Bag",
      category: "Аксесуар",
      price: 185000,
      comparePrice: 220000,
      stock: 7,
      description: "Өдөр тутмын хэрэглээнд тохирсон арьсан цүнх. Хотын стильтэй, багтаамж сайтай.",
      featured: true,
      image: createPlaceholder("Leather Bag", "Аксесуар"),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      name: "Steppe Cotton Hoodie",
      category: "Хувцас",
      price: 129000,
      comparePrice: 149000,
      stock: 12,
      description: "Зөөлөн материалтай, өдөр бүр өмсөхөд эвтэйхэн hoodie.",
      featured: true,
      image: createPlaceholder("Cotton Hoodie", "Хувцас"),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      name: "Aurora Skin Set",
      category: "Гоо сайхан",
      price: 89000,
      comparePrice: 0,
      stock: 4,
      description: "Арьс арчилгааны 3 алхамтай set. Бэлэг болгоход тохиромжтой.",
      featured: false,
      image: createPlaceholder("Skin Set", "Гоо сайхан"),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      name: "Orbit Wireless Earbuds",
      category: "Технологи",
      price: 210000,
      comparePrice: 245000,
      stock: 0,
      description: "Өдөр тутмын ажил, аялалд тохирох утасгүй чихэвч.",
      featured: false,
      image: createPlaceholder("Wireless Earbuds", "Технологи"),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 42).toISOString(),
    },
  ];
}

function createPlaceholder(title, category) {
  const [from, to] = categoryPalette[category] || categoryPalette.default;
  const safeTitle = encodeXml(title);
  const safeCategory = encodeXml(category);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 700">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${from}" />
          <stop offset="100%" stop-color="${to}" />
        </linearGradient>
      </defs>
      <rect width="700" height="700" rx="44" fill="url(#g)" />
      <circle cx="560" cy="140" r="110" fill="rgba(255,255,255,0.14)" />
      <circle cx="140" cy="560" r="160" fill="rgba(255,255,255,0.08)" />
      <text x="54" y="540" fill="white" font-family="Georgia, serif" font-size="62" font-weight="700">${safeTitle}</text>
      <text x="58" y="608" fill="rgba(255,255,255,0.84)" font-family="Trebuchet MS, sans-serif" font-size="26">${safeCategory}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function encodeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatPrice(value) {
  return currency.format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
