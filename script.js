// [1] 현재 영업 상태를 판별하는 함수
function getStatus(shop) {
    const now = new Date();
    const day = now.getDay(); 
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const todayName = dayNames[day];
    const isWeekend = (day === 0 || day === 6);

    if (shop["휴무 요일"].includes(todayName)) {
        return { label: "정기 휴무", canEat: false, class: "closed" };
    }

    const prefix = isWeekend ? "주말 타임 " : "평일 타임 ";
    const timeRanges = [shop[prefix + "1"], shop[prefix + "2"], shop[prefix + "3"]].filter(t => t && t !== "");

    if (timeRanges.length === 0) {
        return { label: "운영 안 함", canEat: false, class: "closed" };
    }

    const currentTimeNum = now.getHours() * 100 + now.getMinutes();

    for (let range of timeRanges) {
        const [start, end] = range.split('~');
        const startNum = parseInt(start.replace(':', ''));
        const endNum = parseInt(end.replace(':', ''));

        if (currentTimeNum >= startNum && currentTimeNum <= endNum) {
            return { label: "영업 중", canEat: true, class: "open" };
        }
    }
    return { label: "준비 중", canEat: false, class: "break" };
}

// [2] 태그 다중 선택 및 팝업 제어
let selectedTags = ["전체"]; 

function openTagModal() {
    renderTagList(); 
    document.getElementById('tag-modal').style.display = 'flex';
}

function closeTagModal() {
    document.getElementById('tag-modal').style.display = 'none';
}

function renderTagList() {
    const container = document.getElementById('tag-list-container');
    if (!container) return;

    let tags = [];
    restaurants.forEach(shop => {
        if (shop["태그"]) {
            const splitTags = shop["태그"].split(',').map(t => t.trim());
            tags.push(...splitTags);
        }
    });

    const uniqueTags = ["전체", ...new Set(tags)].filter(tag => tag !== "").sort((a, b) => {
        if (a === "전체") return -1;
        if (b === "전체") return 1;
        return a.localeCompare(b, 'ko'); 
    });

    container.innerHTML = uniqueTags.map(tag => {
        const isSelected = selectedTags.includes(tag);
        return `
            <div class="tag-item-btn ${isSelected ? 'selected' : ''}" 
                 onclick="toggleTag('${tag}')">
                ${tag === "전체" ? tag : '#' + tag}
            </div>
        `;
    }).join('');
}

function toggleTag(tag) {
    if (tag === "전체") {
        selectedTags = ["전체"];
    } else {
        selectedTags = selectedTags.filter(t => t !== "전체");
        if (selectedTags.includes(tag)) {
            selectedTags = selectedTags.filter(t => t !== tag);
            if (selectedTags.length === 0) selectedTags = ["전체"];
        } else {
            selectedTags.push(tag);
        }
    }
    renderTagList(); 
}

function applyMultiFilters() {
    const label = document.getElementById('current-tag-label');
    if (selectedTags.includes("전체")) {
        label.innerText = "전체";
    } else {
        label.innerText = selectedTags.length > 1 
            ? `${selectedTags[0]} 외 ${selectedTags.length - 1}개` 
            : selectedTags[0];
    }
    closeTagModal();
    renderList();
}

