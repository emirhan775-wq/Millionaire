═════════════════════════════════════════════════════════════════════════════════
  ERP MUTABAKAT SİSTEMİ — KURULUM VE KULLANIM KILAVUZU
═════════════════════════════════════════════════════════════════════════════════

PROJE YAPISI
─────────────────────────────────────────────────────────────────────────────────

ERP_MUTABAKAT_HTML_SYSTEM/
│
├─ index.html                    [Ana sayfa - SPA mantığıyla çalışır]
├─ assets/
│   └─ app.js                    [Tüm JavaScript mantığı]
├─ data/
│   └─ dashboard-data.json       [Veri kaynağı - raporlar buradan okunur]
├─ 02_RAPORLAR/                  [Kullanıcı Excel/CSV dosyalarını buraya atar]
├─ 04_HATA/                      [Log dosyaları]
│   ├─ log.txt
│   └─ son_hata.txt
└─ README_KURULUM.txt            [Bu dosya]


KURULUM
─────────────────────────────────────────────────────────────────────────────────

1. DOSYA YAPISI
   Proje klasörünün içinde bu dosyaları bulundurunuz:
   - index.html
   - assets/app.js
   - assets/style.css (isteğe bağlı - CSS index.html içine gömülüdür)
   - data/dashboard-data.json
   - 02_RAPORLAR/ (klasör)
   - 04_HATA/ (klasör)

2. HTML AÇMA
   • Tarayıcıda doğrudan açın: File → Open → index.html
   • Veya localhost'ta sunun: python -m http.server 8000
   • Önerilen tarayıcı: Chrome, Firefox, Edge (son sürüm)

3. İLK VERİ YÜKLEME
   Sistem başladığında:
   ✓ data/dashboard-data.json'ı otomatik okur
   ✓ Dosya yoksa fallback (demo) verisi kullanır
   ✓ Ekranda "Canlı veri bulunamadı" mesajı gösterilir


VERİ YÜKLEME YÖNTEMLERI
─────────────────────────────────────────────────────────────────────────────────

YÖNTEM 1: DOSYA YÜKLEME (TAVSIYE EDILEN)
──────────────────────────────────────────

1. Sidebar → "Veri Yükleme" sayfasına git
2. "📁 Dosya Seç" düğmesine tıkla
3. Excel (.xlsx), CSV veya JSON dosyalarını seç
4. Dosya adından rapor tipi otomatik tanınır:

   Dosya Adı Örneği           → Rapor Tipi
   ──────────────────────────────────────
   3010_KASA.xlsx             → Raw_3010
   3014_TAHSILAT.xlsx         → Raw_3014
   3025_EKSTRA_SATIS.xlsx     → Raw_3025
   3026_KDV.xlsx              → Raw_3026
   3035_GELIR.xlsx            → Raw_3035
   3000_RAPOR.xlsx            → Raw_3000
   181_BALANS.xlsx            → Raw_181
   HESAP_KARTLARI.xlsx        → Raw_HesapKartlari
   MUHASEBE_HAREKETLERI.xlsx  → Raw_Muhasebe

5. Yüklenen dosyalar listelenir
6. "✅ Dashboardu Güncelle" düğmesine tıkla
7. Dashboard otomatik olarak güncellenir


YÖNTEM 2: JSON VERİSİ (PROGRAMCI İÇİN)
────────────────────────────────────────

data/dashboard-data.json dosyasını düzenle:

{
  "meta": {
    "hotel": "ADAM & EVE OTEL",
    "lastUpdate": "2026-06-30 20:45",
    "status": "ORTA FARK"
  },
  "raw": {
    "Raw_3010": [ {...} ],
    "Raw_3014": [ {...} ],
    "Raw_3025": [ {...} ],
    "Raw_3026": [ {...} ],
    "Raw_3035": [ {...} ],
    "Raw_3000": [ {...} ],
    "Raw_181": [ {...} ],
    "Raw_HesapKartlari": [ {...} ],
    "Raw_Muhasebe": [ {...} ]
  },
  "summary": {
    "totalRevenue": 2788958,
    "roomRevenue": 2682232,
    ...
  },
  "alerts": [ {...} ],
  "logs": [ {...} ]
}


