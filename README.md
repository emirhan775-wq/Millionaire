# KDV Beyanname Hata Nedenli Robot (Şube Şube / Merkezler Hariç)

Çok şubeli (otel grubu) bir işletme için **KDV1 beyanname icmalini** şube bazında
hesaplayan, 600 / 610 / 191 / 391 hesap hareketlerinden hareketle **hatalı KDV
tutarlarının nedenini** ve **kontrol edilecek fiş/hesap alanını** otomatik üreten
formüllü bir Excel robotudur. Merkez şubeler (GİTAŞ MERKEZ / SERTAŞ MERKEZ)
kapsam dışıdır.

## Dosya

`KDV_BEYANNAME_HATA_NEDENLI_FORMULLU_ROBOT_SUBE_SUBE.xlsx`

Profesyonel, renkli ve mevzuata uygun biçimde hazırlanmıştır. Çalışma kitabındaki
tüm hesaplama formülleri ve çapraz referanslar korunmuştur; yalnızca görsel
düzen (renk teması, başlık bantları, sayı/oran biçimleri, durum bazlı koşullu
biçimlendirme, donmuş bölmeler ve otomatik filtre) eklenmiştir.

## Sayfalar

| Sayfa | İçerik |
|-------|--------|
| **DASHBOARD** | Toplam 391/191, net KDV, genel sonuç ve şube bazlı özet + hata nedeni |
| **RAW_HESAP_KARTLARI** | Hesap kartları ham verisi (rapor buraya yapıştırılır) |
| **KDV_BEYAN_ICMAL** | Şube şube KDV1 icmali (matrah, hesaplanan, indirilecek, ilave, iade, net) |
| **KDV_ORAN_KONTROL** | Oran ↔ hesap eşleşme kontrolü ve fark/durum analizi |
| **HATA_NEDEN_MOTORU** | Fark veren satır için hata nedeni ve kontrol edilecek fiş/hesap |
| **KDV_HESAP_TABANI** | Şube bazlı çekirdek hesaplama motoru (tüm sayfalar buradan beslenir) |
| **GIDER_7xx_191** | 7'li gider hesapları ↔ 191 indirilecek KDV risk özeti |
| **KDV_NASIL_HESAPLANIR** | KDV hesaplama mantığı + mini hesap makinesi |
| **BEYANNAME_YOL_HARITASI** | Hangi KDV hangi beyannamenin konusu (KDV1 / KDV2) |
| **AYARLAR** | Tolerans, RAW aralığı ve şube listesi |
| **KAYNAKLAR** | GİB mevzuat ve beyanname kaynakları (3065 sayılı KDV Kanunu, oran listesi) |
| **KULLANIM** | Adım adım kullanım talimatı |

## Renk / Durum Lejantı

- 🟢 **TUTUYOR / DEVREDEN KDV / DÜŞÜK** — tolerans içinde
- 🟡 **KÜÇÜK FARK / ORTA** — incelenmeli
- 🔴 **TUTMUYOR / YÜKSEK / Kritik Fark** — hatalı, kontrol gerekli
- ⚪ **HAREKET YOK** — ilgili grupta hareket yok

## Kullanım

1. `RAW_HESAP_KARTLARI` sayfasına yeni hesap kartları raporunu A1'den itibaren
   başlıklarıyla yapıştırın.
2. Hesaplama otomatik değilse **F9** ile yenileyin.
3. `DASHBOARD` ve `KDV_BEYAN_ICMAL` özetini, fark veren satırlar için
   `KDV_ORAN_KONTROL` / `HATA_NEDEN_MOTORU` sayfalarını inceleyin.

## Yeniden üretme

```bash
python3 scripts/format_kdv_template.py <kaynak.xlsx> <cikti.xlsx>
```

KDV oranları (%1 / %10 / %20) 3065 sayılı KDV Kanunu ve GİB güncel oran
listesine göredir.
