// ============ CSV Parsing & Data Processing ============
function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);
    return lines.slice(1).map(line => {
        const vals = parseCSVLine(line);
        const obj = {};
        headers.forEach((h, i) => obj[h.trim()] = (vals[i] || '').trim());
        return obj;
    }).filter(d => d.Name);
}

function parseCSVLine(line) {
    const result = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
        else { current += ch; }
    }
    result.push(current);
    return result;
}

// ============ Classification ============
const NEGATIVE_KW = ['延毕', '压榨', '骚扰', '逼酒', '养蛊', '黑论文', '随叫随到', '极坑', '难毕业', '边缘化', '无Idea', '忽悠', '摆烂', '不作为', '管理混乱'];
const POSITIVE_KW = ['允许实习', '不Push', '尊重学生', '氛围自由', '人品好', '平易近人', '关心学生', '学术水平高', '前途广阔', '环境自由', '不打卡', '经费足'];

function classifySupervisor(d) {
    const cat = d.Category || '';
    if (cat.includes('广受好评') || cat.includes('推荐')) return 'good';
    if (cat.includes('避雷') || cat.includes('风险较高') || cat.includes('慎重')) return 'bad';
    if (cat.includes('争议') || cat.includes('两极分化') || cat.includes('表现稳健')) return 'mixed';

    const rel = parseFloat(d.Avg_Relationship);
    if (!isNaN(rel)) {
        if (rel >= 4) return 'good';
        if (rel >= 3) return 'mixed';
        if (rel > 0) return 'bad';
    }
    return 'unknown';
}

function getInfoScore(d) {
    let score = 0;
    const fields = ['Title', 'Research_Area', 'Department', 'Alma_Mater', 'H_Index', 'Citations', 'Paper_Count', 'Keywords', 'Avg_Relationship', 'Internship_Policy', 'Talent_Plan'];
    fields.forEach(f => { if (d[f] && d[f] !== '0' && d[f] !== '0.0') score++; });
    const rel = parseFloat(d.Avg_Relationship) || 0;
    score += rel * 2;
    const h = parseFloat(d.H_Index) || 0;
    score += Math.min(h / 10, 3);
    return score;
}

function classifyKeyword(kw) {
    const k = kw.trim();
    for (const neg of NEGATIVE_KW) { if (k.includes(neg)) return 'negative'; }
    for (const pos of POSITIVE_KW) { if (k.includes(pos)) return 'positive'; }
    return 'neutral';
}

// ============ Rendering ============
function getInternshipHTML(policy) {
    if (!policy) return '<span class="internship-badge na">📋 未提及</span>';
    if (policy.includes('允许') || policy.includes('不限制'))
        return '<span class="internship-badge allowed">✅ 允许实习</span>';
    if (policy.includes('不允许') || policy.includes('限制'))
        return '<span class="internship-badge restricted">❌ 不允许实习</span>';
    if (policy.includes('仅暑期') || policy.includes('视情况'))
        return '<span class="internship-badge partial">⚠️ 仅暑期/视情况</span>';
    return '<span class="internship-badge na">📋 ' + policy + '</span>';
}

function getRelBarHTML(rel) {
    const v = parseFloat(rel);
    if (isNaN(v)) return '';
    const pct = (v / 5 * 100).toFixed(0);
    const cls = v >= 4 ? 'green' : v >= 3 ? 'amber' : 'red';
    return `<div class="relationship-bar">
    <div class="relationship-label"><span>师生关系</span><span>${v.toFixed(1)} / 5.0</span></div>
    <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
  </div>`;
}

function getKeywordsHTML(kws) {
    if (!kws) return '';
    const parts = kws.split('|')[0].split(',').map(k => k.trim()).filter(Boolean).slice(0, 6);
    if (!parts.length) return '';
    return '<div class="keyword-pills">' +
        parts.map(k => {
            const cls = classifyKeyword(k);
            return `<span class="keyword-pill ${cls}">${k}</span>`;
        }).join('') + '</div>';
}

