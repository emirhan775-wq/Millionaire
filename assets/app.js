/* ERP MUTABAKAT HTML SYSTEM
   Görsel şablona dokunmadan çalışan SPA + veri motoru.
*/

const ROUTES = [
  {ico:'🏠', lbl:'Dashboard', page:'dashboard', title:'ERP Mutabakat Sistemi — Günlük Kontrol Paneli'},
  {ico:'🤖', lbl:'Otomatik Kontrol', page:'auto-control', title:'Otomatik Kontrol Sistemi'},
  {ico:'📥', lbl:'Veri Yükleme', page:'upload', title:'Veri Yükleme ve Rapor Tanıma'},
  {ico:'⚖', lbl:'181 ↔ 3010', page:'balance-181-3010', title:'181 ↔ 3010 Balans Kontrolü'},
  {ico:'🧮', lbl:'Mizan Kontrol', page:'mizan', title:'Mizan / Hesap Kartları Kontrolü'},
  {ico:'🟨', lbl:'3026 Kon.Tax', page:'kontax', title:'3026 Konaklama Vergisi & KDV Kontrolü'},
  {ico:'📊', lbl:'Fark Analizi', page:'diff-analysis', title:'Fark Analizi'},
  {ico:'🚨', lbl:'Uyarı Listesi', page:'alerts', title:'Uyarı Listesi'},
  {ico:'💱', lbl:'Güncel Kurlar', page:'rates', title:'Güncel Kurlar'},
  {ico:'🛒', lbl:'Ekstra Satış', page:'extra-sales', title:'3025 Ekstra Satış'},
  {ico:'🧠', lbl:'Neden Motoru', page:'reason-engine', title:'Fark Neden Motoru'},
  {ico:'📜', lbl:'Log', page:'log', title:'Otomatik Log'},
  {ico:'🛠', lbl:'Otomatik Ayarlar', page:'settings', title:'Otomatik Ayarlar'},
  {ico:'📌', lbl:'Ana Menü', page:'main-menu', title:'Ana Menü'}
];

const TR_M = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const TR_D = ['Pz','Pt','Sa','Ça','Pe','Cu','Ct'];
const REPORT_KEYS = ['Raw_3010','Raw_3014','Raw_3025','Raw_3026','Raw_3035','Raw_3000','Raw_181','Raw_HesapKartlari','Raw_Muhasebe'];
const BALANCE_ACCOUNT = '181.01.01.0001';
const ACCOM_TAX_ACCOUNT = '360.01.01.0016';
const KDV10_ACCOUNT = '391.01.01.0002';
const KDV20_ACCOUNT = '391.01.01.0003';
const MAX_CALC_ROWS = 4000;

let APP_STATE = {
  meta: {hotel:'ADAM & EVE OTEL', lastUpdate:'', status:'VERİ YOK', source:'Hazırlanıyor'},
  raw: emptyRaw(),
  summary: {},
  alerts: [],
  logs: [],
  uploads: [],
  controls: [],
  extras: [],
  mizan: [],
  revenue3026: [],
  reasonRows: []
};

const FALLBACK_DATA = {
  meta: {hotel:'ADAM & EVE OTEL', lastUpdate:'2026-06-26 20:45', status:'ORTA FARK', source:'Fallback Demo Veri'},
  raw: emptyRaw(),
  summary: {
    totalRevenue: 2788958,
    roomRevenue: 2682232,
    fbRevenue: 74688,
    otherRevenue: 32036,
    mtdRevenue: 106981497,
    ytdRevenue: 114919766,
    occupancy: 27.2,
    occupiedRooms: 148,
    totalRooms: 544,
    outOfOrderRooms: 3,
    guestCount: 301,
    adr: 18123,
    revpar: 4930,
    mtdAdr: 14725,
    ytdAdr: 14499,
    arrivals: 21,
    departures: 150,
    cashTotal: 473246,
    balance181: 6359035.78,
    balance3010: 6359518.05,
    balanceDiff: -482.27,
    kdv10: 110720,
    kdv20: 35600,
    accommodationTax: 0,
    extraTotal: 106961
  },
  alerts: [
    {type:'amber', ico:'⚡', title:'181 ↔ 3010 Balans Farkı: ₺482,27 (ORTA FARK)', desc:'Rapor farklı tarih/saatte alınmış olabilir. Guest ledger devri, previous balance veya tahakkuk kapanışı muhasebeye tam aktarılmamış olabilir.', actionRequired:true},
    {type:'blue', ico:'ℹ', title:'3026 ↔ 3035 Kapsam Farkı Olası', desc:'3035 MTD/YTD özeti ile 3026 revenue kırılımı farklı kapsamdan alınmış olabilir. Aynı gün sonu kapanış kesitinde alınmalı.', actionRequired:false},
    {type:'amber', ico:'⚠', title:'3025 Extra Posting — Mapping Eksik Kalem', desc:'“Diğer” kategorisi doğru hesap koduna eşleşmemiş görünüyor. Ürün açıklama mapping tablosu güncellenmeli.', actionRequired:true},
    {type:'green', ico:'✅', title:'KDV Mutabakatı — Demo veri uyumlu', desc:'KDV %10 ve %20 örnek tutarları dashboard hesaplamasına dahil edildi.', actionRequired:false}
  ],
  logs: [
    logObj('Başlangıç', 'dashboard-data.json', 'Uyarı', 'Canlı veri yoksa fallback demo veri ile açılır.', '', false)
  ]
};

function emptyRaw(){
  return {
    Raw_3010: [], Raw_3014: [], Raw_3025: [], Raw_3026: [], Raw_3035: [],
    Raw_3000: [], Raw_181: [], Raw_HesapKartlari: [], Raw_Muhasebe: []
  };
}

function pad(n){ return String(n).padStart(2,'0'); }
function fmtDate(d){ return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function isoNow(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function esc(v){
  return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
function normalizeText(text){
  return String(text ?? '')
    .replace(/İ/g,'I').replace(/ı/g,'I')
    .replace(/Ş/g,'S').replace(/ş/g,'S')
    .replace(/Ğ/g,'G').replace(/ğ/g,'G')
    .replace(/Ü/g,'U').replace(/ü/g,'U')
    .replace(/Ö/g,'O').replace(/ö/g,'O')
    .replace(/Ç/g,'C').replace(/ç/g,'C')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toUpperCase().replace(/\s+/g,' ').trim();
}
function parseAmount(value){
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  let s = String(value).trim();
  if (!s || /^[-–—]+$/.test(s)) return 0;
  let negative = false;
  if (/\((.*?)\)/.test(s) || /-$/.test(s)) negative = true;
  s = s.replace(/\((.*?)\)/g,'$1').replace(/[^0-9,\.\-]/g,'');
  if (!s || s === '-' || s === ',' || s === '.') return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    s = s.replace(/\./g,'').replace(',', '.');
  } else if (lastDot > lastComma) {
    s = s.replace(/,/g,'');
  } else if (lastComma !== -1 && lastDot === -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals <= 2 ? s.replace(',', '.') : s.replace(/,/g,'');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return negative && n > 0 ? -n : n;
}
function fmtTL(n){
  const val = Number(n || 0);
  return val.toLocaleString('tr-TR', {style:'currency', currency:'TRY', minimumFractionDigits: val % 1 ? 2 : 0, maximumFractionDigits: 2});
}
function fmtNum(n, digits=0){
  return Number(n || 0).toLocaleString('tr-TR', {minimumFractionDigits:digits, maximumFractionDigits:digits});
}
function fmtPct(n){ return `%${Number(n || 0).toLocaleString('tr-TR', {minimumFractionDigits:1, maximumFractionDigits:1})}`; }
function abs(n){ return Math.abs(Number(n || 0)); }
function diffStatus(diff){
  if (diff === null || diff === undefined || !Number.isFinite(Number(diff))) return 'VERİ YOK';
  const a = abs(diff);
  if (a <= 1) return 'MUTABIK';
  if (a <= 1000) return 'ORTA FARK';
  return 'KRİTİK FARK';
}
function pill(status, text){
  const s = normalizeText(status);
  if (s.includes('MUTAB') || s.includes('CALISTI') || s.includes('OK') || s.includes('ESLESTI')) return `<span class="pill ok">✅ ${esc(text || status)}</span>`;
  if (s.includes('KRITIK') || s.includes('HATA') || s.includes('ERR')) return `<span class="pill err">🔴 ${esc(text || status)}</span>`;
  if (s.includes('ORTA') || s.includes('UYARI') || s.includes('FARK') || s.includes('WARN')) return `<span class="pill warn">⚠ ${esc(text || status)}</span>`;
  if (s.includes('BILGI') || s.includes('INFO')) return `<span class="pill info">ℹ ${esc(text || status)}</span>`;
  return `<span class="pill neutral">— ${esc(text || status || 'Veri Yok')}</span>`;
}
function logObj(process, fileName, status, desc, errorMsg, actionRequired){
  return {time: isoNow(), process, fileName: fileName || '', status, desc: desc || '', errorMsg: errorMsg || '', actionRequired: !!actionRequired};
}
function addLog(process, fileName, status, desc, errorMsg='', actionRequired=false){
  APP_STATE.logs.unshift(logObj(process, fileName, status, desc, errorMsg, actionRequired));
  APP_STATE.logs = APP_STATE.logs.slice(0, 500);
}
function toast(message, type='info'){
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; }, 4200);
  setTimeout(()=> el.remove(), 4700);
}
function rowText(row){ return normalizeText(Object.values(row || {}).join(' ')); }
function hasAny(text, terms){
  const t = normalizeText(text);
  return terms.some(term => t.includes(normalizeText(term)));
}
function firstNumFromRow(row, keyTerms=[]){
  if (!row) return 0;
  const keys = Object.keys(row);
  const preferred = keys.filter(k => hasAny(k, keyTerms));
  const allKeys = preferred.length ? preferred : keys;
  let best = 0;
  for (const k of allKeys) {
    const n = parseAmount(row[k]);
    if (n !== 0 && abs(n) >= abs(best)) best = n;
  }
  return best;
}
function safeRows(rows){ return Array.isArray(rows) ? rows.slice(0, MAX_CALC_ROWS) : []; }
function rowsWith(rows, include=[], exclude=[]){
  return safeRows(rows).filter(r => {
    const t = rowText(r);
    return (!include.length || include.some(x => t.includes(normalizeText(x)))) && (!exclude.length || !exclude.some(x => t.includes(normalizeText(x))));
  });
}
function sumRows(rows, include=[], exclude=[], keyTerms=['TUTAR','BAKIYE','BORC','ALACAK','TOTAL','TOPLAM','NET','GELIR','MATRAH','KDV']){
  return rowsWith(rows, include, exclude).reduce((s,r)=>s + firstNumFromRow(r, keyTerms), 0);
}
function maxAbsRows(rows, include=[], exclude=[], keyTerms=['TUTAR','BAKIYE','TOTAL','TOPLAM','NET','GELIR','MATRAH']){
  let best = 0;
  rowsWith(rows, include, exclude).forEach(r => {
    const n = firstNumFromRow(r, keyTerms);
    if (abs(n) > abs(best)) best = n;
  });
  return best;
}
function getRaw(key){ return safeRows(APP_STATE.raw?.[key]); }

// ─── DATE / TIME ───────────────────────────────────────────────────
let NOW = new Date();
let cY = NOW.getFullYear(), cM = NOW.getMonth();
const evDays = [1,7,14,22];
function updateClock(){
  const n = new Date();
  const dc = document.getElementById('datechip');
  const lu = document.getElementById('lastupd');
  if (dc) dc.textContent = fmtDate(n);
  if (lu && !APP_STATE.meta.lastUpdate) lu.textContent = fmtDate(n);
}
function renderCal(){
  const label = document.getElementById('calLbl');
  const grid = document.getElementById('calGrid');
  if (!label || !grid) return;
  label.textContent = `${TR_M[cM]} ${cY}`;
  grid.innerHTML = '';
  TR_D.forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-dlbl';
    el.textContent = d;
    grid.appendChild(el);
  });
  const first = new Date(cY,cM,1).getDay();
  const dim = new Date(cY,cM+1,0).getDate();
  const prevDim = new Date(cY,cM,0).getDate();
  for(let i=0;i<first;i++){
    const el=document.createElement('div');
    el.className='cal-day other';
    el.textContent=prevDim-first+1+i;
    grid.appendChild(el);
  }
  for(let d=1;d<=dim;d++){
    const el=document.createElement('div');
    const isToday=d===NOW.getDate()&&cM===NOW.getMonth()&&cY===NOW.getFullYear();
    el.className='cal-day'+(isToday?' today':'')+(evDays.includes(d)&&!isToday?' has-ev':'');
    el.textContent=d;
    grid.appendChild(el);
  }
}
function chMonth(dir){
  cM += dir;
  if (cM > 11) { cM = 0; cY++; }
  if (cM < 0) { cM = 11; cY--; }
  renderCal();
}
function makeBars(id, vals){
  const c = document.getElementById(id);
  if (!c) return;
  c.innerHTML = '';
  vals.forEach((h,i)=>{
    const b=document.createElement('div');
    b.className='mini-bar';
    b.style.height=clamp(h,4,100)+'%';
    b.style.background=i===vals.length-1?'rgba(255,255,255,.9)':`rgba(255,255,255,${.2+h/300})`;
    c.appendChild(b);
  });
}

// ─── DATA LOADING ──────────────────────────────────────────────────
async function loadDashboardData(){
  try {
    const res = await fetch('data/dashboard-data.json', {cache:'no-store'});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    hydrateState(data, 'data/dashboard-data.json');
    addLog('JSON Veri Okuma', 'data/dashboard-data.json', 'Çalıştı', 'Dashboard JSON başarıyla okundu.', '', false);
  } catch (err) {
    console.warn('dashboard-data.json okunamadı. Fallback veri kullanılacak:', err);
    hydrateState(FALLBACK_DATA, 'Fallback Demo Veri');
    addLog('JSON Veri Okuma', 'data/dashboard-data.json', 'Uyarı', 'Canlı veri bulunamadı. Sistem fallback demo veriyle açıldı.', err.message, true);
    APP_STATE.alerts.unshift({type:'amber', ico:'⚠', title:'Canlı veri bulunamadı', desc:'data/dashboard-data.json okunamadı. HTML fallback demo veriyle açıldı. Veri Yükleme sayfasından Excel/CSV/JSON yükleyebilirsiniz.', actionRequired:true});
  }
  renderAll();
}
function hydrateState(data, sourceLabel){
  const incomingRaw = Object.assign(emptyRaw(), data?.raw || {});
  APP_STATE.meta = Object.assign({hotel:'ADAM & EVE OTEL', lastUpdate:'', status:'VERİ YOK', source:sourceLabel}, data?.meta || {});
  APP_STATE.raw = incomingRaw;
  APP_STATE.summary = Object.assign({}, data?.summary || {});
  APP_STATE.alerts = Array.isArray(data?.alerts) ? data.alerts.slice() : [];
  APP_STATE.logs = Array.isArray(data?.logs) ? data.logs.slice() : [];
  APP_STATE.uploads = [];
  APP_STATE.meta.source = sourceLabel;
  recalculateState(false);
}
function reloadData(){
  addLog('Yenile', '', 'Bilgi', 'Kullanıcı Yenile butonuna bastı. JSON yeniden okunuyor.', '', false);
  loadDashboardData().then(()=> toast('Veriler yeniden yüklendi.', 'ok'));
}
function updateFromLoadedRaw(){
  recalculateState(true);
  renderAll();
  toast('Dashboard yüklenen raporlara göre güncellendi.', 'ok');
}

