// =============================================================
// ==      وحدة المتجر (store.js) - محدثة لاستخدام ناقل الأحداث
// =============================================================

import * as ui from './ui.js';
import * as player from './player.js';
import * as progression from './progression.js';
// ▼▼▼ تم استيراد ناقل الأحداث ▼▼▼
import { dispatch } from './eventBus.js';

let storeItemsCache = [];
let specialOffersCache = [];
let processedItems = { all: [], pages: [], ranges: [], qari: [], consumable: [], exchange: [] };

/**
 * معالجة بيانات المتجر الأولية وتصنيفها.
 */
export function processStoreData(items, offers) {
    storeItemsCache = items || [];
    specialOffersCache = offers || [];
    processedItems = { all: [], pages: [], ranges: [], qari: [], consumable: [], exchange: [] };
    
    storeItemsCache.forEach(item => {
        if (item && item.type) {
            const isOffer = specialOffersCache.some(offer => offer.store_item_id === item.id);
            const isRecommended = item.is_recommended;
            const processedItem = { ...item, isOffer, isRecommended };
            
            processedItems.all.push(processedItem);
            
            if (processedItems[item.type]) {
                processedItems[item.type].push(processedItem);
            }
        }
    });
}

/**
 * عرض عناصر المتجر في واجهة المستخدم بناءً على الفلتر المحدد.
 */
export function renderStoreTabs(filter = 'all') {
    const container = document.getElementById('store-container');
    if (!container) return;

    let itemsToRender = [];
    if (filter === 'consumable') {
        itemsToRender = [...(processedItems.consumable || []), ...(processedItems.exchange || [])];
    } else {
        itemsToRender = processedItems[filter] || [];
    }

    container.innerHTML = '';

    if (itemsToRender.length === 0) {
        container.innerHTML = '<p>لا توجد عناصر لعرضها في هذا القسم.</p>';
        return;
    }

    itemsToRender.forEach(item => {
        const isOwned = checkIfOwned(item, player.playerData.inventory);
        const buttonText = isOwned ? 'تم الشراء' : 'تفاصيل';

        const itemDiv = document.createElement('div');
        itemDiv.className = `store-item ${isOwned ? 'owned-item' : ''}`;
        
        itemDiv.innerHTML = `
            ${item.isOffer ? '<div class="special-offer-badge">عرض خاص</div>' : ''}
            ${item.isRecommended ? '<div class="recommended-badge">⭐</div>' : ''}
            <div class="item-icon">${item.icon || '🎁'}</div>
            <h4>${item.name}</h4>
            <p class="item-price">${item.price} ${item.type === 'exchange' ? 'XP' : '💎'}</p>
            <button class="details-button" data-item-id="${item.id}" ${isOwned ? 'disabled' : ''}>${buttonText}</button>
        `;
        
        container.appendChild(itemDiv);
    });
}

/**
 * يتم استدعاؤها من main.js لإظهار تفاصيل العنصر.
 */
export function handleDetailsClick(itemId) {
    const itemToShow = storeItemsCache.find(i => String(i.id) === String(itemId));
    if (itemToShow) {
        ui.showModal(true, itemToShow, player.playerData);
    } else {
        console.error(`لم يتم العثور على عنصر بالمعرف: ${itemId}`);
    }
}

/**
 * التحقق مما إذا كان اللاعب يمتلك عنصرًا معينًا.
 */
function checkIfOwned(item, inventory) {
    if (!inventory) return false;
    if (item.type === 'consumable' || item.type === 'exchange') return false;
    
    if (item.type === 'pages' || item.type === 'qari' || item.type === 'themes') {
        return inventory.includes(item.id);
    }
    if (item.type === 'ranges' || item.type === 'juz') {
        const [start, end] = item.value.split('-').map(Number);
        for (let i = start; i <= end; i++) {
            if (!inventory.includes(`page_${i}`)) return false;
        }
        return true;
    }
    return false;
}

/**
 * التحقق مما إذا كان اللاعب يستطيع شراء عنصر معين.
 */
function checkIfCanAfford(item, playerData) {
    if (item.type === 'exchange') {
        return playerData.xp >= item.price;
    }
    return playerData.diamonds >= item.price;
}

/**
 * تنفيذ عملية شراء العنصر.
 */
export async function purchaseItem(itemId) {
    const item = storeItemsCache.find(i => String(i.id) === String(itemId));
    if (!item) return;

    if (!checkIfCanAfford(item, player.playerData)) {
        return ui.showToast("رصيدك غير كافٍ لإتمام هذه العملية.", "error");
    }

    // ▼▼▼ تم تبسيط هذا القسم وإصلاحه ▼▼▼
    switch (item.type) {
        case 'exchange':
            player.playerData.xp -= item.price;
            player.playerData.diamonds += parseInt(item.value, 10);
            break;
        
        case 'consumable':
            player.playerData.diamonds -= item.price;
            if (item.id === 'energy_stars_pack') { 
                player.playerData.energy_stars = (player.playerData.energy_stars || 0) + parseInt(item.value, 10);
            }
            break;
            
        case 'ranges':
        case 'juz':
            player.playerData.diamonds -= item.price;
            const [start, end] = item.value.split('-').map(Number);
            for (let i = start; i <= end; i++) {
                const pageId = `page_${i}`;
                if (!player.playerData.inventory.includes(pageId)) {
                    player.playerData.inventory.push(pageId);
                }
            }
            break;
            
        case 'pages':
        case 'qari':
        case 'themes':
            player.playerData.diamonds -= item.price;
            if (!player.playerData.inventory.includes(item.id)) {
                player.playerData.inventory.push(item.id);
            }
            break;
            
        default:
            console.error(`نوع العنصر غير معروف: ${item.type}`);
            return ui.showToast("حدث خطأ غير متوقع.", "error");
    }
    // ▲▲▲ نهاية القسم المبسط ▲▲▲

    ui.showToast(`تمت عملية "${item.name}" بنجاح!`, "info");
    
    // ▼▼▼ تم استبدال الاستدعاءات المباشرة بناقل الأحداث ▼▼▼
    dispatch('item_purchased', { itemId: item.id, itemType: item.type });
    // ▲▲▲ نهاية التعديل ▲▲▲

    await player.savePlayer();
    
    const levelInfo = progression.getLevelInfo(player.playerData.xp);
    ui.updatePlayerHeader(player.playerData, levelInfo);
    if (item.type === 'qari') {
        ui.populateQariSelect(ui.qariSelect, player.playerData.inventory);
    }
    
    const currentFilter = document.querySelector('.filter-button.active')?.dataset.filter || 'all';
    renderStoreTabs(currentFilter);
    ui.showModal(false);
}