function getDetailsHTML(d) {
    const kws = d.Keywords || '';
    const reviews = kws.split('|').slice(1).map(r => r.trim()).filter(Boolean);
    let html = '';
    if (reviews.length) {
        html += '<div class="detail-section"><h4>详细评价</h4><div class="detail-text">';
        reviews.forEach(r => { html += `<p>${r}</p>`; });
        html += '</div></div>';
    }
    const charEval = d.Excel_Character_Eval;
    const compEval = d.Excel_Competence_Eval;
    if (charEval || compEval) {
        html += '<div class="eval-badges">';
        if (charEval) {
            const cls = charEval === '好' ? 'good' : charEval.includes('不好') ? 'bad' : 'neutral';
            html += `<span class="eval-badge ${cls}">人品: ${charEval}</span>`;
        }
        if (compEval) {
            const cls = compEval === '好' ? 'good' : compEval.includes('不好') ? 'bad' : 'neutral';
            html += `<span class="eval-badge ${cls}">能力: ${compEval}</span>`;
        }
        html += '</div>';
    }
    return html;
}

function renderCard(d, idx) {
    const tier = d._tier;
    const avatarCls = { good: 'green-bg', mixed: 'amber-bg', bad: 'red-bg', unknown: 'blue-bg' }[tier];
    const tierLabel = { good: '推荐', mixed: '一般', bad: '慎重', unknown: '未分类' }[tier];
    const tierCls = tier;
    const h = parseFloat(d.H_Index) || '-';
    const cite = parseFloat(d.Citations); const citeStr = !isNaN(cite) ? (cite > 999 ? (cite / 1000).toFixed(1) + 'k' : cite) : '-';
    const papers = parseFloat(d.Paper_Count) || '-';
    const activity = parseFloat(d.Activity_Score); const actStr = !isNaN(activity) ? activity.toFixed(1) : '-';

    const metaTags = [];
    if (d.Department) metaTags.push(`<span class="meta-tag dept">${d.Sub_Department || d.Department}</span>`);
    if (d.Alma_Mater) metaTags.push(`<span class="meta-tag alma">🎓 ${d.Alma_Mater}</span>`);
    if (d.Talent_Plan) metaTags.push(`<span class="meta-tag talent">🏆 ${d.Talent_Plan}</span>`);
    if (d.Admin_Role) metaTags.push(`<span class="meta-tag">${d.Admin_Role}</span>`);

    return `<div class="card tier-${tier}" data-tier="${tier}" data-dept="${d.Department || ''}" style="animation-delay:${idx * 0.05}s" onclick="this.classList.toggle('expanded')">
    <div class="card-header">
      <div class="avatar ${avatarCls}">${d.Name[0]}</div>
      <div class="card-header-info">
        <div class="card-name">${d.Name} <span class="tier-badge ${tierCls}">${tierLabel}</span></div>
        <div class="card-title">${d.Title || '教师'}</div>
      </div>
    </div>
    ${d.Research_Area ? `<div class="card-research">🔬 ${d.Research_Area}</div>` : ''}
    ${metaTags.length ? `<div class="card-meta">${metaTags.join('')}</div>` : ''}
    <div class="card-stats">
      <div class="stat-box"><span class="val">${h}</span><span class="lbl">H-Index</span></div>
      <div class="stat-box"><span class="val">${citeStr}</span><span class="lbl">引用</span></div>
      <div class="stat-box"><span class="val">${papers}</span><span class="lbl">论文</span></div>
      <div class="stat-box"><span class="val">${actStr}</span><span class="lbl">活跃度</span></div>
    </div>
    ${getInternshipHTML(d.Internship_Policy)}
    ${getRelBarHTML(d.Avg_Relationship)}
    ${getKeywordsHTML(d.Keywords)}
    <div class="card-details">${getDetailsHTML(d)}</div>
    <div class="expand-hint">▼</div>
  </div>`;
}