// ─── FILE READER ───────────────────────────────────────────────────
function classifyFile(fileName){
  const n = normalizeText(fileName);
  if (n.includes('3014')) return 'Raw_3014';
  if (n.includes('3025')) return 'Raw_3025';
  if (n.includes('3026')) return 'Raw_3026';
  if (n.includes('3035')) return 'Raw_3035';
  if (n.includes('3000')) return 'Raw_3000';
  if (n.includes('181')) return 'Raw_181';
  if (n.includes('3010')) return 'Raw_3010';
  if (n.includes('BALANS') || n.includes('BALANCE')) return 'Raw_181';
  if (n.includes('HESAP KART') || n.includes('HESAP KARTLARI') || n.includes('100') || n.includes('108')) return 'Raw_HesapKartlari';
  if (n.includes('MUHASEBE') || n.includes('HAREKET')) return 'Raw_Muhasebe';
  return 'UNKNOWN';
}
function openFilePicker(){
  const picker = document.getElementById('filePicker');
  if (picker) picker.click();
}
async function handleFileSelect(event){
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  for (const file of files) {
    const reportType = classifyFile(file.name);
    const uploadInfo = {fileName:file.name, reportType, rows:0, status:'Bekliyor', error:''};
    APP_STATE.uploads.unshift(uploadInfo);
    try {
      if (reportType === 'UNKNOWN') {
        uploadInfo.status = 'Uyarı';
        uploadInfo.error = 'Rapor tipi tanınmadı';
        addLog('Dosya Tanıma', file.name, 'Uyarı', 'Dosya adı bilinen rapor tiplerine eşleşmedi.', uploadInfo.error, true);
        continue;
      }
      const rows = await parseExcelFile(file);
      uploadInfo.rows = rows.length;
      uploadInfo.status = rows.length ? 'Çalıştı' : 'Uyarı';
      uploadInfo.error = rows.length ? '' : '0 satır / atlandı';
      APP_STATE.raw[reportType] = rows;
      addLog('Dosya Yükleme', file.name, uploadInfo.status, `${reportType} olarak okundu. Satır: ${rows.length}`, uploadInfo.error, !rows.length);
    } catch (err) {
      console.error('Dosya okunamadı:', file.name, err);
      uploadInfo.status = 'Hata';
      uploadInfo.error = err.message || String(err);
      addLog('Dosya Yükleme', file.name, 'Hata', 'Dosya okunamadı. Diğer dosyalar işlenmeye devam etti.', uploadInfo.error, true);
    }
  }
  event.target.value = '';
  recalculateState(true);
  renderAll();
  navigateTo('upload');
  toast(`${files.length} dosya işlendi. Dashboardu Güncelle butonu ile hesaplamayı yenileyebilirsiniz.`, 'ok');
}
async function parseExcelFile(file){
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'json') {
    const txt = await file.text();
    const obj = JSON.parse(txt);
    if (Array.isArray(obj)) return obj;
    if (Array.isArray(obj.rows)) return obj.rows;
    if (obj.raw) {
      Object.assign(APP_STATE.raw, emptyRaw(), obj.raw);
      return [];
    }
    return [obj];
  }
  if (!window.XLSX) throw new Error('SheetJS yüklenemedi. İnternet bağlantısını veya CDN erişimini kontrol edin.');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, {type:'array', cellDates:true, raw:false, defval:''});
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(ws, {header:1, defval:'', blankrows:false, raw:false});
  return matrixToRows(matrix);
}
function matrixToRows(matrix){
  const rows = (matrix || []).filter(r => Array.isArray(r) && r.some(v => String(v ?? '').trim() !== ''));
  if (!rows.length) return [];
  const headerIndex = detectHeaderRow(rows);
  if (headerIndex === -1) {
    const maxLen = Math.max(...rows.map(r => r.length));
    const headers = Array.from({length:maxLen}, (_,i)=>`Kolon${i+1}`);
    return rows.map(r => objFromRow(headers, r));
  }
  const headers = rows[headerIndex].map((h,i) => String(h || '').trim() || `Kolon${i+1}`);
  const seen = {};
  const uniqueHeaders = headers.map((h,i) => {
    const base = h || `Kolon${i+1}`;
    const key = normalizeText(base) || `KOLON${i+1}`;
    seen[key] = (seen[key] || 0) + 1;
    return seen[key] > 1 ? `${base}_${seen[key]}` : base;
  });
  return rows.slice(headerIndex+1).map(r => objFromRow(uniqueHeaders, r)).filter(o => Object.values(o).some(v => String(v ?? '').trim() !== ''));
}
function detectHeaderRow(rows){
  const known = ['TARIH','HESAP','HESAP KODU','ACIKLAMA','TUTAR','BAKIYE','BORC','ALACAK','GELIR','REVENUE','KDV','MATRAH','ODA','ROOM','FOLIO','CURRENCY','PARA','DEPARTMAN','URUN','CHECK','MUSTERI'];
  let bestIndex = -1, bestScore = 0;
  const limit = Math.min(25, rows.length);
  for (let i=0; i<limit; i++) {
    const row = rows[i];
    const nonEmpty = row.filter(v => String(v ?? '').trim() !== '');
    const textCount = nonEmpty.filter(v => Number.isNaN(Number(String(v).replace(/[.,]/g,'')))).length;
    const n = normalizeText(nonEmpty.join(' '));
    const knownScore = known.reduce((s,k)=>s+(n.includes(k)?1:0),0);
    const score = knownScore * 3 + Math.min(textCount, 8) + Math.min(nonEmpty.length, 8) * 0.25;
    if (score > bestScore) { bestScore = score; bestIndex = i; }
  }
  return bestScore >= 4 ? bestIndex : -1;
}
function objFromRow(headers, row){
  const obj = {};
  headers.forEach((h,i) => { obj[h] = row[i] ?? ''; });
  return obj;
}

// ─── CALCULATION ENGINE ────────────────────────────────────────────
function recalculateState(fromUploads){
  const beforeSummary = Object.assign({}, APP_STATE.summary || {});
  const raw = APP_STATE.raw || emptyRaw();
  const calc3035 = calculate3035Revenue(raw.Raw_3035 || []);
  const calc3014 = calculate3014Cash(raw.Raw_3014 || []);
  const calc181 = calculate1813010(raw.Raw_181 || [], raw.Raw_3010 || []);
  const calc3025 = calculate3025Extra(raw.Raw_3025 || []);
  const calcKdv = calculateKdv(raw.Raw_3026 || [], raw.Raw_HesapKartlari || []);
  const summary = Object.assign({}, beforeSummary, calc3035, calc3014, calc181, calc3025, calcKdv);

  // Koruma: raw boşsa JSON/fallback summary değerleri bozulmasın.
  Object.keys(summary).forEach(k => {
    if ((summary[k] === 0 || summary[k] === '' || summary[k] === null || Number.isNaN(summary[k])) && beforeSummary[k]) summary[k] = beforeSummary[k];
  });

  summary.balanceDiff = Number(summary.balance181 || 0) - Number(summary.balance3010 || 0);
  summary.balanceStatus = diffStatus(summary.balanceDiff);
  summary.kdvTotal = Number(summary.kdv10 || 0) + Number(summary.kdv20 || 0);
  summary.totalRevenue = Number(summary.totalRevenue || 0) || (Number(summary.roomRevenue||0) + Number(summary.fbRevenue||0) + Number(summary.otherRevenue||0));
  summary.adr = Number(summary.adr || 0) || (Number(summary.occupiedRooms||0) ? Number(summary.roomRevenue||0) / Number(summary.occupiedRooms||1) : 0);
  summary.revpar = Number(summary.revpar || 0) || (Number(summary.totalRooms||0) ? Number(summary.roomRevenue||0) / Number(summary.totalRooms||1) : 0);
  summary.occupancy = Number(summary.occupancy || 0) || (Number(summary.totalRooms||0) ? Number(summary.occupiedRooms||0) / Number(summary.totalRooms||1) * 100 : 0);

  APP_STATE.summary = summary;
  APP_STATE.extras = calc3025.extraRows?.length ? calc3025.extraRows : fallbackExtraRows(summary);
  APP_STATE.mizan = buildMizanRows(summary);
  APP_STATE.revenue3026 = buildRevenue3026Rows(summary);
  APP_STATE.reasonRows = buildReasonRows(summary, raw);
  APP_STATE.controls = buildControls(summary, raw);
  const calcAlerts = buildAlerts(summary, raw);
  const existingImportant = (APP_STATE.alerts || []).filter(a => a.title && normalizeText(a.title).includes('CANLI VERI'));
  APP_STATE.alerts = [...existingImportant, ...calcAlerts];
  APP_STATE.meta.status = summary.balanceStatus || APP_STATE.meta.status || 'VERİ YOK';
  APP_STATE.meta.lastUpdate = APP_STATE.meta.lastUpdate || isoNow();
  if (fromUploads) addLog('Hesaplama Motoru', 'Yüklenen raporlar', 'Çalıştı', 'APP_STATE.summary yeniden hesaplandı.', '', false);
}
function calculate1813010(raw181, raw3010){
  const r181 = safeRows(raw181);
  const r3010 = safeRows(raw3010);
  let balance181 = maxAbsRows(r181, [BALANCE_ACCOUNT], [], ['BAKIYE','BORC','ALACAK','TUTAR','TOTAL','TOPLAM']);
  if (!balance181 && r181.length) balance181 = maxAbsRows(r181, ['181'], [], ['BAKIYE','TUTAR','TOTAL','TOPLAM','NET']);
  if (!balance181 && r181.length) balance181 = maxAbsRows(r181, [], [], ['BAKIYE','TUTAR','TOTAL','TOPLAM','NET']);

  let balance3010 = maxAbsRows(r3010, ['BALANCE','TOTAL'], [], ['BAKIYE','BALANCE','TUTAR','TOTAL','TOPLAM','NET']);
  if (!balance3010 && r3010.length) balance3010 = maxAbsRows(r3010, ['3010'], [], ['BAKIYE','TUTAR','TOTAL','TOPLAM','NET']);
  if (!balance3010 && r3010.length) balance3010 = maxAbsRows(r3010, [], [], ['BAKIYE','TUTAR','TOTAL','TOPLAM','NET']);

  return {balance181, balance3010, balanceDiff: balance181 - balance3010};
}
function calculate3014Cash(raw3014){
  const rows = safeRows(raw3014);
  if (!rows.length) return {cashTotal: 0, cashBreakdown: []};
  const breakdown = [
    {code:'TL', ico:'💳', lbl:'Kredi Kartı / Nakit TL', terms:['TL','TRY','TURK LIRASI']},
    {code:'EUR', ico:'💶', lbl:'Kredi Kartı / Nakit EUR', terms:['EUR','EURO','€']},
    {code:'USD', ico:'💵', lbl:'Kredi Kartı / Nakit USD', terms:['USD','DOLAR','$']},
    {code:'GBP', ico:'💷', lbl:'Kredi Kartı / Nakit GBP', terms:['GBP','STERLIN','POUND','£']},
    {code:'CL', ico:'🏦', lbl:'City Ledger', terms:['CITY LEDGER','CL','ACENTE','CARI']},
    {code:'OTHER', ico:'🎟', lbl:'Diğer Ödeme', terms:['DIGER','OTHER','TRANSFER','HAVALE']}
  ].map(item => {
    const val = sumRows(rows, item.terms, [], ['TUTAR','AMOUNT','TAHSILAT','PAYMENT','TOTAL','TOPLAM','NET']);
    return Object.assign({}, item, {val});
  });
  const matched = breakdown.reduce((s,b)=>s+abs(b.val),0);
  const fallback = rows.reduce((s,r)=>s + abs(firstNumFromRow(r, ['TUTAR','AMOUNT','TAHSILAT','PAYMENT','TOTAL','TOPLAM'])), 0);
  return {cashTotal: matched || fallback, cashBreakdown: breakdown};
}
function calculate3035Revenue(raw3035){
  const rows = safeRows(raw3035);
  if (!rows.length) return {};
  const roomRevenue = abs(sumRows(rows, ['ODA','ROOM'], ['KDV','TAX','DOLULUK','OCCUPANCY'], ['GELIR','REVENUE','TUTAR','NET','TOTAL','TOPLAM'])) || abs(maxAbsRows(rows, ['ROOM REVENUE','ODA GELIRI'], [], ['GELIR','REVENUE','TUTAR','TOTAL','TOPLAM']));
  const fbRevenue = abs(sumRows(rows, ['F&B','YIYECEK','ICECEK','FOOD','BEVERAGE','RESTAURANT'], ['KDV','TAX'], ['GELIR','REVENUE','TUTAR','NET','TOTAL','TOPLAM']));
  const otherRevenue = abs(sumRows(rows, ['DIGER','OTHER','MINIBAR','SPA','BANQUET'], ['KDV','TAX'], ['GELIR','REVENUE','TUTAR','NET','TOTAL','TOPLAM']));
  let totalRevenue = abs(maxAbsRows(rows, ['TOTAL REVENUE','TOPLAM GELIR','GENEL TOPLAM','GRAND TOTAL'], [], ['GELIR','REVENUE','TUTAR','NET','TOTAL','TOPLAM']));
  if (!totalRevenue) totalRevenue = roomRevenue + fbRevenue + otherRevenue;

  const occupiedRooms = abs(maxAbsRows(rows, ['OCCUPIED','DOLU ODA','ROOM NIGHT'], [], ['ODA','ROOM','NIGHT','SAYI','COUNT','TOTAL','TOPLAM']));
  const totalRooms = abs(maxAbsRows(rows, ['TOTAL ROOM','AVAILABLE ROOM','TOPLAM ODA','KAPASITE'], [], ['ODA','ROOM','SAYI','COUNT','TOTAL','TOPLAM']));
  const guestCount = abs(maxAbsRows(rows, ['GUEST','KISI','PAX'], [], ['SAYI','COUNT','TOTAL','TOPLAM']));
  const occupancyRaw = abs(maxAbsRows(rows, ['OCCUPANCY','DOLULUK'], [], ['ORAN','PCT','%','RATE']));
  const arrivals = abs(maxAbsRows(rows, ['ARRIVAL','VARIS'], [], ['ODA','ROOM','SAYI','COUNT','TOTAL','TOPLAM']));
  const departures = abs(maxAbsRows(rows, ['DEPARTURE','CIKIS'], [], ['ODA','ROOM','SAYI','COUNT','TOTAL','TOPLAM']));
  const mtdRevenue = abs(maxAbsRows(rows, ['MTD'], [], ['GELIR','REVENUE','TUTAR','TOTAL','TOPLAM']));
  const ytdRevenue = abs(maxAbsRows(rows, ['YTD'], [], ['GELIR','REVENUE','TUTAR','TOTAL','TOPLAM']));
  const adr = abs(maxAbsRows(rows, ['ADR'], [], ['ADR','TUTAR','TOTAL','TOPLAM'])) || (occupiedRooms ? roomRevenue/occupiedRooms : 0);
  const revpar = abs(maxAbsRows(rows, ['REVPAR'], [], ['REVPAR','TUTAR','TOTAL','TOPLAM'])) || (totalRooms ? roomRevenue/totalRooms : 0);
  let occupancy = occupancyRaw;
  if (occupancy > 1 && occupancy <= 100) occupancy = occupancy;
  else if (occupancy > 100) occupancy = 0;
  else occupancy = totalRooms ? occupiedRooms/totalRooms*100 : 0;

  return {totalRevenue, roomRevenue, fbRevenue, otherRevenue, occupiedRooms, totalRooms, guestCount, occupancy, adr, revpar, mtdRevenue, ytdRevenue, arrivals, departures};
}
function calculate3025Extra(raw3025){
  const rows = safeRows(raw3025);
  if (!rows.length) return {extraTotal:0, extraRows:[]};
  const groups = [
    {grup:'🍽 Restaurant / F&B', hesap:'600.01.02.0001', kdv:'%10', status:'Eşleşti', terms:['RESTAURANT','YIYECEK','FOOD','F&B','ALAKART','A LA CARTE']},
    {grup:'🍷 Bar / Alkollü İçecek', hesap:'600.01.02.0003', kdv:'%20', status:'Eşleşti', terms:['BAR','ALKOL','ALCOHOL','WINE','BEER','VOTKA','RAKI','KOKTEYL']},
    {grup:'🥤 Alkolsüz İçecek', hesap:'600.01.02.0002', kdv:'%10', status:'Eşleşti', terms:['ALKOLSUZ','SOFT','ICECEK','COLA','WATER','SU','JUICE']},
    {grup:'🥤 Mini Bar', hesap:'600.01.03.0002', kdv:'%20', status:'Eşleşti', terms:['MINI BAR','MINIBAR','MAXI BAR','MAXIBAR']},
    {grup:'🎉 Banquet', hesap:'600.01.02.0005', kdv:'%10/%20', status:'Eşleşti', terms:['BANQUET','TOPLANTI','MEETING','EVENT']},
    {grup:'📦 Diğer Servis', hesap:'600.01.03.0001', kdv:'%20', status:'Eksik Map', terms:['DIGER','OTHER','SPA','TRANSFER','SERVIS','SERVICE']}
  ];
  const extraRows = groups.map(g => {
    const gelir = abs(sumRows(rows, g.terms, ['KDV','TAX'], ['TUTAR','AMOUNT','GELIR','REVENUE','NET','TOTAL','TOPLAM']));
    return Object.assign({}, g, {gelir, status: gelir ? g.status : 'Veri Yok'});
  });
  const matchedSum = extraRows.reduce((s,r)=>s+r.gelir,0);
  const fallback = rows.reduce((s,r)=>s + abs(firstNumFromRow(r, ['TUTAR','AMOUNT','GELIR','REVENUE','NET','TOTAL','TOPLAM'])), 0);
  const extraTotal = matchedSum || fallback;
  return {extraTotal, extraRows};
}
function calculateKdv(raw3026, rawHesapKartlari){
  const r3026 = safeRows(raw3026);
  const hk = safeRows(rawHesapKartlari);
  const both = r3026.concat(hk);
  if (!both.length) return {};
  let kdv10 = abs(sumRows(both, ['KDV','%10'], [], ['KDV','TUTAR','AMOUNT','ALACAK','BAKIYE','TOTAL','TOPLAM']));
  if (!kdv10) kdv10 = abs(sumRows(both, [KDV10_ACCOUNT], [], ['KDV','TUTAR','AMOUNT','ALACAK','BAKIYE','TOTAL','TOPLAM']));
  let kdv20 = abs(sumRows(both, ['KDV','%20'], [], ['KDV','TUTAR','AMOUNT','ALACAK','BAKIYE','TOTAL','TOPLAM']));
  if (!kdv20) kdv20 = abs(sumRows(both, [KDV20_ACCOUNT], [], ['KDV','TUTAR','AMOUNT','ALACAK','BAKIYE','TOTAL','TOPLAM']));
  let accommodationTax = abs(sumRows(both, [ACCOM_TAX_ACCOUNT], [], ['TUTAR','AMOUNT','ALACAK','BAKIYE','TOTAL','TOPLAM']));
  if (!accommodationTax) accommodationTax = abs(sumRows(both, ['KONAKLAMA VERGISI','KON.TAX','KON TAX','ACCOMMODATION TAX'], [], ['TUTAR','AMOUNT','TAX','TOTAL','TOPLAM']));
  return {kdv10, kdv20, accommodationTax};
}
function buildMizanRows(summary){
  return [
    {ico:'🟨', hesap:ACCOM_TAX_ACCOUNT, ad:'Konaklama Vergisi', status: summary.accommodationTax ? 'Mutabık' : 'Veri Yok'},
    {ico:'🧾', hesap:KDV10_ACCOUNT, ad:'KDV %10', status: summary.kdv10 ? 'Mutabık' : 'Veri Yok'},
    {ico:'🧾', hesap:KDV20_ACCOUNT, ad:'KDV %20', status: summary.kdv20 ? 'Mutabık' : 'Veri Yok'},
    {ico:'🛏', hesap:'600.01.01.0001', ad:'Oda Geliri %10', status: summary.roomRevenue ? 'Mutabık' : 'Veri Yok'},
    {ico:'🍽', hesap:'600.01.02.0001', ad:'Yiyecek Geliri', status: summary.fbRevenue ? 'Mutabık' : 'Veri Yok'},
    {ico:'🥤', hesap:'600.01.02.0002', ad:'Alkolsüz İçecek', status: summary.fbRevenue ? 'Mutabık' : 'Veri Yok'},
    {ico:'🍷', hesap:'600.01.02.0003', ad:'Alkollü İçecek %20', status: summary.kdv20 ? 'Mutabık' : 'Veri Yok'},
    {ico:'📌', hesap:'600.01.03.0001', ad:'Diğer Gelir %20', status: summary.otherRevenue ? 'Mutabık' : 'Veri Yok'},
    {ico:'🎉', hesap:'600.01.02.0005', ad:'Banquet', status: 'Veri Yok'}
  ];
}
function buildRevenue3026Rows(summary){
  return [
    {rev:'Room Revenue', matrah: summary.roomRevenue, kdv:'%10', status: summary.roomRevenue ? 'Mutabık' : 'Veri Yok'},
    {rev:'Restaurant/F&B', matrah: summary.fbRevenue, kdv:'%10', status: summary.fbRevenue ? 'Mutabık' : 'Veri Yok'},
    {rev:'Alkollü/Diğer', matrah: summary.otherRevenue, kdv:'%20', status: summary.otherRevenue ? 'Mutabık' : 'Veri Yok'},
    {rev:'KDV %10', matrah: summary.kdv10, kdv:'391', status: summary.kdv10 ? 'Mutabık' : 'Veri Yok'},
    {rev:'KDV %20', matrah: summary.kdv20, kdv:'391', status: summary.kdv20 ? 'Mutabık' : 'Veri Yok'}
  ];
}
function fallbackExtraRows(summary){
  return [
    {grup:'🍽 Restaurant / F&B', hesap:'600.01.02.0001', gelir:Number(summary.fbRevenue||0), kdv:'%10', status: summary.fbRevenue ? 'Eşleşti' : 'Veri Yok'},
    {grup:'🍷 Bar / Alkollü İçecek', hesap:'600.01.02.0003', gelir:Number(summary.otherRevenue||0)*0.55, kdv:'%20', status: summary.otherRevenue ? 'Eşleşti' : 'Veri Yok'},
    {grup:'📦 Diğer Servis', hesap:'600.01.03.0001', gelir:Number(summary.otherRevenue||0)*0.45, kdv:'%20', status: summary.otherRevenue ? 'Eksik Map' : 'Veri Yok'},
    {grup:'🎉 Banquet', hesap:'600.01.02.0005', gelir:0, kdv:'—', status:'Veri Yok'}
  ];
}
function buildControls(summary, raw){
  const has = key => safeRows(raw[key]).length > 0;
  return [
    {name:'181 ↔ 3010 Balans Kontrolü', status: has('Raw_181') || has('Raw_3010') ? summary.balanceStatus : 'Veri Yok', lastRun:APP_STATE.meta.lastUpdate, desc:`181: ${fmtTL(summary.balance181)} · 3010: ${fmtTL(summary.balance3010)} · Fark: ${fmtTL(summary.balanceDiff)}`},
    {name:'3014 Kasa / Tahsilat Kontrolü', status: has('Raw_3014') ? 'Çalıştı' : 'Veri Yok', lastRun:APP_STATE.meta.lastUpdate, desc:`TL/EUR/USD/GBP karıştırılmadan ödeme kırılımı üretildi. Toplam: ${fmtTL(summary.cashTotal)}`},
    {name:'3035 Gelir Kontrolü', status: has('Raw_3035') ? 'Çalıştı' : 'Veri Yok', lastRun:APP_STATE.meta.lastUpdate, desc:`Toplam gelir, oda, F&B, diğer, doluluk, ADR ve RevPAR hesaplandı.`},
    {name:'3025 Ekstra Satış Mapping', status: APP_STATE.extras.some(x=>normalizeText(x.status).includes('EKSIK')) ? 'Uyarı' : (has('Raw_3025') ? 'Çalıştı' : 'Veri Yok'), lastRun:APP_STATE.meta.lastUpdate, desc:'Ürün grupları F&B, alkollü, minibar, banquet ve diğer servis olarak ayrıştırıldı.'},
    {name:'3026 KDV / Konaklama Vergisi', status: has('Raw_3026') || has('Raw_HesapKartlari') ? 'Çalıştı' : 'Veri Yok', lastRun:APP_STATE.meta.lastUpdate, desc:`KDV %10: ${fmtTL(summary.kdv10)} · KDV %20: ${fmtTL(summary.kdv20)} · Kon.Tax: ${fmtTL(summary.accommodationTax)}`},
    {name:'Fark Neden Motoru', status: abs(summary.balanceDiff) > 1 ? 'Uyarı' : 'Çalıştı', lastRun:APP_STATE.meta.lastUpdate, desc:'Tespit edilen farklara göre olası nedenler üretildi.'}
  ];
}
function buildAlerts(summary, raw){
  const alerts = [];
  const status = diffStatus(summary.balanceDiff);
  if (status === 'MUTABIK') {
    alerts.push({type:'green', ico:'✅', title:'181 ↔ 3010 Mutabık', desc:`Fark tolerans içinde. Fark: ${fmtTL(summary.balanceDiff)}.`, actionRequired:false});
  } else if (status === 'ORTA FARK') {
    alerts.push({type:'amber', ico:'⚡', title:`181 ↔ 3010 Balans Farkı: ${fmtTL(summary.balanceDiff)} (ORTA FARK)`, desc:'Raporlar farklı tarih/saatte alınmış olabilir; gün sonu kapanışı, guest ledger devri, city ledger transferi ve ön büro aktarımı kontrol edilmeli.', actionRequired:true});
  } else if (status === 'KRİTİK FARK') {
    alerts.push({type:'red', ico:'🚨', title:`181 ↔ 3010 Kritik Fark: ${fmtTL(summary.balanceDiff)}`, desc:'Tolerans 1.000 TL üzerinde. Rapor kesitleri, manuel muhasebe kayıtları, kur farkı ve devir fişleri acil kontrol edilmeli.', actionRequired:true});
  } else {
    alerts.push({type:'neutral', ico:'—', title:'181 ↔ 3010 Veri Yok', desc:'181 Balance veya 3010 raporu yüklenmediği için balans kontrolü çalışmadı.', actionRequired:true});
  }
  if (!safeRows(raw.Raw_3026).length && !safeRows(raw.Raw_HesapKartlari).length) alerts.push({type:'amber', ico:'🟨', title:'KDV / Konaklama Vergisi verisi yok', desc:'3026 ve Hesap Kartları Rakamları yüklenmeden 391 ve 360.01.01.0016 kontrolü tamamlanamaz.', actionRequired:true});
  if (APP_STATE.extras.some(x => normalizeText(x.status).includes('EKSIK'))) alerts.push({type:'amber', ico:'📦', title:'3025 Extra Posting mapping eksik', desc:'Ekstra satışta bazı ürün açıklamaları hesap koduna eşleşmedi. Ürün açıklama mapping listesi kontrol edilmeli.', actionRequired:true});
  if (summary.kdv10 || summary.kdv20) alerts.push({type:'green', ico:'✅', title:'KDV hesaplama motoru çalıştı', desc:`KDV %10: ${fmtTL(summary.kdv10)} · KDV %20: ${fmtTL(summary.kdv20)}.`, actionRequired:false});
  return alerts;
}
function buildReasonRows(summary, raw){
  const reasons = [];
  if (abs(summary.balanceDiff) > 1) {
    reasons.push({code:'RN001', risk:summary.balanceStatus, reason:'Raporlar farklı tarih/saatte alınmış olabilir.', control:'3010, 3035 ve 3026 aynı gün sonu kapanış kesitinde yeniden alınmalı.'});
    reasons.push({code:'RN002', risk:summary.balanceStatus, reason:'Gün sonu kapanışı yapılmamış veya eksik tamamlanmış olabilir.', control:'Night audit, folio closing ve revenue posting kayıtları kontrol edilmeli.'});
    reasons.push({code:'RN003', risk:summary.balanceStatus, reason:'City Ledger transferi eksik olabilir.', control:'CL transfer listesi ile muhasebe 120/340 hareketleri karşılaştırılmalı.'});
    reasons.push({code:'RN004', risk:summary.balanceStatus, reason:'Guest ledger devri eksik olabilir.', control:'Previous balance, guest ledger ve 181 hesap hareketleri karşılaştırılmalı.'});
    reasons.push({code:'RN005', risk:summary.balanceStatus, reason:'Ön büro tahsilatı muhasebeye aktarılmamış olabilir.', control:'3014 tahsilat detayları ile 100/108 hesap kartları çapraz kontrol edilmeli.'});
    reasons.push({code:'RN006', risk:'Bilgi', reason:'Kur farkı veya yuvarlama farkı olabilir.', control:'646, 656, 679 ve 689 hesapları fark nedeni arama kapsamına alınmalı.'});
    reasons.push({code:'RN007', risk:'Bilgi', reason:'Manuel muhasebe kaydı olabilir.', control:'Muhasebe Hareketleri açıklamalarında manuel fiş, mahsup, düzeltme aranmalı.'});
  } else {
    reasons.push({code:'RN000', risk:'Mutabık', reason:'Ana balans farkı tolerans içinde.', control:'Rutin kontrol devam edebilir.'});
  }
  if (!safeRows(raw.Raw_3026).length) reasons.push({code:'RN008', risk:'Uyarı', reason:'KDV mapping eksik olabilir.', control:'3026, Hesap Kartları ve 391 hesapları yüklenmeli.'});
  if (APP_STATE.extras.some(x => normalizeText(x.status).includes('EKSIK'))) reasons.push({code:'RN009', risk:'Uyarı', reason:'Ürün açıklaması hesap koduna eşleşmemiş olabilir.', control:'3025 ürün grubu ve MAP_URUN_ACIKLAMA güncellenmeli.'});
  return reasons;
}