YÖNTEM 3: NODE.JS LOKAL VERİ MOTORU (İLERİ KULLANıCıLAR)
───────────────────────────────────────────────────────────

1. Node.js yükle (https://nodejs.org/)
2. Proje klasöründe terminal aç
3. Şu komutları çalıştır:

   npm install xlsx   (Excel okuma kütüphanesi)

4. server.js oluştur ve şu kodu ekle:

   const fs = require('fs');
   const XLSX = require('xlsx');
   const path = require('path');

   const raporlarDir = './02_RAPORLAR';
   const outputFile = './data/dashboard-data.json';

   let raw = {
     Raw_3010: [],
     Raw_3014: [],
     Raw_3025: [],
     Raw_3026: [],
     Raw_3035: [],
     Raw_3000: [],
     Raw_181: [],
     Raw_HesapKartlari: [],
     Raw_Muhasebe: []
   };

   function classifyFile(fileName) {
     const upper = fileName.toUpperCase();
     if (upper.includes('3010')) return 'Raw_3010';
     if (upper.includes('3014')) return 'Raw_3014';
     if (upper.includes('3025')) return 'Raw_3025';
     if (upper.includes('3026')) return 'Raw_3026';
     if (upper.includes('3035')) return 'Raw_3035';
     if (upper.includes('3000')) return 'Raw_3000';
     if (upper.includes('181') || upper.includes('BALANS')) return 'Raw_181';
     if (upper.includes('HESAP KART') || upper.includes('100') || upper.includes('108')) return 'Raw_HesapKartlari';
     if (upper.includes('MUHASEBE')) return 'Raw_Muhasebe';
     return 'unknown';
   }

   // 02_RAPORLAR klasörünü tara
   const files = fs.readdirSync(raporlarDir);
   files.forEach(file => {
     const filePath = path.join(raporlarDir, file);
     if (file.match(/\.(xlsx|xlsm|csv)$/i)) {
       try {
         const workbook = XLSX.readFile(filePath);
         const worksheet = workbook.Sheets[workbook.SheetNames[0]];
         const jsonData = XLSX.utils.sheet_to_json(worksheet);
         const type = classifyFile(file);

         if (type !== 'unknown') {
           raw[type] = jsonData;
           console.log(`✓ ${file} → ${type} (${jsonData.length} satır)`);
         }
       } catch (e) {
         console.error(`✗ ${file}: ${e.message}`);
       }
     }
   });

   // data/dashboard-data.json oluştur
   const output = {
     meta: {
       hotel: "ADAM & EVE OTEL",
       lastUpdate: new Date().toLocaleString('tr-TR'),
       status: "ORTA FARK"
     },
     raw: raw,
     summary: {},
     alerts: [],
     logs: []
   };

   fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
   console.log(`✓ ${outputFile} oluşturuldu`);

5. Komutla çalıştır:
   node server.js

6. 02_RAPORLAR klasörünü tarar ve data/dashboard-data.json'ı otomatik oluşturur


BUTON VE SAYFA NAVİGASYONU
─────────────────────────────────────────────────────────────────────────────────

SİDEBAR MENÜLER (Hepsi Çalışıyor)
──────────────────────────────────

Ana Menü:
  • 🏠 Dashboard              → Ana dashboard sayfası
  • 🤖 Otomatik Kontrol       → Tüm otomatik kontrollerin durumu
  • 📥 Veri Yükleme          → Excel/CSV/JSON yükleme

Finans Kontrol:
  • ⚖ 181 ↔ 3010            → Balans kontrol detayı
  • 🧮 Mizan Kontrol         → Hesap kartları kontrol
  • 🟨 3026 Kon.Tax          → KDV ve konaklama vergisi
  • 📊 Fark Analizi          → Fark analizi raporları
  • 🚨 Uyarı Listesi         → Tüm uyarılar ve dikkat edilecekler

Raporlar:
  • 💱 Güncel Kurlar         → Döviz kurları
  • 🛒 Ekstra Satış          → 3025 raporu
  • 🧠 Neden Motoru          → Fark nedenleri
  • 📜 Log                   → Sistem log kaydı

Sistem:
  • 🛠 Otomatik Ayarlar      → Sistem ayarları
  • 📌 Ana Menü              → Menu


TOPBAR BUTONLARI
────────────────

• ↻ Yenile                    → Sayfayı yenile (F5 gibi)
• 📜 Log                      → Log sayfasını aç
• 🔔 Bildirimler             → Uyarı listesini aç
• A (Avatar)                 → Profil (isteğe bağlı)


KART ACTIONLARI (DASHBOARD)
────────────────────────────

Kart başlıklarında "↗ Detay" veya "↗ Neden Motoru" butonları:

• ④ Mizan Kartında          → "↗ Detay" → Mizan Kontrol sayfası
• ⑤ Ekstra Satış Kartında   → "↗ Detay" → Ekstra Satış sayfası
• ⑩ Kritik Farklar Kartında → "↗ Neden Motoru" → Fark Neden Motoru sayfası


HESAPLAMA MOTORLARI
─────────────────────────────────────────────────────────────────────────────────

Sistem şu kontrolleri otomatik yapar:

1. 181 ↔ 3010 BALANS KONTROLÜ
   ─────────────────────────────
   • 181.01.01.0001 hesabı ile 3010 balance karşılaştırılır
   • Fark hesaplanır

   Tolerans:
   - 0 - 1 TL              → MUTABIK (✅)
   - 1 - 1.000 TL          → ORTA FARK (⚡)
   - 1.000+ TL             → KRİTİK FARK (🚨)

   Sonuç: Dashboard'un sağ üstünde durumu gösterilir


2. 3014 KASA / TAHSİLAT KONTROLÜ
   ─────────────────────────────
   • TL, EUR, USD, GBP kredi kartı tahsilatları ayrıştırılır
   • Nakit kasalar kontrol edilir
   • City Ledger transferleri doğrulanır


3. 3035 GELIR KONTROLÜ
   ────────────────────
   Şu KPI'lar otomatik hesaplanır:
   • Toplam Gelir
   • Oda Geliri
   • F&B Gelirleri
   • Diğer Gelirler
   • Doluluk %
   • ADR (Average Daily Rate)
   • RevPAR
   • MTD/YTD değerleri


4. 3025 EKSTRA SATIŞLAR
   ─────────────────────
   • Ürün grubu bazlı gelir ayrıştırılır
   • F&B, alkollü içecek, minibar gibi kategoriler eşleştirilir
   • Eksik mapping varsa uyarı listesine yazılır


5. 3026 / KONAKLAMA VERGİSİ / KDV KONTROLÜ
   ─────────────────────────────────────────
   • KDV %10 ve %20 ayrıştırılır
   • 391 KDV hesaplarıyla karşılaştırılır
   • Konaklama Vergisi (360.01.01.0016) kontrol edilir
   • Mutabık / Fark / Veri Yok durumları dashboard'a yazılır


6. FARK NEDEN MOTORU
   ──────────────────
   Fark tespit edilirse olası nedenleri otomatik üretir:

   [RN001] Raporlar farklı tarih/saatte alınmış
   [RN002] Gün sonu kapanışı yapılmamış
   [RN003] 3010/3035/3026 farklı kesit saatinden alınmış
   [RN004] City Ledger transferi eksik
   [RN005] Guest ledger devri eksik
   [RN006] Ön büro tahsilatı muhasebeye aktarılmamış
   [RN007] KDV mapping eksik
   [RN008] Ürün açıklaması hesap koduna eşleşmemiş
   [RN009] Kur farkı
   [RN010] Yuvarlama farkı
   [RN011] Manuel muhasebe kaydı


LOG SİSTEMİ
─────────────────────────────────────────────────────────────────────────────────

Her işlem otomatik kaydedilir:

Tarih/Saat              İşlem       Dosya/Rapor     Durum      Açıklama
──────────────────────────────────────────────────────────────────────────
2026-06-30 20:45:22     OKUMA       3010            ok         Kasa Raporu okundu
2026-06-30 20:44:15     OKUMA       3035            ok         Revenue Raporu okundu
2026-06-30 20:43:08     KONTROL     181             warn       Fark tespit edildi


HATA YÖNETİMİ
─────────────────────────────────────────────────────────────────────────────────

Sistem sağlamdır ve çökmez:

✓ Bir dosya okunamazsa diğerleri okunmaya devam eder
✓ Boş dosya varsa "0 satır / atlandı" yazsın
✓ Başlık bulunamazsa "Kolon1, Kolon2, Kolon3..." kullanılır
✓ Bilinmeyen dosya varsa "Rapor tipi tanınmadı" yazılır
✓ JSON yoksa fallback statik veriye düşer
✓ Kullanıcıya ekranda anlaşılır uyarı verilir
✓ Console'da detaylı error mesajları yazılır
✓ Log listesine tüm işlemler kaydedilir


ÖZEL NOTLAR
─────────────────────────────────────────────────────────────────────────────────

1. TÜRKÇE KARAKTERLERİ
   Excel dosyalarındaki Türkçe karakterler otomatik normalize edilir:
   İ → I, Ş → S, Ğ → G, Ü → U, Ö → O, Ç → C

2. PARA BİRİMLERİ
   USD, EUR, GBP gibi farklı para birimlerine göre kuru otomatik uygulanır.
   GUNCEL_KURLAR sayfasından kurlar güncellenebilir.

3. DASHBOARD GÜNCELLEME
   Veri yüklendikten sonra dashboard otomatik güncellenir.
   Manüel güncelleme: Topbar'daki "↻ Yenile" düğmesine tıkla.

4. BROWSERİ REFRESH ETME
   HTML açıkken F5 veya Ctrl+R tuşlarıyla sayfayı yenile.
   Veri kaybı olmaz - JSON'dan tekrar yüklenir.

5. RESPONSIVE TASARIM
   Tüm kartlar, tablolar ve butonlar telefonda da çalışır.
   Sidebar mobilde daraltılabilir (isteğe bağlı).


SORUN GİDERME
─────────────────────────────────────────────────────────────────────────────────

P: "Dosya yüklenmiyor"
C: • 02_RAPORLAR klasörüne dosya kopyalandı mı?
   • Dosya adı rapor tipi içeriyor mu (3010, 181, vb.)?
   • Excel dosyası başlık satırı var mı?

P: "JSON yüklenmediğinde fallback veri yok"
C: • data/dashboard-data.json dosyasının yolu doğru mu?
   • JSON formatı hatalı mı? (JSON linter ile kontrol et)

P: "Butonlar çalışmıyor"
C: • JavaScript hata var mı? (F12 → Console'a bak)
   • app.js dosyası doğru yolda mı?
   • HTML'de SheetJS CDN yükleniyor mu?

P: "Sayfalar değişmiyor"
C: • Sidebar menüye tıkladın mı?
   • data-page ve onclick attribute'leri var mı?
   • Tarayıcının console'unda hata var mı?

P: "KPI kartları güncellenmemiş"
C: • Veri yükleme sayfasında "✅ Dashboardu Güncelle" butonuna tıkla
   • JSON'da summary değerleri dolu mu?


GELECEK GELİŞTİRMELER (İSTEĞE BAĞLI)
─────────────────────────────────────────────────────────────────────────────────

1. Veritabanı entegrasyonu (MySQL, PostgreSQL)
2. Real-time WebSocket veri akışı
3. İstatistiksel öngörü (Machine Learning)
4. PDF rapor dışa aktarma
5. Email bildirimleri
6. Dashboard kişiselleştirme
7. Kullanıcı hesapları ve izinler
8. Gerçek zamanlı grafikler (Chart.js)
9. API endpoint'leri (REST/GraphQL)
10. Koşullu biçimlendirme (Conditional Formatting)


İLETİŞİM VE DESTEK
─────────────────────────────────────────────────────────────────────────────────

Sorun veya öneriniz için:
• Konsol hatalarını kaydet (F12)
• 04_HATA/log.txt dosyasını incele
• Sistem log sayfasını kontrol et


═════════════════════════════════════════════════════════════════════════════════
Son Güncelleme: 2026-06-30
Versiyon: 1.0
Durum: Üretim (Production) Hazır
═════════════════════════════════════════════════════════════════════════════════
