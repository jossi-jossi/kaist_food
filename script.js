// [1] 날짜 설정 (학기별로 한 번씩만 업데이트 하세요)
const CALENDAR = {
    // 방학 기간 설정 (시작일 ~ 종료일)
    vacation: [
        { start: '2025-12-22', end: '2026-02-28' }, // 겨울 방학
        { start: '2026-06-22', end: '2026-08-31' }  // 여름 방학
    ],
    // 공휴일 리스트 (YYYY-MM-DD)
    holidays: [
        '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-01', '2026-05-01', '2026-05-05', '2026-05-24', '2026-06-03', '2026-06-06', '2026-08-15', '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-03', '2026-10-09', '2026-12-25'
    ]
};

// [2] 현재 날짜가 어떤 시즌인지 판단하는 함수
function getSeason() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    // 1순위: 공휴일
    if (CALENDAR.holidays.includes(dateStr)) return "HOLIDAY";

    // 2순위: 방학
    const isVacation = CALENDAR.vacation.some(range => dateStr >= range.start && dateStr <= range.end);
    return isVacation ? "VACATION" : "SEMESTER";
}

// [3] 현재 영업 상태 판별 (방학/공휴일 반영)
function getStatus(shop) {
    const now = new Date();
    const day = now.getDay(); // 0:일, 1:월 ...
    const dayName = ['일', '월', '화', '수', '목', '금', '토'][day];
    const isWeekend = (day === 0 || day === 6);
    const season = getSeason();

    // A. 공휴일 체크
    if (season === "HOLIDAY" && shop["공휴일 영업"] === "N") {
        return { label: "공휴일 휴무", canEat: false, class: "closed" };
    }

    // B. 휴무 요일 체크 (시즌별 구분)
    const closedDays = season === "VACATION" ? shop["방학 휴무 요일"] : shop["학기 휴무 요일"];
    if (closedDays && closedDays.includes(dayName)) {
        return { label: "정기 휴무", canEat: false, class: "closed" };
    }

    // C. 운영 시간 결정 (방학 데이터가 없으면 학기 데이터 사용)
    let prefix = "";
    if (season === "VACATION") {
        prefix = isWeekend ? "방학 주말 타임 " : "방학 평일 타임 ";
        // 방학 데이터가 완전히 비어있으면 학기 데이터로 대체
        if (!shop[prefix + "1"] || shop[prefix + "1"] === "") {
            prefix = isWeekend ? "학기 주말 타임 " : "학기 평일 타임 ";
        }
    } else {
        prefix = isWeekend ? "학기 주말 타임 " : "학기 평일 타임 ";
    }

    const timeRanges = [shop[prefix + "1"], shop[prefix + "2"], shop[prefix + "3"]].filter(t => t && t !== "" && t !== "운영 안 함");

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

// 전역 변수로 태그 목록 관리
let allUniqueTags = [];

function openTagModal() {
    const searchInput = document.getElementById('tag-search-input');
    if (searchInput) searchInput.value = '';
    
    let rawTags = [];
    restaurants.forEach(shop => {
        if (shop["태그"]) {
            rawTags.push(...shop["태그"].split(',').map(t => t.trim()));
        }
    });

    // ✨ '전체'를 제외하고 고유 태그만 추출하여 가나다순 정렬
    allUniqueTags = [...new Set(rawTags)].filter(tag => tag !== "" && tag !== "전체").sort();

    renderTagList(allUniqueTags);
    document.getElementById('tag-modal').style.display = 'flex';
    history.pushState({ modal: 'tag' }, '');
}

// [4] 태그 닫기 함수 (기존 window.onpopstate와 연동되게 확인)
function closeTagModal() {
    const tm = document.getElementById('tag-modal');
    if (tm.style.display === 'flex') {
        tm.style.display = 'none';
        if (history.state && history.state.modal === 'tag') {
            history.back();
        }
    }
}

// [2] 태그 리스트 화면에 그리기
function renderTagList(tagsToShow) {
    const container = document.getElementById('tag-list-container');
    
    if (tagsToShow.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #bbb; padding: 20px;">검색 결과가 없습니다. 😅</p>`;
        return;
    }

    container.innerHTML = tagsToShow.map(tag => `
        <div class="tag-item-btn ${selectedTags.includes(tag) ? 'selected' : ''}" 
             onclick="toggleTag('${tag}')" 
             style="cursor: pointer;">
            ${tag === "전체" ? tag : '#' + tag}
        </div>
    `).join('');
}

// [3] 실시간 태그 검색 로직 (검색어에 따른 필터링된 목록 반환)
function filterTagsInModal() {
    const keyword = document.getElementById('tag-search-input').value.toLowerCase().trim();
    
    const filteredTags = allUniqueTags.filter(tag => 
        tag.toLowerCase().includes(keyword)
    );
    
    renderTagList(filteredTags);
}

function toggleTag(tag) {
    // 선택된 태그 목록에 있으면 제거, 없으면 추가
    if (selectedTags.includes(tag)) {
        selectedTags = selectedTags.filter(t => t !== tag);
    } else {
        // 만약 기존에 '전체'만 있었다면 비워주고 태그 추가
        if (selectedTags.includes("전체")) {
            selectedTags = [];
        }
        selectedTags.push(tag);
    }

    // ✨ 아무것도 선택되지 않았다면 다시 '전체' 상태로 복구
    if (selectedTags.length === 0) {
        selectedTags = ["전체"];
    }

    // 현재 검색어 상태 유지하며 리스트 갱신
    const keyword = document.getElementById('tag-search-input').value.toLowerCase().trim();
    const filteredTags = allUniqueTags.filter(t => t.toLowerCase().includes(keyword));
    
    renderTagList(filteredTags); 
}

function applyMultiFilters() {
    const label = document.getElementById('current-tag-label');
    if (selectedTags.includes("전체") || selectedTags.length === 0) {
        label.innerText = "전체";
        selectedTags = ["전체"];
    } else {
        label.innerText = selectedTags.length > 1 ? `${selectedTags[0]} 외 ${selectedTags.length - 1}` : selectedTags[0];
    }
    closeTagModal();
    renderList();
}

// [3] 식당 리스트 출력 함수 (위치 정렬 및 거리 표시 추가)
function renderList() {
    const listContainer = document.getElementById('restaurant-list');
    listContainer.innerHTML = '';

    // 1. 태그 필터링
    const filteredData = restaurants.filter(shop => {
        if (selectedTags.includes("전체")) return true;
        if (!shop["태그"]) return false;
        const shopTags = shop["태그"].split(',').map(t => t.trim());
        return selectedTags.some(selected => shopTags.includes(selected));
    });

    // renderList 함수 내 sort 부분 수정
    const sortedData = filteredData.sort((a, b) => {
        const statusA = getStatus(a).canEat;
        const statusB = getStatus(b).canEat;

        if (statusA !== statusB) {
            return statusB - statusA;
        }
        
        // 거리 정보가 둘 다 있을 때만 거리순 정렬
        if (a.distance !== undefined && b.distance !== undefined) {
            return a.distance - b.distance;
        }
        
        // 거리 정보가 한쪽만 있다면 정보가 있는 쪽을 위로
        if (a.distance !== undefined) return -1;
        if (b.distance !== undefined) return 1;

        return 0; // 둘 다 없으면 순서 유지
    });

    // 3. 데이터가 없을 때 처리
    if (sortedData.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; padding:50px; color:#999;">해당하는 식당이 없습니다. 😭</p>';
        return;
    }

    // 4. 카드 생성
    sortedData.forEach(shop => {
        const status = getStatus(shop);
        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => openModal(shop);

        // 거리 표시용 텍스트 생성 (1km 미만은 m로 표시하거나 소수점 처리)
        let distanceHtml = '';
        if (shop.distance !== undefined) {
            const dist = shop.distance;
            const displayDist = dist < 1 
                ? `${Math.round(dist * 1000)}m` 
                : `${dist.toFixed(1)}km`;
            distanceHtml = `<span style="font-size: 0.8rem; color: #ff6b6b; font-weight: bold; margin-left: 8px;">📍${displayDist}</span>`;
        }

        card.innerHTML = `
            <div class="card-header">
                <span class="status-badge ${status.class}">${status.label}</span>
                <span class="tags">${shop["태그"] || ''}</span>
            </div>
            <h2>${shop["식당명"]}${distanceHtml}</h2>
            <div class="time-info">
                <p>⏰ 오늘 운영: ${getCurrentDayTimes(shop)}</p>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

// [4] 상세 정보 모달 (학기/방학/공휴일 완벽 대응 버전)
function openModal(shop) {
    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');
    const status = getStatus(shop); // 시즌이 반영된 영업 상태
    const season = getSeason();     // 현재 시즌 (SEMESTER, VACATION, HOLIDAY)
    const isWeekend = ([0, 6].includes(new Date().getDay()));
    
    // 📅 오늘 날짜를 YYYY-MM-DD 형식으로 생성 (식단표 링크용)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

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

    // 🕒 시즌에 맞는 시간 데이터 선택 (방학 데이터가 없으면 학기 데이터 사용)
    const isVacationMode = (season === "VACATION");
    const weekPrefix = isVacationMode ? "방학 평일 타임 " : "학기 평일 타임 ";
    const weekendPrefix = isVacationMode ? "방학 주말 타임 " : "학기 주말 타임 ";
    const closedLabel = isVacationMode ? (shop["방학 휴무 요일"] || '연중무휴') : (shop["학기 휴무 요일"] || '연중무휴');

    // 시간 리스트 생성 (비어있을 경우 fallback)
    const getTimes = (prefix, fallbackPrefix) => {
        let times = [shop[prefix + "1"], shop[prefix + "2"], shop[prefix + "3"]].filter(t => t && t.trim() !== "");
        if (times.length === 0 && isVacationMode) {
            times = [shop[fallbackPrefix + "1"], shop[fallbackPrefix + "2"], shop[fallbackPrefix + "3"]].filter(t => t && t.trim() !== "");
        }
        return times.join(' / ') || '운영 안 함';
    };

    const weekTimes = getTimes(weekPrefix, "학기 평일 타임 ");
    const weekendTimes = getTimes(weekendPrefix, "학기 주말 타임 ");

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
            <div style="font-size: 0.75rem; color: #ff6b6b; font-weight: bold; border-bottom: 1px dashed #ddd; padding-bottom: 5px; margin-bottom: 5px;">
                📢 현재 운영 모드: ${season === "VACATION" ? "🏖️ 방학 중" : (season === "HOLIDAY" ? "🚩 공휴일" : "📖 학기 중")}
            </div>
            <div class="detail-item" style="margin: 0;">
                <span class="detail-label" style="font-size: 0.75rem; color: #888;">🕒 평일 운영시간</span>
                <div style="font-size: 0.95rem; ${(!isWeekend && season !== 'HOLIDAY') ? 'color:#333; font-weight:bold;' : 'color:#999;'}">
                    ${weekTimes}
                </div>
            </div>
            <div class="detail-item" style="margin: 0;">
                <span class="detail-label" style="font-size: 0.75rem; color: #888;">📅 주말 운영시간</span>
                <div style="font-size: 0.95rem; ${(isWeekend || season === 'HOLIDAY') ? 'color:#333; font-weight:bold;' : 'color:#999;'}">
                    ${weekendTimes}
                </div>
            </div>
            <div class="detail-item" style="margin: 0;">
                <span class="detail-label" style="font-size: 0.75rem; color: #888;">🚫 정기 휴무</span>
                <div style="font-size: 0.95rem; color: #e74c3c;">${closedLabel}</div>
            </div>
            ${season === "HOLIDAY" ? `<div style="font-size: 0.8rem; color: #e74c3c;">※ 공휴일 영업 여부: ${shop["공휴일 영업"] === "Y" ? "영업함" : "쉬어감"}</div>` : ''}
        </div>

        <button onclick="closeModal()" style="width:100%; padding:15px; margin-top:20px; border-radius:12px; border:none; background:#333; color:white; font-weight:bold; cursor:pointer;">닫기</button>
    `;
    modal.style.display = 'flex';
    history.pushState({ modal: 'detail' }, '');
}

function closeModal() {
    const modal = document.getElementById('modal');
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
        // 만약 사용자가 '닫기' 버튼을 눌러서 닫는 경우, 쌓인 히스토리를 한 칸 뒤로 돌려줍니다.
        if (history.state && history.state.modal === 'detail') {
            history.back();
        }
    }
}

// [6] 랜덤 추천 시작
function pickRandomShop() {
    refreshRandom(); // 식당을 뽑고 화면에 표시
    
    document.getElementById('random-modal').style.display = 'flex';
    history.pushState({ modal: 'random' }, ''); // 히스토리 추가
}

// ✨ [새로 추가] 식당을 실제로 뽑아서 화면 내용만 바꿔주는 함수
function refreshRandom() {
    const available = restaurants.filter(s => getStatus(s).canEat);
    
    if (available.length === 0) {
        alert("현재 영업 중인 식당이 없네요. 😭");
        closeRandomModal();
        return;
    }

    const selected = available[Math.floor(Math.random() * available.length)];
    let suggestion = "맛있는 식사를 즐겨보세요! 😋";
    
    if (selected["식단가기"]) {
        suggestion = "🍱 오늘의 맛있는 학식을 확인해보세요!";
    } else if (selected["메뉴"]) {
        const items = selected["메뉴"].replace(/\[.*?\]/g, "").split(",").map(i => i.trim()).filter(i => i);
        if (items.length > 0) {
            suggestion = `✨ ${items.sort(() => 0.5 - Math.random()).slice(0, 2).join(', ')} 어때요?`;
        }
    }

    // 화면 내용 교체
    document.getElementById('random-result-name').innerText = selected["식당명"];
    document.getElementById('random-menu-text').innerText = suggestion;
    
    // 상세 정보 보기 버튼 이벤트 연결
    document.getElementById('random-go-btn').onclick = () => {
        const rm = document.getElementById('random-modal');
        rm.style.display = 'none';
        if (history.state && history.state.modal === 'random') history.back();
        
        setTimeout(() => openModal(selected), 100);
    };
}

function closeRandomModal() {
    const rm = document.getElementById('random-modal');
    if (rm && rm.style.display === 'flex') {
        rm.style.display = 'none';
        
        // ✨ 핵심: 자바스크립트 함수(클릭)로 닫을 때는 쌓인 히스토리를 하나 지워줍니다.
        // 하지만 이미 뒤로가기로 인해 닫힌 상태라면 back()을 실행하지 않아야 합니다.
        if (history.state && history.state.modal === 'random') {
            history.back();
        }
    }
}

// ✨ [핵심] 사용자가 폰의 '뒤로가기' 버튼을 눌렀을 때 실행되는 이벤트
window.onpopstate = function(event) {
    // 히스토리가 뒤로 가졌으므로, 떠 있는 모든 모달을 그냥 화면에서 숨깁니다.
    document.getElementById('modal').style.display = 'none';
    document.getElementById('random-modal').style.display = 'none';
    document.getElementById('tag-modal').style.display = 'none';
};

// 윈도우 클릭 이벤트에 랜덤 모달 닫기 추가 (기존 window.onclick 수정)
window.onclick = (event) => {
    const modal = document.getElementById('modal');
    const tagModal = document.getElementById('tag-modal');
    const randomModal = document.getElementById('random-modal');
    if (event.target === modal) closeModal();
    if (event.target === tagModal) closeTagModal();
    if (event.target === randomModal) closeRandomModal();
}

// [5] 메인 리스트에서 오늘 운영 시간을 표시하는 함수 (수정본)
function getCurrentDayTimes(shop) {
    const season = getSeason(); // 현재 학기/방학/공휴일 판단
    const day = new Date().getDay();
    const isWeekend = (day === 0 || day === 6);

    // 1. 시즌 및 요일에 따른 데이터 키(Key) 결정
    let prefix = "";
    if (season === "VACATION") {
        prefix = isWeekend ? "방학 주말 타임 " : "방학 평일 타임 ";
        // 방학 데이터가 없으면 학기 데이터로 대체 (Fallback)
        if (!shop[prefix + "1"] || shop[prefix + "1"] === "") {
            prefix = isWeekend ? "학기 주말 타임 " : "학기 평일 타임 ";
        }
    } else {
        // 공휴일인 경우 보통 주말 시간을 따르므로 isWeekend와 동일하게 처리하거나
        // 학기 중이라면 학기 시간을 따름
        prefix = isWeekend ? "학기 주말 타임 " : "학기 평일 타임 ";
    }

    // 2. 해당 키의 1, 2, 3번 타임을 합쳐서 출력
    const times = [shop[prefix + "1"], shop[prefix + "2"], shop[prefix + "3"]]
                  .filter(t => t && t.trim() !== "" && t !== "운영 안 함");

    // 3. 공휴일 휴무 체크 추가
    if (season === "HOLIDAY" && shop["공휴일 영업"] === "N") {
        return "공휴일 휴무";
    }

    return times.length > 0 ? times.join(', ') : "운영 안 함";
}

// 두 지점 간의 직선 거리 계산 (단위: km)
function getDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999; // 좌표 정보가 없으면 아주 멀리 보냄
    const R = 6371; // 지구 반지름
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function updateLocationAndRender() {
    if (navigator.geolocation) {
        // 위치 정보 요청 (모바일에서 권한 팝업이 뜹니다)
        navigator.geolocation.getCurrentPosition((position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;

            // 모든 식당 객체에 현재 내 위치와의 거리(distance) 속성 추가
            restaurants.forEach(shop => {
                shop.distance = getDistance(userLat, userLng, shop.lat, shop.lng);
            });

            // 정렬 후 리스트 다시 그리기
            renderList();
        }, (error) => {
            console.warn("위치 정보를 가져올 수 없습니다. 기본 순서로 표시합니다.");
            renderList(); // 위치 실패 시에도 리스트는 보여줌
        });
    } else {
        renderList(); // GPS 미지원 브라우저 대응
    }
}

window.onload = () => {
    const loader = document.getElementById('location-loader');
    
    // 1. 일단 리스트를 한 번 그립니다 (기존 순서)
    renderList();

    if (navigator.geolocation) {
        // 2. 위치 계산 메시지 표시
        loader.style.display = 'block';

        const geoOptions = {
            enableHighAccuracy: true,
            timeout: 10000, // 최대 10초 대기
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition((position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;

            restaurants.forEach(shop => {
                shop.distance = getDistance(userLat, userLng, shop.lat, shop.lng);
            });

            // 3. 계산 완료 후 리스트 재정렬 및 메시지 숨김
            loader.style.display = 'none';
            renderList(); 
        }, (error) => {
            console.warn("위치 정보를 가져올 수 없습니다:", error.message);
            loader.style.display = 'none'; // 실패 시에도 메시지는 숨김
        }, geoOptions);
    }
};

// [5] 초기 실행
renderList();
setInterval(renderList, 60000);