// [3] 식당 리스트 출력 함수
function renderList() {
    const listContainer = document.getElementById('restaurant-list');
    listContainer.innerHTML = '';

    const filteredData = restaurants.filter(shop => {
        if (selectedTags.includes("전체")) return true;
        const shopTags = shop["태그"].split(',').map(t => t.trim());
        return selectedTags.some(selected => shopTags.includes(selected));
    });

    const sortedData = filteredData.sort((a, b) => getStatus(b).canEat - getStatus(a).canEat);

    if (sortedData.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; padding:50px; color:#999;">해당하는 식당이 없습니다. 😭</p>';
        return;
    }

    sortedData.forEach(shop => {
        const status = getStatus(shop);
        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => openModal(shop);

        card.innerHTML = `
            <div class="card-header">
                <span class="status-badge ${status.class}">${status.label}</span>
                <span class="tags">${shop["태그"] || ''}</span>
            </div>
            <h2>${shop["식당명"]}</h2>
            <div class="time-info">
                <p>📍 오늘 운영: ${getCurrentDayTimes(shop)}</p>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

// [4] 상세 정보 모달 (날짜 자동 생성 버튼 포함)
function openModal(shop) {
    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');
    const status = getStatus(shop);
    const isWeekend = ([0, 6].includes(new Date().getDay()));
    
    // 📅 오늘 날짜를 YYYY-MM-DD 형식으로 생성
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${date}`;

    // 🔗 식단표 링크 생성
    let menuLinkHtml = '';
    if (shop["식단가기"]) {
        const fullLink = `${shop["식단가기"]}&stt_dt=${todayStr}`;
        menuLinkHtml = `
            <a href="${fullLink}" target="_blank" style="text-decoration: none;">
                <div style="background: #ff6b6b; color: white; padding: 15px; border-radius: 12px; margin-bottom: 20px; text-align: center; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 4px 10px rgba(255,107,107,0.3);">
                    📅 오늘(${todayStr}) 메뉴 확인 
                    <span style="font-size: 1.2rem;">↗️</span>
                </div>
            </a>
        `;
    }

    // 🍴 메뉴 섹션 생성 (식단가기 링크가 없을 때만 메뉴를 보여줌)
    let menuSectionHtml = '';
    if (!shop["식단가기"] && shop["메뉴"]) {
        const sections = shop["메뉴"].split('[').filter(s => s.trim() !== "");
        const menuHtml = sections.map(section => {
            const parts = section.split(']');
            const categoryName = parts[0].trim();
            const items = parts[1] ? parts[1].split(',').map(i => i.trim()) : [];
            return `
                <div class="menu-section" style="margin-bottom: 15px;">
                    <h4 style="margin: 0 0 8px 0; color: #ff6b6b; font-size: 0.9rem; border-bottom: 1px solid #eee; padding-bottom: 4px;">${categoryName}</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                        ${items.map(item => `<span style="background: #f1f3f5; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; color: #495057;">${item}</span>`).join('')}
                    </div>
                </div>
            `;
        }).join('');

        menuSectionHtml = `
            <div class="detail-item" style="margin-bottom: 25px;">
                <span class="detail-label" style="font-weight: bold; color: #333; margin-bottom: 10px; display: block; border-left: 4px solid #ff6b6b; padding-left: 8px;">🍴 고정 메뉴 구성</span>
                <div style="max-height: 250px; overflow-y: auto; padding: 10px; background: #fff; border: 1px solid #eee; border-radius: 12px;">
                    ${menuHtml}
                </div>
            </div>
        `;
    }

    body.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <div style="margin-bottom: 8px;">
                <span class="status-badge ${status.class}">${status.label}</span>
            </div>
            <h2 style="margin: 0; color: #333;">${shop["식당명"]}</h2>
            <div style="color: #888; font-size: 0.85rem; margin-top: 5px;">
                ${shop["태그"] ? shop["태그"].split(',').map(t => '#' + t.trim()).join(' ') : ''}
            </div>
        </div>

        ${menuLinkHtml}
        ${menuSectionHtml}

        <div style="background: #f8f9fa; padding: 15px; border-radius: 12px; display: grid; gap: 12px;">
            <div class="detail-item" style="margin: 0;">
                <span class="detail-label" style="font-size: 0.75rem; color: #888;">🕒 평일 운영시간</span>
                <div style="font-size: 0.95rem; ${!isWeekend ? 'color:#333; font-weight:bold;' : 'color:#999;'}">
                    ${[shop["평일 타임 1"], shop["평일 타임 2"], shop["평일 타임 3"]].filter(t => t).join(' / ') || '운영 안 함'}
                </div>
            </div>
            <div class="detail-item" style="margin: 0;">
                <span class="detail-label" style="font-size: 0.75rem; color: #888;">📅 주말 운영시간</span>
                <div style="font-size: 0.95rem; ${isWeekend ? 'color:#333; font-weight:bold;' : 'color:#999;'}">
                    ${[shop["주말 타임 1"], shop["주말 타임 2"], shop["주말 타임 3"]].filter(t => t).join(' / ') || '운영 안 함'}
                </div>
            </div>
            <div class="detail-item" style="margin: 0;">
                <span class="detail-label" style="font-size: 0.75rem; color: #888;">🚫 정기 휴무</span>
                <div style="font-size: 0.95rem; color: #e74c3c;">${shop["휴무 요일"] || '연중무휴'}</div>
            </div>
        </div>

        <button onclick="closeModal()" style="width:100%; padding:15px; margin-top:20px; border-radius:12px; border:none; background:#333; color:white; font-weight:bold; cursor:pointer;">닫기</button>
    `;
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

function getCurrentDayTimes(shop) {
    const day = new Date().getDay();
    const isWeekend = (day === 0 || day === 6);
    const prefix = isWeekend ? "주말 타임 " : "평일 타임 ";
    const times = [shop[prefix + "1"], shop[prefix + "2"], shop[prefix + "3"]].filter(t => t && t !== "");
    return times.length > 0 ? times.join(', ') : "운영 안 함";
}

window.onclick = (event) => {
    const modal = document.getElementById('modal');
    const tagModal = document.getElementById('tag-modal');
    if (event.target === modal) closeModal();
    if (event.target === tagModal) closeTagModal();
}

// [5] 초기 실행
renderList();
setInterval(renderList, 60000);