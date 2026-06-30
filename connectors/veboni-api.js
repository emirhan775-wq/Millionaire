const fs = require('fs');
const path = require('path');
let XLSX = null;
try { XLSX = require('xlsx'); } catch { console.warn('[!] Veboni connector: XLSX bulunamadı'); }

function normalizeBaseUrl(url){
  return String(url || '').trim().replace(/\/+$/, '');
}
function todayISO(){
  const d = new Date();
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function safeJson(filePath, fallback){
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}
function replaceTpl(value, ctx){
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  return value.replace(/{{\s*(\w+)\s*}}/g, (_, key) => String(ctx[key] ?? ''));
}
function fillObject(obj, ctx){
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(x => fillObject(x, ctx));
  return Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, typeof v === 'object' ? fillObject(v, ctx) : replaceTpl(v, ctx)]));
}
function matrixToRows(matrix){
  const rows = (matrix || []).filter(r => Array.isArray(r) && r.some(v => String(v ?? '').trim() !== ''));
  if (!rows.length) return [];
  const maxLook = Math.min(25, rows.length);
  const known = ['TARIH','HESAP','HESAP KODU','ACIKLAMA','TUTAR','BAKIYE','BORC','ALACAK','GELIR','REVENUE','KDV','MATRAH','ODA','ROOM','FOLIO','PARA','DEPARTMAN','URUN','CHECK','MUSTERI'];
  const norm = s => String(s ?? '').toUpperCase().replace(/İ/g,'I').replace(/Ş/g,'S').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ö/g,'O').replace(/Ç/g,'C');
  let best = -1, score = 0;
  for (let i=0;i<maxLook;i++) {
    const text = norm(rows[i].join(' '));
    const non = rows[i].filter(v => String(v ?? '').trim() !== '').length;
    const sc = known.reduce((a,k)=>a+(text.includes(k)?3:0),0) + Math.min(non, 8);
    if (sc > score) { score = sc; best = i; }
  }
  if (best < 0 || score < 4) {
    const maxLen = Math.max(...rows.map(r=>r.length));
    const headers = Array.from({length:maxLen}, (_,i)=>`Kolon${i+1}`);
    return rows.map(r => Object.fromEntries(headers.map((h,i)=>[h, r[i] ?? ''])));
  }
  const headers = rows[best].map((h,i)=>String(h || '').trim() || `Kolon${i+1}`);
  return rows.slice(best+1).map(r => Object.fromEntries(headers.map((h,i)=>[h, r[i] ?? '']))).filter(o => Object.values(o).some(v => String(v ?? '').trim() !== ''));
}
function extractRows(payload){
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.result)) return payload.result;
  if (payload.data && Array.isArray(payload.data.rows)) return payload.data.rows;
  if (payload.result && Array.isArray(payload.result.rows)) return payload.result.rows;
  if (payload.value && Array.isArray(payload.value)) return payload.value;
  return [payload];
}
function parseExcelBuffer(buffer){
  const wb = XLSX.read(buffer, {type:'buffer', cellDates:true, raw:false});
  const sheet = wb.SheetNames[0];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {header:1, defval:'', blankrows:false, raw:false});
  return matrixToRows(matrix);
}
class VeboniConnector {
  constructor(rootDir){
    this.rootDir = rootDir;
    this.configDir = path.join(rootDir, 'config');
    this.baseUrl = normalizeBaseUrl(process.env.VEBONI_BASE_URL);
    this.authMode = String(process.env.VEBONI_AUTH_MODE || 'token').toLowerCase();
    this.token = process.env.VEBONI_TOKEN || '';
    this.username = process.env.VEBONI_USERNAME || '';
    this.password = process.env.VEBONI_PASSWORD || '';
    this.loginPath = process.env.VEBONI_LOGIN_PATH || '/auth/login';
    this.tokenField = process.env.VEBONI_TOKEN_FIELD || 'token';
    this.timeoutMs = Number(process.env.VEBONI_TIMEOUT_MS || 60000);
    this.dateFrom = process.env.VEBONI_DATE_FROM || todayISO();
    this.dateTo = process.env.VEBONI_DATE_TO || todayISO();
    this.hotels = safeJson(path.join(this.configDir, 'hotels.json'), []);
    const endpointJson = safeJson(path.join(this.configDir, 'veboni-endpoints.json'), {reports:{}});
    this.reports = endpointJson.reports || {};
    this.lastSync = '';
    this.lastLogs = [];
  }
  isConfigured(){
    if (!this.baseUrl) return false;
    if (this.authMode === 'none') return true;
    if (this.authMode === 'token') return !!this.token;
    if (this.authMode === 'basic' || this.authMode === 'login') return !!(this.username && this.password);
    return false;
  }
  status(extra={}){
    return Object.assign({
      ok: this.isConfigured(),
      configured: this.isConfigured(),
      mode: this.authMode,
      baseUrl: this.baseUrl || '',
      endpointCount: Object.keys(this.reports).length,
      hotels: this.hotels.map(h => ({id:h.id, name:h.name, erpId:h.erpId || '', status:h.erpId ? 'Hazır' : 'ERP ID Bekliyor', reportCount:0, errorCount:0})),
      lastSync: this.lastSync,
      reportCount: 0,
      errorCount: 0,
      message: this.isConfigured() ? 'Connector ayarları okunuyor.' : 'VEBONI_BASE_URL ve kimlik bilgileri .env içinde doldurulmalı.'
    }, extra);
  }
  async ensureAuth(){
    if (this.authMode !== 'login' || this.token) return;
    const url = this.baseUrl + this.loginPath;
    const res = await this.fetchWithTimeout(url, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username:this.username, password:this.password})
    });
    const data = await res.json();
    const token = data?.[this.tokenField] || data?.data?.[this.tokenField] || data?.accessToken || data?.token;
    if (!token) throw new Error('Login başarılı görünmedi: token alanı bulunamadı. VEBONI_TOKEN_FIELD değerini kontrol edin.');
    this.token = token;
  }
  authHeaders(){
    if (this.authMode === 'token' || this.authMode === 'login') return this.token ? {Authorization:`Bearer ${this.token}`} : {};
    if (this.authMode === 'basic') return {Authorization:'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64')};
    return {};
  }
  async fetchWithTimeout(url, options={}){
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      return await fetch(url, Object.assign({}, options, {signal:ctrl.signal}));
    } finally {
      clearTimeout(timer);
    }
  }
  buildUrl(reportDef, ctx){
    const pathPart = replaceTpl(reportDef.path || '', ctx);
    const url = new URL(pathPart.startsWith('http') ? pathPart : this.baseUrl + '/' + pathPart.replace(/^\/+/, ''));
    const query = fillObject(reportDef.query || {}, ctx);
    Object.entries(query || {}).forEach(([k,v]) => {
      if (v !== undefined && v !== null && String(v) !== '') url.searchParams.set(k, String(v));
    });
    return url.toString();
  }
  async requestReport(reportKey, reportDef, hotel){
    const ctx = {hotelId:hotel.erpId || hotel.id || '', hotelCode:hotel.id || '', hotelName:hotel.name || '', dateFrom:this.dateFrom, dateTo:this.dateTo, reportCode:reportDef.code || reportKey};
    if (!ctx.hotelId) throw new Error(`${hotel.name || hotel.id} için erpId boş. config/hotels.json doldurulmalı.`);
    const method = String(reportDef.method || 'GET').toUpperCase();
    const headers = Object.assign({'Accept':'application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv'}, this.authHeaders(), reportDef.headers || {});
    let body;
    if (method !== 'GET' && reportDef.body) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      body = JSON.stringify(fillObject(reportDef.body, ctx));
    }
    const url = this.buildUrl(reportDef, ctx);
    const res = await this.fetchWithTimeout(url, {method, headers, body});
    if (!res.ok) {
      const txt = await res.text().catch(()=> '');
      throw new Error(`${reportDef.code || reportKey} HTTP ${res.status}: ${txt.slice(0,500)}`);
    }
    const ctype = String(res.headers.get('content-type') || '').toLowerCase();
    if (ctype.includes('spreadsheet') || ctype.includes('excel') || ctype.includes('application/octet-stream')) {
      const buf = Buffer.from(await res.arrayBuffer());
      return parseExcelBuffer(buf);
    }
    if (ctype.includes('csv')) {
      const text = await res.text();
      const wb = XLSX.read(text, {type:'string', raw:false});
      const sheet = wb.SheetNames[0];
      const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {header:1, defval:'', blankrows:false, raw:false});
      return matrixToRows(matrix);
    }
    const payload = await res.json();
    return extractRows(payload);
  }
  async test(){
    if (!this.isConfigured()) return {ok:false, message:'Connector ayarları eksik. .env dosyasını doldurun.', status:this.status({ok:false})};
    await this.ensureAuth();
    return {ok:true, message:'Kimlik doğrulama ayarları geçerli görünüyor. Endpoint testini canlı senkron ile yapabilirsiniz.', status:this.status({ok:true, message:'Bağlantı testi başarılı.'})};
  }
  async sync(){
    if (!this.isConfigured()) throw new Error('Connector ayarları eksik. .env dosyasında VEBONI_BASE_URL ve auth bilgileri doldurulmalı.');
    await this.ensureAuth();
    this.lastLogs = [];
    let totalReports = 0;
    let totalErrors = 0;
    const resultHotels = [];
    for (const hotel of this.hotels) {
      const raw = {};
      let hReports = 0, hErrors = 0;
      for (const [key, def] of Object.entries(this.reports)) {
        try {
          const rows = await this.requestReport(key, def, hotel);
          raw[key] = rows;
          hReports += 1; totalReports += 1;
          this.lastLogs.push({time:new Date().toISOString(), process:'ERP API Rapor', fileName:`${hotel.name} / ${def.code || key}`, status:rows.length ? 'Çalıştı' : 'Uyarı', desc:`${def.label || key} API üzerinden çekildi. Satır: ${rows.length}`, errorMsg: rows.length ? '' : '0 satır', actionRequired:!rows.length});
        } catch (err) {
          raw[key] = [];
          hErrors += 1; totalErrors += 1;
          this.lastLogs.push({time:new Date().toISOString(), process:'ERP API Rapor', fileName:`${hotel.name} / ${def.code || key}`, status:'Hata', desc:`${def.label || key} çekilemedi.`, errorMsg:err.message, actionRequired:true});
        }
      }
      resultHotels.push({id:hotel.id, name:hotel.name, short:hotel.short, erpId:hotel.erpId || '', raw, logs:this.lastLogs.filter(l => l.fileName.startsWith(hotel.name)), syncStatus:{reportCount:hReports, errorCount:hErrors, status:hErrors ? 'Uyarı' : 'Çalıştı'}});
    }
    this.lastSync = new Date().toLocaleString('tr-TR');
    return {hotels:resultHotels, logs:this.lastLogs, reportCount:totalReports, errorCount:totalErrors, lastSync:this.lastSync, status:this.status({ok:totalErrors===0, reportCount:totalReports, errorCount:totalErrors, lastSync:this.lastSync, hotels:resultHotels.map(h => ({id:h.id, name:h.name, erpId:h.erpId, reportCount:h.syncStatus.reportCount, errorCount:h.syncStatus.errorCount, status:h.syncStatus.status})), message: totalErrors ? 'Senkron tamamlandı; bazı raporlar hata verdi.' : 'ERP senkronizasyonu tamamlandı.'})};
  }
}

module.exports = { VeboniConnector };
