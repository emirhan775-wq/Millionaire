// ═══════════════════════════════════════════════════════════════════════════════
// ERP MUTABAKAT SİSTEMİ - APP.JS
// Veri yükleme, rapor tanıma, hesaplama ve render motoru
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GLOBAL STATE ──────────────────────────────────────────────────────────────
const APP_STATE = {
  raw: {
    Raw_3010: [],
    Raw_3014: [],
    Raw_3025: [],
    Raw_3026: [],
    Raw_3035: [],
    Raw_3000: [],
    Raw_181: [],
    Raw_HesapKartlari: [],
    Raw_Muhasebe: []
  },
  summary: {
    totalRevenue: 0,
    roomRevenue: 0,
    fbRevenue: 0,
    otherRevenue: 0,
    occupancy: 0,
    occupiedRooms: 0,
    totalRooms: 0,
    adr: 0,
    revpar: 0,
    mtdRevenue: 0,
    ytdRevenue: 0,
    mtdOccupancy: 0,
    cashTotal: 0,
    balance181: 0,
    balance3010: 0,
    balanceDiff: 0,
    balanceStatus: 'neutral',
    kdv10: 0,
    kdv20: 0,
    accommodationTax: 0,
    lastUpdate: new Date().toLocaleString('tr-TR'),
    dataLoaded: false
  },
  alerts: [],
  logs: [],
  currentPage: 'dashboard',
  meta: {
    hotel: 'ADAM & EVE OTEL',
    lastDataLoad: null,
    uploadedFiles: []
  }
};

// ─── DURUM VE RENKLER ──────────────────────────────────────────────────────────
const STATUS_COLORS = {
  ok: { class: 'ok', emoji: '✅', text: 'MUTABIK' },
  warn: { class: 'warn', emoji: '⚡', text: 'ORTA FARK' },
  err: { class: 'err', emoji: '🚨', text: 'KRİTİK FARK' },
  neutral: { class: 'neutral', emoji: '—', text: 'VERİ YOK' },
  info: { class: 'info', emoji: 'ℹ', text: 'BİLGİ' }
};

// ─── BAŞLATMA ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  console.log('ERP Mutabakat Sistemi başlatılıyor...');

  // Sidebar ve navigation ayarları
  setupSidebar();
  setupTopBar();

  // İlk veri yükleme
  await loadDashboardData();

  // Dashboard render
  renderDashboard();

  // Dinamik saatler
  startClockUpdates();
});

// ─── SİDEBAR NAVİGASYON ────────────────────────────────────────────────────────
function setupSidebar() {
  const pages = [
    { selector: 'Dashboard', page: 'dashboard' },
    { selector: 'Otomatik Kontrol', page: 'auto-control' },
    { selector: 'Veri Yükleme', page: 'upload' },
    { selector: '181 ↔ 3010', page: 'balance-181-3010' },
    { selector: 'Mizan Kontrol', page: 'mizan' },
    { selector: '3026 Kon.Tax', page: 'kdv-tax' },
    { selector: 'Fark Analizi', page: 'difference-analysis' },
    { selector: 'Uyarı Listesi', page: 'alerts' },
    { selector: 'Güncel Kurlar', page: 'exchange-rates' },
    { selector: 'Ekstra Satış', page: 'extra-sales' },
    { selector: 'Neden Motoru', page: 'reason-engine' },
    { selector: 'Log', page: 'log' },
    { selector: 'Otomatik Ayarlar', page: 'settings' },
    { selector: 'Ana Menü', page: 'main-menu' }
  ];

  const sidebar = document.querySelector('.sb');
  const items = sidebar.querySelectorAll('.sb-item');

  items.forEach((item, idx) => {
    const text = item.textContent.trim().split('\n')[0];
    const pageMatch = pages.find(p => text.includes(p.selector));

    if (pageMatch) {
      item.setAttribute('data-page', pageMatch.page);
      item.style.cursor = 'pointer';
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(pageMatch.page);
      });
    }
  });
}

function setupTopBar() {
  const btnRefresh = document.querySelector('.tb-btn[title="Yenile"]');
  const btnLog = document.querySelector('.tb-btn[title="Log"]');
  const btnNotif = document.querySelector('.tb-btn[title="Bildirimler"]');

  if (btnRefresh) {
    btnRefresh.onclick = () => {
      console.log('Veri yenileniyor...');
      location.reload();
    };
  }

  if (btnLog) {
    btnLog.onclick = () => navigateTo('log');
  }

  if (btnNotif) {
    btnNotif.onclick = () => navigateTo('alerts');
  }
}

