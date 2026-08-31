// --- ⚙️ إعدادات الفايربيس ---
const firebaseConfig = { databaseURL: "https://proj-5252-default-rtdb.firebaseio.com" };
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// --- 👤 إدارة المستخدم المجهول (Hash) ---
let userHash = localStorage.getItem('userHash');
if (!userHash) {
    userHash = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('userHash', userHash);
}

// المتغيرات العالمية
let allDeals = [];
let userFavorites = new Set();
let userInterests = {};
let isShowingFavorites = false;
let currentStore = 'all';
let currentMainCategory = 'all';
let activeSubCategories = new Set();

let appCategories = [
    { name: 'الإلكترونيات', subsList: ['الكل', 'باور بانك', 'تلفزيونات', 'جوالات وملحقاته', 'راوترات ومقويات شبكة', 'كاميرات وعدسات', 'لابتوبات', 'لابتوبات قيمنق', 'ملحقات إلكترونية'] },
    { name: 'قيمنق', subsList: ['الكل', 'أجهزة الكونسول', 'ألعاب فيديو', 'كراسي وطاولات', 'ملحقات قيمنق'] },
    { name: 'قسم الرجال', subsList: ['الكل', 'عطور رجالية', 'ملابس وإكسسوارات'] },
    { name: 'قسم النساء', subsList: ['الكل', 'مجوهرات وساعات', 'ملابس وحقائب'] },
    { name: 'العناية والجمال', subsList: ['الكل', 'عطور نسائية'] },
    { name: 'قسم المكاتب', subsList: ['الكل', 'أثاث مكتببي', 'قرطاسية وأدوات'] },
    { name: 'قسم الأطفال', subsList: ['الكل', 'ألعاب أطفال'] }
];

// تهيئة النظام
window.onload = async () => {
    initTheme();
    updateThemeIcon();
    initPresence();
    
    // جلب مفضلة واهتمامات المستخدم أولاً
    await fetchUserData();
    
    // مراقبة حالة الصيانة بشكل حي
    database.ref('metadata/siteSettings/maintenanceMode').on('value', snap => {
        if(snap.val() === true) {
            document.getElementById('maintenanceOverlay').style.display = 'flex';
        } else {
            document.getElementById('maintenanceOverlay').style.display = 'none';
        }
    });
    
    // ثم جلب العروض
    await fetchAllData();
    
    // بناء المتاجر وعرض المنتجات
    renderHomeStores();
    renderHomeBrands();
    renderHomeDeals();
    
    // بدء خوارزمية الإشعارات
    startSmartNotifications();
};

// --- 🌐 نظام التواجد (Live Users) ---
function initPresence() {
    const amOnline = database.ref('.info/connected');
    const userRef = database.ref('presence/' + userHash);
    
    amOnline.on('value', function(snapshot) {
        if (snapshot.val()) {
            userRef.onDisconnect().remove();
            userRef.set(Date.now()); // Set timestamp instead of just true
            logVisit();
        }
    });

    database.ref('presence').on('value', function(snapshot) {
        const count = snapshot.numChildren();
        const el = document.getElementById('liveUsersCount');
        if (el) el.innerText = count;
    });
}

function logVisit() {
    const lastVisit = localStorage.getItem('last_visit_time');
    const now = Date.now();
    // Only log once per hour (3600000 ms) per device
    if (!lastVisit || now - parseInt(lastVisit) > 3600000) {
        database.ref('analytics/visits').push(now);
        localStorage.setItem('last_visit_time', now.toString());
    }
}

// --- 🎨 الثيم و التنقل ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

function toggleThemeBottom() {
    toggleTheme();
    updateThemeIcon();
}

function updateThemeIcon() {
    const current = document.documentElement.getAttribute('data-theme');
    const icon = document.getElementById('themeIcon');
    if (icon) {
        if (current === 'dark') {
            icon.className = 'fa-solid fa-sun';
        } else {
            icon.className = 'fa-solid fa-moon';
        }
    }
}

// التبديل بين الواجهات
function setActiveNav(navId) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    if (navId) {
        const el = document.getElementById(navId);
        if (el) el.classList.add('active');
    }
}

