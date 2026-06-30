require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const XLSX = require('xlsx');
const { VeboniConnector } = require('./connectors/veboni-api');

const ROOT = __dirname;
const REPORT_DIR = path.join(ROOT, '02_RAPORLAR');
const DATA_DIR = path.join(ROOT, 'data');
const ERR_DIR = path.join(ROOT, '04_HATA');
const OUT_JSON = path.join(DATA_DIR, 'dashboard-data.json');
const PORT = process.env.PORT || 3080;
const REPORT_KEYS = ['Raw_3010','Raw_3014','Raw_3025','Raw_3026','Raw_3035','Raw_3000','Raw_181','Raw_HesapKartlari','Raw_Muhasebe'];
const CONFIG_DIR = path.join(ROOT, 'config');
const AUTO_MODE = String(process.env.AUTO_MODE || 'folder_first').toLowerCase();
const WATCH_REPORTS = String(process.env.WATCH_REPORTS || 'true').toLowerCase() !== 'false';
let LAST_BUILD_STATUS = {mode:'startup', ok:false, lastBuild:'', fileCount:0, reportCount:0, errorCount:0, message:'Başlatılıyor', busy:false};
let BUILD_TIMER = null;
let WATCHER_STARTED = false;
function readJsonSafe(filePath, fallback){ try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; } }
const HOTEL_DEFS = readJsonSafe(path.join(CONFIG_DIR, 'hotels.json'), [
  {id:'ADAM_EVE', name:'ADAM & EVE OTEL', short:'A&E', terms:['ADAM','EVE','ADAM EVE','ADAMEVE']},
  {id:'SEGINUS', name:'SEGINUS OTEL', short:'SEG', terms:['SEGINUS','SEGİNUS']},
  {id:'ALHAMBRA', name:'ALHAMBRA OTEL', short:'ALH', terms:['ALHAMBRA']},
  {id:'HOLIDAY', name:'HOLIDAY OTEL', short:'HOL', terms:['HOLIDAY']},
  {id:'DRAGON', name:'DRAGON OTEL', short:'DRG', terms:['DRAGON']}
]);
const DEFAULT_HOTEL_ID = 'ADAM_EVE';

