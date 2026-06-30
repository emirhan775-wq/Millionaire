ERP MUTABAKAT HTML SYSTEM — V223 OTOMATIK FIX
================================================

Bu sürüm V222'deki "API ayarı yoksa bekleyen/bozulan" akışı düzeltir.
Sistem artık otomatik olarak önce 02_RAPORLAR klasörünü okur. Veboni API bilgisi tam doldurulursa ERP'den canlı veri çeker; API eksikse sistem durmaz, klasör robotu ile çalışır.

1) EN KOLAY ÇALIŞTIRMA
----------------------
Windows'ta:

  START_DASHBOARD.bat

Bu dosya:
- Node.js var mı kontrol eder
- node_modules yoksa npm install yapar
- http://localhost:3080 adresini açar
- server.js'i başlatır
- 02_RAPORLAR klasörünü otomatik izler

2) MANUEL ÇALIŞTIRMA
--------------------
Terminal / CMD:

  npm install      (opsiyonel - sadece dotenv/xlsx gerekirse)
  npm start

Sonra tarayıcı:

  http://localhost:3080

NOT: Sistem Node built-in modules ile çalışır. npm install zorunlu değil.
     Excel desteği için: npm install xlsx

3) OTOMATİK RAPOR OKUMA
-----------------------
Raporları şu klasörlere at:

  02_RAPORLAR/ADAM_EVE
  02_RAPORLAR/SEGINUS
  02_RAPORLAR/ALHAMBRA
  02_RAPORLAR/HOLIDAY
  02_RAPORLAR/DRAGON

Dosya adında şu ifadeler geçerse sistem rapor tipini tanır:

  3010        -> Raw_3010
  3014        -> Raw_3014
  3025        -> Raw_3025
  3026        -> Raw_3026
  3035        -> Raw_3035
  3000        -> Raw_3000
  181/BALANS  -> Raw_181
  Hesap Kart / Kiracı / 120 / 340 / 100 / 108 -> Raw_HesapKartlari
  Muhasebe / Hareket / Virman / Mahsup / Fiş / Yevmiye -> Raw_Muhasebe

Rapor klasörüne yeni Excel/CSV/JSON atıldığında Node.js watcher otomatik yeniden okur ve data/dashboard-data.json dosyasını günceller.
Dashboard da 15 saniyede bir otomatik kontrol eder.

4) CANLI ERP / VEBONI API OPSİYONELDİR
--------------------------------------
API bilgisi yoksa sistem bozulmaz. Klasör robotu çalışır.
API kullanmak istersen:

  .env.example dosyasını .env olarak kopyala
  VEBONI_BASE_URL, VEBONI_TOKEN veya kullanıcı/şifre bilgilerini doldur
  config/hotels.json içinde her otelin erpId alanını doldur
  config/veboni-endpoints.json içindeki endpointleri gerçek Veboni yapısına göre doğrula

AUTO_MODE seçenekleri:

  folder_first  -> Varsayılan. API uygunsa ERP; değilse klasör robotu.
  folder_only   -> Sadece klasör robotu.

5) ÖNEMLİ
---------
index.html dosyasını çift tıklayıp file:// olarak açarsan tarayıcı güvenliği nedeniyle tam otomatik klasör okuma çalışmaz.
Tam otomatik kullanım için START_DASHBOARD.bat veya npm start ile localhost üzerinden aç.

6) SAYFALAR VE MODÜLLER
------------------------
ANA SAYFA (Dashboard):
- Toplam gelir, oda doluluk, ADR & RevPAR
- 181 ↔ 3010 balans kontrolü
- KDV robotu özet (anasayfada görsün)
- Virman/Mahsup robotu özet
- Kiracı 120/340 özet
- Muhasebe Komuta Merkezi

KONTROL SAYFALARI:
- KDV & Konaklama Vergisi (🟨 Kon.Tax)
  * 391.01.01.0002 (%10)
  * 391.01.01.0003 (%20)
  * 360.01.01.0016 (Konaklama Vergisi)
  * CSV Export

- Virman Kontrol (🔁 Virman)
  * 120/340 virman adayları
  * 191/391 mahsup etkisi
  * 646/656 kur farkı
  * 679/689 yuvarlama/düzeltme

- Kiracılar (🏬 Kiracılar 120/340)
  * 120.01.06/340.01.06 (Otel Kiracı)
  * 120.01.07/340.01.07 (AVM Kiracı)
  * 120.01.01/340.01.01 (Acente)
  * Ayrı sınıflandırma ve CSV

- Muhasebe Modu (🧑‍💼 Muhasebe)
  * Denetim skoru (0-100)
  * Kritik riskler listesi
  * Aksiyon önerileri
  * Denetçi raporu

7) HIZLI ENDPOINTLER
--------------------
  http://localhost:3080              -> Dashboard
  http://localhost:3080/rebuild      -> Klasörü manuel yeniden oku
  http://localhost:3080/api/auto/status -> Otomatik robot durumu
  http://localhost:3080/api/auto/sync   -> Otomatik çalıştır: API uygunsa ERP, değilse klasör

V223 notu: Bu sürüm "bozulmuş otomatik değil" şikayetini düzeltmek için klasör öncelikli, watcher destekli ve API opsiyonel çalışacak şekilde düzenlenmiştir.