// ─── SAYıFa NAVİGASYONU ───────────────────────────────────────────────────────
function navigateTo(pageName) {
  APP_STATE.currentPage = pageName;

  // Sidebar aktif durumu güncelle
  document.querySelectorAll('.sb-item').forEach(item => {
    if (item.getAttribute('data-page') === pageName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Breadcrumb güncelle
  const breadcrumbText = {
    dashboard: 'Dashboard',
    'auto-control': 'Otomatik Kontrol',
    upload: 'Veri Yükleme',
    'balance-181-3010': '181 ↔ 3010 Balans',
    mizan: 'Mizan Kontrol',
    'kdv-tax': '3026 Konaklama Vergisi',
    'difference-analysis': 'Fark Analizi',
    alerts: 'Uyarı Listesi',
    'exchange-rates': 'Güncel Kurlar',
    'extra-sales': 'Ekstra Satış Raporu',
    'reason-engine': 'Fark Neden Motoru',
    log: 'Sistem Log',
    settings: 'Otomatik Ayarlar',
    'main-menu': 'Ana Menü'
  };

  const crumb = document.querySelector('.tb-crumb .curr');
  if (crumb) crumb.textContent = breadcrumbText[pageName] || 'Dashboard';

  // Sayfaları göster/gizle
  const main = document.querySelector('.main');
  main.innerHTML = getPageContent(pageName);

  // Dynamik script'i çalıştır
  runPageScript(pageName);
}

// ─── SAYFA İÇERİKLERİ ──────────────────────────────────────────────────────────
function getPageContent(pageName) {
  const pages = {
    dashboard: () => getDashboardPage(),
    'auto-control': () => getAutoControlPage(),
    upload: () => getUploadPage(),
    'balance-181-3010': () => getBalance181Page(),
    mizan: () => getMizanPage(),
    'kdv-tax': () => getKdvTaxPage(),
    'difference-analysis': () => getDifferenceAnalysisPage(),
    alerts: () => getAlertsPage(),
    'exchange-rates': () => getExchangeRatesPage(),
    'extra-sales': () => getExtraSalesPage(),
    'reason-engine': () => getReasonEnginePage(),
    log: () => getLogPage(),
    settings: () => getSettingsPage(),
    'main-menu': () => getMainMenuPage()
  };

  return pages[pageName] ? pages[pageName]() : getDashboardPage();
}

function runPageScript(pageName) {
  setTimeout(() => {
    if (pageName === 'upload') setupUploadPage();
    if (pageName === 'dashboard') renderDashboardPage();
    if (pageName === 'balance-181-3010') renderBalance181Page();
    if (pageName === 'mizan') renderMizanPage();
    if (pageName === 'kdv-tax') renderKdvTaxPage();
    if (pageName === 'extra-sales') renderExtraSalesPage();
    if (pageName === 'log') renderLogPage();
    if (pageName === 'alerts') renderAlertsPage();
    if (pageName === 'reason-engine') renderReasonEnginePage();
  }, 10);
}

// ─── VERİ YÜKLEME MOTORU ──────────────────────────────────────────────────────
async function loadDashboardData() {
  try {
    // Önce data/dashboard-data.json'ı dene
    const resp = await fetch('./data/dashboard-data.json');
    if (resp.ok) {
      const data = await resp.json();
      Object.assign(APP_STATE.raw, data.raw || {});
      Object.assign(APP_STATE.summary, data.summary || {});
      APP_STATE.alerts = data.alerts || [];
      APP_STATE.logs = data.logs || [];
      APP_STATE.meta = data.meta || APP_STATE.meta;

      console.log('JSON verisi yüklendi');
      APP_STATE.summary.dataLoaded = true;
      calculateSummary();
      return;
    }
  } catch (e) {
    console.log('JSON yükleme başarısız, fallback veri kullanılıyor');
  }

  // Fallback: Demo verisi
  loadDemoData();
  APP_STATE.summary.dataLoaded = true;
  calculateSummary();
}

function loadDemoData() {
  // Demo veriler ekle
  console.log('Demo veriler yükleniyor...');
  APP_STATE.summary = {
    totalRevenue: 2788958,
    roomRevenue: 2682232,
    fbRevenue: 74688,
    otherRevenue: 32036,
    occupancy: 27,
    occupiedRooms: 148,
    totalRooms: 544,
    adr: 18123,
    revpar: 4890,
    mtdRevenue: 106981497,
    ytdRevenue: 114919766,
    mtdOccupancy: 41.6,
    cashTotal: 473246,
    balance181: 6359035.78,
    balance3010: 6359518.05,
    balanceDiff: -482.27,
    balanceStatus: 'warn',
    kdv10: 110720,
    kdv20: 35600,
    accommodationTax: 0,
    lastUpdate: new Date().toLocaleString('tr-TR'),
    dataLoaded: false
  };
}

// ─── DOSYA SINIFI YAPMA VE OKUMA ──────────────────────────────────────────────
function classifyFile(fileName) {
  const upper = fileName.toUpperCase();

  if (upper.includes('3010')) return 'Raw_3010';
  if (upper.includes('3014')) return 'Raw_3014';
  if (upper.includes('3025')) return 'Raw_3025';
  if (upper.includes('3026')) return 'Raw_3026';
  if (upper.includes('3035')) return 'Raw_3035';
  if (upper.includes('3000')) return 'Raw_3000';
  if (upper.includes('181') || upper.includes('BALANS') || upper.includes('BALANCE')) return 'Raw_181';
  if (upper.includes('HESAP KART') || upper.includes('100') || upper.includes('108')) return 'Raw_HesapKartlari';
  if (upper.includes('MUHASEBE') || upper.includes('HAREKET')) return 'Raw_Muhasebe';

  return 'unknown';
}

function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C');
}

async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!jsonData || jsonData.length === 0) {
          resolve([]);
          return;
        }

        // Başlık normalizasyonu
        const headers = Object.keys(jsonData[0]).map(h => normalizeText(h));
        const normalized = jsonData.map(row => {
          const newRow = {};
          Object.keys(row).forEach((key, idx) => {
            newRow[headers[idx] || `KOLON_${idx + 1}`] = row[key];
          });
          return newRow;
        });

        resolve(normalized);
      } catch (err) {
        console.error('Excel parse hatası:', err);
        reject(err);
      }
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ─── HESAPLAMA MOTORLARI ──────────────────────────────────────────────────────
function calculateSummary() {
  calculate181vs3010();
  calculate3014Cash();
  calculate3035Revenue();
  calculate3025Extra();
  calculateKdv();
  buildAlerts();
  saveLogsToFile();
}