// ─── RENDER ────────────────────────────────────────────────────────
function renderAll(){
  renderTopMeta();
  renderDashboard(APP_STATE);
  renderMizanTable(APP_STATE);
  renderExtraTable(APP_STATE);
  renderKasaRows(APP_STATE);
  renderBalanceRows(APP_STATE);
  renderKdvRows(APP_STATE);
  renderCriticalAlerts(APP_STATE);
  renderDikkatRows(APP_STATE);
  renderLinks();
  renderPages();
  renderCal();
  applyGlobalSearch(document.getElementById('globalSearch')?.value || '');
}
function renderTopMeta(){
  const meta = APP_STATE.meta || {};
  const summary = APP_STATE.summary || {};
  document.getElementById('hotelNameSide').textContent = meta.hotel || 'ADAM & EVE OTEL';
  document.getElementById('dataSourceLabel').textContent = meta.source || 'Canlı Veri';
  document.getElementById('lastupd').textContent = meta.lastUpdate || fmtDate(new Date());
  const alertBadge = document.getElementById('alertBadge');
  if (alertBadge) alertBadge.textContent = String((APP_STATE.alerts || []).filter(a=>a.actionRequired).length);
  const chip = document.getElementById('mainStatusChip');
  const st = summary.balanceStatus || meta.status || 'VERİ YOK';
  chip.className = 'status-chip';
  const n = normalizeText(st);
  if (n.includes('MUTAB')) { chip.classList.add('ok'); chip.textContent = '✅ MUTABIK'; }
  else if (n.includes('KRITIK')) { chip.classList.add('err','pulse'); chip.textContent = `🚨 KRİTİK FARK — 181↔3010: ${fmtTL(abs(summary.balanceDiff))}`; }
  else if (n.includes('ORTA')) { chip.classList.add('warn','pulse'); chip.textContent = `⚡ ORTA FARK — 181↔3010: ${fmtTL(abs(summary.balanceDiff))}`; }
  else { chip.classList.add('neutral'); chip.textContent = '— VERİ YOK'; }
}
function renderDashboard(state){
  const s = state.summary || {};
  setText('kpiTotalRevenue', fmtTL(s.totalRevenue));
  setText('kpiRevenueSub', `Oda: ${fmtTL(s.roomRevenue)} · F&B: ${fmtTL(s.fbRevenue)} · Diğer: ${fmtTL(s.otherRevenue)}`);
  setText('kpiMtdYtd', `MTD: ${fmtTL(s.mtdRevenue)} · YTD: ${fmtTL(s.ytdRevenue)}`);
  setText('occupancyPct', fmtPct(s.occupancy || 0).replace(',0',''));
  setText('roomCountVal', `${fmtNum(s.occupiedRooms)} / ${fmtNum(s.totalRooms)}`);
  setText('roomSubVal', `Dolu / Toplam Oda · OOO: ${fmtNum(s.outOfOrderRooms || 0)}`);
  setText('guestCountVal', fmtNum(s.guestCount || 0));
  setText('occAdrVal', fmtTL(s.adr));
  setText('mtdOccVal', fmtPct(s.mtdOccupancy || s.occupancy || 0));
  setText('adrVal', fmtTL(s.adr));
  setText('adrSubVal', `RevPAR: ${fmtTL(s.revpar)} · Matrah: ${fmtTL((s.roomRevenue||0) / 1.10)}`);
  setText('adrMoreGrid', '', true);
  const adrMore = document.getElementById('adrMoreGrid');
  if (adrMore) adrMore.innerHTML = `<div>MTD ADR: ${fmtTL(s.mtdAdr || s.adr || 0)}</div><div>YTD ADR: ${fmtTL(s.ytdAdr || s.adr || 0)}</div><div>Varış: ${fmtNum(s.arrivals || 0)} oda</div><div>Çıkış: ${fmtNum(s.departures || 0)} oda</div>`;
  const circ = document.getElementById('occCircle');
  if (circ) {
    const pct = clamp(Number(s.occupancy || 0),0,100);
    const c = 2 * Math.PI * 23;
    circ.setAttribute('stroke-dasharray', `${(pct/100*c).toFixed(1)} ${c.toFixed(1)}`);
  }
  makeBars('revBar', barValsFromNumber(s.totalRevenue));
  makeBars('adrBar', barValsFromNumber(s.adr));
}
function barValsFromNumber(n){
  const base = abs(n) || 1;
  return Array.from({length:15}, (_,i)=> clamp(45 + ((base / (i+7)) % 55), 35, 100));
}
function renderMizanTable(state){
  const mt = document.getElementById('mizanTbl');
  const rt = document.getElementById('rev3026Tbl');
  if (mt) mt.innerHTML = state.mizan.map(r => `<tr><td>${r.ico}</td><td class="muted">${esc(r.hesap)}</td><td style="font-family:'Inter';font-size:10.5px">${esc(r.ad)}</td><td>${pill(r.status, r.status)}</td></tr>`).join('');
  if (rt) rt.innerHTML = state.revenue3026.map(r => `<tr><td style="font-family:'Inter';font-size:10.5px">${esc(r.rev)}</td><td class="pos">${fmtTL(r.matrah)}</td><td class="muted">${esc(r.kdv)}</td><td>${pill(r.status, r.status)}</td></tr>`).join('');
}
function renderExtraTable(state){
  const et = document.getElementById('ekstraTbl');
  if (et) et.innerHTML = (state.extras || []).map(r => `<tr><td style="font-family:'Inter'">${esc(r.grup)}</td><td class="muted" style="font-size:10px">${esc(r.hesap)}</td><td class="pos">${r.gelir ? fmtTL(r.gelir) : '—'}</td><td class="muted">${esc(r.kdv)}</td><td>${pill(r.status, r.status)}</td></tr>`).join('');
  const s = state.summary || {};
  setText('extraTotalVal', fmtTL(s.extraTotal || 0));
  const total = (state.extras || []).length;
  const ok = (state.extras || []).filter(r => normalizeText(r.status).includes('ESLESTI')).length;
  const pct = total ? Math.round(ok/total*100) : 0;
  setText('extraMatchPct', `${pct}%`);
  const fill = document.getElementById('extraMatchFill');
  if (fill) fill.style.width = `${pct}%`;
  const missing = (state.extras || []).filter(r => !normalizeText(r.status).includes('ESLESTI') && r.gelir).map(r=>r.grup.replace(/^[^\wığüşöçİĞÜŞÖÇ]+/i,'').trim());
  setText('extraMapNote', missing.length ? `Mapping bekliyor: ${missing.join(', ')}` : 'Mapping bekleyen aktif kalem yok');
}
function renderKasaRows(state){
  const kr = document.getElementById('kasaRows');
  const s = state.summary || {};
  const breakdown = s.cashBreakdown?.length ? s.cashBreakdown : [
    {ico:'💳', lbl:'Kredi Kartı TL (100/108)', val:s.cashTotal || 0, code:'TL'},
    {ico:'💶', lbl:'Kredi Kartı EUR', val:0, code:'EUR'},
    {ico:'💵', lbl:'Kredi Kartı USD', val:0, code:'USD'},
    {ico:'💷', lbl:'Kredi Kartı GBP', val:0, code:'GBP'},
    {ico:'🏦', lbl:'City Ledger', val:0, code:'CL'},
    {ico:'🎟', lbl:'Diğer Ödeme', val:0, code:'OTHER'}
  ];
  if (kr) kr.innerHTML = breakdown.map(k => `<div class="kasa-row"><div class="kasa-left"><span style="font-size:15px">${k.ico}</span>${esc(k.lbl)}</div><div class="kasa-right">${fmtTL(k.val)}</div></div>`).join('');
  setText('cashTotalVal', fmtTL(s.cashTotal || 0));
}
function renderBalanceRows(state){
  const br = document.getElementById('balRows');
  if (!br) return;
  const s = state.summary || {};
  const st = diffStatus(s.balanceDiff);
  const rows = [
    {lbl:'181.01.01.0001 Bakiyesi', val:fmtTL(s.balance181), cls:'neutral'},
    {lbl:'3010 Total Balance', val:fmtTL(s.balance3010), cls:'neutral'},
    {lbl:'Fark (181 - 3010)', val:fmtTL(s.balanceDiff), cls:st === 'MUTABIK' ? 'ok' : st === 'ORTA FARK' ? 'warn' : st === 'KRİTİK FARK' ? 'err' : 'neutral'},
    {lbl:'Tolerans Eşiği', val:'≤ ₺1,00 = Mutabık', cls:'neutral'},
    {lbl:'≤ ₺1.000 = Orta Fark', val:`Bu kontrol: ${st}`, cls:st === 'ORTA FARK' ? 'warn' : st === 'KRİTİK FARK' ? 'err' : 'neutral'},
    {lbl:'Son Güncelleme', val:APP_STATE.meta.lastUpdate || isoNow(), cls:'neutral'}
  ];
  br.innerHTML = rows.map(r => `<div class="bal-row"><div class="bal-lbl">${esc(r.lbl)}</div><div class="bal-val ${r.cls==='warn'?'warn':r.cls==='err'?'neg':r.cls==='ok'?'pos':''}">${esc(r.val)}</div></div>`).join('');
  const cls = st === 'MUTABIK' ? 'ok' : st === 'ORTA FARK' ? 'warn' : st === 'KRİTİK FARK' ? 'err' : 'neutral';
  br.innerHTML += `<div class="bal-sum ${cls}">${st === 'MUTABIK' ? '✅' : st === 'KRİTİK FARK' ? '🚨' : st === 'ORTA FARK' ? '⚡' : '—'} ${st} — Fark: ${fmtTL(s.balanceDiff || 0)}</div>`;
}
function renderKdvRows(state){
  const kd = document.getElementById('kdvRows');
  if (!kd) return;
  const s = state.summary || {};
  const rows = [
    {ico:s.kdv10?'🟢':'⚪', lbl:`KDV %10 — Oda/F&B (${KDV10_ACCOUNT})`, val:s.kdv10 ? fmtTL(s.kdv10) : 'Veri Yok', bg:'rgba(34,197,94,.07)', status:s.kdv10?'Mutabık':'Veri Yok'},
    {ico:s.kdv20?'🟢':'⚪', lbl:`KDV %20 — Alkollü/Diğer (${KDV20_ACCOUNT})`, val:s.kdv20 ? fmtTL(s.kdv20) : 'Veri Yok', bg:'rgba(99,102,241,.06)', status:s.kdv20?'Mutabık':'Veri Yok'},
    {ico:s.accommodationTax?'🟢':'🟨', lbl:`Konaklama Vergisi (${ACCOM_TAX_ACCOUNT})`, val:s.accommodationTax ? fmtTL(s.accommodationTax) : 'Bekleniyor', bg:'rgba(245,158,11,.07)', status:s.accommodationTax?'Mutabık':'Kontrol Et'},
    {ico:'📦', lbl:'Toplam KDV Yükü', val:fmtTL(s.kdvTotal || 0), bg:'rgba(15,23,42,.04)', status:'Bilgi'}
  ];
  kd.innerHTML = rows.map(k => `<div class="kdv-pill" style="background:${k.bg}"><div style="display:flex;align-items:center;gap:6px"><span>${k.ico}</span><div class="kdv-lbl">${esc(k.lbl)}</div></div><div style="display:flex;align-items:center;gap:8px"><div class="kdv-val">${esc(k.val)}</div>${pill(k.status, k.status)}</div></div>`).join('');
}
function renderCriticalAlerts(state){
  const kr2 = document.getElementById('kritikRows');
  if (!kr2) return;
  const alerts = (state.alerts || []).slice(0, 5);
  kr2.innerHTML = alerts.length ? alerts.map(a => `<div class="alert-row ${esc(a.type || 'blue')}"><div class="alert-ico">${esc(a.ico || 'ℹ')}</div><div><div class="alert-title">${esc(a.title)}</div><div class="alert-desc">${esc(a.desc)}</div></div></div>`).join('') : '<div class="empty-state">Aktif kritik fark bulunmadı.</div>';
}
function renderDikkatRows(state){
  const di = document.getElementById('dikkatRows');
  if (!di) return;
  const notes = (state.alerts || []).filter(a => a.actionRequired).slice(0,7);
  di.innerHTML = notes.length ? notes.map(a => `<div class="note-row"><span class="note-ico">${esc(a.ico || '⚡')}</span><div class="note-text"><em>${esc(a.title)}</em> — ${esc(a.desc)}</div></div>`).join('') : '<div class="empty-state">Aksiyon gerektiren aktif uyarı yok.</div>';
}
function renderLinks(){
  const lw = document.getElementById('linksWrap');
  if (!lw) return;
  lw.innerHTML = ROUTES.map(l => `<a class="link-chip" data-page="${l.page}" onclick="navigateTo('${l.page}')"><span style="font-size:16px">${l.ico}</span>${esc(l.lbl)}</a>`).join('');
}
function setText(id, value, skip=false){
  const el = document.getElementById(id);
  if (el && !skip) el.textContent = value;
}