function ensureDirs(){
  [REPORT_DIR, DATA_DIR, ERR_DIR, CONFIG_DIR].forEach(d => fs.mkdirSync(d, {recursive:true}));
  HOTEL_DEFS.forEach(h => fs.mkdirSync(path.join(REPORT_DIR, h.id), {recursive:true}));
}
function emptyRaw(){ return Object.fromEntries(REPORT_KEYS.map(k => [k, []])); }
function emptyHotel(h){
  return {id:h.id, name:h.name, short:h.short, meta:{hotel:h.name,lastUpdate:'',status:'VERİ YOK',source:'Node Lokal Veri Motoru'}, raw:emptyRaw(), summary:{}, alerts:[], logs:[]};
}
function normalizeText(text){
  return String(text ?? '')
    .replace(/İ/g,'I').replace(/ı/g,'I').replace(/Ş/g,'S').replace(/ş/g,'S')
    .replace(/Ğ/g,'G').replace(/ğ/g,'G').replace(/Ü/g,'U').replace(/ü/g,'U')
    .replace(/Ö/g,'O').replace(/ö/g,'O').replace(/Ç/g,'C').replace(/ç/g,'C')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toUpperCase().replace(/\s+/g,' ').trim();
}
function detectHotelFromText(text){
  const n = normalizeText(text || '');
  for (const h of HOTEL_DEFS) {
    if (n.includes(normalizeText(h.id)) || (h.terms || []).some(t => n.includes(normalizeText(t)))) return h.id;
  }
  return '';
}
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
  if (n.includes('HESAP KART') || n.includes('HESAP KARTLARI') || n.includes('KIRACI') || n.includes('KIRACILAR') || n.includes('ACENTE') || n.includes('120') || n.includes('340') || n.includes('100') || n.includes('108')) return 'Raw_HesapKartlari';
  if (n.includes('MUHASEBE') || n.includes('HAREKET') || n.includes('VIRMAN') || n.includes('MAHSUP') || n.includes('FIS') || n.includes('YEVMIYE')) return 'Raw_Muhasebe';
  return 'UNKNOWN';
}
function detectHeaderRow(rows){
  const known = ['TARIH','HESAP','HESAP KODU','ACIKLAMA','TUTAR','BAKIYE','BORC','ALACAK','GELIR','REVENUE','KDV','MATRAH','ODA','ROOM','FOLIO','PARA','DEPARTMAN','URUN','CHECK','MUSTERI'];
  let bestIndex = -1, bestScore = 0;
  rows.slice(0,25).forEach((row,i) => {
    const nonEmpty = row.filter(v => String(v ?? '').trim() !== '');
    const n = normalizeText(nonEmpty.join(' '));
    const knownScore = known.reduce((s,k)=>s+(n.includes(k)?1:0),0);
    const score = knownScore * 3 + Math.min(nonEmpty.length,8);
    if (score > bestScore) { bestScore = score; bestIndex = i; }
  });
  return bestScore >= 4 ? bestIndex : -1;
}
function objFromRow(headers, row){
  const obj = {};
  headers.forEach((h,i)=>{ obj[h || `Kolon${i+1}`] = row[i] ?? ''; });
  return obj;
}
function matrixToRows(matrix){
  const rows = (matrix || []).filter(r => Array.isArray(r) && r.some(v => String(v ?? '').trim() !== ''));
  if (!rows.length) return [];
  const headerIndex = detectHeaderRow(rows);
  if (headerIndex === -1) {
    const maxLen = Math.max(...rows.map(r=>r.length));
    const headers = Array.from({length:maxLen}, (_,i)=>`Kolon${i+1}`);
    return rows.map(r => objFromRow(headers, r));
  }
  const headers = rows[headerIndex].map((h,i)=>String(h || '').trim() || `Kolon${i+1}`);
  return rows.slice(headerIndex+1).map(r => objFromRow(headers, r)).filter(o => Object.values(o).some(v => String(v ?? '').trim() !== ''));
}
function readReport(filePath){
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    const obj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(obj)) return obj;
    if (Array.isArray(obj.rows)) return obj.rows;
    if (obj.raw) return [];
    return [obj];
  }
  if (ext === '.csv') {
    const wb = XLSX.readFile(filePath, {type:'file', raw:false});
    const sheetName = wb.SheetNames[0];
    const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {header:1, defval:'', blankrows:false, raw:false});
    return matrixToRows(matrix);
  }
  const wb = XLSX.readFile(filePath, {cellDates:true, raw:false});
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {header:1, defval:'', blankrows:false, raw:false});
  return matrixToRows(matrix);
}
function parseAmount(value){
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let s = String(value ?? '').trim();
  if (!s) return 0;
  let neg = /\((.*?)\)/.test(s) || /-$/.test(s);
  s = s.replace(/\((.*?)\)/g,'$1').replace(/[^0-9,.\-]/g,'');
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g,'').replace(',', '.');
  else if (lastDot > lastComma) s = s.replace(/,/g,'');
  const n = Number(s);
  return Number.isFinite(n) ? (neg && n > 0 ? -n : n) : 0;
}
function rowText(row){ return normalizeText(Object.values(row || {}).join(' ')); }
function firstNum(row){ return Object.values(row || {}).map(parseAmount).reduce((best,n)=>Math.abs(n)>Math.abs(best)?n:best,0); }
function sumRows(rows, terms){ return rows.filter(r => terms.some(t => rowText(r).includes(normalizeText(t)))).reduce((s,r)=>s+firstNum(r),0); }
function maxRows(rows, terms){ return rows.filter(r => !terms.length || terms.some(t => rowText(r).includes(normalizeText(t)))).reduce((best,r)=>Math.abs(firstNum(r))>Math.abs(best)?firstNum(r):best,0); }
function calculateSummary(raw){
  const r3035 = raw.Raw_3035 || [], r181 = raw.Raw_181 || [], r3010 = raw.Raw_3010 || [], r3014 = raw.Raw_3014 || [], r3025 = raw.Raw_3025 || [], r3026 = raw.Raw_3026 || [], hk = raw.Raw_HesapKartlari || [];
  const roomRevenue = Math.abs(sumRows(r3035, ['ODA','ROOM']));
  const fbRevenue = Math.abs(sumRows(r3035, ['F&B','YIYECEK','ICECEK','FOOD','BEVERAGE','RESTAURANT']));
  const otherRevenue = Math.abs(sumRows(r3035, ['DIGER','OTHER','MINIBAR','SPA']));
  const totalRevenue = Math.abs(maxRows(r3035, ['TOTAL REVENUE','TOPLAM GELIR','GENEL TOPLAM'])) || roomRevenue + fbRevenue + otherRevenue;
  const balance181 = Math.abs(maxRows(r181, ['181.01.01.0001','181'])) || Math.abs(maxRows(r181, []));
  const balance3010 = Math.abs(maxRows(r3010, ['BALANCE','TOTAL','3010'])) || Math.abs(maxRows(r3010, []));
  const cashTotal = Math.abs(maxRows(r3014, []));
  const extraTotal = Math.abs(maxRows(r3025, []));
  const both = r3026.concat(hk);
  const kdv10 = Math.abs(sumRows(both, ['391.01.01.0002','%10','KDV 10']));
  const kdv20 = Math.abs(sumRows(both, ['391.01.01.0003','%20','KDV 20']));
  const accommodationTax = Math.abs(sumRows(both, ['360.01.01.0016','KONAKLAMA VERGISI','KON.TAX']));
  const balanceDiff = balance181 - balance3010;
  const status = Math.abs(balanceDiff) <= 1 ? 'MUTABIK' : Math.abs(balanceDiff) <= 1000 ? 'ORTA FARK' : 'KRİTİK FARK';
  return {totalRevenue, roomRevenue, fbRevenue, otherRevenue, cashTotal, balance181, balance3010, balanceDiff, balanceStatus:status, kdv10, kdv20, accommodationTax, extraTotal};
}
function calculateKdvRobot(raw){
  const r3026 = raw.Raw_3026 || [], r391 = raw.Raw_HesapKartlari || [], rMuh = raw.Raw_Muhasebe || [];
  const kdvData = {kdv10Expected:0, kdv10Actual:0, kdv10Diff:0, kdv20Expected:0, kdv20Actual:0, kdv20Diff:0, accTaxExpected:0, accTaxActual:0, accTaxDiff:0, status:'VERİ YOK', remarks:''};

  const sum = (rows, terms) => rows.filter(r => terms.some(t => rowText(r).includes(normalizeText(t)))).reduce((s,r)=>s+firstNum(r),0);
  const rowText = row => normalizeText(Object.values(row||{}).join(' '));
  const firstNum = row => {const v=Object.values(row||{}).map(parseAmount).filter(n=>n!==0);return v.length?v[0]:0;};
  const parseAmount = value => {if(typeof value==='number')return Number.isFinite(value)?value:0; let s=String(value??'').trim(); if(!s)return 0; let neg=/\((.*?)\)/.test(s)||/-$/.test(s); s=s.replace(/\((.*?)\)/g,'$1').replace(/[^0-9,.\-]/g,''); const lastComma=s.lastIndexOf(','),lastDot=s.lastIndexOf('.'); if(lastComma>lastDot)s=s.replace(/\./g,'').replace(',',.); else if(lastDot>lastComma)s=s.replace(/,/g,''); const n=Number(s); return Number.isFinite(n)?(neg&&n>0?-n:n):0;};
  const normalizeText = text => String(text??'').replace(/İ/g,'I').replace(/ş/g,'S').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ö/g,'O').replace(/Ç/g,'C').toUpperCase().trim();

  kdvData.kdv10Actual = Math.abs(sum(r391, ['391.01.01.0002','KDV 10'])) || Math.abs(sum(r3026, ['391','%10']));
  kdvData.kdv20Actual = Math.abs(sum(r391, ['391.01.01.0003','KDV 20'])) || Math.abs(sum(r3026, ['391','%20']));
  kdvData.accTaxActual = Math.abs(sum(r391, ['360.01.01.0016','KONAKLAMA'])) || Math.abs(sum(r3026, ['360']));

  kdvData.kdv10Expected = kdvData.kdv10Actual * 1.05;
  kdvData.kdv20Expected = kdvData.kdv20Actual * 1.05;
  kdvData.accTaxExpected = kdvData.accTaxActual * 1.02;

  kdvData.kdv10Diff = Math.abs(kdvData.kdv10Actual - kdvData.kdv10Expected);
  kdvData.kdv20Diff = Math.abs(kdvData.kdv20Actual - kdvData.kdv20Expected);
  kdvData.accTaxDiff = Math.abs(kdvData.accTaxActual - kdvData.accTaxExpected);

  const totalDiff = kdvData.kdv10Diff + kdvData.kdv20Diff + kdvData.accTaxDiff;
  if(totalDiff === 0) kdvData.status='MUTABIK';
  else if(totalDiff <= 1000) kdvData.status='ORTA FARK';
  else kdvData.status='KRİTİK FARK';

  if(r3026.length === 0 && r391.length === 0) {kdvData.status='VERİ YOK'; kdvData.remarks='3026 ve 391 hesapları raporundan veri yok.';}
  else if(kdvData.kdv10Actual === 0 && kdvData.kdv20Actual === 0) {kdvData.remarks='KDV tutarları sıfır. Konaklama vergisi kaydı yapılmış olabilir.';}
  else if(totalDiff > 0) {kdvData.remarks='KDV fark nedeni: Ön büro tahsil muhasebeye tam aktarılmamış, iade/indirim ya da düzeltme kaydı.';}

  return kdvData;
}
function calculateVirmanRobot(raw){
  const hk = raw.Raw_HesapKartlari || [], rMuh = raw.Raw_Muhasebe || [];
  const virman = {candidates:0, totalAmount:0, withRisk:0, kur191Effect:0, adj679Effect:0, status:'İNCELEME GEREKLİ', remarks:''};

  const matchAccount = (rows, acctPattern) => rows.filter(r => String(r['Hesap Kodu']||r['Account']||'').includes(acctPattern));
  const sum = rows => rows.reduce((s,r)=>s+parseFloat(r['Bakiye']||r['Balance']||0),0);
  const parseAmount = v => {const n=parseFloat(v); return Number.isFinite(n)?n:0;};

  const acnt120 = matchAccount(hk, '120');
  const acnt340 = matchAccount(hk, '340');
  const acnt191 = matchAccount(hk, '191');
  const acnt391 = matchAccount(hk, '391');
  const acnt360 = matchAccount(hk, '360');
  const acnt393 = matchAccount(hk, '393');

  virman.candidates = acnt120.filter(r=>parseAmount(r['Bakiye']||0)>0).length;
  virman.totalAmount = Math.abs(sum(acnt120)) + Math.abs(sum(acnt340));
  virman.withRisk = acnt340.filter(r=>String(r['Şube']||r['Branch']||'')!=String(acnt120[0]?.['Şube']||'')).length;
  virman.kur191Effect = Math.abs(sum(acnt191));
  virman.adj679Effect = Math.abs(sum(rMuh.filter(r=>rowText(r).includes('679')||rowText(r).includes('689'))));

  if(virman.candidates===0&&virman.totalAmount===0) virman.status='MUTABIK';
  else if(virman.candidates<=3) virman.status='DÜŞÜK RİSK';
  else virman.status='YÜKSEK RİSK';

  virman.remarks = `Virman adayı: ${virman.candidates}, Döviz etkisi: ${virman.kur191Effect>1000?'Yüksek':'Düşük'}, Düzeltme etkisi: ${virman.adj679Effect>1000?'Var':'Yok'}`;
  const rowText = row => String(Object.values(row||{}).join(' ')).toUpperCase();

  return virman;
}
function calculateKiraci120340(raw){
  const hk = raw.Raw_HesapKartlari || [];
  const kiraci = {otelCari:0, otelAvans:0, avmCari:0, avmAvans:0, acenteCari:0, acenteAvans:0, virmanOpportunity:0, totalVirmanAmount:0};

  const matchCode = (pattern) => hk.filter(r => String(r['Hesap Kodu']||r['Account Code']||'').startsWith(pattern));
  const count = rows => rows.filter(r=>parseFloat(r['Bakiye']||r['Balance']||0)>0).length;
  const sum = rows => rows.reduce((s,r)=>s+Math.abs(parseFloat(r['Bakiye']||r['Balance']||0)),0);
  const parseAmount = v => {const n=parseFloat(v); return Number.isFinite(n)?n:0;};

  const c120_06 = matchCode('120.01.06');
  const c340_06 = matchCode('340.01.06');
  const c120_07 = matchCode('120.01.07');
  const c340_07 = matchCode('340.01.07');
  const c120_01 = matchCode('120.01.01');
  const c340_01 = matchCode('340.01.01');

  kiraci.otelCari = count(c120_06);
  kiraci.otelAvans = count(c340_06);
  kiraci.avmCari = count(c120_07);
  kiraci.avmAvans = count(c340_07);
  kiraci.acenteCari = count(c120_01);
  kiraci.acenteAvans = count(c340_01);

  kiraci.virmanOpportunity = Math.min(kiraci.otelCari + kiraci.avmCari + kiraci.acenteCari, 5);
  kiraci.totalVirmanAmount = sum(c120_06) + sum(c120_07) + sum(c120_01);

  return kiraci;
}
function calculateMuhasebeModu(raw){
  const muhasebe = {score:50, kritikRisk:[], fisSuggestions:[], status:'GELİŞTİRİLECEK ALAN VAR'};
  const hk = raw.Raw_HesapKartlari || [], r181 = raw.Raw_181 || [], r3010 = raw.Raw_3010 || [];

  let score = 50;
  const checks = [];

  if((r181||[]).length>0) {score+=5; checks.push({alan:'181 Bakiyesi', ok:true});}
  if((r3010||[]).length>0) {score+=5; checks.push({alan:'3010 Bakiyesi', ok:true});}
  if((hk||[]).length>5) {score+=10; checks.push({alan:'Hesap Kartları', ok:true});}

  const hasErrors = (hk||[]).filter(r=>!r['Belge No']||!r['Date']).length > 0;
  if(hasErrors) {score-=15; muhasebe.kritikRisk.push('Belge numarası veya tarih eksik.');}

  score = Math.max(0, Math.min(100, score));
  muhasebe.score = score;

  if(score>=90) muhasebe.status='ÜST SEVIYE KONTROL';
  else if(score>=75) muhasebe.status='GÜÇLÜ MUHASEBE KONTROLÜ';
  else if(score>=55) muhasebe.status='GELİŞTİRİLECEK ALAN VAR';
  else muhasebe.status='ACİL MUHASEBE TEMİZLİĞİ';

  return muhasebe;
}
function buildAlerts(hotelState){
  const alerts = [];
  const {raw={}, summary={}} = hotelState;
  const diff = Math.abs(summary.balanceDiff || 0);

  if(diff > 1000) {
    alerts.push({type:'err', ico:'🔴', title:'KRİTİK FARK: 181 ↔ 3010', desc:`₺${diff.toLocaleString('tr-TR')} fark bulundu. Rapor kesit saati, ön büro kapanışı, tahakkuk veya manuel muhasebe kaydı kontrol et.`, actionRequired:true});
  } else if(diff > 1) {
    alerts.push({type:'warn', ico:'⚠', title:'ORTA FARK: 181 ↔ 3010', desc:`₺${diff.toLocaleString('tr-TR')} fark. City Ledger, tahakkuk kapanışı veya ön büro devri kontrol et.`, actionRequired:true});
  } else if(diff === 0) {
    alerts.push({type:'ok', ico:'✅', title:'MUTABIK: 181 ↔ 3010', desc:'Balans kontrolü uyumlu.', actionRequired:false});
  }

  const kdvRobot = calculateKdvRobot(raw);
  if(kdvRobot.status==='KRİTİK FARK') {
    alerts.push({type:'err', ico:'🔴', title:'KDV SORUNU: Oran Farkı', desc:'KDV %10 ve %20 arası fark kritik düzeyde. Ön büro tahsili muhasebeye kontrol et.', actionRequired:true});
  } else if(kdvRobot.status==='ORTA FARK') {
    alerts.push({type:'warn', ico:'⚠', title:'KDV UYARI: Oran Kontrolü', desc:'KDV hesaplamada veri uyumsuzluğu var. Mapping tablosunu güncelle.', actionRequired:true});
  }

  if(!raw.Raw_HesapKartlari || raw.Raw_HesapKartlari.length === 0) {
    alerts.push({type:'info', ico:'ℹ', title:'Hesap Kartları Eksik', desc:'Mizan veya hesap kartları raporu bulunamadı. 120/340/391 analizleri sınırlı.', actionRequired:false});
  }

  return alerts;
}
function walkFiles(dir){
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(d => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return walkFiles(full);
    return /\.(xlsx|xlsm|csv|json)$/i.test(d.name) ? [full] : [];
  });
}
function buildData(){
  ensureDirs();
  const hotels = Object.fromEntries(HOTEL_DEFS.map(h => [h.id, emptyHotel(h)]));
  const allLogs = [];
  const files = walkFiles(REPORT_DIR);
  files.forEach(full => {
    const rel = path.relative(REPORT_DIR, full);
    const file = path.basename(full);
    const type = classifyFile(file);
    const hotelId = detectHotelFromText(rel) || DEFAULT_HOTEL_ID;
    const h = hotels[hotelId] || hotels[DEFAULT_HOTEL_ID];
    if (type === 'UNKNOWN') {
      const log = {time:new Date().toISOString(), process:'Dosya Tanıma', fileName:rel, status:'Uyarı', desc:`${h.name}: rapor tipi tanınmadı.`, errorMsg:'', actionRequired:true};
      h.logs.push(log); allLogs.push(log); return;
    }
    try {
      const rows = readReport(full);
      const enrichedRows = rows.map(r => Object.assign({__sourceFile:rel, __reportType:type, __hotelId:hotelId}, r));
      h.raw[type] = (h.raw[type] || []).concat(enrichedRows);
      const log = {time:new Date().toISOString(), process:'Dosya Okuma', fileName:rel, status: rows.length ? 'Çalıştı' : 'Uyarı', desc:`${h.name} / ${type} olarak okundu. Satır: ${rows.length}`, errorMsg: rows.length ? '' : '0 satır / atlandı', actionRequired:!rows.length};
      h.logs.push(log); allLogs.push(log);
    } catch (err) {
      const log = {time:new Date().toISOString(), process:'Dosya Okuma', fileName:rel, status:'Hata', desc:`${h.name}: dosya okunamadı.`, errorMsg:err.message, actionRequired:true};
      h.logs.push(log); allLogs.push(log);
      fs.writeFileSync(path.join(ERR_DIR, 'son_hata.txt'), `${rel}\n${err.stack || err.message}`, 'utf8');
    }
  });
  if (!files.length) {
    const log = {time:new Date().toISOString(), process:'Otomatik Klasör Taraması', fileName:'02_RAPORLAR', status:'Uyarı', desc:'02_RAPORLAR klasöründe okunacak Excel/CSV/JSON raporu bulunamadı. Dashboard boş veri ile açılır; rapor atılır atılmaz watcher otomatik yeniden okur.', errorMsg:'0 dosya', actionRequired:true};
    allLogs.push(log);
    Object.values(hotels).forEach(h => h.logs.push(log));
  }
  Object.values(hotels).forEach(h => {
    h.summary = calculateSummary(h.raw);
    h.summary.kdvRobot = calculateKdvRobot(h.raw);
    h.summary.virmanRobot = calculateVirmanRobot(h.raw);
    h.summary.kiraci = calculateKiraci120340(h.raw);
    h.summary.muhasebeModu = calculateMuhasebeModu(h.raw);
    h.meta.lastUpdate = new Date().toLocaleString('tr-TR');
    h.meta.status = h.summary.balanceStatus || 'VERİ YOK';
    h.alerts = buildAlerts(h);
  });
  const reportCount = Object.values(hotels).reduce((sum,h)=>sum+REPORT_KEYS.reduce((s,k)=>s+(h.raw[k]||[]).length,0),0);
  const errorCount = allLogs.filter(l => String(l.status).toUpperCase().includes('HATA')).length;
  LAST_BUILD_STATUS = {mode:'folder', ok:errorCount===0, lastBuild:new Date().toLocaleString('tr-TR'), fileCount:files.length, reportCount, errorCount, message: files.length ? `${files.length} dosya otomatik okundu.` : 'Rapor klasörü boş; dosya bekleniyor.', busy:false};
  const data = {currentHotelId:DEFAULT_HOTEL_ID, meta:{hotel:'BEŞ OTEL MUTABAKAT', lastUpdate:new Date().toLocaleString('tr-TR'), status:'OTOMATİK KLASÖR', autoMode:AUTO_MODE, watcher:WATCH_REPORTS, fileCount:files.length}, hotels:Object.values(hotels), raw:hotels[DEFAULT_HOTEL_ID].raw, summary:hotels[DEFAULT_HOTEL_ID].summary, alerts:[], logs:allLogs, automation:LAST_BUILD_STATUS};
  fs.writeFileSync(OUT_JSON, JSON.stringify(data, null, 2), 'utf8');
  fs.writeFileSync(path.join(ERR_DIR, 'log.txt'), allLogs.map(l => `${l.time} | ${l.status} | ${l.process} | ${l.fileName} | ${l.desc} | ${l.errorMsg}`).join('\n'), 'utf8');
  return data;
}
function contentType(filePath){
  const ext = path.extname(filePath).toLowerCase();
  return {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8'}[ext] || 'application/octet-stream';
}

function normalizeApiRaw(raw){
  return Object.assign(emptyRaw(), raw || {});
}
function buildDashboardFromApi(apiResult){
  ensureDirs();
  const hotels = (apiResult.hotels || []).map(src => {
    const def = HOTEL_DEFS.find(h => h.id === src.id) || src;
    const raw = normalizeApiRaw(src.raw);
    const summary = calculateSummary(raw);
    const meta = {hotel:src.name || def.name || src.id, lastUpdate:apiResult.lastSync || new Date().toLocaleString('tr-TR'), status:summary.balanceStatus || 'VERİ YOK', source:'ERP Canlı Veri Connector'};
    return {id:src.id || def.id, name:src.name || def.name, short:src.short || def.short, erpId:src.erpId || def.erpId || '', meta, raw, summary, alerts:[], logs:src.logs || [], syncStatus:src.syncStatus || {}};
  });
  const first = hotels[0] || emptyHotel(HOTEL_DEFS[0]);
  const logs = apiResult.logs || hotels.flatMap(h => h.logs || []);
  const data = {currentHotelId:first.id || DEFAULT_HOTEL_ID, meta:{hotel:'BEŞ OTEL MUTABAKAT', lastUpdate:apiResult.lastSync || new Date().toLocaleString('tr-TR'), status:'ERP CANLI VERİ', source:'ERP Canlı Veri Connector'}, hotels, raw:first.raw, summary:first.summary, alerts:[], logs};
  fs.writeFileSync(OUT_JSON, JSON.stringify(data, null, 2), 'utf8');
  fs.writeFileSync(path.join(ERR_DIR, 'log.txt'), logs.map(l => `${l.time} | ${l.status} | ${l.process} | ${l.fileName} | ${l.desc} | ${l.errorMsg}`).join('\n'), 'utf8');
  return data;
}
function readBody(req){
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 5_000_000) { reject(new Error('Request body çok büyük.')); req.destroy(); } });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { resolve({raw:body}); }
    });
    req.on('error', reject);
  });
}
async function sendJson(res, statusCode, obj){
  res.writeHead(statusCode, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
  res.end(JSON.stringify(obj, null, 2));
}

function connector(){ return new VeboniConnector(ROOT); }
function erpCanRun(c){
  try {
    return !!(c && c.isConfigured && c.isConfigured() && Array.isArray(c.hotels) && c.hotels.some(h => String(h.erpId || '').trim()) && c.reports && Object.keys(c.reports).length);
  } catch { return false; }
}
function autoStatus(extra={}){
  let cStatus = {configured:false, ok:false, message:'ERP connector okunamadı.'};
  try { cStatus = connector().status(); } catch (err) { cStatus = {configured:false, ok:false, message:err.message}; }
  return Object.assign({
    ok: LAST_BUILD_STATUS.ok,
    mode: LAST_BUILD_STATUS.mode,
    autoMode: AUTO_MODE,
    watcher: WATCH_REPORTS,
    lastBuild: LAST_BUILD_STATUS.lastBuild,
    fileCount: LAST_BUILD_STATUS.fileCount,
    reportCount: LAST_BUILD_STATUS.reportCount,
    errorCount: LAST_BUILD_STATUS.errorCount,
    message: LAST_BUILD_STATUS.message,
    erpConfigured: !!cStatus.configured,
    erpOk: !!cStatus.ok,
    erpMessage: cStatus.message || '',
    busy: !!LAST_BUILD_STATUS.busy
  }, extra);
}
async function runAutoSync(){
  ensureDirs();
  LAST_BUILD_STATUS = Object.assign({}, LAST_BUILD_STATUS, {busy:true, message:'Otomatik senkronizasyon çalışıyor...'});
  const c = connector();
  if (AUTO_MODE !== 'folder_only' && erpCanRun(c)) {
    try {
      const apiResult = await c.sync();
      const dashboardData = buildDashboardFromApi(apiResult);
      LAST_BUILD_STATUS = {mode:'erp', ok:apiResult.errorCount===0, lastBuild:new Date().toLocaleString('tr-TR'), fileCount:0, reportCount:apiResult.reportCount || 0, errorCount:apiResult.errorCount || 0, message: apiResult.errorCount ? 'ERP çalıştı; bazı raporlar hata verdi.' : 'ERP canlı veri otomatik çekildi.', busy:false};
      return {ok:true, mode:'erp', dashboardData, status:autoStatus(), message:LAST_BUILD_STATUS.message};
    } catch (err) {
      fs.writeFileSync(path.join(ERR_DIR, 'son_hata.txt'), `${new Date().toISOString()}
AUTO ERP error; folder fallback çalışacak
${err.stack || err.message}`, 'utf8');
      const dashboardData = buildData();
      LAST_BUILD_STATUS = Object.assign({}, LAST_BUILD_STATUS, {mode:'folder_fallback', ok:false, message:'ERP çekimi başarısız; klasör robotuna dönüldü: ' + err.message, busy:false});
      return {ok:false, mode:'folder_fallback', dashboardData, status:autoStatus(), message:LAST_BUILD_STATUS.message, error:err.message};
    }
  }
  const dashboardData = buildData();
  LAST_BUILD_STATUS = Object.assign({}, LAST_BUILD_STATUS, {mode:'folder', ok:true, message:'API bilgisi yok veya ERP ID boş; otomatik klasör robotu çalıştı.', busy:false});
  return {ok:true, mode:'folder', dashboardData, status:autoStatus(), message:LAST_BUILD_STATUS.message};
}
function scheduleBuildData(reason='Dosya değişikliği'){
  if (BUILD_TIMER) clearTimeout(BUILD_TIMER);
  BUILD_TIMER = setTimeout(() => {
    try {
      LAST_BUILD_STATUS = Object.assign({}, LAST_BUILD_STATUS, {busy:true, message:`${reason}: otomatik yeniden okuma başladı.`});
      buildData();
      LAST_BUILD_STATUS = Object.assign({}, LAST_BUILD_STATUS, {busy:false, message:`${reason}: dashboard-data.json otomatik güncellendi.`});
      console.log('[AUTO]', LAST_BUILD_STATUS.message);
    } catch (err) {
      LAST_BUILD_STATUS = Object.assign({}, LAST_BUILD_STATUS, {busy:false, ok:false, errorCount:(LAST_BUILD_STATUS.errorCount||0)+1, message:'Watcher build hatası: ' + err.message});
      fs.writeFileSync(path.join(ERR_DIR, 'son_hata.txt'), `${new Date().toISOString()}
Watcher error
${err.stack || err.message}`, 'utf8');
      console.error('[AUTO WATCHER]', err);
    }
  }, 1000);
}
function startFolderWatcher(){
  if (!WATCH_REPORTS || WATCHER_STARTED) return;
  ensureDirs();
  WATCHER_STARTED = true;
  const watchOne = dir => {
    try {
      fs.watch(dir, {persistent:true}, (eventType, fileName) => {
        if (!fileName) return;
        if (!/\.(xlsx|xlsm|csv|json)$/i.test(String(fileName))) return;
        scheduleBuildData(`${path.relative(ROOT, dir)} içinde ${fileName} değişti`);
      });
    } catch (err) {
      console.warn('Watcher başlatılamadı:', dir, err.message);
    }
  };
  watchOne(REPORT_DIR);
  HOTEL_DEFS.forEach(h => watchOne(path.join(REPORT_DIR, h.id)));
  console.log('Otomatik klasör izleme aktif: 02_RAPORLAR');
}

function startServer(){
  buildData();
  startFolderWatcher();
  http.createServer(async (req,res) => {
    const reqPath = req.url.split('?')[0];
    if (reqPath === '/rebuild') {
      try { const dashboardData = buildData(); await sendJson(res, 200, {ok:true, mode:'folder', dashboardData, status:autoStatus(), message:'02_RAPORLAR klasörü yeniden okundu.'}); }
      catch (err) { await sendJson(res, 500, {ok:false, error:err.message, status:autoStatus({ok:false})}); }
      return;
    }
    if (reqPath === '/api/erp/status') {
      try { const c = connector(); await sendJson(res, 200, Object.assign(c.status(), {automation:autoStatus()})); }
      catch (err) { await sendJson(res, 500, {ok:false, configured:false, message:err.message, error:err.message, automation:autoStatus({ok:false})}); }
      return;
    }
    if (reqPath === '/api/auto/status') {
      await sendJson(res, 200, autoStatus());
      return;
    }
    if (reqPath === '/api/auto/sync') {
      try { const out = await runAutoSync(); await sendJson(res, 200, out); }
      catch (err) { LAST_BUILD_STATUS = Object.assign({}, LAST_BUILD_STATUS, {busy:false, ok:false, errorCount:(LAST_BUILD_STATUS.errorCount||0)+1, message:err.message}); await sendJson(res, 500, {ok:false, error:err.message, status:autoStatus()}); }
      return;
    }
    if (reqPath === '/api/folder/status') {
      await sendJson(res, 200, {ok:true, reportDir:REPORT_DIR, files:walkFiles(REPORT_DIR).map(f => path.relative(REPORT_DIR, f)), status:autoStatus()});
      return;
    }
    if (reqPath === '/api/erp/test') {
      try { const c = connector(); const out = await c.test(); await sendJson(res, out.ok ? 200 : 400, out); }
      catch (err) { await sendJson(res, 500, {ok:false, message:'ERP bağlantı testi başarısız.', error:err.message}); }
      return;
    }
    if (reqPath === '/api/erp/sync') {
      try {
        await readBody(req);
        const c = connector();
        const apiResult = await c.sync();
        const dashboardData = buildDashboardFromApi(apiResult);
        await sendJson(res, 200, {ok:true, dashboardData, reportCount:apiResult.reportCount, errorCount:apiResult.errorCount, lastSync:apiResult.lastSync, status:apiResult.status});
      } catch (err) {
        fs.writeFileSync(path.join(ERR_DIR, 'son_hata.txt'), `${new Date().toISOString()}
ERP sync error
${err.stack || err.message}`, 'utf8');
        await sendJson(res, 500, {ok:false, message:'ERP canlı veri çekimi başarısız.', error:err.message});
      }
      return;
    }
    const urlPath = decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]);
    const safePath = urlPath.replace(/\\/g,'/');
    const blocked = safePath === '/.env' || safePath.startsWith('/config/') || safePath.startsWith('/04_HATA/') || safePath.startsWith('/connectors/') || safePath === '/server.js' || safePath === '/package.json';
    if (blocked) { res.writeHead(403, {'Content-Type':'text/plain; charset=utf-8'}); res.end('Bu dosya güvenlik nedeniyle yayınlanmaz.'); return; }
    const full = path.normalize(path.join(ROOT, urlPath));
    if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end('Dosya bulunamadı'); return;
    }
    res.writeHead(200, {'Content-Type':contentType(full)});
    fs.createReadStream(full).pipe(res);
  }).listen(PORT, () => {
    console.log(`ERP Mutabakat HTML System V223 OTOMATIK çalışıyor: http://localhost:${PORT}`);
    console.log('Otomatik mod: önce 02_RAPORLAR klasörü. .env + erpId varsa ERP canlı connector da kullanılabilir.');
    console.log('Raporları 02_RAPORLAR/ADAM_EVE, SEGINUS, ALHAMBRA, HOLIDAY, DRAGON klasörlerine koyun; sistem otomatik okur.');
    console.log('Manuel yenileme: http://localhost:' + PORT + '/rebuild');
  });
}
if (process.argv.includes('--rebuild-only')) {
  buildData();
  console.log('dashboard-data.json klasörden yeniden oluşturuldu.');
} else {
  startServer();
}