function backToHome() {
    setActiveNav('navHome');
    isShowingFavorites = false;
    document.getElementById('searchInput').value = '';
    document.getElementById('searchSuggestions').style.display = 'none';
    
    document.getElementById('productsView').style.display = 'none';
    document.getElementById('storeCategoriesView').style.display = 'none';
    document.getElementById('homeView').style.display = 'block';
    
    if (window.closeProductModal) window.closeProductModal();
}

function showStoreCategoriesView(storeName) {
    document.getElementById('storeCategoriesTitle').innerText = 'أقسام متجر ' + storeName;
    document.getElementById('homeView').style.display = 'none';
    document.getElementById('productsView').style.display = 'none';
    document.getElementById('storeCategoriesView').style.display = 'block';
}

function backToStoreCategories() {
    if (isShowingFavorites || currentMainCategory === 'all' || currentMainCategory === 'search') {
        backToHome();
        return;
    }
    document.getElementById('productsView').style.display = 'none';
    document.getElementById('storeCategoriesView').style.display = 'block';
}

function showProductsView(title) {
    document.getElementById('productsTitle').innerText = title;
    document.getElementById('homeView').style.display = 'none';
    document.getElementById('storeCategoriesView').style.display = 'none';
    document.getElementById('productsView').style.display = 'block';
}

function toggleFavoritesView() {
    setActiveNav('navFav');
    isShowingFavorites = true;
    document.getElementById('searchSuggestions').style.display = 'none';
    
    if (window.closeProductModal) window.closeProductModal();
    let favItems = allDeals.filter(d => userFavorites.has(d.id));
    showProductsView('❤️ مفضلتي');
    renderGrid(favItems);
    document.querySelector('.filter-btn').style.display = 'none';
    const inlineCats = document.getElementById('inlineSubCategories');
    if(inlineCats) inlineCats.style.display = 'none';
}

// --- 📦 جلب البيانات من Firebase ---
async function fetchUserData() {
    const favSnap = await database.ref('users/' + userHash + '/favorites').once('value');
    if (favSnap.exists()) {
        Object.keys(favSnap.val()).forEach(id => userFavorites.add(id));
    }
    
    const intSnap = await database.ref('users/' + userHash + '/interests').once('value');
    if (intSnap.exists()) {
        userInterests = intSnap.val();
    }
}

async function fetchAllData() {
    try {
        // Default metadata fallback
        window.appStoresMeta = {
            'noon': { label: 'noon', cssClass: 'noon-badge-logo' },
            'amazon': { label: 'AMAZON', cssClass: 'amazon-badge-logo' }
        };
        let storesList = ['noon', 'amazon'];
        
        // Fetch dynamic stores from metadata
        const metaSnap = await database.ref('metadata/stores').once('value');
        if (metaSnap.exists()) {
            const fetchedStores = metaSnap.val();
            for (let k in fetchedStores) {
                if (!window.appStoresMeta[k]) {
                    window.appStoresMeta[k] = fetchedStores[k];
                } else {
                    Object.assign(window.appStoresMeta[k], fetchedStores[k]);
                }
            }
        }
        
        // Build storesList excluding hidden ones
        storesList = Object.keys(window.appStoresMeta).filter(k => !window.appStoresMeta[k].isHidden);
        
        // Fetch brands
        window.appBrandsMeta = {};
        const brandsSnap = await database.ref('metadata/brands').once('value');
        if (brandsSnap.exists()) {
            window.appBrandsMeta = brandsSnap.val();
        }

        // Fetch deals
        window.appDealsMeta = {};
        const dealsSnap = await database.ref('metadata/deals').once('value');
        if (dealsSnap.exists()) {
            window.appDealsMeta = dealsSnap.val();
        }
        
        allDeals = [];

        for (let s of storesList) {
            const snap = await database.ref(s).once('value');
            const storeData = snap.val();

            if (storeData) {
                Object.keys(storeData).forEach(categoryKey => {
                    if (categoryKey === 'last_update' || categoryKey === 'All') return;
                    const subCategories = storeData[categoryKey];
                    if (typeof subCategories === 'object') {
                        Object.keys(subCategories).forEach(subKey => {
                            const products = subCategories[subKey];
                            if (typeof products === 'object') {
                                Object.keys(products).forEach(id => {
                                    let item = products[id];
                                    if (item && item.name && item.price_now && !item.isHidden) {
                                        item.store = s;
                                        item.id = id;
                                        item.main_category = categoryKey;
                                        item.sub_category = subKey;
                                        allDeals.push(item);
                                    }
                                });
                            }
                        });
                    }
                });
            }
        }

        // إزالة التكرار
        allDeals = Array.from(new Map(allDeals.map(item => [item.id || item.product_url, item])).values());
        
    } catch (e) {
        console.error(e);
    }
}