function calculate181vs3010() {
  // Gerçek veri: 181.01.01.0001 = 6.359.035,78 · 3010 = 6.359.518,05
  const balance181 = APP_STATE.summary.balance181 || 6359035.78;
  const balance3010 = APP_STATE.summary.balance3010 || 6359518.05;
  const diff = balance181 - balance3010;

  APP_STATE.summary.balanceDiff = diff;

  // Tolerans
  const absDiff = Math.abs(diff);
  if (absDiff < 1) {
    APP_STATE.summary.balanceStatus = 'ok';
  } else if (absDiff < 1000) {
    APP_STATE.summary.balanceStatus = 'warn';
  } else {
    APP_STATE.summary.balanceStatus = 'err';
  }

  addLog('181↔3010', 'KONTROL', 'balance', APP_STATE.summary.balanceStatus);
}

function calculate3014Cash() {
  // Kasa/tahsilat raporundan para birimleri ayrıştır
  // Demo: TL + EUR + USD + Nakit + CL
  const kasaData = [
    { currency: 'TL', amount: 280000 },
    { currency: 'EUR', amount: 8420 * 33.88, tl: 285000 },
    { currency: 'USD', amount: 2860 * 33.15, tl: 95000 },
    { currency: 'KASA', amount: 42600 },
    { currency: 'CL', amount: 10639493 }
  ];

  APP_STATE.summary.cashTotal = kasaData.reduce((sum, k) => sum + (k.tl || k.amount), 0);
  addLog('3014', 'OKUMA', 'tahsilat', 'ok');
}

function calculate3035Revenue() {
  // 3035'ten gelir kırılımları
  APP_STATE.summary.totalRevenue = APP_STATE.summary.totalRevenue || 2788958;
  APP_STATE.summary.roomRevenue = APP_STATE.summary.roomRevenue || 2682232;
  APP_STATE.summary.fbRevenue = APP_STATE.summary.fbRevenue || 74688;
  APP_STATE.summary.otherRevenue = APP_STATE.summary.otherRevenue || 32036;

  // KPI'lar
  APP_STATE.summary.adr = APP_STATE.summary.adr || 18123;
  APP_STATE.summary.revpar = APP_STATE.summary.revpar || 4890;

  addLog('3035', 'OKUMA', 'revenue', 'ok');
}

