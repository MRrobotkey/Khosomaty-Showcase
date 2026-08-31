// admin.js
const firebaseConfig = {
    databaseURL: "https://proj-5252-default-rtdb.firebaseio.com"
};
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

let allStoresMeta = {};
let allBrandsMeta = {};
let allCategories = {};
let allProducts = [];
let allMessages = [];
let totalUsers = 0;
let currentMaintenanceMode = false;

// Simple Auth
function checkPassword() {
    const pw = document.getElementById('adminPassword').value;
    if (pw === 'Ba55330') { 
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('dashboardWrapper').style.display = 'flex';
        initDashboard();
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
}

function logout() {
    location.reload();
}

// Navigation
function switchTab(tabId) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');
    
    document.getElementById('tab-' + tabId).classList.add('active');
    document.getElementById('view-' + tabId).style.display = 'block';
}

// Initialization
async function initDashboard() {
    await seedDefaults();
    
    listenToLiveUsers();
    listenToMaintenanceMode();
    try { await fetchStats(); } catch(e) { console.error('fetchStats error:', e); }
    try { await fetchStores(); } catch(e) { console.error('fetchStores error:', e); }
    try { await fetchBrands(); } catch(e) { console.error('fetchBrands error:', e); }
    try { await fetchDeals(); } catch(e) { console.error('fetchDeals error:', e); }
    try { fetchCategories(); } catch(e) { console.error('fetchCategories error:', e); }
    try { await fetchProducts(); } catch(e) { console.error('fetchProducts error:', e); }
    try { await fetchMessages(); } catch(e) { console.error('fetchMessages error:', e); }
}

function listenToLiveUsers() {
    database.ref('presence').on('value', snap => {
        let count = snap.exists() ? Object.keys(snap.val()).length : 0;
        document.getElementById('adminLiveUsers').innerText = count;
    });
}

function listenToMaintenanceMode() {
    database.ref('metadata/siteSettings/maintenanceMode').on('value', snap => {
        currentMaintenanceMode = snap.val() === true;
        document.getElementById('maintenanceToggle').checked = currentMaintenanceMode;
    });
}

function toggleMaintenanceMode() {
    const isChecked = document.getElementById('maintenanceToggle').checked;
    if (confirm(isChecked ? 'هل أنت متأكد من إغلاق الموقع وإدخاله في وضع الصيانة للزوار؟' : 'هل تريد إعادة فتح الموقع للزوار؟')) {
        database.ref('metadata/siteSettings/maintenanceMode').set(isChecked);
    } else {
        document.getElementById('maintenanceToggle').checked = !isChecked; // Revert
    }
}

let allVisits = [];

async function fetchStats() {
    try {
        const usersSnap = await database.ref('users').once('value');
        if (usersSnap.exists()) {
            totalUsers = Object.keys(usersSnap.val()).length;
            document.getElementById('totalUsersCount').innerText = totalUsers;
        }
    } catch(e) { console.error(e); }
    
    try {
        // Fetch Visitor Analytics
        const visitsSnap = await database.ref('analytics/visits').once('value');
        if (visitsSnap.exists()) {
            allVisits = Object.values(visitsSnap.val());
        } else {
            allVisits = [];
        }
        updateAnalyticsStats();
    } catch(e) { 
        console.error("Analytics fetch error:", e);
        allVisits = [];
    }
}

function updateAnalyticsStats() {
    const filter = document.getElementById('analyticsFilter');
    if (!filter) return;
    
    const now = Date.now();
    let count = 0;
    
    if (filter.value === 'all') {
        count = allVisits.length;
    } else {
        let timeframe = 0;
        if (filter.value === '24h') timeframe = 24 * 60 * 60 * 1000;
        else if (filter.value === '7d') timeframe = 7 * 24 * 60 * 60 * 1000;
        else if (filter.value === '30d') timeframe = 30 * 24 * 60 * 60 * 1000;
        
        count = allVisits.filter(t => (now - t) <= timeframe).length;
    }
    
    const countEl = document.getElementById('analyticsVisitorsCount');
    if (countEl) countEl.innerText = count;
}