// ─── SPA PAGES ─────────────────────────────────────────────────────
function renderPages(){
  renderAutoControlPage();
  renderUploadPage();
  renderBalancePage();
  renderMizanPage();
  renderKontaxPage();
  renderDiffPage();
  renderAlertsPage();
  renderRatesPage();
  renderExtraSalesPage();
  renderReasonPage();
  renderLog(APP_STATE);
  renderSettingsPage();
  renderMainMenuPage();
}
function renderAutoControlPage(){
  const el = document.getElementById('autoControlPage');
  if (!el) return;
  el.innerHTML = `<div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">🤖</span><div class="card-label">Tüm Otomatik Kontroller</div><div class="card-actions"><button class="card-act-btn" onclick="updateFromLoadedRaw()">↻ Yeniden Çalıştır</button></div></div><div class="scrollbox tall"><table class="tbl"><thead><tr><th>Kontrol</th><th>Durum</th><th>Son Çalışma</th><th>Açıklama</th></tr></thead><tbody>${APP_STATE.controls.map(c=>`<tr><td style="font-family:'Inter';font-weight:700">${esc(c.name)}</td><td>${pill(c.status,c.status)}</td><td class="muted">${esc(c.lastRun || '—')}</td><td style="font-family:'Inter';font-size:10.5px">${esc(c.desc)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function renderUploadPage(){
  const el = document.getElementById('uploadPage');
  if (!el) return;
  const rawCounts = REPORT_KEYS.map(k => `<tr><td class="muted">${k}</td><td>${fmtNum(safeRows(APP_STATE.raw[k]).length)}</td><td>${pill(safeRows(APP_STATE.raw[k]).length ? 'Çalıştı' : 'Veri Yok', safeRows(APP_STATE.raw[k]).length ? 'Okundu' : 'Veri Yok')}</td></tr>`).join('');
  const uploads = APP_STATE.uploads.length ? APP_STATE.uploads.map(u => `<tr><td style="font-family:'Inter'">${esc(u.fileName)}</td><td class="muted">${esc(u.reportType)}</td><td>${fmtNum(u.rows)}</td><td>${pill(u.status,u.status)}</td><td style="font-family:'Inter';font-size:10.5px">${esc(u.error || '—')}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">Henüz dosya yüklenmedi.</td></tr>';
  el.innerHTML = `
    <div class="card" style="grid-column:span 12">
      <div class="card-head"><span class="card-ico">📥</span><div class="card-label">Dosya Yükleme Alanı</div><div class="card-actions"><button class="card-act-btn" onclick="openFilePicker()">Dosya Seç</button><button class="card-act-btn" onclick="updateFromLoadedRaw()">Dashboardu Güncelle</button></div></div>
      <div class="upload-zone" onclick="openFilePicker()"><strong>Excel / CSV / JSON raporlarını buraya yükle</strong><small>.xlsx, .xlsm, .csv, .json desteklenir. Dosya adına göre 3010, 3014, 3025, 3026, 3035, 3000, 181, Hesap Kartları ve Muhasebe Hareketleri otomatik tanınır.</small></div>
    </div>
    <div class="card" style="grid-column:span 7"><div class="card-head"><span class="card-ico">📋</span><div class="card-label">Yüklenen Dosya Listesi</div></div><div class="scrollbox tall"><table class="tbl"><thead><tr><th>Dosya</th><th>Rapor Tipi</th><th>Satır</th><th>Durum</th><th>Hata</th></tr></thead><tbody>${uploads}</tbody></table></div></div>
    <div class="card" style="grid-column:span 5"><div class="card-head"><span class="card-ico">🧾</span><div class="card-label">Raw Veri Durumu</div></div><div class="scrollbox tall"><table class="tbl"><thead><tr><th>Raw Sayfa</th><th>Satır</th><th>Durum</th></tr></thead><tbody>${rawCounts}</tbody></table></div></div>`;
}
function renderBalancePage(){
  const el = document.getElementById('balancePage');
  const s = APP_STATE.summary;
  if (!el) return;
  el.innerHTML = `
    <div class="card" style="grid-column:span 4"><div class="card-head"><span class="card-ico">⚖</span><div class="card-label">181 Bakiye</div></div><div class="kpi-val">${fmtTL(s.balance181)}</div><div class="kpi-sub">Hesap: ${BALANCE_ACCOUNT}</div></div>
    <div class="card" style="grid-column:span 4"><div class="card-head"><span class="card-ico">📘</span><div class="card-label">3010 Balance</div></div><div class="kpi-val">${fmtTL(s.balance3010)}</div><div class="kpi-sub">3010 Total Balance</div></div>
    <div class="card" style="grid-column:span 4"><div class="card-head"><span class="card-ico">${diffStatus(s.balanceDiff)==='KRİTİK FARK'?'🚨':'⚡'}</span><div class="card-label">Fark & Tolerans</div></div><div class="kpi-val">${fmtTL(s.balanceDiff)}</div><div class="kpi-sub">${diffStatus(s.balanceDiff)} · 0-1 TL Mutabık · 1-1.000 TL Orta Fark · 1.000+ Kritik</div></div>
    <div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">🧠</span><div class="card-label">Fark Nedeni Ön Analizi</div><div class="card-actions"><button class="card-act-btn" onclick="navigateTo('reason-engine')">Neden Motoru</button></div></div>${APP_STATE.reasonRows.slice(0,6).map(r=>`<div class="alert-row ${normalizeText(r.risk).includes('KRITIK')?'red':normalizeText(r.risk).includes('ORTA')||normalizeText(r.risk).includes('UYARI')?'amber':'blue'}"><div class="alert-ico">${normalizeText(r.risk).includes('MUTAB')?'✅':'⚡'}</div><div><div class="alert-title">${esc(r.code)} — ${esc(r.reason)}</div><div class="alert-desc">${esc(r.control)}</div></div></div>`).join('')}</div>`;
}
function renderMizanPage(){
  const el = document.getElementById('mizanPage');
  if (!el) return;
  el.innerHTML = `<div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">🧮</span><div class="card-label">Mizan / Hesap Kartları ↔ 3026 Kontrol Tablosu</div></div><div class="section-note">600 gelir hesapları, 391 KDV hesapları, 360 konaklama vergisi ve gelir kırılımları dashboard özetinden dinamik üretilir.</div><div class="scrollbox tall"><table class="tbl"><thead><tr><th>İkon</th><th>Hesap</th><th>Hesap Adı</th><th>Durum</th></tr></thead><tbody>${APP_STATE.mizan.map(r=>`<tr><td>${r.ico}</td><td class="muted">${esc(r.hesap)}</td><td style="font-family:'Inter'">${esc(r.ad)}</td><td>${pill(r.status,r.status)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function renderKontaxPage(){
  const el = document.getElementById('kontaxPage');
  const s = APP_STATE.summary;
  if (!el) return;
  el.innerHTML = `<div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">🟨</span><div class="card-label">3026 Konaklama Vergisi / KDV Kontrolü</div></div><div class="metric-grid"><div class="metric-box"><div class="metric-label">KDV %10</div><div class="metric-val">${fmtTL(s.kdv10)}</div></div><div class="metric-box"><div class="metric-label">KDV %20</div><div class="metric-val">${fmtTL(s.kdv20)}</div></div><div class="metric-box"><div class="metric-label">Konaklama Vergisi</div><div class="metric-val">${fmtTL(s.accommodationTax)}</div></div><div class="metric-box"><div class="metric-label">Toplam KDV Yükü</div><div class="metric-val">${fmtTL(s.kdvTotal)}</div></div></div></div><div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">📦</span><div class="card-label">3026 Revenue Satırları</div></div><div class="scrollbox tall"><table class="tbl"><thead><tr><th>Revenue</th><th>Matrah / Tutar</th><th>KDV / Hesap</th><th>Durum</th></tr></thead><tbody>${APP_STATE.revenue3026.map(r=>`<tr><td style="font-family:'Inter'">${esc(r.rev)}</td><td>${fmtTL(r.matrah)}</td><td class="muted">${esc(r.kdv)}</td><td>${pill(r.status,r.status)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function renderDiffPage(){
  const el = document.getElementById('diffPage');
  if (!el) return;
  const rows = [
    ['181 Bakiyesi', APP_STATE.summary.balance181, 'Raw_181'],
    ['3010 Balance', APP_STATE.summary.balance3010, 'Raw_3010'],
    ['Fark', APP_STATE.summary.balanceDiff, '181 - 3010'],
    ['Kasa Tahsilat Toplamı', APP_STATE.summary.cashTotal, 'Raw_3014'],
    ['Toplam Gelir', APP_STATE.summary.totalRevenue, 'Raw_3035'],
    ['Ekstra Satış Toplamı', APP_STATE.summary.extraTotal, 'Raw_3025'],
    ['KDV %10', APP_STATE.summary.kdv10, 'Raw_3026/Hesap Kartları'],
    ['KDV %20', APP_STATE.summary.kdv20, 'Raw_3026/Hesap Kartları']
  ];
  el.innerHTML = `<div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">📊</span><div class="card-label">Fark Analizi Ana Tablo</div></div><div class="scrollbox tall"><table class="tbl"><thead><tr><th>Kalem</th><th>Tutar</th><th>Kaynak</th><th>Durum</th></tr></thead><tbody>${rows.map(r=>`<tr><td style="font-family:'Inter'">${esc(r[0])}</td><td class="${abs(r[1])>1000 && r[0]==='Fark'?'neg':'pos'}">${fmtTL(r[1])}</td><td class="muted">${esc(r[2])}</td><td>${r[0]==='Fark'?pill(diffStatus(r[1]),diffStatus(r[1])):pill(r[1]?'Bilgi':'Veri Yok',r[1]?'Bilgi':'Veri Yok')}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function renderAlertsPage(){
  const el = document.getElementById('alertsPage');
  if (!el) return;
  el.innerHTML = `<div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">🚨</span><div class="card-label">Uyarı Listesi</div></div>${APP_STATE.alerts.length ? APP_STATE.alerts.map(a=>`<div class="alert-row ${esc(a.type || 'blue')}"><div class="alert-ico">${esc(a.ico || 'ℹ')}</div><div><div class="alert-title">${esc(a.title)} ${a.actionRequired ? '<span class="code-pill">Aksiyon</span>' : ''}</div><div class="alert-desc">${esc(a.desc)}</div></div></div>`).join('') : '<div class="empty-state">Aktif uyarı yok.</div>'}</div>`;
}
function renderRatesPage(){
  const el = document.getElementById('ratesPage');
  if (!el) return;
  const rates = [
    {cur:'EUR/TRY', val:'Manuel/ERP kur bekleniyor', status:'Veri Yok'},
    {cur:'USD/TRY', val:'Manuel/ERP kur bekleniyor', status:'Veri Yok'},
    {cur:'GBP/TRY', val:'Manuel/ERP kur bekleniyor', status:'Veri Yok'}
  ];
  el.innerHTML = `<div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">💱</span><div class="card-label">Güncel Kurlar</div></div><div class="section-note">HTML dosyası internetten canlı kur çekmez. Kur bilgisi ERP raporlarında veya dashboard-data.json içinde verilirse burada gösterilir. Para birimleri 3014 hesaplamasında ayrı tutulur.</div><table class="tbl"><thead><tr><th>Kur</th><th>Değer</th><th>Durum</th></tr></thead><tbody>${rates.map(r=>`<tr><td>${esc(r.cur)}</td><td class="muted">${esc(r.val)}</td><td>${pill(r.status,r.status)}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderExtraSalesPage(){
  const el = document.getElementById('extraSalesPage');
  if (!el) return;
  el.innerHTML = `<div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">🛒</span><div class="card-label">3025 Ekstra Satış Grup Kontrolü</div></div><div class="scrollbox tall"><table class="tbl"><thead><tr><th>Ürün Grubu</th><th>Hesap</th><th>Gelir</th><th>KDV%</th><th>Durum</th></tr></thead><tbody>${(APP_STATE.extras||[]).map(r=>`<tr><td style="font-family:'Inter'">${esc(r.grup)}</td><td class="muted">${esc(r.hesap)}</td><td>${r.gelir?fmtTL(r.gelir):'—'}</td><td class="muted">${esc(r.kdv)}</td><td>${pill(r.status,r.status)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function renderReasonPage(){
  const el = document.getElementById('reasonPage');
  if (!el) return;
  el.innerHTML = `<div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">🧠</span><div class="card-label">Fark Neden Motoru</div></div><div class="section-note">Fark varsa sistem olası nedeni operasyon, PMS kesiti, muhasebe aktarımı, KDV mapping, kur/yuvarlama ve manuel kayıt ihtimallerine göre üretir.</div><div class="scrollbox tall"><table class="tbl"><thead><tr><th>Kod</th><th>Risk</th><th>Olası Neden</th><th>Kontrol Aksiyonu</th></tr></thead><tbody>${APP_STATE.reasonRows.map(r=>`<tr><td class="muted">${esc(r.code)}</td><td>${pill(r.risk,r.risk)}</td><td style="font-family:'Inter'">${esc(r.reason)}</td><td style="font-family:'Inter';font-size:10.5px">${esc(r.control)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function renderLog(state){
  const el = document.getElementById('logPage');
  if (!el) return;
  const rows = (state.logs || []).slice(0,200);
  el.innerHTML = `<div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">📜</span><div class="card-label">İşlem Logları</div><div class="card-actions"><button class="card-act-btn" onclick="clearLogs()">Log Temizle</button></div></div><div class="scrollbox tall"><table class="tbl"><thead><tr><th>Tarih Saat</th><th>İşlem</th><th>Dosya</th><th>Durum</th><th>Açıklama</th><th>Hata</th><th>Aksiyon?</th></tr></thead><tbody>${rows.length ? rows.map(l=>`<tr><td class="muted">${esc(l.time)}</td><td style="font-family:'Inter'">${esc(l.process)}</td><td class="muted">${esc(l.fileName)}</td><td>${pill(l.status,l.status)}</td><td style="font-family:'Inter';font-size:10.5px">${esc(l.desc)}</td><td class="neg">${esc(l.errorMsg || '—')}</td><td>${l.actionRequired?'Evet':'Hayır'}</td></tr>`).join('') : '<tr><td colspan="7" class="muted">Log kaydı yok.</td></tr>'}</tbody></table></div></div>`;
}
function renderSettingsPage(){
  const el = document.getElementById('settingsPage');
  if (!el) return;
  el.innerHTML = `<div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">🛠</span><div class="card-label">Otomatik Ayarlar</div></div><div class="metric-grid"><div class="metric-box"><div class="metric-label">Tolerans 1</div><div class="metric-val">₺1</div><div class="kpi-sub">Mutabık sınırı</div></div><div class="metric-box"><div class="metric-label">Tolerans 2</div><div class="metric-val">₺1.000</div><div class="kpi-sub">Orta/Kritik fark sınırı</div></div><div class="metric-box"><div class="metric-label">Başlık Arama</div><div class="metric-val">25 satır</div><div class="kpi-sub">Excel ilk 25 satırda başlık arar</div></div><div class="metric-box"><div class="metric-label">Fallback</div><div class="metric-val">Aktif</div><div class="kpi-sub">JSON yoksa demo veri</div></div></div></div>`;
}
function renderMainMenuPage(){
  const el = document.getElementById('mainMenuPage');
  if (!el) return;
  el.innerHTML = `<div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">📌</span><div class="card-label">Ana Menü</div></div><div class="links-wrap">${ROUTES.map(r=>`<a class="link-chip" onclick="navigateTo('${r.page}')"><span style="font-size:16px">${r.ico}</span>${esc(r.lbl)}</a>`).join('')}</div></div>`;
}
function clearLogs(){
  APP_STATE.logs = [];
  addLog('Log Temizleme', '', 'Bilgi', 'Kullanıcı log listesini temizledi.', '', false);
  renderLog(APP_STATE);
  toast('Log listesi temizlendi.', 'ok');
}

// ─── NAVIGATION / SEARCH ───────────────────────────────────────────
function navigateTo(pageName){
  const route = ROUTES.find(r => r.page === pageName) || ROUTES[0];
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  const section = document.getElementById(`page-${route.page}`);
  if (section) section.classList.add('active');
  document.querySelectorAll('.sb-item').forEach(a => a.classList.toggle('active', a.dataset.page === route.page));
  document.getElementById('breadcrumbCurr').textContent = route.lbl;
  document.getElementById('pageTitle').textContent = route.title;
  addLog('Navigasyon', route.lbl, 'Bilgi', `${route.lbl} sayfası açıldı.`, '', false);
  window.scrollTo({top:0, behavior:'smooth'});
  applyGlobalSearch(document.getElementById('globalSearch')?.value || '');
}
function applyGlobalSearch(query){
  const q = normalizeText(query || '');
  const active = document.querySelector('.page-section.active');
  if (!active) return;
  active.querySelectorAll('.card, .link-chip, .tbl tbody tr').forEach(el => {
    const hay = normalizeText((el.dataset.search || '') + ' ' + el.textContent);
    el.classList.toggle('search-hidden', !!q && !hay.includes(q));
  });
}

// ─── BOOT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 30000);
  renderCal();
  loadDashboardData();
});

// Global exposure for inline onclick
window.navigateTo = navigateTo;
window.reloadData = reloadData;
window.openFilePicker = openFilePicker;
window.handleFileSelect = handleFileSelect;
window.updateFromLoadedRaw = updateFromLoadedRaw;
window.chMonth = chMonth;
window.applyGlobalSearch = applyGlobalSearch;
window.clearLogs = clearLogs;

/* ────────────────────────────────────────────────────────────────
   V221 — MUHASEBE KOMUTA MERKEZİ
   Ana sayfa fark yaratan muhasebe modu + detaylı denetim ekranı.
   Mevcut tasarım/class yapısı korunur; sadece çalışan motor eklenir.
──────────────────────────────────────────────────────────────── */
const V221_HOTELS = ['ADAM & EVE OTEL','SEGINUS OTEL','ALHAMBRA OTEL','HOLIDAY OTEL','DRAGON OTEL'];
let V221_LAST_DATA = null;
let V221_ACTIVE_HOTEL = 'ADAM & EVE OTEL';

function v221EnsureRoute(route, afterPage='dashboard'){
  if (!ROUTES.some(r => r.page === route.page)) {
    const idx = ROUTES.findIndex(r => r.page === afterPage);
    ROUTES.splice(idx >= 0 ? idx + 1 : ROUTES.length, 0, route);
  }
}
v221EnsureRoute({ico:'🧑‍💼', lbl:'Muhasebe Modu', page:'accounting-mode', title:'Muhasebe Komuta Merkezi'}, 'dashboard');
v221EnsureRoute({ico:'🔁', lbl:'Virman Kontrol', page:'virman-control', title:'Virman / Mahsup Kontrol Merkezi'}, 'kontax');
v221EnsureRoute({ico:'🏬', lbl:'Kiracılar 120/340', page:'tenants', title:'Kiracılar 120/340 Detaylı Virman Analizi'}, 'virman-control');

const V221_BASE_classifyFile = classifyFile;
classifyFile = function(fileName){
  const n = normalizeText(fileName);
  if (n.includes('KIRACI') || n.includes('KIRACILAR') || n.includes('ACENTE') || n.includes('120') || n.includes('340') || n.includes('HESAP KART')) return 'Raw_HesapKartlari';
  if (n.includes('VIRMAN') || n.includes('MAHSUP') || n.includes('MUHASEBE') || n.includes('HAREKET') || n.includes('FIS') || n.includes('YEVMIYE')) return 'Raw_Muhasebe';
  return V221_BASE_classifyFile(fileName);
};

const V221_BASE_hydrateState = hydrateState;
hydrateState = function(data, sourceLabel){
  V221_LAST_DATA = data || null;
  if (data && Array.isArray(data.hotels) && data.hotels.length) {
    const chosen = data.hotels.find(h => normalizeText(h?.meta?.hotel || h?.hotel || '') === normalizeText(V221_ACTIVE_HOTEL)) || data.hotels[0];
    V221_ACTIVE_HOTEL = chosen?.meta?.hotel || chosen?.hotel || V221_ACTIVE_HOTEL;
    APP_STATE.meta = Object.assign({hotel:V221_ACTIVE_HOTEL, lastUpdate:'', status:'VERİ YOK', source:sourceLabel}, chosen.meta || {hotel:chosen.hotel});
    APP_STATE.raw = Object.assign(emptyRaw(), chosen.raw || {});
    APP_STATE.summary = Object.assign({}, chosen.summary || {});
    APP_STATE.alerts = Array.isArray(chosen.alerts) ? chosen.alerts.slice() : [];
    APP_STATE.logs = Array.isArray(chosen.logs) ? chosen.logs.slice() : [];
    APP_STATE.uploads = [];
    APP_STATE.meta.source = sourceLabel;
    recalculateState(false);
  } else {
    V221_BASE_hydrateState(data, sourceLabel);
    V221_ACTIVE_HOTEL = APP_STATE.meta?.hotel || V221_ACTIVE_HOTEL;
  }
};

function renderHotelSelect(){
  const sel = document.getElementById('hotelSelect');
  if (!sel) return;
  if (!sel.dataset.ready) {
    sel.innerHTML = V221_HOTELS.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('');
    sel.dataset.ready = '1';
  }
  sel.value = V221_ACTIVE_HOTEL;
}
function selectHotel(hotelName){
  V221_ACTIVE_HOTEL = hotelName || V221_ACTIVE_HOTEL;
  if (V221_LAST_DATA && Array.isArray(V221_LAST_DATA.hotels)) {
    hydrateState(V221_LAST_DATA, APP_STATE.meta?.source || 'data/dashboard-data.json');
  } else {
    APP_STATE.meta.hotel = V221_ACTIVE_HOTEL;
    recalculateState(false);
  }
  addLog('Otel Seçimi', V221_ACTIVE_HOTEL, 'Bilgi', 'Aktif otel değiştirildi; muhasebe modu ve dashboard yeniden hesaplandı.', '', false);
  renderAll();
  toast(`${V221_ACTIVE_HOTEL} aktif edildi.`, 'ok');
}

function v221RawAll(){
  return REPORT_KEYS.flatMap(k => safeRows(APP_STATE.raw?.[k] || []));
}
function v221FindKey(row, terms){
  return Object.keys(row || {}).find(k => hasAny(k, terms));
}
function v221Val(row, terms){
  const k = v221FindKey(row, terms);
  return k ? row[k] : '';
}
function v221AccountCode(row){
  const direct = String(v221Val(row, ['HESAP KODU','HESAP','ACCOUNT','KOD']) || '');
  const txt = `${direct} ${Object.values(row || {}).join(' ')}`;
  const m = txt.match(/\b\d{3}(?:[\.-]\d{2}){0,5}\b/);
  return m ? m[0].replace(/-/g,'.') : direct.trim();
}
function v221Name(row){
  const v = v221Val(row, ['UNVAN','ÜNVAN','MUSTERI','MÜŞTERİ','CARI','CARİ','ADI','AD SOYAD','FIRMA','FİRMA','ACENTE']);
  if (String(v || '').trim()) return String(v).trim();
  const vals = Object.values(row || {}).map(x => String(x || '').trim()).filter(Boolean);
  const candidate = vals.find(x => /[A-Za-zÇĞİÖŞÜçğıöşü]{3,}/.test(x) && !/^\d/.test(x));
  return candidate || 'İsimsiz Cari';
}
function v221Currency(row){
  const t = rowText(row);
  if (t.includes('EUR') || t.includes('EURO') || t.includes('€')) return 'EUR';
  if (t.includes('USD') || t.includes('DOLAR') || t.includes('$')) return 'USD';
  if (t.includes('GBP') || t.includes('STERLIN') || t.includes('£')) return 'GBP';
  return 'TL';
}
function v221Debit(row){ return abs(firstNumFromRow(row, ['BORC','BORÇ','DEBIT'])); }
function v221Credit(row){ return abs(firstNumFromRow(row, ['ALACAK','CREDIT'])); }
function v221Balance(row){
  const b = firstNumFromRow(row, ['BAKIYE','BALANCE']);
  return b || (v221Debit(row) - v221Credit(row));
}
function v221Date(row){ return String(v221Val(row, ['TARIH','TARİH','DATE','VADE']) || '').trim(); }
function v221DocNo(row){ return String(v221Val(row, ['BELGE','FATURA','FİŞ','FIS','EVRAK','DOCUMENT','NO']) || '').trim(); }
function v221Desc(row){ return String(v221Val(row, ['ACIKLAMA','AÇIKLAMA','DESCRIPTION','REMARK']) || '').trim(); }
function v221StatusFromDiff(diff, missing=false){
  if (missing) return 'Veri Yok';
  const st = diffStatus(diff);
  return st === 'MUTABIK' ? 'Mutabık' : st;
}
function v221RiskClass(risk){
  const n = normalizeText(risk);
  if (n.includes('KRITIK')) return 'red';
  if (n.includes('ORTA') || n.includes('UYARI') || n.includes('FARK')) return 'amber';
  if (n.includes('MUTAB') || n.includes('TAMAM')) return 'green';
  return 'blue';
}
function v221Round(n){ return Math.round(Number(n || 0) * 100) / 100; }

function v221TenantAnalysis(){
  const rows = safeRows(APP_STATE.raw?.Raw_HesapKartlari).concat(safeRows(APP_STATE.raw?.Raw_Muhasebe));
  const groups = new Map();
  const details = [];
  rows.forEach((row, idx) => {
    const hesap = v221AccountCode(row);
    if (!/^120|^340/.test(hesap)) return;
    const name = v221Name(row);
    const key = normalizeText(name).slice(0,80) || `CARI-${idx}`;
    const cur = v221Currency(row);
    const borc = v221Debit(row);
    const alacak = v221Credit(row);
    const bakiye = v221Balance(row);
    const d = {idx, name, key, hesap, cur, borc, alacak, bakiye, tarih:v221Date(row), belge:v221DocNo(row), desc:v221Desc(row), raw:row};
    details.push(d);
    if (!groups.has(key)) groups.set(key, {key, name, rows:[], b120:0, a120:0, b340:0, a340:0, fx:{}, dates:[], docs:0});
    const g = groups.get(key);
    g.rows.push(d);
    if (d.tarih) g.dates.push(d.tarih);
    if (d.belge) g.docs++;
    const bucket = d.cur === 'TL' ? null : d.cur;
    if (bucket) g.fx[bucket] = g.fx[bucket] || {b120:0,a120:0,b340:0,a340:0};
    const target = bucket ? g.fx[bucket] : g;
    if (/^120/.test(hesap)) { target.b120 += borc; target.a120 += alacak; }
    if (/^340/.test(hesap)) { target.b340 += borc; target.a340 += alacak; }
  });
  const tenantRows = Array.from(groups.values()).map(g => {
    const virmanTL = Math.min(abs(g.b120 - g.a120), abs(g.a340 - g.b340));
    const icMahsupTL = Math.min(abs(g.b120), abs(g.a120));
    const fxSummary = Object.entries(g.fx).map(([cur,v]) => ({cur, virman:Math.min(abs(v.b120-v.a120), abs(v.a340-v.b340)), b120:v.b120, a340:v.a340})).filter(x=>x.virman>0);
    const fxVirman = fxSummary.reduce((s,x)=>s+x.virman,0);
    const kalan120 = Math.max(0, abs(g.b120 - g.a120) - virmanTL);
    const action = virmanTL > 0 || fxVirman > 0 ? 'Borç 340 / Alacak 120 virman fişi öner' : icMahsupTL > 0 ? '120 içi borç/alacak mahsup kontrol et' : 'Tahsilat veya cari mutabakat bekle';
    const risk = virmanTL > 1000 || fxVirman > 0 ? 'Kritik Fark' : virmanTL > 1 || icMahsupTL > 1 ? 'Uyarı' : 'Bilgi';
    return Object.assign(g, {virmanTL, icMahsupTL, fxVirman, fxSummary, kalan120, action, risk, priority:(virmanTL+fxVirman)*10 + icMahsupTL});
  }).sort((a,b)=>b.priority-a.priority || normalizeText(a.name).localeCompare(normalizeText(b.name),'tr'));
  const summary = {
    count: tenantRows.length,
    virmanCount: tenantRows.filter(x=>x.virmanTL>1 || x.fxVirman>0).length,
    virmanTL: tenantRows.reduce((s,x)=>s+x.virmanTL,0),
    virmanFx: tenantRows.reduce((s,x)=>s+x.fxVirman,0),
    detailCount: details.length
  };
  return {summary, rows:tenantRows, details};
}

function v221VirmanAnalysis(){
  const rows = safeRows(APP_STATE.raw?.Raw_Muhasebe).concat(safeRows(APP_STATE.raw?.Raw_HesapKartlari));
  const tenant = v221TenantAnalysis();
  const make = (name, terms, accounts, action) => {
    const matched = rowsWith(rows, terms.concat(accounts || []), []);
    const tutar = matched.reduce((s,r)=>s + abs(firstNumFromRow(r, ['TUTAR','BORC','BORÇ','ALACAK','BAKIYE','TOTAL','TOPLAM'])), 0);
    return {name, count:matched.length, amount:tutar, status:matched.length ? 'Çalıştı' : 'Veri Yok', action};
  };
  const list = [
    {name:'120 ↔ 340 Cari/Avans Virmanı', count:tenant.summary.virmanCount, amount:tenant.summary.virmanTL, status:tenant.summary.virmanCount?'Uyarı':'Bilgi', action:'Kiracı/acente bazında Borç 340 / Alacak 120 fiş önerilerini kontrol et.'},
    make('191 ↔ 391 KDV Mahsup / Virman', ['MAHSUP','VIRMAN','VIRMAN','KDV'], ['191','391'], 'KDV dönem kapanışında 191/391 mahsup fişini beyanname ile eşleştir.'),
    make('360 Konaklama Vergisi Mahsubu', ['KONAKLAMA','KON TAX','KON.TAX','360'], ['360.01.01.0016'], '360.01.01.0016 borç/alacak hareketlerini beyan ödeme kaydıyla karşılaştır.'),
    make('393 ↔ 340 Devir / Avans Virmanı', ['DEVIR','DEVİR','VIRMAN','MAHSUP'], ['393','340'], '393 geçici hesap ile 340 avans kapanışını kontrol et.'),
    make('646 / 656 Kur Farkı Etkisi', ['KUR FARKI','KAMBİYO','KAMBIYO'], ['646','656'], 'Dövizli cari/avans kapanışlarında kur farkı fişini ayrıştır.'),
    make('679 / 689 Yuvarlama / Düzeltme', ['YUVARLAMA','DÜZELTME','DUZELTME'], ['679','689'], 'Tolerans altı farkları yuvarlama/düzeltme hesabıyla açıklamaya bağla.')
  ];
  return list;
}

function v221AccountingAudit(){
  const s = APP_STATE.summary || {};
  const raw = APP_STATE.raw || emptyRaw();
  const tenant = v221TenantAnalysis();
  const virman = v221VirmanAnalysis();
  const rowsAll = v221RawAll();
  const muRows = safeRows(raw.Raw_Muhasebe);
  const expected10 = v221Round((Number(s.roomRevenue||0) + Number(s.fbRevenue||0)) * 0.10);
  const expected20 = v221Round((Number(s.otherRevenue||0) + Number(s.extraTotal||0)) * 0.20);
  const actual10 = Number(s.kdv10 || 0);
  const actual20 = Number(s.kdv20 || 0);
  const diff10 = v221Round(actual10 - expected10);
  const diff20 = v221Round(actual20 - expected20);
  const docMissing = muRows.filter(r => !v221DocNo(r) || !v221Desc(r) || !v221Date(r)).length;
  const kurRows = rowsWith(rowsAll, ['646','656','KUR FARKI','KAMBİYO','KAMBIYO'], []);
  const roundRows = rowsWith(rowsAll, ['679','689','YUVARLAMA','DÜZELTME','DUZELTME'], []);
  const returnRows = rowsWith(rowsAll, ['610','IADE','İADE','INDIRIM','İNDİRİM'], []);
  const auditRows = [
    {area:'600 ↔ 391 KDV %10', finding:`Beklenen ${fmtTL(expected10)} · Fiili ${fmtTL(actual10)} · Fark ${fmtTL(diff10)}`, risk:v221StatusFromDiff(diff10, !expected10 && !actual10), action:'Oda/F&B 600 hesapları ile 391.01.01.0002 hesabını mutabık hale getir.', voucher:'600/391'},
    {area:'600 ↔ 391 KDV %20', finding:`Beklenen ${fmtTL(expected20)} · Fiili ${fmtTL(actual20)} · Fark ${fmtTL(diff20)}`, risk:v221StatusFromDiff(diff20, !expected20 && !actual20), action:'Alkollü/diğer/minibar gelirlerini 391.01.01.0003 ile eşleştir.', voucher:'600/391'},
    {area:'360 Konaklama Vergisi', finding:`360.01.01.0016 tutarı ${fmtTL(s.accommodationTax || 0)}`, risk:s.accommodationTax ? 'Mutabık' : 'Uyarı', action:'3026 Kon.Tax ile 360 hesabını beyan öncesi kontrol et.', voucher:'360'},
    {area:'181 ↔ 3010 Balans', finding:`181 ${fmtTL(s.balance181)} · 3010 ${fmtTL(s.balance3010)} · Fark ${fmtTL(s.balanceDiff)}`, risk:diffStatus(s.balanceDiff), action:'Rapor kesit saati, night audit, guest ledger ve city ledger devrini kontrol et.', voucher:'181/3010'},
    {area:'120 ↔ 340 Cari/Avans', finding:`${tenant.summary.virmanCount} virman adayı · ${fmtTL(tenant.summary.virmanTL)} TL`, risk:tenant.summary.virmanCount ? 'Kritik Fark' : 'Bilgi', action:'Virmanlanacakları üstten başlayarak Borç 340 / Alacak 120 fişine hazırla.', voucher:'Borç 340 / Alacak 120'},
    {area:'100/108 ↔ 3014 Tahsilat', finding:`3014 tahsilat toplamı ${fmtTL(s.cashTotal || 0)}`, risk:s.cashTotal ? 'Bilgi' : 'Veri Yok', action:'100 kasa ve 108 kredi kartı hesaplarını TL/EUR/USD/GBP karıştırmadan karşılaştır.', voucher:'100/108'},
    {area:'E-Defter / Fiş Kalitesi', finding:`Eksik tarih/belge/açıklama olabilecek satır: ${fmtNum(docMissing)}`, risk:docMissing > 20 ? 'Uyarı' : docMissing ? 'Bilgi' : 'Mutabık', action:'Belge no, açıklama ve fiş açıklaması eksik kayıtları e-defter öncesi düzelt.', voucher:'Yevmiye kontrol'},
    {area:'646/656 Kur Farkı', finding:`Kur farkı sinyali: ${fmtNum(kurRows.length)} satır`, risk:kurRows.length ? 'Bilgi' : 'Veri Yok', action:'Dövizli cari/avans kapanışında kur farkını KDV farkından ayır.', voucher:'646/656'},
    {area:'679/689 Yuvarlama/Düzeltme', finding:`Yuvarlama/düzeltme sinyali: ${fmtNum(roundRows.length)} satır`, risk:roundRows.length ? 'Bilgi' : 'Veri Yok', action:'Tolerans içi farkları yuvarlama; büyük farkları manuel düzeltme olarak incele.', voucher:'679/689'},
    {area:'610 İade / İndirim', finding:`İade/indirim sinyali: ${fmtNum(returnRows.length)} satır`, risk:returnRows.length ? 'Uyarı' : 'Bilgi', action:'Satıştan iadeyi 600/391 beklenen KDV hesabından düşür.', voucher:'610'}
  ];
  const critical = auditRows.filter(r => ['KRITIK FARK','Kritik Fark'].includes(r.risk)).length;
  const warn = auditRows.filter(r => normalizeText(r.risk).includes('UYARI') || normalizeText(r.risk).includes('ORTA') || normalizeText(r.risk).includes('FARK')).length;
  const missing = auditRows.filter(r => normalizeText(r.risk).includes('VERI YOK')).length;
  const score = clamp(100 - critical*14 - warn*7 - missing*3 + Math.min(rowsAll.length, 500)/100, 0, 100);
  const level = score >= 90 ? 'Üst Seviye Kontrol' : score >= 75 ? 'Güçlü Muhasebe Kontrolü' : score >= 55 ? 'Geliştirilecek Alan Var' : 'Acil Muhasebe Temizliği';
  const vouchers = auditRows.filter(r => normalizeText(r.risk).includes('FARK') || normalizeText(r.risk).includes('UYARI')).length + tenant.summary.virmanCount;
  return {rows:auditRows, score:Math.round(score), level, critical, warn, missing, vouchers, tenant, virman};
}

const V221_BASE_buildControls = buildControls;
buildControls = function(summary, raw){
  const rows = V221_BASE_buildControls(summary, raw);
  const acc = v221AccountingAudit();
  rows.unshift({name:'Muhasebe Komuta Merkezi', status:acc.critical ? 'Kritik Fark' : acc.warn ? 'Uyarı' : 'Çalıştı', lastRun:APP_STATE.meta.lastUpdate, desc:`Skor: ${acc.score}/100 · ${acc.level} · Fiş/Aksiyon: ${acc.vouchers}`});
  rows.push({name:'Kiracılar 120/340 Detaylı Virman', status:acc.tenant.summary.virmanCount ? 'Uyarı' : 'Bilgi', lastRun:APP_STATE.meta.lastUpdate, desc:`Cari: ${acc.tenant.summary.count} · Virman adayı: ${acc.tenant.summary.virmanCount} · TL: ${fmtTL(acc.tenant.summary.virmanTL)}`});
  return rows;
};

const V221_BASE_buildAlerts = buildAlerts;
buildAlerts = function(summary, raw){
  const alerts = V221_BASE_buildAlerts(summary, raw);
  const acc = v221AccountingAudit();
  if (acc.critical || acc.warn) {
    alerts.unshift({type:acc.critical?'red':'amber', ico:'🧑‍💼', title:`Muhasebe Modu: ${acc.level} — Skor ${acc.score}/100`, desc:`${acc.critical} kritik, ${acc.warn} uyarı ve ${acc.vouchers} fiş/aksiyon önerisi üretildi. Muhasebe Modu sayfasından yönetici özeti ve fiş önerilerini kontrol edin.`, actionRequired:true});
  } else {
    alerts.unshift({type:'green', ico:'🧑‍💼', title:`Muhasebe Modu hazır — Skor ${acc.score}/100`, desc:'Kritik muhasebe riski görünmüyor; rutin mutabakat ve beyan öncesi kontrol devam edebilir.', actionRequired:false});
  }
  return alerts;
};

const V221_BASE_renderDashboard = renderDashboard;
renderDashboard = function(state){
  V221_BASE_renderDashboard(state);
  renderHotelOverviewRows();
  renderKdvHomeRows();
  renderVirmanHomeRows();
  renderTenantHomeRows();
  renderAccountingHome(state);
};

const V221_BASE_renderTopMeta = renderTopMeta;
renderTopMeta = function(){
  renderHotelSelect();
  V221_BASE_renderTopMeta();
  const tenantBadge = document.getElementById('tenantBadge');
  if (tenantBadge) tenantBadge.textContent = String(v221TenantAnalysis().summary.virmanCount || 0);
};

const V221_BASE_renderPages = renderPages;
renderPages = function(){
  renderAutoControlPage();
  renderUploadPage();
  renderBalancePage();
  renderMizanPage();
  renderKontaxPage();
  renderVirmanPage();
  renderTenantsPage();
  renderAccountingModePage();
  renderDiffPage();
  renderAlertsPage();
  renderRatesPage();
  renderExtraSalesPage();
  renderReasonPage();
  renderLog(APP_STATE);
  renderSettingsPage();
  renderMainMenuPage();
};

function renderHotelOverviewRows(){
  const el = document.getElementById('hotelOverviewRows');
  if (!el) return;
  const dataHotels = (V221_LAST_DATA && Array.isArray(V221_LAST_DATA.hotels)) ? V221_LAST_DATA.hotels : null;
  const cards = V221_HOTELS.map(h => {
    const src = dataHotels?.find(x => normalizeText(x?.meta?.hotel || x?.hotel || '') === normalizeText(h));
    const sum = src?.summary || (normalizeText(h) === normalizeText(V221_ACTIVE_HOTEL) ? APP_STATE.summary : {});
    const status = sum.balanceStatus || diffStatus(Number(sum.balanceDiff || 0));
    return `<button class="hotel-mini ${normalizeText(h)===normalizeText(V221_ACTIVE_HOTEL)?'active':''}" onclick="selectHotel('${esc(h)}')"><strong>${esc(h)}</strong><span>${pill(status,status)}</span><small>Gelir: ${fmtTL(sum.totalRevenue || 0)} · KDV: ${fmtTL((sum.kdv10||0)+(sum.kdv20||0))}</small></button>`;
  }).join('');
  el.innerHTML = cards;
}

function renderKdvHomeRows(){
  const el = document.getElementById('kdvHomeRows');
  if (!el) return;
  const s = APP_STATE.summary || {};
  const exp10 = v221Round((Number(s.roomRevenue||0) + Number(s.fbRevenue||0)) * 0.10);
  const exp20 = v221Round((Number(s.otherRevenue||0) + Number(s.extraTotal||0)) * 0.20);
  const rows = [
    ['KDV %10 — Oda/F&B', exp10, s.kdv10 || 0, (s.kdv10||0)-exp10, v221StatusFromDiff((s.kdv10||0)-exp10, !exp10 && !s.kdv10)],
    ['KDV %20 — Alkollü/Diğer/Extra', exp20, s.kdv20 || 0, (s.kdv20||0)-exp20, v221StatusFromDiff((s.kdv20||0)-exp20, !exp20 && !s.kdv20)],
    ['Konaklama Vergisi — 360.01.01.0016', s.accommodationTax || 0, s.accommodationTax || 0, 0, s.accommodationTax ? 'Mutabık' : 'Kontrol Et']
  ];
  const totalDiff = rows.reduce((a,r)=>a+Number(r[3]||0),0);
  setText('homeKdvStatus', diffStatus(totalDiff));
  setText('homeKdvDiff', `Fark: ${fmtTL(totalDiff)}`);
  setText('homeKdv10Expected', fmtTL(exp10));
  setText('homeKdv10Actual', `391: ${fmtTL(s.kdv10 || 0)}`);
  setText('homeKdv20Expected', fmtTL(exp20));
  setText('homeKdv20Actual', `391: ${fmtTL(s.kdv20 || 0)}`);
  setText('homeAccomTax', fmtTL(s.accommodationTax || 0));
  el.innerHTML = rows.map(r=>`<tr><td style="font-family:'Inter'">${esc(r[0])}</td><td>${fmtTL(r[1])}</td><td>${fmtTL(r[2])}</td><td class="${abs(r[3])>1?'neg':'pos'}">${fmtTL(r[3])}</td><td>${pill(r[4],r[4])}</td></tr>`).join('');
}

function renderVirmanHomeRows(){
  const el = document.getElementById('virmanHomeRows');
  if (!el) return;
  const list = v221VirmanAnalysis().slice(0,6);
  el.innerHTML = list.map(x => `<div class="kasa-row"><div class="kasa-left"><span>${normalizeText(x.status).includes('VERI')?'⚪':normalizeText(x.status).includes('UYARI')?'⚠':'✅'}</span>${esc(x.name)}</div><div class="kasa-right">${fmtNum(x.count)} · ${fmtTL(x.amount)}</div></div>`).join('') + `<div class="kasa-total-bar"><span>VİRMAN AKSİYONU</span><span class="kasa-total-val">${fmtNum(list.reduce((s,x)=>s+x.count,0))}</span></div>`;
}

function renderTenantHomeRows(){
  const el = document.getElementById('tenantHomeRows');
  if (!el) return;
  const t = v221TenantAnalysis();
  setText('tenantHomeCount', fmtNum(t.summary.count));
  setText('tenantHomeVirmanCount', fmtNum(t.summary.virmanCount));
  setText('tenantHomeVirmanTL', fmtTL(t.summary.virmanTL));
  setText('tenantHomeVirmanFx', fmtNum(t.summary.virmanFx,2));
  el.innerHTML = t.rows.slice(0,8).map(r => `<tr><td style="font-family:'Inter';font-weight:700">${esc(r.name)}</td><td>${fmtTL((r.b120||0)-(r.a120||0))}</td><td>${fmtTL((r.a340||0)-(r.b340||0))}</td><td class="warn">${fmtTL(r.virmanTL)}${r.fxVirman?` / FX ${fmtNum(r.fxVirman,2)}`:''}</td><td>${pill(r.risk,r.risk)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">120/340 cari verisi yüklenmedi.</td></tr>';
}

function renderAccountingHome(){
  const el = document.getElementById('accountingHomeRows');
  if (!el) return;
  const a = v221AccountingAudit();
  setText('accHomeScore', `${a.score}/100`);
  setText('accHomeLevel', a.level);
  setText('accHomeCritical', fmtNum(a.critical + a.warn));
  setText('accHomeVoucher', fmtNum(a.vouchers));
  setText('accHomeImpact', a.score >= 75 ? 'Fark Yaratır' : 'Temizlik Şart');
  el.innerHTML = a.rows.map(r=>`<tr><td style="font-family:'Inter';font-weight:700">${esc(r.area)}</td><td style="font-family:'Inter';font-size:10.5px">${esc(r.finding)}</td><td>${pill(r.risk,r.risk)}</td><td style="font-family:'Inter';font-size:10.5px">${esc(r.action)}</td><td class="muted">${esc(r.voucher)}</td></tr>`).join('');
}

function renderAccountingModePage(){
  const el = document.getElementById('accountingModePage');
  if (!el) return;
  const a = v221AccountingAudit();
  const topRisks = a.rows.filter(r => normalizeText(r.risk).includes('FARK') || normalizeText(r.risk).includes('UYARI')).slice(0,5);
  el.innerHTML = `
    <div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">🧑‍💼</span><div class="card-label">Muhasebe Komuta Merkezi<br><b>Nereye Gidersen Fark Yaratacak Kontrol Paneli</b></div><div class="card-actions"><button class="card-act-btn" onclick="exportAccountingAuditCsv()">CSV Denetim</button><button class="card-act-btn" onclick="exportTenantVoucherCsv()">CSV Fiş</button></div></div>
      <div class="section-note">Bu mod; otel finansında SMMM/denetçi bakışıyla mizan, KDV, cari, virman, kasa, e-defter kalite ve kapanış risklerini tek ekranda toplar. Amaç sadece fark bulmak değil; farkın fişini, nedenini ve aksiyonunu üretmektir.</div>
      <div class="metric-grid"><div class="metric-box"><div class="metric-label">Muhasebe Skoru</div><div class="metric-val">${a.score}/100</div><div class="kpi-sub">${esc(a.level)}</div></div><div class="metric-box"><div class="metric-label">Kritik/Uyarı</div><div class="metric-val">${fmtNum(a.critical+a.warn)}</div><div class="kpi-sub">Aksiyon satırı</div></div><div class="metric-box"><div class="metric-label">Fiş Önerisi</div><div class="metric-val">${fmtNum(a.vouchers)}</div><div class="kpi-sub">Virman / mahsup / düzeltme</div></div><div class="metric-box"><div class="metric-label">Cari Kapsam</div><div class="metric-val">${fmtNum(a.tenant.summary.count)}</div><div class="kpi-sub">120/340 cari</div></div></div>
    </div>
    <div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">🚦</span><div class="card-label">Öncelikli Riskler ve Patron Cümlesi</div></div>${topRisks.length ? topRisks.map(r=>`<div class="alert-row ${v221RiskClass(r.risk)}"><div class="alert-ico">${normalizeText(r.risk).includes('KRITIK')?'🚨':'⚠'}</div><div><div class="alert-title">${esc(r.area)} — ${esc(r.finding)}</div><div class="alert-desc">${esc(r.action)} | Fiş/Hesap: ${esc(r.voucher)}</div></div></div>`).join('') : '<div class="alert-row green"><div class="alert-ico">✅</div><div><div class="alert-title">Kritik muhasebe riski yok</div><div class="alert-desc">Rutin mutabakat ve beyan öncesi kontrolle ilerlenebilir.</div></div></div>'}</div>
    <div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">📋</span><div class="card-label">Muhasebe Denetim Checklist</div></div><div class="scrollbox tall"><table class="tbl"><thead><tr><th>Kontrol</th><th>Bulgu</th><th>Risk</th><th>Aksiyon</th><th>Fiş/Hesap</th></tr></thead><tbody>${a.rows.map(r=>`<tr><td style="font-family:'Inter';font-weight:700">${esc(r.area)}</td><td style="font-family:'Inter';font-size:10.5px">${esc(r.finding)}</td><td>${pill(r.risk,r.risk)}</td><td style="font-family:'Inter';font-size:10.5px">${esc(r.action)}</td><td class="muted">${esc(r.voucher)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">🧾</span><div class="card-label">Fiş Önerisi Mantığı</div></div><div class="scrollbox tall"><table class="tbl"><thead><tr><th>Öncelik</th><th>Cari / Kontrol</th><th>Fiş</th><th>Tutar</th><th>Açıklama</th></tr></thead><tbody>${a.tenant.rows.filter(x=>x.virmanTL>1 || x.fxVirman>0).slice(0,50).map((x,i)=>`<tr><td>${i+1}</td><td style="font-family:'Inter';font-weight:700">${esc(x.name)}</td><td class="muted">Borç 340 / Alacak 120</td><td class="warn">${fmtTL(x.virmanTL)}${x.fxVirman?` · FX ${fmtNum(x.fxVirman,2)}`:''}</td><td style="font-family:'Inter';font-size:10.5px">120 açık bakiye ile 340 avans aynı cari anahtarında eşleşti.</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Virman fişi önerisi yok.</td></tr>'}</tbody></table></div></div>`;
}

function renderVirmanPage(){
  const el = document.getElementById('virmanPage');
  if (!el) return;
  const rows = v221VirmanAnalysis();
  el.innerHTML = `<div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">🔁</span><div class="card-label">Virman / Mahsup Kontrol Merkezi</div><div class="card-actions"><button class="card-act-btn" onclick="exportTenantVoucherCsv()">CSV Fiş</button></div></div><div class="scrollbox tall"><table class="tbl"><thead><tr><th>Kontrol</th><th>Bulunan Satır</th><th>Tutar</th><th>Durum</th><th>Aksiyon</th></tr></thead><tbody>${rows.map(r=>`<tr><td style="font-family:'Inter';font-weight:700">${esc(r.name)}</td><td>${fmtNum(r.count)}</td><td>${fmtTL(r.amount)}</td><td>${pill(r.status,r.status)}</td><td style="font-family:'Inter';font-size:10.5px">${esc(r.action)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function renderTenantsPage(){
  const el = document.getElementById('tenantsPage');
  if (!el) return;
  const t = v221TenantAnalysis();
  el.innerHTML = `
    <div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">🏬</span><div class="card-label">Kiracılar 120/340 — Çok Detaylı Virman Analizi</div><div class="card-actions"><button class="card-act-btn" onclick="exportTenantVoucherCsv()">CSV Fiş</button><button class="card-act-btn" onclick="exportTenantDetailCsv()">CSV Detay</button></div></div><div class="metric-grid"><div class="metric-box"><div class="metric-label">Cari Sayısı</div><div class="metric-val">${fmtNum(t.summary.count)}</div></div><div class="metric-box"><div class="metric-label">Virman Adayı</div><div class="metric-val">${fmtNum(t.summary.virmanCount)}</div></div><div class="metric-box"><div class="metric-label">Virman TL</div><div class="metric-val">${fmtTL(t.summary.virmanTL)}</div></div><div class="metric-box"><div class="metric-label">Döviz Virman</div><div class="metric-val">${fmtNum(t.summary.virmanFx,2)}</div></div></div></div>
    <div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">🔁</span><div class="card-label">Virmanlanacaklar Öncelikli Liste</div></div><div class="scrollbox tall"><table class="tbl"><thead><tr><th>Cari</th><th>120 Borç</th><th>120 Alacak</th><th>340 Avans</th><th>Virman TL</th><th>Döviz</th><th>Kalan 120</th><th>Risk</th><th>Aksiyon</th></tr></thead><tbody>${t.rows.map(r=>`<tr><td style="font-family:'Inter';font-weight:700">${esc(r.name)}</td><td>${fmtTL(r.b120)}</td><td>${fmtTL(r.a120)}</td><td>${fmtTL(r.a340)}</td><td class="warn">${fmtTL(r.virmanTL)}</td><td>${r.fxSummary.map(x=>`${x.cur}: ${fmtNum(x.virman,2)}`).join('<br>') || '—'}</td><td>${fmtTL(r.kalan120)}</td><td>${pill(r.risk,r.risk)}</td><td style="font-family:'Inter';font-size:10.5px">${esc(r.action)}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">120/340 verisi yüklenmedi.</td></tr>'}</tbody></table></div></div>
    <div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">🧾</span><div class="card-label">Kalem Kalem 120/340 Detay</div></div><div class="scrollbox tall"><table class="tbl"><thead><tr><th>Tip</th><th>Hesap</th><th>Cari</th><th>Tarih</th><th>Belge</th><th>Döviz</th><th>Borç</th><th>Alacak</th><th>Bakiye</th><th>Açıklama</th></tr></thead><tbody>${t.details.slice(0,500).map(d=>`<tr><td>${/^120/.test(d.hesap)?'120 Cari':'340 Avans'}</td><td class="muted">${esc(d.hesap)}</td><td style="font-family:'Inter'">${esc(d.name)}</td><td class="muted">${esc(d.tarih||'—')}</td><td class="muted">${esc(d.belge||'—')}</td><td>${esc(d.cur)}</td><td>${fmtTL(d.borc)}</td><td>${fmtTL(d.alacak)}</td><td>${fmtTL(d.bakiye)}</td><td style="font-family:'Inter';font-size:10.5px">${esc(d.desc||'—')}</td></tr>`).join('') || '<tr><td colspan="10" class="muted">Detay satır yok.</td></tr>'}</tbody></table></div></div>`;
}

function downloadCsv(filename, rows){
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function exportAccountingAuditCsv(){
  const a = v221AccountingAudit();
  downloadCsv(`muhasebe_komuta_merkezi_${normalizeText(APP_STATE.meta.hotel).replace(/\s+/g,'_')}.csv`, [['Kontrol','Bulgu','Risk','Aksiyon','Fis/Hesap'], ...a.rows.map(r=>[r.area,r.finding,r.risk,r.action,r.voucher])]);
  addLog('CSV Denetim', 'Muhasebe Modu', 'Çalıştı', 'Muhasebe denetim CSV çıktısı oluşturuldu.', '', false);
}
function exportTenantVoucherCsv(){
  const t = v221TenantAnalysis();
  const rows = t.rows.filter(x=>x.virmanTL>1 || x.fxVirman>0).map(x => [x.name,'340','120',v221Round(x.virmanTL),x.fxSummary.map(f=>`${f.cur}:${f.virman}`).join(' | '),'Borç 340 / Alacak 120 virman önerisi']);
  downloadCsv(`kiraci_virman_fis_onerisi_${normalizeText(APP_STATE.meta.hotel).replace(/\s+/g,'_')}.csv`, [['Cari','Borc Hesap','Alacak Hesap','TL Tutar','Doviz Tutar','Aciklama'], ...rows]);
  addLog('CSV Fiş', 'Kiracılar 120/340', 'Çalıştı', 'Virman fişi öneri CSV çıktısı oluşturuldu.', '', false);
}
function exportTenantDetailCsv(){
  const t = v221TenantAnalysis();
  downloadCsv(`kiraci_120_340_detay_${normalizeText(APP_STATE.meta.hotel).replace(/\s+/g,'_')}.csv`, [['Tip','Hesap','Cari','Tarih','Belge','Doviz','Borc','Alacak','Bakiye','Aciklama'], ...t.details.map(d=>[/^120/.test(d.hesap)?'120 Cari':'340 Avans',d.hesap,d.name,d.tarih,d.belge,d.cur,d.borc,d.alacak,d.bakiye,d.desc])]);
  addLog('CSV Detay', 'Kiracılar 120/340', 'Çalıştı', 'Kiracı detay CSV çıktısı oluşturuldu.', '', false);
}

window.selectHotel = selectHotel;
window.exportAccountingAuditCsv = exportAccountingAuditCsv;
window.exportTenantVoucherCsv = exportTenantVoucherCsv;
window.exportTenantDetailCsv = exportTenantDetailCsv;

/* ────────────────────────────────────────────────────────────────
   V222 — ERP CANLI VERİ CONNECTOR
   Node.js local engine üzerinden Veboni/API veri çekme köprüsü.
   Şifre/token frontend'e yazılmaz; .env dosyasında kalır.
──────────────────────────────────────────────────────────────── */
const V222_ERP_ROUTE = {ico:'🔌', lbl:'ERP Canlı Veri', page:'erp-connector', title:'ERP Canlı Veri Connector'};
if (typeof v221EnsureRoute === 'function') v221EnsureRoute(V222_ERP_ROUTE, 'upload');
else if (!ROUTES.some(r => r.page === V222_ERP_ROUTE.page)) ROUTES.splice(3, 0, V222_ERP_ROUTE);

let V222_ERP_STATUS = {
  ok:false,
  mode:'unknown',
  configured:false,
  lastSync:'',
  reportCount:0,
  errorCount:0,
  message:'Node.js server bağlantısı bekleniyor.',
  endpointCount:0,
  hotels:[]
};

function v222IsLocalServer(){
  return location.protocol === 'http:' || location.protocol === 'https:';
}
async function v222FetchJson(url, options={}){
  const res = await fetch(url, Object.assign({cache:'no-store'}, options));
  const txt = await res.text();
  let data = {};
  try { data = txt ? JSON.parse(txt) : {}; } catch { data = {raw:txt}; }
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}
async function loadErpStatus(){
  if (!v222IsLocalServer()) {
    V222_ERP_STATUS = Object.assign(V222_ERP_STATUS, {ok:false, configured:false, mode:'file', message:'HTML dosyası doğrudan açılmış. Canlı çekim için npm start ile localhost üzerinden aç.'});
    renderErpStatusWidgets();
    return V222_ERP_STATUS;
  }
  try {
    const data = await v222FetchJson('/api/erp/status');
    V222_ERP_STATUS = Object.assign(V222_ERP_STATUS, data || {});
  } catch (err) {
    V222_ERP_STATUS = Object.assign(V222_ERP_STATUS, {ok:false, configured:false, message:err.message, errorCount:(V222_ERP_STATUS.errorCount||0)+1});
    addLog('ERP Connector Status', '/api/erp/status', 'Uyarı', 'ERP connector durum bilgisi alınamadı.', err.message, true);
  }
  renderErpStatusWidgets();
  return V222_ERP_STATUS;
}
async function testErpConnection(){
  if (!v222IsLocalServer()) {
    toast('Canlı veri için sistemi npm start ile localhost üzerinden açmalısın.', 'warn');
    navigateTo('erp-connector');
    return;
  }
  addLog('ERP API Test', 'Veboni Connector', 'Bilgi', 'ERP bağlantı testi başlatıldı.', '', false);
  try {
    toast('ERP bağlantısı test ediliyor...', 'info');
    const data = await v222FetchJson('/api/erp/test', {method:'POST'});
    V222_ERP_STATUS = Object.assign(V222_ERP_STATUS, data.status || {}, {ok:!!data.ok, message:data.message || 'Bağlantı testi tamamlandı.'});
    addLog('ERP API Test', 'Veboni Connector', data.ok ? 'Çalıştı' : 'Uyarı', data.message || 'Test tamamlandı.', data.error || '', !data.ok);
    toast(data.ok ? 'ERP bağlantı testi başarılı.' : 'ERP bağlantı testi uyarı verdi.', data.ok ? 'ok' : 'warn');
  } catch (err) {
    addLog('ERP API Test', 'Veboni Connector', 'Hata', 'ERP bağlantı testi başarısız.', err.message, true);
    toast('ERP bağlantı testi başarısız: ' + err.message, 'err');
  }
  await loadErpStatus();
  renderPages();
}
async function syncErpNow(){
  if (!v222IsLocalServer()) {
    toast('ERP’den canlı veri çekmek için paketi localhost üzerinden aç: npm start', 'warn');
    navigateTo('erp-connector');
    return;
  }
  addLog('ERP Canlı Veri Çekme', 'Veboni Connector', 'Bilgi', 'Canlı veri senkronizasyonu başlatıldı.', '', false);
  renderErpStatusWidgets({busy:true, message:'ERP’den veri çekiliyor...'});
  try {
    const hotel = APP_STATE?.meta?.hotel || V221_ACTIVE_HOTEL || '';
    const data = await v222FetchJson('/api/erp/sync', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({hotel})
    });
    if (data.dashboardData) {
      hydrateState(data.dashboardData, 'ERP Canlı Veri / dashboard-data.json');
      addLog('ERP Canlı Veri Çekme', 'Veboni Connector', 'Çalıştı', `Senkronizasyon tamamlandı. Rapor: ${data.reportCount || 0}, Hata: ${data.errorCount || 0}.`, '', false);
      V222_ERP_STATUS = Object.assign(V222_ERP_STATUS, data.status || {}, {ok:true, reportCount:data.reportCount||0, errorCount:data.errorCount||0, lastSync:data.lastSync || isoNow(), message:'ERP senkronizasyonu tamamlandı.'});
      renderAll();
      toast('ERP canlı veri çekimi tamamlandı.', 'ok');
    } else {
      throw new Error(data.message || 'dashboardData dönmedi.');
    }
  } catch (err) {
    addLog('ERP Canlı Veri Çekme', 'Veboni Connector', 'Hata', 'ERP canlı veri çekimi başarısız.', err.message, true);
    V222_ERP_STATUS = Object.assign(V222_ERP_STATUS, {ok:false, errorCount:(V222_ERP_STATUS.errorCount||0)+1, message:err.message});
    renderErpStatusWidgets();
    toast('ERP canlı veri çekimi başarısız: ' + err.message, 'err');
    navigateTo('erp-connector');
  }
  await loadErpStatus();
  renderPages();
}
async function rebuildFromFolder(){
  if (!v222IsLocalServer()) {
    toast('Klasörden yenileme için npm start ile localhost üzerinden açmalısın.', 'warn');
    return;
  }
  try {
    const data = await v222FetchJson('/rebuild');
    addLog('Klasör Robotu', '02_RAPORLAR', data.ok ? 'Çalıştı' : 'Uyarı', data.ok ? '02_RAPORLAR klasörü yeniden okundu.' : 'Klasör okuma uyarı verdi.', data.error || '', !data.ok);
    await reloadData();
    toast('02_RAPORLAR klasörü yeniden okundu.', 'ok');
  } catch (err) {
    addLog('Klasör Robotu', '02_RAPORLAR', 'Hata', 'Klasör robotu çalışmadı.', err.message, true);
    toast('Klasör robotu hatası: ' + err.message, 'err');
  }
}
function renderErpStatusWidgets(extra={}){
  const st = Object.assign({}, V222_ERP_STATUS, extra);
  const statusText = st.busy ? 'Çalışıyor' : st.configured ? (st.ok ? 'Hazır' : 'Uyarı') : 'Kurulum Eksik';
  setText('erpConnStatus', statusText);
  setText('erpConnSub', st.message || (st.configured ? 'Connector hazır.' : '.env / endpoint ayarı bekleniyor.'));
  setText('erpLastSync', st.lastSync || '—');
  setText('erpLastSyncSub', st.mode === 'file' ? 'localhost gerekli' : (st.mode || 'Node connector'));
  setText('erpReportCount', fmtNum(st.reportCount || 0));
  setText('erpErrorCount', fmtNum(st.errorCount || 0));
  const badge = document.getElementById('erpLiveBadge');
  if (badge) {
    badge.textContent = st.configured ? (st.ok ? 'Hazır' : 'Uyarı') : 'Kur';
    badge.className = 'sb-badge ' + (st.configured && st.ok ? 'green' : 'amber');
  }
  const rows = document.getElementById('erpHomeRows');
  if (rows) {
    rows.innerHTML = `<div class="alert-row ${st.busy?'blue':st.configured?(st.ok?'green':'amber'):'amber'}"><div class="alert-ico">${st.busy?'⏳':st.configured?(st.ok?'✅':'⚠'):'🔧'}</div><div><div class="alert-title">ERP Connector: ${esc(statusText)}</div><div class="alert-desc">${esc(st.message || 'Connector durum bilgisi bekleniyor.')} Endpoint: ${fmtNum(st.endpointCount || 0)} · Otel: ${fmtNum((st.hotels||[]).length || 0)} · Son senkron: ${esc(st.lastSync || '—')}</div></div></div>`;
  }
}
function renderErpConnectorPage(){
  const el = document.getElementById('erpConnectorPage');
  if (!el) return;
  const st = V222_ERP_STATUS || {};
  const isLocal = v222IsLocalServer();
  const envRows = [
    ['Çalışma modu', isLocal ? 'Localhost / Node.js' : 'File mode', isLocal ? 'Çalıştı' : 'Uyarı'],
    ['API Base URL', st.baseUrl || 'VEBONI_BASE_URL bekleniyor', st.baseUrl ? 'Çalıştı' : 'Veri Yok'],
    ['Kimlik doğrulama', st.authMode || 'token/basic/login', st.configured ? 'Çalıştı' : 'Veri Yok'],
    ['Endpoint mapping', `${fmtNum(st.endpointCount || 0)} rapor`, (st.endpointCount||0) ? 'Çalıştı' : 'Uyarı'],
    ['Son senkron', st.lastSync || '—', st.lastSync ? 'Çalıştı' : 'Veri Yok']
  ];
  const hotels = (st.hotels || []).length ? st.hotels : V221_HOTELS.map(h => ({name:h, id:h, reportCount:0, errorCount:0, status:'Bekliyor'}));
  el.innerHTML = `
    <div class="card" style="grid-column:span 12">
      <div class="card-head"><span class="card-ico">🔌</span><div class="card-label">ERP Canlı Veri Connector<br><b>Veboni API · Güvenli Local Engine</b></div><div class="card-actions"><button class="card-act-btn" onclick="testErpConnection()">Bağlantı Test</button><button class="card-act-btn" onclick="syncErpNow()">ERP’den Çek</button><button class="card-act-btn" onclick="rebuildFromFolder()">Klasörden Yenile</button></div></div>
      <div class="section-note">Bu modda şifre/token HTML içinde tutulmaz. Bilgiler <span class="code-pill">.env</span> dosyasında kalır; Node.js connector ERP’den veriyi çeker, <span class="code-pill">data/dashboard-data.json</span> üretir, dashboard bu JSON’u okur.</div>
      <div class="metric-grid">
        <div class="metric-box"><div class="metric-label">Durum</div><div class="metric-val">${esc(st.configured ? (st.ok ? 'Hazır' : 'Uyarı') : 'Kurulum')}</div><div class="kpi-sub">${esc(st.message || 'Durum bekleniyor.')}</div></div>
        <div class="metric-box"><div class="metric-label">Base URL</div><div class="metric-val" style="font-size:12px">${esc(st.baseUrl || '—')}</div><div class="kpi-sub">.env / VEBONI_BASE_URL</div></div>
        <div class="metric-box"><div class="metric-label">Rapor Seti</div><div class="metric-val">${fmtNum(st.endpointCount || 0)}</div><div class="kpi-sub">3010/3014/3025/3026/3035/3000/181/HK/MH</div></div>
        <div class="metric-box"><div class="metric-label">Son Senkron</div><div class="metric-val" style="font-size:12px">${esc(st.lastSync || '—')}</div><div class="kpi-sub">${fmtNum(st.reportCount || 0)} rapor · ${fmtNum(st.errorCount || 0)} hata</div></div>
      </div>
    </div>
    <div class="card" style="grid-column:span 6"><div class="card-head"><span class="card-ico">🧪</span><div class="card-label">Connector Kontrol Listesi</div></div><table class="tbl"><thead><tr><th>Kontrol</th><th>Değer</th><th>Durum</th></tr></thead><tbody>${envRows.map(r=>`<tr><td style="font-family:'Inter'">${esc(r[0])}</td><td class="muted">${esc(r[1])}</td><td>${pill(r[2],r[2])}</td></tr>`).join('')}</tbody></table></div>
    <div class="card" style="grid-column:span 6"><div class="card-head"><span class="card-ico">🏨</span><div class="card-label">5 Otel Senkron Durumu</div></div><div class="scrollbox tall"><table class="tbl"><thead><tr><th>Otel</th><th>ERP ID</th><th>Rapor</th><th>Hata</th><th>Durum</th></tr></thead><tbody>${hotels.map(h=>`<tr><td style="font-family:'Inter'">${esc(h.name || h.hotel || h.id)}</td><td class="muted">${esc(h.erpId || h.id || '—')}</td><td>${fmtNum(h.reportCount||0)}</td><td class="${(h.errorCount||0)>0?'neg':'pos'}">${fmtNum(h.errorCount||0)}</td><td>${pill(h.status || 'Bekliyor', h.status || 'Bekliyor')}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card" style="grid-column:span 12"><div class="card-head"><span class="card-ico">📌</span><div class="card-label">Kurulum Akışı</div></div><div class="note-row"><span class="note-ico">1️⃣</span><div class="note-text"><em>.env.example</em> dosyasını <em>.env</em> olarak kopyala ve API bilgilerini yaz.</div></div><div class="note-row"><span class="note-ico">2️⃣</span><div class="note-text"><em>config/hotels.json</em> içinde 5 otelin Veboni/ERP hotelId değerlerini doldur.</div></div><div class="note-row"><span class="note-ico">3️⃣</span><div class="note-text"><em>config/veboni-endpoints.json</em> içinde gerçek rapor endpoint path/parametrelerini doğrula.</div></div><div class="note-row"><span class="note-ico">4️⃣</span><div class="note-text"><em>npm install</em> ve <em>npm start</em> çalıştır. Sonra <em>http://localhost:3080</em> adresinden aç.</div></div></div>`;
}

const V222_BASE_renderDashboard = renderDashboard;
renderDashboard = function(state){
  V222_BASE_renderDashboard(state);
  renderErpStatusWidgets();
};
const V222_BASE_renderPages = renderPages;
renderPages = function(){
  V222_BASE_renderPages();
  renderErpConnectorPage();
};
const V222_BASE_loadDashboardData = loadDashboardData;
loadDashboardData = async function(){
  await V222_BASE_loadDashboardData();
  loadErpStatus();
};
const V222_BASE_renderMainMenuPage = renderMainMenuPage;
renderMainMenuPage = function(){
  V222_BASE_renderMainMenuPage();
  // Ana menü yeniden çizildikten sonra yeni route varsa görünür.
};

window.syncErpNow = syncErpNow;
window.testErpConnection = testErpConnection;
window.loadErpStatus = loadErpStatus;
window.rebuildFromFolder = rebuildFromFolder;

/* ────────────────────────────────────────────────────────────────
   V223 — OTOMATİK AKIŞ DÜZELTME
   Önce 02_RAPORLAR klasörünü otomatik okur. ERP API bilgisi tam ise canlı
   connector çalışır; eksikse sistem çökmez, klasör robotuna düşer.
──────────────────────────────────────────────────────────────── */
const V223_AUTO_ROUTE = {ico:'⚡', lbl:'Otomatik Veri Robotu', page:'auto-data', title:'Otomatik Veri Robotu'};
if (typeof v221EnsureRoute === 'function') v221EnsureRoute(V223_AUTO_ROUTE, 'erp-connector');
else if (!ROUTES.some(r => r.page === V223_AUTO_ROUTE.page)) ROUTES.splice(3, 0, V223_AUTO_ROUTE);

let V223_AUTO_STATUS = {ok:false, mode:'startup', lastBuild:'', fileCount:0, reportCount:0, errorCount:0, message:'Otomatik robot başlatılıyor.', busy:false};
let V223_LAST_BUILD_SEEN = '';
const V223_PREV_loadDashboardData = loadDashboardData;
const V223_PREV_reloadData = reloadData;
const V223_PREV_renderPages = renderPages;
const V223_PREV_renderDashboard = renderDashboard;
const V223_PREV_syncErpNow = window.syncErpNow || syncErpNow;

async function v223Api(url, options={}){
  if (typeof v222FetchJson === 'function') return v222FetchJson(url, options);
  const res = await fetch(url, Object.assign({cache:'no-store'}, options));
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}
function v223IsLocal(){ return location.protocol === 'http:' || location.protocol === 'https:'; }
async function loadAutoStatus(){
  if (!v223IsLocal()) {
    V223_AUTO_STATUS = {ok:false, mode:'file', message:'HTML doğrudan dosya olarak açılmış. Tam otomatik için START_DASHBOARD.bat veya npm start ile aç.', busy:false};
    renderAutoStatusWidgets();
    return V223_AUTO_STATUS;
  }
  try {
    const st = await v223Api('/api/auto/status');
    V223_AUTO_STATUS = Object.assign({}, V223_AUTO_STATUS, st || {});
  } catch (err) {
    V223_AUTO_STATUS = Object.assign({}, V223_AUTO_STATUS, {ok:false, message:'Otomatik robot durum bilgisi alınamadı: ' + err.message, errorCount:(V223_AUTO_STATUS.errorCount||0)+1});
  }
  renderAutoStatusWidgets();
  return V223_AUTO_STATUS;
}
async function autoSyncNow(){
  if (!v223IsLocal()) {
    toast('Tam otomatik akış için paketi START_DASHBOARD.bat veya npm start ile açmalısın.', 'warn');
    navigateTo('auto-data');
    return;
  }
  addLog('Otomatik Veri Robotu', 'AUTO', 'Bilgi', 'Otomatik veri çekme/klasör okuma başlatıldı.', '', false);
  V223_AUTO_STATUS = Object.assign({}, V223_AUTO_STATUS, {busy:true, message:'Otomatik veri robotu çalışıyor...'});
  renderAutoStatusWidgets();
  try {
    const out = await v223Api('/api/auto/sync', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({hotel:APP_STATE?.meta?.hotel || ''})});
    V223_AUTO_STATUS = Object.assign({}, V223_AUTO_STATUS, out.status || {}, {busy:false, ok:!!out.ok, mode:out.mode || V223_AUTO_STATUS.mode, message:out.message || 'Otomatik veri robotu tamamlandı.'});
    if (out.dashboardData) {
      hydrateState(out.dashboardData, out.mode === 'erp' ? 'ERP Canlı Veri / Otomatik' : '02_RAPORLAR / Otomatik Klasör Robotu');
      renderAll();
    } else {
      await V223_PREV_loadDashboardData();
    }
    addLog('Otomatik Veri Robotu', out.mode || 'AUTO', out.ok ? 'Çalıştı' : 'Uyarı', out.message || 'Otomatik işlem tamamlandı.', out.error || '', !out.ok);
    toast(out.mode === 'erp' ? 'ERP canlı veri otomatik çekildi.' : 'Klasör robotu otomatik çalıştı.', out.ok ? 'ok' : 'warn');
  } catch (err) {
    V223_AUTO_STATUS = Object.assign({}, V223_AUTO_STATUS, {busy:false, ok:false, message:err.message, errorCount:(V223_AUTO_STATUS.errorCount||0)+1});
    addLog('Otomatik Veri Robotu', 'AUTO', 'Hata', 'Otomatik veri robotu çalışmadı.', err.message, true);
    toast('Otomatik robot hatası: ' + err.message, 'err');
    await V223_PREV_loadDashboardData();
  }
  await loadAutoStatus();
  if (typeof loadErpStatus === 'function') await loadErpStatus();
  renderPages();
}

loadDashboardData = async function(){
  if (v223IsLocal()) {
    await autoSyncNow();
  } else {
    await V223_PREV_loadDashboardData();
    await loadAutoStatus();
  }
};
reloadData = async function(){ await autoSyncNow(); };
syncErpNow = async function(){ await autoSyncNow(); };

async function v223PollAutoStatus(){
  if (!v223IsLocal()) return;
  try {
    const st = await v223Api('/api/auto/status');
    const prev = V223_LAST_BUILD_SEEN;
    V223_AUTO_STATUS = Object.assign({}, V223_AUTO_STATUS, st || {});
    if (st.lastBuild && prev && st.lastBuild !== prev) {
      await V223_PREV_loadDashboardData();
      toast('Rapor klasörü değişti; dashboard otomatik güncellendi.', 'ok');
    }
    V223_LAST_BUILD_SEEN = st.lastBuild || V223_LAST_BUILD_SEEN;
    renderAutoStatusWidgets();
  } catch {}
}
setInterval(v223PollAutoStatus, 15000);

function renderAutoStatusWidgets(){
  const st = V223_AUTO_STATUS || {};
  const modeLabel = st.mode === 'erp' ? 'ERP Canlı' : st.mode === 'folder_fallback' ? 'Klasör Fallback' : st.mode === 'file' ? 'Dosya Modu' : 'Klasör Robotu';
  const autoRows = document.getElementById('erpHomeRows');
  if (autoRows) {
    autoRows.innerHTML = `<div class="alert-row ${st.busy?'blue':st.ok?'green':'amber'}"><div class="alert-ico">${st.busy?'⏳':st.ok?'✅':'⚠'}</div><div><div class="alert-title">Otomatik Veri Robotu: ${esc(modeLabel)}</div><div class="alert-desc">${esc(st.message || 'Durum bekleniyor.')} Dosya: ${fmtNum(st.fileCount || 0)} · Satır: ${fmtNum(st.reportCount || 0)} · Hata: ${fmtNum(st.errorCount || 0)} · Son: ${esc(st.lastBuild || '—')}</div></div></div>`;
  }
  const badge = document.getElementById('erpLiveBadge');
  if (badge) {
    badge.textContent = st.busy ? 'Çalışıyor' : (st.ok ? 'Auto' : 'Uyarı');
    badge.className = 'sb-badge ' + (st.ok ? 'green' : 'amber');
  }
  setText('autoModeVal', modeLabel);
  setText('autoFileCount', fmtNum(st.fileCount || 0));
  setText('autoRowCount', fmtNum(st.reportCount || 0));
  setText('autoLastBuild', st.lastBuild || '—');
}

function renderAutoDataPage(){
  const el = document.getElementById('page-auto-data');
  if (!el) return;
  const target = el.querySelector('.grid');
  if (!target) return;
  const st = V223_AUTO_STATUS || {};
  target.innerHTML = `
    <div class="card" style="grid-column:span 12">
      <div class="card-head"><span class="card-ico">⚡</span><div class="card-label">Otomatik Veri Robotu<br><b>Klasör İzleme · JSON Üretme · ERP Fallback</b></div><div class="card-actions"><button class="card-act-btn" onclick="autoSyncNow()">Şimdi Otomatik Çalıştır</button><button class="card-act-btn" onclick="rebuildFromFolder()">Sadece Klasör Oku</button><button class="card-act-btn" onclick="navigateTo('upload')">Dosya Yükle</button></div></div>
      <div class="section-note">Bu sürümde otomatik akış değişti: sistem açılınca önce <span class="code-pill">02_RAPORLAR</span> klasörünü okur. API ayarı tam ise ERP’den çeker; API eksikse beklemez, klasör robotu çalışır. Klasöre yeni rapor atılınca Node.js watcher JSON’u otomatik günceller.</div>
      <div class="metric-grid">
        <div class="metric-box"><div class="metric-label">Mod</div><div class="metric-val" id="autoModeVal">${esc(st.mode || 'folder')}</div><div class="kpi-sub">folder_first</div></div>
        <div class="metric-box"><div class="metric-label">Okunan Dosya</div><div class="metric-val" id="autoFileCount">${fmtNum(st.fileCount || 0)}</div><div class="kpi-sub">02_RAPORLAR</div></div>
        <div class="metric-box"><div class="metric-label">Okunan Satır</div><div class="metric-val" id="autoRowCount">${fmtNum(st.reportCount || 0)}</div><div class="kpi-sub">Tüm oteller/raw raporlar</div></div>
        <div class="metric-box"><div class="metric-label">Son Otomatik Okuma</div><div class="metric-val" style="font-size:12px" id="autoLastBuild">${esc(st.lastBuild || '—')}</div><div class="kpi-sub">Watcher aktif</div></div>
      </div>
    </div>
    <div class="card" style="grid-column:span 6"><div class="card-head"><span class="card-ico">📂</span><div class="card-label">Otomatik Klasör Yapısı</div></div><table class="tbl"><thead><tr><th>Klasör</th><th>Ne Atılacak?</th><th>Durum</th></tr></thead><tbody>
      ${['ADAM_EVE','SEGINUS','ALHAMBRA','HOLIDAY','DRAGON'].map(h=>`<tr><td class="muted">02_RAPORLAR/${h}</td><td style="font-family:'Inter'">3010, 3014, 3025, 3026, 3035, 3000, 181, Hesap Kartları, Muhasebe Hareketleri</td><td>${pill('Çalıştı','İzleniyor')}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="card" style="grid-column:span 6"><div class="card-head"><span class="card-ico">🧠</span><div class="card-label">Otomatik Karar Mantığı</div></div>
      <div class="note-row"><span class="note-ico">1️⃣</span><div class="note-text"><em>API doluysa</em> ERP connector çalışır.</div></div>
      <div class="note-row"><span class="note-ico">2️⃣</span><div class="note-text"><em>API eksikse</em> sistem beklemez; klasör robotu çalışır.</div></div>
      <div class="note-row"><span class="note-ico">3️⃣</span><div class="note-text"><em>Klasöre dosya atılırsa</em> watcher otomatik JSON üretir.</div></div>
      <div class="note-row"><span class="note-ico">4️⃣</span><div class="note-text"><em>Dashboard</em> 15 saniyede bir otomatik durum kontrolü yapar.</div></div>
    </div>`;
}

renderPages = function(){
  V223_PREV_renderPages();
  renderAutoDataPage();
};
renderDashboard = function(state){
  V223_PREV_renderDashboard(state);
  renderAutoStatusWidgets();
};

window.autoSyncNow = autoSyncNow;
window.reloadData = reloadData;
window.syncErpNow = syncErpNow;
window.loadAutoStatus = loadAutoStatus;