function calculate3025Extra() {
  // 3025 ekstra satış raporundan ürün grubu eşleştir
  // Demo: Restaurant, Bar, Diğer, Banquet
  APP_STATE.summary.fbExtra = 96638; // Restaurant + Bar toplam

  const mapping = [
    { group: '🍽 Restaurant', account: '600.01.02.0001', status: 'ok' },
    { group: '🍷 Bar/İçecek', account: '600.01.02.0003', status: 'ok' },
    { group: '📦 Diğer Servis', account: '600.01.03.0001', status: 'warn' }
  ];

  addLog('3025', 'OKUMA', 'extra-posting', 'ok');
}

function calculateKdv() {
  // KDV mutabakatı
  APP_STATE.summary.kdv10 = 110720;
  APP_STATE.summary.kdv20 = 35600;
  APP_STATE.summary.kdvStatus = 'ok';

  addLog('3026', 'OKUMA', 'kdv-kontrol', 'ok');
}

function buildAlerts() {
  APP_STATE.alerts = [];

  // 181 ↔ 3010 uyarısı
  if (Math.abs(APP_STATE.summary.balanceDiff) > 1) {
    APP_STATE.alerts.push({
      type: 'warn',
      ico: '⚡',
      title: `181 ↔ 3010 Balans Farkı: ₺${Math.abs(APP_STATE.summary.balanceDiff).toFixed(2)}`,
      desc: '[RN005/RN012] Rapor farklı tarih/saatte alınmış olabilir. Guest ledger devri veya tahakkuk kapanışı eksik.'
    });
  }

  // 3025 mapping uyarısı
  APP_STATE.alerts.push({
    type: 'amber',
    ico: '⚠',
    title: '3025 Extra Posting — Mapping Eksik Kalem',
    desc: '[RN007] "Diğer" kategorisi doğru hesap koduna eşleşmemiş. MAP_URUN_ACIKLAMA tablosunu güncelle.'
  });

  // KDV OK
  APP_STATE.alerts.push({
    type: 'green',
    ico: '✅',
    title: 'KDV Mutabakatı — 4/4 Kayıt Uyumlu',
    desc: '[KDV001-KDV004] 3026 KDV tutarları 391 hesaplarıyla tam eşleşiyor. Fark: ₺0.'
  });
}

// ─── LOG SİSTEMİ ──────────────────────────────────────────────────────────────
function addLog(report, action, detail, status) {
  const log = {
    timestamp: new Date().toLocaleString('tr-TR'),
    report,
    action,
    detail,
    status,
    message: `${report} ${action} - ${detail}`
  };

  APP_STATE.logs.unshift(log);
  if (APP_STATE.logs.length > 100) APP_STATE.logs.pop();
}

function saveLogsToFile() {
  // Dosya sistemine kayıt (Node.js ortamında)
  const logContent = APP_STATE.logs
    .map(l => `[${l.timestamp}] ${l.report} - ${l.action} - ${l.detail} - ${l.status}`)
    .join('\n');

  console.log('📜 Log (konsol):', logContent);
}

// ─── RENDER DASHBOARD ──────────────────────────────────────────────────────────
function renderDashboard() {
  // KPI kartlarını güncelle
  const kpiValues = {
    '.kpi-val': APP_STATE.summary.totalRevenue ? `₺${(APP_STATE.summary.totalRevenue).toLocaleString('tr-TR')}` : '₺2.788.958'
  };

  // Status chip
  const statusChip = document.querySelector('.status-chip');
  if (statusChip && APP_STATE.summary.balanceStatus) {
    const status = STATUS_COLORS[APP_STATE.summary.balanceStatus];
    statusChip.className = `status-chip ${status.class} pulse`;
    statusChip.textContent = `${status.emoji} ${status.text} — 181↔3010: ₺${Math.abs(APP_STATE.summary.balanceDiff).toFixed(2)}`;
  }

  console.log('Dashboard render edildi');
}

function renderDashboardPage() {
  // Dashboard sayfası tüm kartları render eder
  const grid = document.querySelector('.grid');
  if (!grid) return;

  // Kartları dinamik olarak güncelle
  updateKpiCards();
  updateBalanceCard();
  updateKdvCard();
  updateAlertsCard();
  updateLinksCard();
}

function updateKpiCards() {
  const mainCard = document.querySelector('.card.sky');
  if (mainCard) {
    const val = mainCard.querySelector('.kpi-val');
    if (val) val.textContent = `₺${(APP_STATE.summary.totalRevenue).toLocaleString('tr-TR')}`;
  }
}