// --- STORES LOGIC ---
async function fetchStores() {
    allStoresMeta = {
        'noon': { label: 'noon', cssClass: 'noon-badge-logo' },
        'amazon': { label: 'AMAZON', cssClass: 'amazon-badge-logo' }
    };
    const metaSnap = await database.ref('metadata/stores').once('value');
    if (metaSnap.exists()) {
        const remoteMeta = metaSnap.val();
        for (let storeId in remoteMeta) {
            if (!allStoresMeta[storeId]) {
                allStoresMeta[storeId] = remoteMeta[storeId];
            } else {
                Object.assign(allStoresMeta[storeId], remoteMeta[storeId]);
            }
        }
    }
    
    document.getElementById('totalStoresCount').innerText = Object.keys(allStoresMeta).length;
    renderStoresTable();
    populateStoreSelect();
    populateCategoryStoreSelect();
}

function renderStoresTable() {
    const tbody = document.getElementById('storesTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const searchEl = document.getElementById('searchStore');
    const query = searchEl ? (searchEl.value || '').toLowerCase() : '';
    
    Object.keys(allStoresMeta).forEach(storeId => {
        const meta = allStoresMeta[storeId];
        
        if (query && !storeId.includes(query) && !(meta.label && meta.label.toLowerCase().includes(query))) return;
        
        const isHidden = meta.isHidden ? true : false;
        const eyeIcon = isHidden ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
        const eyeColor = isHidden ? '#888' : '#28a745';
        const statusText = isHidden ? '<span style="color:#ff4444;">مخفي</span>' : '<span style="color:#28a745;">ظاهر</span>';
        
        tbody.innerHTML += `
            <tr style="${isHidden ? 'opacity:0.5;' : ''}">
                <td>${storeId}</td>
                <td>${meta.label}</td>
                <td><span class="${meta.cssClass || 'noon-badge-logo'}" style="display:inline-block;">${meta.label}</span></td>
                <td>${statusText}</td>
                <td>
                    <button class="action-btn" style="color:${eyeColor};" onclick="toggleStoreVisibility('${storeId}', ${isHidden})" title="إخفاء/إظهار">${eyeIcon}</button>
                    <button class="action-btn delete-btn" onclick="deleteStore('${storeId}')" title="حذف المتجر"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function filterStoresTable() {
    renderStoresTable();
}

async function toggleStoreVisibility(storeId, currentStatus) {
    await database.ref('metadata/stores/' + storeId + '/isHidden').set(!currentStatus);
    await fetchStores(); // Refresh
}

function populateStoreSelect() {
    const selects = [document.getElementById('prodStoreInput'), document.getElementById('filterProductStore')];
    selects[1].innerHTML = '<option value="all">كل المتاجر</option>';
    
    Object.keys(allStoresMeta).forEach(storeId => {
        const lbl = allStoresMeta[storeId].label;
        selects[0].innerHTML += `<option value="${storeId}">${lbl} (${storeId})</option>`;
        selects[1].innerHTML += `<option value="${storeId}">${lbl} (${storeId})</option>`;
    });
}

// --- BRANDS LOGIC ---
async function fetchBrands() {
    const metaSnap = await database.ref('metadata/brands').once('value');
    if (metaSnap.exists()) {
        allBrandsMeta = metaSnap.val();
    } else {
        allBrandsMeta = {};
    }
    renderBrandsTable();
    populateBrandSelect();
}

function renderBrandsTable() {
    const tbody = document.getElementById('brandsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const searchEl = document.getElementById('searchBrand');
    const query = searchEl ? (searchEl.value || '').toLowerCase() : '';
    
    Object.keys(allBrandsMeta).forEach(brandId => {
        const meta = allBrandsMeta[brandId];
        
        if (query && !brandId.includes(query) && !(meta.label && meta.label.toLowerCase().includes(query))) return;
        
        tbody.innerHTML += `
            <tr>
                <td>${brandId}</td>
                <td>${meta.label}</td>
                <td><img src="${meta.icon}" style="width:30px;height:30px;object-fit:contain;"></td>
                <td>
                    <button class="action-btn delete-btn" onclick="deleteBrand('${brandId}')" title="حذف המاركة"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function filterBrandsTable() {
    renderBrandsTable();
}

function populateBrandSelect() {
    const select = document.getElementById('prodBrandInput');
    if(!select) return;
    select.innerHTML = '<option value="">بدون ماركة</option>';
    Object.keys(allBrandsMeta).forEach(brandId => {
        select.innerHTML += `<option value="${brandId}">${allBrandsMeta[brandId].label}</option>`;
    });
}

function openAddBrandModal() {
    document.getElementById('brandModalTitle').innerText = 'إضافة ماركة جديدة';
    document.getElementById('brandEditId').value = '';
    document.getElementById('brandIdInput').value = '';
    document.getElementById('brandIdInput').disabled = false;
    document.getElementById('brandLabelInput').value = '';
    document.getElementById('brandIconInput').value = '';
    document.getElementById('brandModal').classList.add('active');
}

async function saveBrand() {
    const id = document.getElementById('brandIdInput').value.trim();
    const label = document.getElementById('brandLabelInput').value.trim();
    const icon = document.getElementById('brandIconInput').value.trim();
    
    if (!id || !label) {
        alert('الرجاء إدخال المعرف واسم الماركة');
        return;
    }
    
    await database.ref('metadata/brands/' + id).set({
        label: label,
        icon: icon
    });
    
    closeModals();
    await fetchBrands();
}

async function deleteBrand(id) {
    if (confirm('هل أنت متأكد من حذف هذه الماركة؟')) {
        await database.ref('metadata/brands/' + id).remove();
        await fetchBrands();
    }
}

function populateCategoryStoreSelect() {
    const select = document.getElementById('catStoreSelect');
    select.innerHTML = '<option value="" disabled selected>اختر المتجر...</option>';
    select.innerHTML += '<option value="all">كل المتاجر (عام)</option>';
    Object.keys(allStoresMeta).forEach(storeId => {
        select.innerHTML += `<option value="${storeId}">${allStoresMeta[storeId].label}</option>`;
    });
}

// --- CATEGORIES LOGIC ---
async function loadStoreCategories() {
    const storeId = document.getElementById('catStoreSelect').value;
    if(!storeId) return;
    
    document.getElementById('categoriesManager').style.display = 'block';
    
    const snap = await database.ref('metadata/stores/' + storeId + '/categories').once('value');
    let categories = [];
    if(snap.exists()) {
        categories = snap.val();
    } else {
        categories = []; // Empty start
    }
    
    const tbody = document.getElementById('categoriesTableBody');
    tbody.innerHTML = '';
    
    categories.forEach((cat, index) => {
        tbody.innerHTML += `
            <tr>
                <td style="font-weight:bold;">${cat.name}</td>
                <td style="color:var(--text-muted); font-size:12px;">${cat.subsList.join(' ، ')}</td>
                <td>
                    <button class="action-btn delete-btn" onclick="deleteCategory('${storeId}', ${index})"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    
    if(categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">لا توجد تصنيفات مخصصة لهذا المتجر. سيتم استخدام التصنيفات الافتراضية.</td></tr>';
    }
}

async function deleteCategory(storeId, index) {
    if(!confirm('هل أنت متأكد من حذف هذا التصنيف الرئيسي بكل أقسامه الفرعية؟')) return;
    const snap = await database.ref('metadata/stores/' + storeId + '/categories').once('value');
    if(snap.exists()) {
        let cats = snap.val();
        cats.splice(index, 1);
        await database.ref('metadata/stores/' + storeId + '/categories').set(cats);
        loadStoreCategories();
    }
}

function openAddCategoryModal() {
    const storeId = document.getElementById('catStoreSelect').value;
    if(!storeId) { alert('اختر المتجر أولاً!'); return; }
    
    // Quick prompt for now instead of full modal to save time
    const name = prompt('ادخل اسم القسم الرئيسي (مثال: الإلكترونيات):');
    if(!name) return;
    
    const subs = prompt('ادخل الأقسام الفرعية مفصولة بفاصلة (مثال: جوالات,شاشات,لابتوب):');
    if(!subs) return;
    
    let subsList = ['الكل'].concat(subs.split(',').map(s => s.trim()));
    
    database.ref('metadata/stores/' + storeId + '/categories').once('value').then(snap => {
        let cats = snap.exists() ? snap.val() : [];
        cats.push({ name: name, subsList: subsList });
        database.ref('metadata/stores/' + storeId + '/categories').set(cats).then(() => {
            loadStoreCategories();
        });
    });
}

// --- PRODUCTS LOGIC ---
async function fetchProducts() {
    allProducts = [];
    for (let storeId of Object.keys(allStoresMeta)) {
        const snap = await database.ref(storeId).once('value');
        const storeData = snap.val();
        if (storeData) {
            Object.keys(storeData).forEach(catKey => {
                if (catKey === 'last_update' || catKey === 'All') return;
                const subCats = storeData[catKey];
                if (typeof subCats === 'object') {
                    Object.keys(subCats).forEach(subKey => {
                        const prods = subCats[subKey];
                        if (typeof prods === 'object') {
                            Object.keys(prods).forEach(id => {
                                let item = prods[id];
                                if (item && (item.name || item.title)) {
                                    item.id = id;
                                    item.store = storeId;
                                    item.main_category = catKey;
                                    item.sub_category = subKey;
                                    allProducts.push(item);
                                }
                            });
                        }
                    });
                }
            });
        }
    }
    
    document.getElementById('totalProductsCount').innerText = allProducts.length;
    renderProductsTable();
}

function renderProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const storeFilter = document.getElementById('filterProductStore').value;
    const searchEl = document.getElementById('searchProduct');
    const query = searchEl ? (searchEl.value || '').toLowerCase() : '';
    
    let displayProducts = [...allProducts].reverse();
    
    if (storeFilter !== 'all') displayProducts = displayProducts.filter(p => p.store === storeFilter);
    if (query) displayProducts = displayProducts.filter(p => (p.name || p.title || '').toLowerCase().includes(query));
    
    displayProducts = displayProducts.slice(0, 150); // Performance limit
    
    displayProducts.forEach(p => {
        let name = p.name || p.title || 'بدون اسم';
        let price = p.price_now || p.price || 0;
        let img = p.image_url || p.image || 'https://via.placeholder.com/40';
        
        const isHidden = p.isHidden ? true : false;
        const eyeIcon = isHidden ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
        const eyeColor = isHidden ? '#888' : '#28a745';
        const statusText = isHidden ? '<span style="color:#ff4444;">مخفي</span>' : '<span style="color:#28a745;">ظاهر</span>';
        
        tbody.innerHTML += `
            <tr style="${isHidden ? 'opacity:0.5;' : ''}">
                <td><img src="${img}" alt="صورة"></td>
                <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${name}">${name}</td>
                <td>${price}</td>
                <td>${p.store}</td>
                <td>${p.main_category} / ${p.sub_category}</td>
                <td>${statusText}</td>
                <td>
                    <button class="action-btn" style="color:${eyeColor};" onclick="toggleProductVisibility('${p.store}', '${p.main_category}', '${p.sub_category}', '${p.id}', ${isHidden})" title="إخفاء/إظهار">${eyeIcon}</button>
                    <button class="action-btn edit-btn" onclick='editProduct(${JSON.stringify(p).replace(/'/g, "&#39;")})'><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="action-btn delete-btn" onclick="deleteProduct('${p.store}', '${p.main_category}', '${p.sub_category}', '${p.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function filterProductsTable() {
    renderProductsTable();
}

async function toggleProductVisibility(store, mainCat, subCat, id, currentStatus) {
    await database.ref(`${store}/${mainCat}/${subCat}/${id}/isHidden`).set(!currentStatus);
    await fetchProducts(); // Refresh
}

// --- MESSAGES LOGIC ---
async function fetchMessages() {
    database.ref('messages').on('value', snap => {
        allMessages = [];
        if (snap.exists()) {
            const data = snap.val();
            Object.keys(data).forEach(k => {
                let m = data[k];
                m.id = k;
                allMessages.push(m);
            });
        }
        allMessages.sort((a,b) => b.timestamp - a.timestamp);
        
        // Update badge
        const badge = document.getElementById('msgCountBadge');
        if(allMessages.length > 0) {
            badge.style.display = 'inline-block';
            badge.innerText = allMessages.length;
        } else {
            badge.style.display = 'none';
        }
        
        renderMessagesTable();
    });
}

function renderMessagesTable() {
    const tbody = document.getElementById('messagesTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const filter = document.getElementById('msgFilter').value;
    const searchEl = document.getElementById('searchMessage');
    const query = searchEl ? (searchEl.value || '').toLowerCase() : '';
    let displayMsgs = allMessages;
    
    if (filter !== 'all') {
        displayMsgs = displayMsgs.filter(m => m.type === filter);
    }
    if (query) {
        displayMsgs = displayMsgs.filter(m => m.text && m.text.toLowerCase().includes(query));
    }
    
    displayMsgs.forEach(m => {
        let date = new Date(m.timestamp).toLocaleDateString('ar-SA') + ' ' + new Date(m.timestamp).toLocaleTimeString('ar-SA');
        let typeBadge = m.type === 'شكوى' ? '<span style="background:#ff4444; color:white; padding:2px 8px; border-radius:10px; font-size:12px;">شكوى</span>' : '<span style="background:#ffc107; color:black; padding:2px 8px; border-radius:10px; font-size:12px;">اقتراح</span>';
        
        tbody.innerHTML += `
            <tr>
                <td style="font-size:12px; color:var(--text-muted);">${date}</td>
                <td>${typeBadge}</td>
                <td style="max-width: 300px; white-space: normal;">${m.text}</td>
                <td>
                    <button class="action-btn delete-btn" onclick="deleteMessage('${m.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function filterMessages() {
    renderMessagesTable();
}

async function deleteMessage(id) {
    if(confirm('هل أنت متأكد من حذف هذه الرسالة؟')) {
        await database.ref('messages/' + id).remove();
    }
}


// --- STORE / PRODUCT MODALS ---
function closeModals() {
    document.querySelectorAll('.admin-modal').forEach(m => m.style.display = 'none');
}

function openAddStoreModal() {
    document.getElementById('storeIdInput').value = '';
    document.getElementById('storeLabelInput').value = '';
    document.getElementById('storeClassInput').value = '';
    document.getElementById('storeModal').style.display = 'flex';
}

async function saveStore() {
    const id = document.getElementById('storeIdInput').value.trim().toLowerCase();
    const label = document.getElementById('storeLabelInput').value.trim();
    const cssClass = document.getElementById('storeClassInput').value.trim();
    
    if(!id || !label) { alert('الرجاء إدخال المعرف والاسم!'); return; }
    
    await database.ref('metadata/stores/' + id).set({
        label: label,
        cssClass: cssClass || 'noon-badge-logo',
        isHidden: false
    });
    
    closeModals();
    await fetchStores();
}

async function deleteStore(id) {
    if(confirm(`هل أنت متأكد من حذف المتجر ${id} نهائياً؟`)) {
        await database.ref('metadata/stores/' + id).remove();
        await fetchStores();
    }
}

function openAddProductModal() {
    document.getElementById('productModalTitle').innerText = 'إضافة منتج جديد';
    document.getElementById('prodEditId').value = '';
    document.getElementById('prodEditStore').value = '';
    
    document.getElementById('prodMainCatInput').value = '';
    document.getElementById('prodSubCatInput').value = '';
    document.getElementById('prodNameInput').value = '';
    document.getElementById('prodBrandInput').value = '';
    document.getElementById('prodPriceNowInput').value = '';
    document.getElementById('prodPriceBeforeInput').value = '';
    document.getElementById('prodDiscInput').value = '';
    document.getElementById('prodImgInput').value = '';
    document.getElementById('prodLinkInput').value = '';
    document.getElementById('prodDescInput').value = '';
    document.getElementById('prodDealInput').value = '';
    
    document.getElementById('productModal').style.display = 'flex';
}

function editProduct(p) {
    document.getElementById('productModalTitle').innerText = 'تعديل منتج';
    
    document.getElementById('prodEditId').value = p.id;
    document.getElementById('prodEditStore').value = p.store; 
    
    document.getElementById('prodStoreInput').value = p.store;
    document.getElementById('prodMainCatInput').value = p.main_category;
    document.getElementById('prodSubCatInput').value = p.sub_category;
    
    document.getElementById('prodNameInput').value = p.name || p.title || '';
    document.getElementById('prodBrandInput').value = p.brand || '';
    
    let priceNow = (p.price_now || p.price || "").toString().replace(/[^0-9.]/g, '');
    let priceBefore = (p.price_before || p.old_price || "").toString().replace(/[^0-9.]/g, '');
    
    document.getElementById('prodPriceNowInput').value = priceNow;
    document.getElementById('prodPriceBeforeInput').value = priceBefore;
    document.getElementById('prodDiscInput').value = p.disc_percent || '';
    
    document.getElementById('prodImgInput').value = p.image_url || p.image || '';
    document.getElementById('prodLinkInput').value = p.link || p.url || p.product_url || '';
    document.getElementById('prodDescInput').value = p.description || p.desc || '';
    document.getElementById('prodDealInput').value = p.dealType || '';
    
    document.getElementById('productModal').style.display = 'flex';
}

async function saveProduct() {
    const editId = document.getElementById('prodEditId').value;
    
    const store = document.getElementById('prodStoreInput').value;
    const mainCat = document.getElementById('prodMainCatInput').value.trim();
    const subCat = document.getElementById('prodSubCatInput').value.trim();
    
    if(!store || !mainCat || !subCat) { alert('الرجاء تحديد المتجر والقسم الرئيسي والفرعي!'); return; }
    
    const name = document.getElementById('prodNameInput').value.trim();
    const brand = document.getElementById('prodBrandInput').value.trim();
    const priceNow = document.getElementById('prodPriceNowInput').value;
    const priceBefore = document.getElementById('prodPriceBeforeInput').value;
    const disc = document.getElementById('prodDiscInput').value;
    const img = document.getElementById('prodImgInput').value.trim();
    const link = document.getElementById('prodLinkInput').value.trim();
    const desc = document.getElementById('prodDescInput').value.trim();
    const deal = document.getElementById('prodDealInput').value;
    
    if(!name || !priceNow) { alert('الرجاء كتابة اسم المنتج والسعر!'); return; }
    
    const productId = editId || 'deal_' + Date.now();
    
    const productData = {
        name: name,
        brand: brand,
        dealType: deal,
        price_now: priceNow + ' ر.س',
        price_before: priceBefore ? (priceBefore + ' ر.س') : '',
        disc_percent: disc,
        image_url: img,
        link: link,
        description: desc,
        timestamp: Date.now(),
        isHidden: false
    };
    
    await database.ref(`${store}/${mainCat}/${subCat}/${productId}`).update(productData);
    
    closeModals();
    await fetchProducts();
}

async function deleteProduct(store, mainCat, subCat, id) {
    if(confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
        await database.ref(`${store}/${mainCat}/${subCat}/${id}`).remove();
        await fetchProducts();
    }
}

// --- DEALS LOGIC ---
let allDealsMeta = {};

async function fetchDeals() {
    try {
        const snap = await database.ref('metadata/deals').once('value');
        if (snap.exists()) {
            allDealsMeta = snap.val();
        } else {
            allDealsMeta = {};
        }
        renderDealsTable();
        populateDealSelect();
    } catch(e) {
        console.error('fetchDeals error:', e);
    }
}

function renderDealsTable() {
    const tbody = document.getElementById('dealsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const searchEl = document.getElementById('searchDeal');
    const query = searchEl ? (searchEl.value || '').toLowerCase() : '';
    
    Object.keys(allDealsMeta).forEach(dealId => {
        const meta = allDealsMeta[dealId];
        if (query && !dealId.toLowerCase().includes(query) && !(meta.label && meta.label.toLowerCase().includes(query)) && !(meta.keywords && meta.keywords.toLowerCase().includes(query))) return;
        
        tbody.innerHTML += `
            <tr>
                <td>${dealId}</td>
                <td>${meta.label || ''} ${meta.isHidden ? '<span style="color:var(--text-danger);font-size:12px;">(مخفي)</span>' : ''}</td>
                <td>${meta.keywords || ''}</td>
                <td>
                    <button class="action-btn" onclick="openAddDealModal('${dealId}')" title="تعديل"><i class="fa-solid fa-edit"></i></button>
                    <button class="action-btn delete-btn" onclick="deleteDeal('${dealId}')" title="حذف"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function filterDealsTable() {
    renderDealsTable();
}

function populateDealSelect() {
    const select = document.getElementById('prodDealInput');
    if(!select) return;
    select.innerHTML = '<option value="">بدون عرض</option>';
    Object.keys(allDealsMeta).forEach(dealId => {
        const lbl = allDealsMeta[dealId].label || dealId;
        select.innerHTML += `<option value="${dealId}">${lbl}</option>`;
    });
}

function openAddDealModal(editId = '') {
    document.getElementById('addDealModal').style.display = 'flex';
    if (editId && allDealsMeta[editId]) {
        document.getElementById('dealOldIdInput').value = editId;
        document.getElementById('dealIdInput').value = editId;
        document.getElementById('dealLabelInput').value = allDealsMeta[editId].label || '';
        document.getElementById('dealKeywordsInput').value = allDealsMeta[editId].keywords || '';
        document.getElementById('dealIsHiddenInput').checked = allDealsMeta[editId].isHidden || false;
    } else {
        document.getElementById('dealOldIdInput').value = '';
        document.getElementById('dealIdInput').value = '';
        document.getElementById('dealLabelInput').value = '';
        document.getElementById('dealKeywordsInput').value = '';
        document.getElementById('dealIsHiddenInput').checked = false;
    }
}

async function saveDeal() {
    const oldId = document.getElementById('dealOldIdInput').value;
    const id = document.getElementById('dealIdInput').value.trim();
    const label = document.getElementById('dealLabelInput').value.trim();
    const keywords = document.getElementById('dealKeywordsInput').value.trim();
    const isHidden = document.getElementById('dealIsHiddenInput').checked;
    
    if(!id || !label) { alert('يجب إدخال المعرف واسم العرض!'); return; }
    
    const dealData = { label, keywords, isHidden };
    
    if (oldId && oldId !== id) {
        await database.ref('metadata/deals/' + oldId).remove();
    }
    await database.ref('metadata/deals/' + id).set(dealData);
    
    closeModals();
    await fetchDeals();
}

async function deleteDeal(id) {
    if(confirm('هل أنت متأكد من حذف هذا العرض؟')) {
        await database.ref('metadata/deals/' + id).remove();
        await fetchDeals();
    }
}

// --- SEED DEFAULTS ---
async function seedDefaults() {
    try {
        // Seed Deals
        const dealsSnap = await database.ref('metadata/deals').once('value');
        if (!dealsSnap.exists() || Object.keys(dealsSnap.val() || {}).length === 0) {
            console.log('Seeding default deals...');
            await database.ref('metadata/deals').set({
                '50plus': { label: 'خصم 50%+', keywords: 'خصم 50' },
                'best': { label: 'الأكثر مبيعاً', keywords: 'مبيعا,أفضل' },
                'seasonal': { label: 'عروض الموسم', keywords: 'موسم,شتاء,صيف' }
            });
        }
        
        // Seed Global Categories
        const catSnap = await database.ref('metadata/stores/all/categories').once('value');
        if (!catSnap.exists() || (catSnap.val() || []).length === 0) {
            console.log('Seeding default global categories...');
            const defaultCats = [
                { name: 'الإلكترونيات', subsList: ['الكل', 'باور بانك', 'تلفزيونات', 'جوالات وملحقاته', 'راوترات ومقويات شبكة', 'كاميرات وعدسات', 'لابتوبات', 'لابتوبات قيمنق', 'ملحقات إلكترونية'] },
                { name: 'قيمنق', subsList: ['الكل', 'أجهزة الكونسول', 'ألعاب فيديو', 'كراسي وطاولات', 'ملحقات قيمنق'] },
                { name: 'قسم الرجال', subsList: ['الكل', 'عطور رجالية', 'ملابس وإكسسوارات'] },
                { name: 'قسم النساء', subsList: ['الكل', 'مجوهرات وساعات', 'ملابس وحقائب'] },
                { name: 'العناية والجمال', subsList: ['الكل', 'عطور نسائية'] },
                { name: 'قسم المكاتب', subsList: ['الكل', 'أثاث مكتبي', 'قرطاسية وأدوات'] },
                { name: 'قسم الأطفال', subsList: ['الكل', 'ألعاب أطفال'] }
            ];
            await database.ref('metadata/stores/all/categories').set(defaultCats);
        }

        // Seed Brands
        const brandsSnap = await database.ref('metadata/brands').once('value');
        if (!brandsSnap.exists() || Object.keys(brandsSnap.val() || {}).length === 0) {
            console.log('Seeding default brands...');
            const defaultBrands = {
                'apple': { label: 'أبل', icon: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg' },
                'samsung': { label: 'سامسونج', icon: 'samsung_logo.svg' },
                'sony': { label: 'سوني', icon: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Sony_logo.svg' },
                'nike': { label: 'نايك', icon: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg' },
                'adidas': { label: 'أديداس', icon: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg' }
            };
            await database.ref('metadata/brands').set(defaultBrands);
        }
    } catch(e) {
        console.error('seed error:', e);
    }
}
