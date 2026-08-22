// epg.js — универсальный загрузчик и рендерер EPG
// Поддерживает:
// - числовые ID (загружает с epg.pw)
// - полные URL на XML-файлы (любой источник)

function parseXMLTime(str) {
    const d = str.split(' ')[0];
    return new Date(Date.UTC(
        d.substr(0, 4),
        d.substr(4, 2) - 1,
        d.substr(6, 2),
        d.substr(8, 2),
        d.substr(10, 2),
        d.substr(12, 2)
    ));
}

function formatTime(d) {
    return d.getHours().toString().padStart(2, '0') + ':' +
           d.getMinutes().toString().padStart(2, '0');
}

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
}

function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}

function determineSport(t) {
    t = t.toLowerCase();
    if (t.includes('футбол')) return 'Футбол';
    if (t.includes('хоккей')) return 'Хоккей';
    if (t.includes('теннис')) return 'Теннис';
    return '';
}

function isLive(t) {
    t = t.toLowerCase();
    return t.includes('live') || t.includes('прямой');
}

function renderProgram(p, now) {
    const cur = now >= p.start && now < p.stop;
    return `
    <div class="program ${cur ? 'current' : ''}">
        <div class="time">${p.startText}</div>
        <div class="program-info">
            <div class="title-with-meta">
                <div>${p.title}</div>
                <div class="meta-info">
                    ${p.sport ? `<span class="sport-badge">${p.sport}</span>` : ''}
                    ${p.live ? '<span class="live-badge">LIVE</span>' : ''}
                    ${cur ? '<span class="current-badge">LIVE</span>' : ''}
                </div>
            </div>
            ${p.desc ? `<div class="program-desc">${p.desc}</div>` : ''}
        </div>
    </div>`;
}

function renderNowPlaying(programs, now) {
    const cur = programs.find(p => now >= p.start && now < p.stop);
    if (cur) {
        return `
        <div class="now-playing">
            <strong>СЕЙЧАС В ЭФИРЕ</strong>
            <div class="now-title">${cur.title}</div>
            до ${formatTime(cur.stop)}
        </div>`;
    } else {
        return `<div class="no-current">Сейчас нет передачи</div>`;
    }
}

function renderSchedule(programs, now) {
    const today = programs.filter(p => isSameDay(p.start, now));
    const tomorrow = programs.filter(p => isSameDay(p.start, addDays(now, 1)));
    today.sort((a, b) => a.start - b.start);
    tomorrow.sort((a, b) => a.start - b.start);

    let html = '';
    if (today.length) {
        html += `<div class="day-header">Сегодня</div>`;
        today.forEach(p => html += renderProgram(p, now));
    }
    if (tomorrow.length) {
        html += `<div class="day-header">Завтра</div>`;
        tomorrow.forEach(p => html += renderProgram(p, now));
    }
    return html || 'Нет программы на сегодня и завтра';
}

function loadEPG(epgId, container) {
    // Если epgId пустой, null или undefined — показываем сообщение
    if (!epgId) {
        container.innerHTML = '<div class="no-current">Нет EPG для этого канала</div>';
        return;
    }

    // Определяем, является ли epgId готовым URL
    let url;
    if (epgId.startsWith('http://') || epgId.startsWith('https://')) {
        // Это готовый URL — используем как есть
        url = epgId;
    } else {
        // Это числовой ID — собираем URL для epg.pw
        url = `https://epg.pw/api/epg.xml?lang=en&channel_id=${epgId}`;
    }

    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`Ошибка загрузки EPG: ${res.status}`);
            return res.text();
        })
        .then(text => {
            const xml = new DOMParser().parseFromString(text, 'text/xml');
            const programmes = xml.getElementsByTagName('programme');
            const now = new Date();
            const items = [];
            for (const p of programmes) {
                const start = parseXMLTime(p.getAttribute('start'));
                const stop = parseXMLTime(p.getAttribute('stop'));
                if (stop <= now) continue;
                const title = p.getElementsByTagName('title')[0]?.textContent || '';
                const desc = p.getElementsByTagName('desc')[0]?.textContent || '';
                items.push({
                    start, stop,
                    startText: formatTime(start),
                    title, desc,
                    sport: determineSport(title),
                    live: isLive(title)
                });
            }
            items.sort((a, b) => a.start - b.start);
            const nowPlayingHtml = renderNowPlaying(items, now);
            const scheduleHtml = renderSchedule(items, now);
            container.innerHTML = nowPlayingHtml + scheduleHtml;
        })
        .catch(err => {
            console.error('EPG load error:', err);
            container.innerHTML = '<div class="no-current">Ошибка загрузки EPG</div>';
        });
}