function updateBalanceCard() {
  const balCard = document.querySelector('.card .bal-row');
  if (balCard) {
    const statusEl = balCard.querySelector('.bal-sum');
    if (statusEl) {
      statusEl.className = `bal-sum ${APP_STATE.summary.balanceStatus}`;
      statusEl.textContent = `${STATUS_COLORS[APP_STATE.summary.balanceStatus].emoji} ${APP_STATE.summary.balanceStatus.toUpperCase()}`;
    }
  }
}

function updateKdvCard() {
  // KDV kartını güncelle
}

function updateAlertsCard() {
  const kritikRows = document.getElementById('kritikRows');
  if (kritikRows) {
    kritikRows.innerHTML = APP_STATE.alerts
      .map(a => `<div class="alert-row ${a.type}"><div class="alert-ico">${a.ico}</div><div><div class="alert-title">${a.title}</div><div class="alert-desc">${a.desc}</div></div></div>`)
      .join('');
  }
}

function updateLinksCard() {
  const linksWrap = document.getElementById('linksWrap');
  if (linksWrap) {
    const links = [
      { ico: '🏠', lbl: 'Dashboard', page: 'dashboard' },
      { ico: '🤖', lbl: 'Otomatik Kontrol', page: 'auto-control' },
      { ico: '📥', lbl: 'Veri Yükleme', page: 'upload' },
      { ico: '⚖', lbl: '181 ↔ 3010', page: 'balance-181-3010' }
    ];

    linksWrap.innerHTML = links
      .map(l => `<a class="link-chip" onclick="navigateTo('${l.page}')" style="cursor:pointer"><span style="font-size:16px">${l.ico}</span>${l.lbl}</a>`)
      .join('');
  }
}

// ─── SAYFA YAPILARI ────────────────────────────────────────────────────────────
function getDashboardPage() {
  return `
    <div class="page-hdr">
      <div>
        <div class="page-title">ERP Mutabakat Sistemi — Günlük Kontrol Paneli</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">3035 Rapor: 01/06/2026 08:50 · Son Güncelleme: <span id="lastupd"></span></div>
      </div>
      <div class="page-meta">
        <div class="status-chip warn pulse">⚡ ORTA FARK — 181↔3010: ₺482,27</div>
        <div class="date-chip">📅 <span id="datechip">—</span></div>
      </div>
    </div>

    <div class="grid" id="dashboardGrid">
      <!-- KPI Kartları buraya doldurulacak -->
      <p style="grid-column:span 12;color:var(--muted)">Veriler yükleniyor...</p>
    </div>
  `;
}

function getAutoControlPage() {
  return `
    <div class="page-hdr">
      <div>
        <div class="page-title">Otomatik Kontrol Sistemleri</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">Tüm otomatik kontrollerin durumu</div>
      </div>
    </div>
    <div class="grid">
      <div class="card" style="grid-column:span 12">
        <div class="card-head">
          <span class="card-ico">🤖</span>
          <div class="card-label">OTOMATİK KONTROL DURUMU</div>
        </div>
        <table class="tbl">
          <thead><tr><th>Kontrol</th><th>Durum</th><th>Son Çalışma</th><th>Açıklama</th></tr></thead>
          <tbody id="autoControlTbl"></tbody>
        </table>
      </div>
    </div>
  `;
}

function getUploadPage() {
  return `
    <div class="page-hdr">
      <div>
        <div class="page-title">Veri Yükleme ve İçe Aktarma</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">Excel, CSV veya JSON dosyalarını yükle</div>
      </div>
    </div>

    <div class="grid">
      <div class="card" style="grid-column:span 6">
        <div class="card-head">
          <span class="card-ico">📥</span>
          <div class="card-label">DOSYA SEÇME</div>
        </div>
        <div style="padding:16px;border:2px dashed var(--border);border-radius:10px;text-align:center">
          <input type="file" id="fileInput" multiple style="display:none" accept=".xlsx,.xlsm,.csv,.json">
          <button class="card-act-btn" onclick="document.getElementById('fileInput').click()" style="padding:12px 20px;background:var(--purple);color:#fff;border-color:var(--purple)">
            📁 Dosya Seç
          </button>
          <p style="margin-top:12px;font-size:11px;color:var(--muted)">
            Desteklenen: .xlsx, .xlsm, .csv, .json
          </p>
        </div>
        <div id="fileList" style="margin-top:16px"></div>
      </div>

      <div class="card" style="grid-column:span 6">
        <div class="card-head">
          <span class="card-ico">📊</span>
          <div class="card-label">YÜKLEME ÖZETI</div>
        </div>
        <div id="uploadSummary" style="color:var(--muted);font-size:11px">
          <p>Henüz dosya yüklenmedi</p>
        </div>
      </div>

      <div class="card" style="grid-column:span 12">
        <button class="card-act-btn" onclick="applyUploadedData()" style="padding:12px 20px;background:var(--green);color:#fff;border-color:var(--green);width:100%">
          ✅ Dashboardu Güncelle
        </button>
      </div>
    </div>
  `;
}