// ============ App State ============
let allData = [];
let currentTab = 'all';

function getFilteredData() {
    let data = [...allData];
    const q = document.getElementById('searchInput').value.toLowerCase();
    const deptFilter = document.getElementById('deptFilter').value;

    if (q) {
        data = data.filter(d =>
            (d.Name || '').toLowerCase().includes(q) ||
            (d.Research_Area || '').toLowerCase().includes(q) ||
            (d.Keywords || '').toLowerCase().includes(q) ||
            (d.Department || '').toLowerCase().includes(q)
        );
    }
    if (deptFilter) data = data.filter(d => d.Department === deptFilter);
    if (currentTab !== 'all') data = data.filter(d => d._tier === currentTab);
    return data;
}

function renderAll() {
    const data = getFilteredData();
    const grid = document.getElementById('cardGrid');
    if (!data.length) {
        grid.innerHTML = '<div class="no-results"><div style="font-size:3rem;margin-bottom:12px">🔍</div>没有找到匹配的导师</div>';
        return;
    }
    grid.innerHTML = data.map((d, i) => renderCard(d, i)).join('');
}

function updateCounts() {
    const counts = { all: allData.length, good: 0, mixed: 0, bad: 0, unknown: 0 };
    allData.forEach(d => counts[d._tier]++);
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const t = btn.dataset.tab;
        const countEl = btn.querySelector('.count');
        if (countEl) countEl.textContent = counts[t];
    });
    // hero stats
    document.getElementById('statTotal').textContent = counts.all;
    document.getElementById('statGood').textContent = counts.good;
    document.getElementById('statMixed').textContent = counts.mixed + counts.unknown;
    document.getElementById('statBad').textContent = counts.bad;
}

function populateDeptFilter() {
    const depts = [...new Set(allData.map(d => d.Department).filter(Boolean))].sort();
    const sel = document.getElementById('deptFilter');
    depts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d; opt.textContent = d;
        sel.appendChild(opt);
    });
}

// ============ Init ============
async function init() {
    try {
        const resp = await fetch('fudan_cs_supervisors.csv');
        const text = await resp.text();
        allData = parseCSV(text);
    } catch (e) {
        console.error('Failed to load CSV:', e);
        document.getElementById('cardGrid').innerHTML = '<div class="no-results"><div style="font-size:3rem;margin-bottom:12px">❌</div>无法加载数据文件</div>';
        return;
    }

    // classify & sort
    allData.forEach(d => { d._tier = classifySupervisor(d); d._score = getInfoScore(d); });
    const tierOrder = { good: 0, mixed: 1, unknown: 2, bad: 3 };
    allData.sort((a, b) => (tierOrder[a._tier] - tierOrder[b._tier]) || (b._score - a._score));

    updateCounts();
    populateDeptFilter();
    renderAll();

    // event listeners
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.className = 'tab-btn');
            const tab = btn.dataset.tab;
            currentTab = tab;
            const colorCls = { all: 'active-blue', good: 'active-green', mixed: 'active-amber', bad: 'active-red' }[tab] || 'active-blue';
            btn.classList.add(colorCls);
            renderAll();
        });
    });

    document.getElementById('searchInput').addEventListener('input', renderAll);
    document.getElementById('deptFilter').addEventListener('change', renderAll);

    // scroll to top
    const scrollBtn = document.getElementById('scrollTop');
    window.addEventListener('scroll', () => {
        scrollBtn.classList.toggle('visible', window.scrollY > 400);
    });
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // activate "all" tab
    document.querySelector('[data-tab="all"]').classList.add('active-blue');

    // theme toggle
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        const current = html.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        html.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    });
}

// Restore theme before paint to avoid flash
(function () {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else if (!saved && window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.setAttribute('data-theme', 'light');
    }
})();

document.addEventListener('DOMContentLoaded', init);