// --- 🖼️ بناء الكروت (Cards) ---
function createCardHTML(item) {
    const displayPriceNow = item.price_now.toString().replace('ر.س', '⃁');
    const displayPriceBefore = item.price_before ? item.price_before.toString().replace('ر.س', '⃁') : '';
    const isFav = userFavorites.has(item.id);
    const favClass = isFav ? 'active' : '';
    const favIcon = isFav ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
    const imgUrl = item.image_url || 'https://via.placeholder.com/150';
    
    let storeBadge = '';
    if (window.appStoresMeta && window.appStoresMeta[item.store]) {
        let meta = window.appStoresMeta[item.store];
        storeBadge = `<div class="${meta.cssClass || 'noon-badge-logo'}">${meta.label || item.store}</div>`;
    } else {
        storeBadge = item.store === 'amazon' 
            ? '<div class="amazon-badge-logo">AMAZON</div>' 
            : '<div class="noon-badge-logo">noon</div>';
    }
        
    return `
        <div class="card classic-card" onclick='openProductModal(${JSON.stringify(item).replace(/'/g, "&#39;")})'>
            <button class="fav-btn ${favClass}" onclick="toggleFavorite(event, '${item.id}')" id="fav-btn-${item.id}">
                ${favIcon}
            </button>
            <div class="store-badge">${storeBadge}</div>
            
            <div class="card-image-container">
                <img src="${imgUrl}" alt="صورة المنتج" loading="lazy">
            </div>
            
            <div class="product-info">
                <div class="product-title">${item.name}</div>
                <div class="price-container">
                    <span class="price-now">${displayPriceNow}</span>
                    ${displayPriceBefore && displayPriceBefore !== "0" && displayPriceBefore !== "0.0" ? `
                        <div style="display:flex; align-items:center; gap:5px;">
                            <span class="price-old">${displayPriceBefore}</span>
                            <span class="discount-badge" style="margin:0; padding:1px 4px; font-size:9px;">${item.disc_percent}%</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function renderHomeStores() {
    const grid = document.getElementById('homeStoresGrid');
    if (!grid) return;
    
    let html = `
        <div class="box-card-small classic-card" onclick="filterByStore('all')">
            <div class="box-icon" style="color: #666;"><i class="fa-solid fa-globe"></i></div>
            <h3 class="box-name">الكل</h3>
        </div>
    `;
    
    Object.keys(window.appStoresMeta).forEach(storeId => {
        if (storeId === 'all') return; // Skip 'all' since it's hardcoded and only holds metadata
        
        const meta = window.appStoresMeta[storeId];
        if (meta.isHidden) return;
        
        let iconHtml = '';
        let color = '#FF9900'; // Default color
        const safeLabel = meta.label || storeId;
        
        if (storeId === 'amazon') {
            iconHtml = '<i class="fa-brands fa-amazon" style="font-size: 32px; color: #FF9900;"></i>';
            color = '#FF9900';
        } else if (storeId === 'noon') {
            iconHtml = '<div style="background:#FEE000; border-radius:50%; width:40px; height:40px; display:flex; align-items:center; justify-content:center; color:#000; font-weight:900; font-size:14px;">noon</div>';
            color = '#FEE000';
        } else {
            // Generic icon for custom stores
            color = '#007bff';
            iconHtml = `<div style="background:var(--card-bg); border: 2px solid ${color}; border-radius:50%; width:40px; height:40px; display:flex; align-items:center; justify-content:center; color:var(--text-color); font-weight:bold; font-size:18px;">${safeLabel.charAt(0)}</div>`;
        }
        
        html += `
            <div class="box-card-small classic-card" onclick="filterByStore('${storeId}')" style="--cat-color: ${color};">
                <div class="box-icon">${iconHtml}</div>
                <h3 class="box-name" style="${storeId==='amazon' ? 'margin-top:10px;' : ''}">${safeLabel}</h3>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

function renderHomeBrands() {
    const grid = document.getElementById('homeBrandsGrid');
    const section = document.getElementById('brandsSection');
    if (!grid || !section) return;
    
    const brandKeys = Object.keys(window.appBrandsMeta || {});
    if(brandKeys.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    let html = '';
    
    brandKeys.forEach(brandId => {
        const meta = window.appBrandsMeta[brandId];
        html += `
            <div class="box-card-small classic-card" onclick="filterByBrand('${brandId}')">
                <div class="box-icon" style="height: 40px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                    <img src="${meta.icon}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="${meta.label}">
                </div>
                <h3 class="box-name">${meta.label}</h3>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

function renderHomeDeals() {
    const grid = document.getElementById('homeDealsGrid');
    const section = document.getElementById('dealsSection');
    if (!grid || !section) return;
    
    const dealKeys = Object.keys(window.appDealsMeta || {});
    if(dealKeys.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    let html = '';
    const colors = ['#F44336', '#FFC107', '#4CAF50', '#2196F3', '#9C27B0'];
    
    dealKeys.forEach((dealId, index) => {
        const meta = window.appDealsMeta[dealId];
        if (meta.isHidden) return; // Skip hidden deals
        
        const color = colors[index % colors.length];
        html += `
            <div class="box-card-small classic-card" onclick="filterByDealType('${dealId}')" style="--cat-color: ${color};">
                <div class="box-icon" style="color: ${color};"><i class="fa-solid fa-gift"></i></div>
                <h3 class="box-name">${meta.label || dealId}</h3>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

function renderGrid(items) {
    const container = document.getElementById('cardsContainer');
    
    if (items.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px;">لا يوجد نتائج لعرضها حالياً.</div>`;
        return;
    }
    
    container.innerHTML = items.map(item => createCardHTML(item)).join('');
}

// --- الفلترة حسب المتاجر وأنواع العروض (Stores & Deal Types) ---

function snapMergeUnique(arr1, arr2) {
    let result = [...arr1];
    arr2.forEach(cat2 => {
        if (!result.find(cat1 => cat1.name === cat2.name)) {
            result.push(cat2);
        }
    });
    return result;
}

async function filterByStore(storeId) {
    isShowingFavorites = false;
    currentStore = storeId;
    document.getElementById('searchSuggestions').style.display = 'none';
    
    let storeName = "جميع المتاجر";
    if (storeId === 'amazon') storeName = "أمازون";
    else if (storeId === 'noon') storeName = "نون";
    else storeName = storeId; // Fallback
    
    let globalCats = [...defaultGlobalCategories];
    const globalSnap = await database.ref('metadata/stores/all/categories').once('value');
    if (globalSnap.exists() && globalSnap.val().length > 0) {
        globalCats = snapMergeUnique(globalCats, globalSnap.val());
    }

    if (storeId === 'all') {
        appCategories = globalCats;
    } else {
        const snap = await database.ref('metadata/stores/' + storeId + '/categories').once('value');
        if (snap.exists() && snap.val().length > 0) {
            appCategories = snapMergeUnique(globalCats, snap.val());
        } else {
            appCategories = globalCats;
        }
    }
    
    renderStoreCategories(appCategories);
    showStoreCategoriesView(storeName);
}

function filterByCategory(category) {
    isShowingFavorites = false;
    currentMainCategory = category;
    activeSubCategories.clear();
    document.getElementById('searchSuggestions').style.display = 'none';
    
    let filtered = allDeals.filter(d => d.main_category === category || (d.name && d.name.includes(category)));
    if (currentStore !== 'all') {
        filtered = filtered.filter(d => d.store === currentStore);
    }
    
    if(filtered.length === 0) {
        filtered = allDeals.filter(d => d.main_category && d.main_category.includes(category.split(' ')[0]));
        if (currentStore !== 'all') {
            filtered = filtered.filter(d => d.store === currentStore);
        }
    }
    
    let storeName = currentStore === 'amazon' ? 'أمازون' : (currentStore === 'noon' ? 'نون' : '');
    showProductsView('🏷️ ' + category);
    renderInlineSubCategories();
    renderGrid(filtered);
}

function toggleSubCategory(subCategory) {
    if (subCategory === 'الكل') {
        activeSubCategories.clear();
    } else {
        if (activeSubCategories.has(subCategory)) {
            activeSubCategories.delete(subCategory);
        } else {
            activeSubCategories.add(subCategory);
        }
    }
    
    // Re-render the inline chips to update selection classes
    renderInlineSubCategories();
    
    // Filter deals
    let filtered = allDeals.filter(d => d.main_category === currentMainCategory || (d.name && d.name.includes(currentMainCategory)));
    if (currentStore !== 'all') {
        filtered = filtered.filter(d => d.store === currentStore);
    }
    
    if (activeSubCategories.size > 0) {
        filtered = filtered.filter(d => {
            for (let sub of activeSubCategories) {
                if ((d.sub_category && d.sub_category === sub) || (d.name && d.name.includes(sub))) {
                    return true;
                }
            }
            return false;
        });
    }
    
    renderGrid(filtered);
}

function renderInlineSubCategories() {
    const container = document.getElementById('inlineSubCategories');
    const catData = appCategories.find(c => c.name === currentMainCategory);
    
    if (catData && catData.subsList && catData.subsList.length > 0) {
        container.style.display = 'flex';
        container.innerHTML = '';
        
        catData.subsList.forEach(sub => {
            const chip = document.createElement('div');
            
            // Check active state
            if (sub === 'الكل' && activeSubCategories.size === 0) {
                chip.className = 'sub-category-chip selected';
            } else if (activeSubCategories.has(sub)) {
                chip.className = 'sub-category-chip selected';
            } else {
                chip.className = 'sub-category-chip';
            }
            
            chip.innerText = sub;
            chip.onclick = () => toggleSubCategory(sub);
            container.appendChild(chip);
        });
    } else {
        container.style.display = 'none';
        container.innerHTML = '';
    }
}

function filterByBrand(brand) {
    isShowingFavorites = false;
    currentStore = 'all';
    currentMainCategory = 'all';
    document.getElementById('searchSuggestions').style.display = 'none';
    
    // Some basic mapping since brand strings might differ slightly
    const brandMap = {
        'ابل': 'apple',
        'سامسونج': 'samsung',
        'سوني': 'sony',
        'نايك': 'nike',
        'اديداس': 'adidas'
    };
    
    let enBrand = brandMap[brand] || brand;
    let filtered = allDeals.filter(d => (d.name && d.name.toLowerCase().includes(enBrand.toLowerCase())) || (d.name && d.name.includes(brand)));
    
    showProductsView('🏷️ ماركة ' + brand);
    renderInlineSubCategories();
    renderStoreCategories(categories);
}

// Global default categories backup
let defaultGlobalCategories = [
    { name: 'الإلكترونيات', subsList: ['الكل', 'باور بانك', 'تلفزيونات', 'جوالات وملحقاته', 'راوترات ومقويات شبكة', 'كاميرات وعدسات', 'لابتوبات', 'لابتوبات قيمنق', 'ملحقات إلكترونية'] },
    { name: 'قيمنق', subsList: ['الكل', 'أجهزة الكونسول', 'ألعاب فيديو', 'كراسي وطاولات', 'ملحقات قيمنق'] },
    { name: 'قسم الرجال', subsList: ['الكل', 'عطور رجالية', 'ملابس وإكسسوارات'] },
    { name: 'قسم النساء', subsList: ['الكل', 'مجوهرات وساعات', 'ملابس وحقائب'] },
    { name: 'العناية والجمال', subsList: ['الكل', 'عطور نسائية'] },
    { name: 'قسم المكاتب', subsList: ['الكل', 'أثاث مكتببي', 'قرطاسية وأدوات'] },
    { name: 'قسم الأطفال', subsList: ['الكل', 'ألعاب أطفال'] }
];


function renderStoreCategories(categories) {
    const grid = document.getElementById('storeCategoriesGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Some basic colors/icons mapping for default categories to look pretty
    const catStyles = {
        'الإلكترونيات': { color: '#2196F3', icon: 'fa-mobile-screen' },
        'قيمنق': { color: '#9C27B0', icon: 'fa-gamepad' },
        'قسم الرجال': { color: '#795548', icon: 'fa-shirt' },
        'قسم النساء': { color: '#E91E63', icon: 'fa-person-dress' },
        'العناية والجمال': { color: '#FF5252', icon: 'fa-wand-magic-sparkles' },
        'قسم المكاتب': { color: '#009688', icon: 'fa-book' },
        'قسم الأطفال': { color: '#03A9F4', icon: 'fa-child-reaching' }
    };
    
    const fallbackColors = ['#ff9f43', '#00d2d3', '#5f27cd', '#ff6b6b', '#10ac84'];
    
    categories.forEach((cat, index) => {
        let style = catStyles[cat.name];
        if (!style) {
            style = { color: fallbackColors[index % fallbackColors.length], icon: 'fa-tags' };
        }
        
        let iconHtml = `<div class="box-icon" style="color: ${style.color};"><i class="fa-solid ${style.icon}"></i></div>`;
        
        grid.innerHTML += `
            <div class="box-card-small classic-card" onclick="filterByCategory('${cat.name}')" style="--cat-color: ${style.color};">
                ${iconHtml}
                <h3 class="box-name" style="margin-top:10px;">${cat.name}</h3>
            </div>
        `;
    });
}

function filterByDealType(type) {
    isShowingFavorites = false;
    currentStore = 'all';
    currentMainCategory = 'all';
    let filtered = [];
    let title = "";
    document.getElementById('searchSuggestions').style.display = 'none'; // إخفاء الاقتراحات
    
    if (type === '50plus') {
        filtered = allDeals.filter(d => parseInt(d.disc_percent) >= 50);
        title = "🔥 صيدات 50%+";
    } 
    else if (type === 'best') {
        const topInterest = Object.keys(userInterests).sort((a, b) => userInterests[b] - userInterests[a])[0];
        if (topInterest) {
            let userFavDeals = allDeals.filter(d => d.main_category === topInterest).sort(() => 0.5 - Math.random()).slice(0, 10);
            let otherDeals = allDeals.sort(() => 0.5 - Math.random()).slice(0, 10);
            filtered = [...userFavDeals, ...otherDeals];
        } else {
            filtered = allDeals.sort(() => 0.5 - Math.random()).slice(0, 20);
        }
        title = "✨ أفضل العروض لك";
    } 
    else if (type === 'seasonal') {
        const seasonalKeywords = ['صيف', 'شتاء', 'جمعة', 'أصفر', 'أسود', 'عيد', 'رمضان'];
        filtered = allDeals.filter(d => seasonalKeywords.some(kw => (d.name || '').includes(kw)));
        if(filtered.length === 0) filtered = allDeals.slice(0, 10); // Fallback
        title = "❄️ العروض الموسمية";
    }
    
    showProductsView(title);
    renderInlineSubCategories();
    renderGrid(filtered);
}

function filterByBrand(brandId) {
    isShowingFavorites = false;
    currentStore = 'all';
    currentMainCategory = 'all';
    document.getElementById('searchSuggestions').style.display = 'none';
    
    const brandMeta = window.appBrandsMeta[brandId];
    if(!brandMeta) return;
    
    let filtered = allDeals.filter(d => {
        if (d.brand === brandId || d.brand === brandMeta.label) return true;
        if (d.name && d.name.toLowerCase().includes(brandMeta.label.toLowerCase())) return true;
        if (d.title && d.title.toLowerCase().includes(brandMeta.label.toLowerCase())) return true;
        return false;
    });
    let title = "منتجات ماركة: " + brandMeta.label;
    
    showProductsView(title);
    renderInlineSubCategories();
    renderGrid(filtered);
}

// --- ❤️ نظام المفضلة ---
function toggleFavorite(event, productId) {
    event.stopPropagation();
    const btn = event.currentTarget;
    
    if (userFavorites.has(productId)) {
        userFavorites.delete(productId);
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
        database.ref('users/' + userHash + '/favorites/' + productId).remove();
    } else {
        userFavorites.add(productId);
        btn.classList.add('active');
        btn.innerHTML = '<i class="fa-solid fa-heart"></i>';
        database.ref('users/' + userHash + '/favorites/' + productId).set(true);
    }
}



// --- 🧠 تتبع الاهتمامات والإشعارات الذكية ---
function trackInterest(category) {
    if(!category) return;
    userInterests[category] = (userInterests[category] || 0) + 1;
    database.ref('users/' + userHash + '/interests').set(userInterests);
}

function startSmartNotifications() {
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "default") {
        Notification.requestPermission();
    }

    // تشغيل كل ساعتين
    setInterval(() => {
        if (Notification.permission !== "granted") return;
        
        const topInterest = Object.keys(userInterests).sort((a, b) => userInterests[b] - userInterests[a])[0];
        if (!topInterest) return;

        const deals = allDeals.filter(d => d.main_category === topInterest && parseInt(d.disc_percent) >= 30);
        if (deals.length > 0) {
            const bestDeal = deals[Math.floor(Math.random() * deals.length)];
            new Notification("🔥 صيدة جديدة تهمك!", {
                body: `خصم ${bestDeal.disc_percent}% على ${bestDeal.name}`,
                icon: 'favicon.ico'
            });
        }
    }, 2 * 60 * 60 * 1000); 
}

// --- 🔍 البحث الذكي (Autocomplete) ---
function handleSmartSearch() {
    const input = document.getElementById('searchInput').value.trim().toLowerCase();
    const suggestionsBox = document.getElementById('searchSuggestions');
    
    if (input.length < 2) {
        suggestionsBox.style.display = 'none';
        return;
    }

    const matches = allDeals.filter(d => (d.name && d.name.toLowerCase().includes(input)));
    
    if (matches.length > 0) {
        suggestionsBox.innerHTML = matches.slice(0, 5).map(m => {
            let imgUrl = m.image_url;
            if(!imgUrl || imgUrl === 'null' || imgUrl === 'undefined') imgUrl = 'https://via.placeholder.com/150';
            
            return `
                <div class="suggestion-box" onclick="executeSearch('${m.id}')">
                    <img src="${imgUrl}" alt="صورة المنتج" class="sug-img">
                    <div class="sug-info">
                        <div class="sug-title">${m.name}</div>
                        <div class="sug-price">${m.price_now} ريال</div>
                    </div>
                    <i class="fa-solid fa-arrow-left" style="color:var(--text-gray); font-size:14px; margin-right:10px;"></i>
                </div>
            `;
        }).join('');
        suggestionsBox.style.display = 'flex'; // vertical list dropdown
    } else {
        suggestionsBox.style.display = 'none';
    }
}

function submitSearch(event) {
    event.preventDefault();
    const input = document.getElementById('searchInput').value.trim().toLowerCase();
    const suggestionsBox = document.getElementById('searchSuggestions');
    
    suggestionsBox.style.display = 'none';
    if (input.length < 2) return;
    
    const matches = allDeals.filter(d => (d.name && d.name.toLowerCase().includes(input)));
    
    isShowingFavorites = false;
    currentMainCategory = 'search';
    currentStore = 'all';
    showProductsView('نتائج البحث عن: ' + input);
    renderInlineSubCategories(); // يمسح فلاتر الفروع
    renderGrid(matches);
    
    // إخفاء الكيبورد في الجوال بعد البحث
    document.getElementById('searchInput').blur();
}

function executeSearch(productId) {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchSuggestions').style.display = 'none';
    
    const item = allDeals.find(d => d.id === productId);
    if(item) {
        openProductModal(item);
    }
}

// --- ⏲️ Timer Logic ---
function startTimer() {
    let timerElement = document.getElementById('timerValue');
    if (!timerElement) return;
    
    // Set for 5 hours, 20 mins, 0 secs
    let timeInSecs = 5 * 3600 + 20 * 60; 
    
    setInterval(() => {
        if (timeInSecs <= 0) timeInSecs = 5 * 3600; 
        let h = Math.floor(timeInSecs / 3600);
        let m = Math.floor((timeInSecs % 3600) / 60);
        let s = timeInSecs % 60;
        
        timerElement.innerText = 
            (h < 10 ? "0"+h : h) + ":" + 
            (m < 10 ? "0"+m : m) + ":" + 
            (s < 10 ? "0"+s : s);
            
        timeInSecs--;
    }, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
    startTimer();
    
    // Close modal if clicked outside
    document.getElementById('productModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeProductModal();
        }
    });
});

// --- 📦 Product Details Modal ---
let currentModalProduct = null;

window.openProductModal = function(item) {
    trackInterest(item.main_category);
    currentModalProduct = item;
    
    const modal = document.getElementById('productModal');
    let img = item.image_url || item.image || '';
    let name = item.name || item.title || 'منتج';
    let brand = item.brand || 'ماركة عامة';
    let priceStr = (item.price_now || item.price || "0").toString();
    let oldPriceStr = (item.price_before || item.old_price || "0").toString();
    
    let displayPriceNow = priceStr.replace('ر.س', '⃁');
    let displayPriceBefore = oldPriceStr.replace('ر.س', '⃁');
    
    let descRaw = item.description || item.desc || 'لا يوجد وصف متاح لهذا المنتج حالياً.';
    
    document.getElementById('modalImg').src = img || 'https://via.placeholder.com/300';
    document.getElementById('modalName').innerText = name;
    document.getElementById('modalBrand').innerText = brand;
    document.getElementById('modalDesc').innerText = descRaw;
    document.getElementById('modalPrice').innerText = displayPriceNow;
    
    if (displayPriceBefore && displayPriceBefore !== "0" && displayPriceBefore !== "0.0" && displayPriceBefore !== "⃁0") {
        document.getElementById('modalOldPrice').innerText = displayPriceBefore;
    } else {
        document.getElementById('modalOldPrice').innerText = '';
    }
    
    updateModalFavBtn();
    modal.classList.add('active');
};

window.closeProductModal = function() {
    document.getElementById('productModal').classList.remove('active');
    currentModalProduct = null;
};

window.openModalUrl = function() {
    if (currentModalProduct) {
        let url = currentModalProduct.link || currentModalProduct.url || currentModalProduct.product_url;
        if (url) window.open(url, '_blank');
    }
};

window.toggleModalFavorite = function() {
    if (!currentModalProduct) return;
    const id = currentModalProduct.id;
    if (userFavorites.has(id)) {
        userFavorites.delete(id);
        database.ref('users/' + userHash + '/favorites/' + id).remove();
    } else {
        userFavorites.add(id);
        database.ref('users/' + userHash + '/favorites/' + id).set(true);
    }
    updateModalFavBtn();
    
    let gridBtn = document.getElementById('fav-btn-' + id);
    if (gridBtn) {
        if (userFavorites.has(id)) {
            gridBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
            gridBtn.classList.add('active');
        } else {
            gridBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
            gridBtn.classList.remove('active');
        }
    }
};

function updateModalFavBtn() {
    const btn = document.getElementById('modalFavBtn');
    if (currentModalProduct && userFavorites.has(currentModalProduct.id)) {
        btn.innerHTML = '<i class="fa-solid fa-heart" style="color:#e74c3c;"></i>';
    } else {
        btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
    }
}

// --- 🚪 Secret Admin Door ---
let adminClickCount = 0;
let adminClickTimer = null;
window.secretAdminDoor = function() {
    adminClickCount++;
    if (adminClickTimer) clearTimeout(adminClickTimer);
    
    // Reset click count after 2 seconds
    adminClickTimer = setTimeout(() => { adminClickCount = 0; }, 2000);
    
    if (adminClickCount >= 5) {
        adminClickCount = 0;
        window.location.href = 'admin.html';
    }
};

// --- 💬 Support Messages ---
window.openSupportModal = function() {
    document.getElementById('supportText').value = '';
    document.getElementById('supportModal').classList.add('active');
};
window.closeSupportModal = function() {
    document.getElementById('supportModal').classList.remove('active');
};
window.submitSupportMessage = async function() {
    const type = document.getElementById('supportType').value;
    const text = document.getElementById('supportText').value.trim();
    if(!text) { alert('الرجاء كتابة نص الرسالة أولاً!'); return; }
    
    const msgData = {
        type: type,
        text: text,
        userHash: userHash,
        timestamp: Date.now()
    };
    
    await database.ref('messages').push(msgData);
    alert('تم إرسال رسالتك بنجاح. شكراً لتواصلك معنا!');
    closeSupportModal();
};