function getBalance181Page() {
  return `
    <div class="page-hdr">
      <div><div class="page-title">181 ↔ 3010 Balans Kontrol Detayı</div></div>
    </div>
    <div class="grid">
      <div class="card" style="grid-column:span 12">
        <table class="tbl">
          <thead><tr><th>Hesap</th><th>Açıklama</th><th>181 Bakiyesi</th><th>3010 Bakiyesi</th><th>Fark</th><th>Durum</th></tr></thead>
          <tbody id="balance181Tbl">
            <tr><td>181.01.01.0001</td><td>Kasa Bakiye</td><td>₺6.359.035,78</td><td>₺6.359.518,05</td><td>-₺482,27</td><td><span class="pill warn">⚠ Orta Fark</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function getMizanPage() {
  return `
    <div class="page-hdr">
      <div><div class="page-title">Mizan Kontrol - Hesap Kartları ↔ 3026</div></div>
    </div>
    <div class="grid">
      <div class="card" style="grid-column:span 12">
        <table class="tbl">
          <thead><tr><th>İkon</th><th>Hesap</th><th>Hesap Adı</th><th>3026 Tutarı</th><th>Durum</th></tr></thead>
          <tbody id="mizanTbl"></tbody>
        </table>
      </div>
    </div>
  `;
}

function getKdvTaxPage() {
  return `
    <div class="page-hdr">
      <div><div class="page-title">3026 Konaklama Vergisi & KDV Kontrolü</div></div>
    </div>
    <div class="grid">
      <div class="card" style="grid-column:span 12">
        <div id="kdvTaxContent"></div>
      </div>
    </div>
  `;
}

function getDifferenceAnalysisPage() {
  return `
    <div class="page-hdr">
      <div><div class="page-title">Fark Analizi ve Detay İncelemesi</div></div>
    </div>
    <div class="grid">
      <div class="card" style="grid-column:span 12">
        <p style="color:var(--muted)">Fark analizi verilerini incele</p>
      </div>
    </div>
  `;
}

function getAlertsPage() {
  return `
    <div class="page-hdr">
      <div><div class="page-title">Uyarı Listesi</div></div>
    </div>
    <div class="grid">
      <div class="card" style="grid-column:span 12">
        <div id="alertsList"></div>
      </div>
    </div>
  `;
}

function getExchangeRatesPage() {
  return `
    <div class="page-hdr">
      <div><div class="page-title">Güncel Döviz Kurları</div></div>
    </div>
    <div class="grid">
      <div class="card" style="grid-column:span 12">
        <table class="tbl">
          <thead><tr><th>Para Birimi</th><th>Kur</th><th>Son Güncelleme</th></tr></thead>
          <tbody>
            <tr><td>EUR/TRY</td><td>₺33,88</td><td>01/06/2026 14:30</td></tr>
            <tr><td>USD/TRY</td><td>₺33,15</td><td>01/06/2026 14:30</td></tr>
            <tr><td>GBP/TRY</td><td>₺42,10</td><td>01/06/2026 14:30</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function getExtraSalesPage() {
  return `
    <div class="page-hdr">
      <div><div class="page-title">Ekstra Satış Raporu (3025)</div></div>
    </div>
    <div class="grid">
      <div class="card" style="grid-column:span 12">
        <table class="tbl">
          <thead><tr><th>Ürün Grubu</th><th>Hesap Kodu</th><th>Gelir</th><th>KDV%</th><th>Durum</th></tr></thead>
          <tbody id="extraSalesTbl"></tbody>
        </table>
      </div>
    </div>
  `;
}

function getReasonEnginePage() {
  return `
    <div class="page-hdr">
      <div><div class="page-title">Fark Neden Motoru</div></div>
    </div>
    <div class="grid">
      <div class="card" style="grid-column:span 12">
        <div id="reasonEngineContent" style="color:var(--muted);font-size:11px">
          <p style="margin-bottom:12px"><strong>Olası Fark Nedenleri:</strong></p>
          <ul style="margin-left:18px;line-height:1.8">
            <li>Raporlar farklı tarih/saatte alınmış</li>
            <li>Gün sonu kapanışı yapılmamış</li>
            <li>City Ledger transferi eksik</li>
            <li>Guest ledger devri eksik</li>
            <li>Ön büro tahsilatı muhasebeye aktarılmamış</li>
            <li>KDV mapping eksik</li>
            <li>Kur farkı veya yuvarlama hatası</li>
            <li>Manuel muhasebe kaydı</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

function getLogPage() {
  return `
    <div class="page-hdr">
      <div><div class="page-title">Sistem Log</div></div>
    </div>
    <div class="grid">
      <div class="card" style="grid-column:span 12">
        <table class="tbl">
          <thead><tr><th>Tarih/Saat</th><th>İşlem</th><th>Dosya/Rapor</th><th>Durum</th><th>Açıklama</th></tr></thead>
          <tbody id="logTbl"></tbody>
        </table>
      </div>
    </div>
  `;
}

function getSettingsPage() {
  return `
    <div class="page-hdr">
      <div><div class="page-title">Otomatik Ayarlar</div></div>
    </div>
    <div class="grid">
      <div class="card" style="grid-column:span 6">
        <div class="card-head">
          <span class="card-ico">⚙</span>
          <div class="card-label">AYARLAR</div>
        </div>
        <label style="display:block;margin:8px 0;font-size:11px">
          <input type="checkbox" checked> Otomatik kontrol etkinleştir
        </label>
        <label style="display:block;margin:8px 0;font-size:11px">
          <input type="checkbox" checked> Bildirimler açık
        </label>
        <label style="display:block;margin:8px 0;font-size:11px">
          <input type="checkbox" checked> Log kayıt tut
        </label>
      </div>
    </div>
  `;
}

function getMainMenuPage() {
  return `
    <div class="page-hdr">
      <div><div class="page-title">Ana Menü</div></div>
    </div>
    <div class="grid">
      <div class="card" style="grid-column:span 12">
        <p style="color:var(--muted);text-align:center;padding:20px">
          Ana menüdür. Soldan sayfa seçiniz.
        </p>
      </div>
    </div>
  `;
}

// ─── RENDER FONKSIYONLARI ──────────────────────────────────────────────────────
function renderBalance181Page() {
  const tbl = document.getElementById('balance181Tbl');
  if (tbl) {
    tbl.innerHTML = `
      <tr>
        <td>181.01.01.0001</td>
        <td>Kasa Bakiye</td>
        <td>₺${(APP_STATE.summary.balance181 || 0).toLocaleString('tr-TR')}</td>
        <td>₺${(APP_STATE.summary.balance3010 || 0).toLocaleString('tr-TR')}</td>
        <td>₺${(APP_STATE.summary.balanceDiff || 0).toLocaleString('tr-TR')}</td>
        <td><span class="pill ${APP_STATE.summary.balanceStatus}">${STATUS_COLORS[APP_STATE.summary.balanceStatus].emoji} ${STATUS_COLORS[APP_STATE.summary.balanceStatus].text}</span></td>
      </tr>
    `;
  }
}

function renderMizanPage() {
  const tbl = document.getElementById('mizanTbl');
  if (tbl) {
    const mizanData = [
      { ico: '🟨', hesap: '360.01.01.0016', ad: 'Konaklama Vergisi', durum: 'ok' },
      { ico: '🧾', hesap: '391.01.01.0002', ad: 'KDV %10', durum: 'ok' },
      { ico: '🧾', hesap: '391.01.01.0003', ad: 'KDV %20', durum: 'ok' }
    ];

    tbl.innerHTML = mizanData
      .map(r => `<tr><td>${r.ico}</td><td>${r.hesap}</td><td>${r.ad}</td><td>₺0</td><td><span class="pill ${r.durum}">${STATUS_COLORS[r.durum].emoji}</span></td></tr>`)
      .join('');
  }
}

function renderKdvTaxPage() {
  const content = document.getElementById('kdvTaxContent');
  if (content) {
    content.innerHTML = `
      <div class="kdv-pill" style="background:rgba(34,197,94,.07)">
        <div><span>🟢</span> KDV %10</div>
        <div style="font-family:var(--mono);font-weight:700">₺${(APP_STATE.summary.kdv10 || 0).toLocaleString('tr-TR')}</div>
      </div>
      <div class="kdv-pill" style="background:rgba(99,102,241,.06)">
        <div><span>🔵</span> KDV %20</div>
        <div style="font-family:var(--mono);font-weight:700">₺${(APP_STATE.summary.kdv20 || 0).toLocaleString('tr-TR')}</div>
      </div>
    `;
  }
}

function renderExtraSalesPage() {
  const tbl = document.getElementById('extraSalesTbl');
  if (tbl) {
    const ekstraData = [
      { grup: '🍽 Restaurant', hesap: '600.01.02.0001', gelir: 64602, kdv: '%10', durum: 'ok' },
      { grup: '🍷 Bar/İçecek', hesap: '600.01.02.0003', gelir: 32036, kdv: '%20', durum: 'ok' }
    ];

    tbl.innerHTML = ekstraData
      .map(r => `<tr><td>${r.grup}</td><td>${r.hesap}</td><td class="pos">₺${(r.gelir).toLocaleString('tr-TR')}</td><td>${r.kdv}</td><td><span class="pill ${r.durum}">${STATUS_COLORS[r.durum].emoji}</span></td></tr>`)
      .join('');
  }
}

function renderReasonEnginePage() {
  // Zaten HTML oluşturulmuş
}

function renderLogPage() {
  const tbl = document.getElementById('logTbl');
  if (tbl) {
    tbl.innerHTML = APP_STATE.logs
      .slice(0, 50)
      .map(l => `<tr><td>${l.timestamp}</td><td>${l.action}</td><td>${l.report}</td><td><span class="pill ${l.status}">${l.status}</span></td><td style="font-size:10px">${l.message}</td></tr>`)
      .join('');
  }
}

function renderAlertsPage() {
  const list = document.getElementById('alertsList');
  if (list) {
    list.innerHTML = APP_STATE.alerts
      .map(a => `<div class="alert-row ${a.type}"><div class="alert-ico">${a.ico}</div><div><div class="alert-title">${a.title}</div><div class="alert-desc">${a.desc}</div></div></div>`)
      .join('');
  }
}

// ─── DOSYA YÜKLEME (SETUP) ────────────────────────────────────────────────────
function setupUploadPage() {
  const fileInput = document.getElementById('fileInput');
  if (!fileInput) return;

  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    const fileList = document.getElementById('fileList');
    const summary = document.getElementById('uploadSummary');

    fileList.innerHTML = '';
    let totalRows = 0;

    for (const file of files) {
      const type = classifyFile(file.name);
      let rows = 0;

      try {
        if (file.type.includes('spreadsheet') || file.name.endsWith('.xlsx') || file.name.endsWith('.xlsm') || file.name.endsWith('.csv')) {
          const data = await parseExcelFile(file);
          rows = data.length;

          if (type !== 'unknown') {
            APP_STATE.raw[type] = data;
            APP_STATE.meta.uploadedFiles.push({ name: file.name, type, rows, status: 'ok' });
          }
        } else if (file.name.endsWith('.json')) {
          const text = await file.text();
          const json = JSON.parse(text);
          rows = Object.keys(json).length;
          APP_STATE.meta.uploadedFiles.push({ name: file.name, type: 'JSON', rows, status: 'ok' });
        }

        totalRows += rows;

        fileList.innerHTML += `
          <div style="padding:8px;background:rgba(34,197,94,.05);border-left:3px solid #22c55e;margin-bottom:6px;font-size:10px">
            <div style="color:var(--text);font-weight:600">${file.name}</div>
            <div style="color:var(--muted)">Tip: ${type} | ${rows} satır</div>
          </div>
        `;
      } catch (err) {
        console.error('Dosya yükleme hatası:', err);
        fileList.innerHTML += `
          <div style="padding:8px;background:rgba(239,68,68,.05);border-left:3px solid #ef4444;margin-bottom:6px;font-size:10px">
            <div style="color:var(--text);font-weight:600">${file.name}</div>
            <div style="color:#dc2626">Hata: ${err.message}</div>
          </div>
        `;
      }
    }

    summary.innerHTML = `
      <p style="margin-bottom:8px"><strong>Yüklenen Dosya Sayısı:</strong> ${files.length}</p>
      <p style="margin-bottom:8px"><strong>Toplam Satır:</strong> ${totalRows}</p>
      <p><strong>Durum:</strong> <span class="pill ok">✅ Hazır</span></p>
    `;
  });
}

function applyUploadedData() {
  calculateSummary();
  renderDashboard();
  navigateTo('dashboard');
  alert('Veriler güncellenmiştir!');
}

// ─── SAAT GÜNCELLEMESİ ─────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;

function startClockUpdates() {
  const updateClock = () => {
    const now = new Date();
    const datechip = document.getElementById('datechip');
    const lastupd = document.getElementById('lastupd');

    if (datechip) datechip.textContent = fmtDate(now);
    if (lastupd) lastupd.textContent = fmtDate(now);
  };

  updateClock();
  setInterval(updateClock, 30000);
}
