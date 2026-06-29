# -*- coding: utf-8 -*-
"""
KDV Beyanname Hata Nedenli Robot - Profesyonel / Renkli / Mevzuata Uygun Biçimlendirme
---------------------------------------------------------------------------------------
Bu betik mevcut çalışma kitabındaki TÜM formülleri, hücre değerlerini ve sayfa
yapısını koruyarak yalnızca görsel biçimlendirme (renk, çerçeve, başlık bandı,
sayı biçimi, koşullu biçimlendirme, donmuş bölmeler, otomatik filtre) uygular.

Çalıştırma:  python3 scripts/format_kdv_template.py <girdi.xlsx> <cikti.xlsx>
"""
import sys
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, NamedStyle
from openpyxl.formatting.rule import CellIsRule
from openpyxl.utils import get_column_letter

# ------------------------------------------------------------------ #
#  KURUMSAL RENK PALETİ (mali müşavirlik / resmi raporlama tonu)
# ------------------------------------------------------------------ #
NAVY        = "1F3A5F"   # Ana başlık bandı (koyu lacivert)
HEADER_BLUE = "2C5282"   # Tablo sütun başlıkları
SUBHEAD     = "3F5A78"   # İkincil başlık
ACCENT      = "0F766E"   # Vurgu (KPI etiketleri)
BAND_LIGHT  = "F4F7FB"   # Şerit - açık
WHITE       = "FFFFFF"
TOTAL_FILL  = "DCE6F4"   # Toplam satırı
KPI_LABEL   = "EAF1F8"   # KPI etiket arkaplanı
GRID        = "C9D4E2"   # İnce çerçeve

# Durum renkleri
GREEN_FILL  = "C6EFCE"; GREEN_TXT  = "1B7A36"
YEL_FILL    = "FFF2CC"; YEL_TXT    = "9C6500"
RED_FILL    = "FFC7CE"; RED_TXT    = "9C0006"
GRAY_FILL   = "E2E8F0"; GRAY_TXT   = "475569"
BLUE_FILL   = "D6E4F5"; BLUE_TXT   = "1F4E79"
ORANGE_FILL = "FCE2C4"; ORANGE_TXT = "B45309"

MONEY_FMT = '#,##0.00'
MONEY_TL  = '#,##0.00" ₺"'
PCT_FMT   = '0%'

thin = Side(style="thin", color=GRID)
ALL_BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)


def fill(hex_):
    return PatternFill("solid", fgColor=hex_)


def title_banner(ws, last_col, row=1, text=None):
    """Sayfa üstüne tam genişlik koyu lacivert başlık bandı."""
    c = ws.cell(row=row, column=1)
    if text is not None:
        c.value = text
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=last_col)
    c.font = Font(name="Calibri", bold=True, size=14, color=WHITE)
    c.fill = fill(NAVY)
    c.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[row].height = 28


def style_header(ws, header_row, first_col, last_col, color=HEADER_BLUE):
    for col in range(first_col, last_col + 1):
        c = ws.cell(row=header_row, column=col)
        c.font = Font(bold=True, size=10, color=WHITE)
        c.fill = fill(color)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = ALL_BORDER
    ws.row_dimensions[header_row].height = 32


def style_body(ws, first_row, last_row, first_col, last_col,
               money_cols=(), pct_cols=(), band=True, total_row=None):
    money_cols = set(money_cols)
    pct_cols = set(pct_cols)
    for r in range(first_row, last_row + 1):
        banded = band and ((r - first_row) % 2 == 1)
        is_total = (total_row is not None and r == total_row)
        for col in range(first_col, last_col + 1):
            c = ws.cell(row=r, column=col)
            c.border = ALL_BORDER
            c.font = Font(bold=is_total, size=10,
                          color="1A202C" if not is_total else "12345A")
            if is_total:
                c.fill = fill(TOTAL_FILL)
            elif banded:
                c.fill = fill(BAND_LIGHT)
            if col in money_cols:
                c.number_format = MONEY_TL if is_total else MONEY_FMT
                c.alignment = Alignment(horizontal="right", vertical="center")
            elif col in pct_cols:
                c.number_format = PCT_FMT
                c.alignment = Alignment(horizontal="center", vertical="center")
            else:
                c.alignment = Alignment(horizontal="left", vertical="center",
                                        wrap_text=True, indent=1)


def status_cf(ws, rng):
    """Durum sütunlarına TUTUYOR / KÜÇÜK FARK / TUTMUYOR / HAREKET YOK renkleri."""
    rules = [
        ("TUTUYOR",     GREEN_FILL, GREEN_TXT),
        ("TUTMUYOR",    RED_FILL,   RED_TXT),
        ("KÜÇÜK FARK",  YEL_FILL,   YEL_TXT),
        ("HAREKET YOK", GRAY_FILL,  GRAY_TXT),
    ]
    for txt, f, t in rules:
        ws.conditional_formatting.add(
            rng, CellIsRule(operator="equal", formula=['"%s"' % txt],
                            fill=fill(f), font=Font(bold=True, color=t)))


def result_cf(ws, rng):
    """Beyan sonucu: ÖDENECEK / DEVREDEN / SIFIR."""
    mapping = [
        ("ÖDENECEK KDV", ORANGE_FILL, ORANGE_TXT),
        ("DEVREDEN KDV", GREEN_FILL,  GREEN_TXT),
        ("SIFIR",        GRAY_FILL,   GRAY_TXT),
    ]
    for txt, f, t in mapping:
        ws.conditional_formatting.add(
            rng, CellIsRule(operator="equal", formula=['"%s"' % txt],
                            fill=fill(f), font=Font(bold=True, color=t)))


def priority_cf(ws, rng):
    mapping = [
        ("YÜKSEK", RED_FILL,   RED_TXT),
        ("ORTA",   ORANGE_FILL, ORANGE_TXT),
        ("DÜŞÜK",  GREEN_FILL,  GREEN_TXT),
    ]
    for txt, f, t in mapping:
        ws.conditional_formatting.add(
            rng, CellIsRule(operator="equal", formula=['"%s"' % txt],
                            fill=fill(f), font=Font(bold=True, color=t)))


def set_widths(ws, widths):
    for col, w in widths.items():
        ws.column_dimensions[col].width = w


def L(i):
    return get_column_letter(i)


# ================================================================== #
def main(src, dst):
    wb = openpyxl.load_workbook(src, data_only=False)
    # Excel açılışında tam yeniden hesaplama
    wb.calculation.fullCalcOnLoad = True

    base_font = Font(name="Calibri", size=10)

    # ---------------- DASHBOARD ----------------
    ws = wb["DASHBOARD"]
    title_banner(ws, 12, 1)
    ws.sheet_view.showGridLines = False
    # Sol KPI bloğu (A2:B8)
    for r in range(2, 9):
        lab = ws.cell(r, 1); val = ws.cell(r, 2)
        lab.font = Font(bold=True, size=10, color="1F2937")
        lab.fill = fill(KPI_LABEL)
        lab.alignment = Alignment(horizontal="left", vertical="center", indent=1)
        lab.border = ALL_BORDER
        val.font = Font(bold=True, size=11, color=ACCENT)
        val.alignment = Alignment(horizontal="right", vertical="center", indent=1)
        val.border = ALL_BORDER
        if r in (2, 3, 4, 7):
            val.number_format = MONEY_TL
    # Sağ şube tablosu
    style_header(ws, 3, 4, 12)
    style_body(ws, 8, 13, 4, 12, money_cols={5, 7, 8, 9})
    status_cf(ws, "F8:F13")          # Sonuç -> beyan sonucu mantığı
    result_cf(ws, "F8:F13")
    ws.conditional_formatting.add("G8:G13",
        CellIsRule(operator="greaterThan", formula=["0"],
                   fill=fill(RED_FILL), font=Font(bold=True, color=RED_TXT)))
    set_widths(ws, {"A": 30, "B": 20, "C": 3, "D": 18, "E": 16, "F": 16,
                    "G": 14, "H": 14, "I": 14, "J": 34, "K": 40, "L": 30})
    ws.freeze_panes = "A4"

    # ---------------- KDV_BEYAN_ICMAL ----------------
    ws = wb["KDV_BEYAN_ICMAL"]
    title_banner(ws, 19, 1)
    style_header(ws, 3, 1, 19)
    money = set(range(2, 18))  # B..Q
    style_body(ws, 4, 10, 1, 19, money_cols=money, total_row=10)
    result_cf(ws, "R4:R10")
    set_widths(ws, {"A": 20, **{L(i): 14 for i in range(2, 19)}, "S": 46})
    ws.freeze_panes = "B4"
    ws.auto_filter.ref = "A3:S9"

    # ---------------- KDV_ORAN_KONTROL ----------------
    ws = wb["KDV_ORAN_KONTROL"]
    title_banner(ws, 11, 1)
    style_header(ws, 3, 1, 11)
    style_body(ws, 4, 39, 1, 11, money_cols={3, 4, 5, 6})
    status_cf(ws, "G4:G39")
    set_widths(ws, {"A": 18, "B": 26, "C": 14, "D": 14, "E": 14, "F": 12,
                    "G": 14, "H": 11, "I": 44, "J": 46, "K": 30})
    ws.freeze_panes = "A4"
    ws.auto_filter.ref = "A3:K39"

    # ---------------- HATA_NEDEN_MOTORU ----------------
    # NOT: Bu sayfaya mutlak referanslarla (..$2:$37) erişilir; satır EKLENMEZ.
    # 1. satır doğrudan başlık olarak biçimlenir.
    ws = wb["HATA_NEDEN_MOTORU"]
    style_header(ws, 1, 1, 10, color=NAVY)
    style_body(ws, 2, 37, 1, 10, money_cols={3, 4, 5, 6})
    status_cf(ws, "G2:G37")
    set_widths(ws, {"A": 18, "B": 26, "C": 14, "D": 14, "E": 14, "F": 12,
                    "G": 50, "H": 11, "I": 11, "J": 40})
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = "A1:J37"

    # ---------------- KDV_HESAP_TABANI ----------------
    # NOT: Çekirdek motor; her sayfa buradan referans alır; satır EKLENMEZ.
    ws = wb["KDV_HESAP_TABANI"]
    style_header(ws, 1, 1, 46, color=NAVY)
    durum_cols = {6, 11, 16, 21, 26, 31}      # F,K,P,U,Z,AE
    matrah_money = set(range(2, 38)) - durum_cols  # sayısal sütunlar
    matrah_money |= {39, 40, 41}              # AM,AN,AO
    style_body(ws, 2, 7, 1, 46, money_cols=matrah_money)
    durum_ranges = " ".join("%s2:%s7" % (L(c), L(c)) for c in durum_cols)
    status_cf(ws, durum_ranges)
    result_cf(ws, "AP2:AP7")
    priority_cf(ws, "AT2:AT7")
    ws.conditional_formatting.add("AQ2:AQ7",
        CellIsRule(operator="greaterThan", formula=["0"],
                   fill=fill(RED_FILL), font=Font(bold=True, color=RED_TXT)))
    widths = {"A": 18}
    for c in range(2, 47):
        widths[L(c)] = 13 if c not in (44, 45) else 38
    widths["AR"] = 38; widths["AS"] = 32
    set_widths(ws, widths)
    ws.freeze_panes = "B2"
    ws.auto_filter.ref = "A1:AT7"

    # ---------------- GIDER_7xx_191 ----------------
    ws = wb["GIDER_7xx_191"]
    title_banner(ws, 8, 1)
    style_header(ws, 3, 1, 8)
    style_body(ws, 4, 9, 1, 8, money_cols={2, 3, 4, 5, 6})
    set_widths(ws, {"A": 18, "B": 18, "C": 18, "D": 14, "E": 14, "F": 14,
                    "G": 12, "H": 60})
    ws.freeze_panes = "A4"

    # ---------------- KDV_NASIL_HESAPLANIR ----------------
    ws = wb["KDV_NASIL_HESAPLANIR"]
    title_banner(ws, 8, 1)
    style_header(ws, 3, 1, 8)
    style_body(ws, 4, 11, 1, 8, band=True)
    # Mini hesap makinesi
    c = ws.cell(14, 1)
    style_header(ws, 14, 1, 5, color=SUBHEAD)
    style_body(ws, 15, 17, 1, 5, money_cols={2, 4, 5}, pct_cols={3})
    set_widths(ws, {"A": 30, "B": 30, "C": 30, "D": 12, "E": 16,
                    "F": 16, "G": 40, "H": 40})
    ws.freeze_panes = "A4"

    # ---------------- BEYANNAME_YOL_HARITASI ----------------
    ws = wb["BEYANNAME_YOL_HARITASI"]
    title_banner(ws, 6, 1)
    style_header(ws, 3, 1, 6)
    style_body(ws, 4, 12, 1, 6)
    set_widths(ws, {"A": 28, "B": 34, "C": 22, "D": 14, "E": 28, "F": 44})
    ws.freeze_panes = "A4"

    # ---------------- AYARLAR ----------------
    ws = wb["AYARLAR"]
    title_banner(ws, 2, 1, "AYARLAR")
    c = ws.cell(1, 4); c.value = "ŞUBE LİSTESİ (MERKEZLER HARİÇ)"
    c.font = Font(bold=True, size=12, color=WHITE); c.fill = fill(SUBHEAD)
    c.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    for r in range(2, 9):
        lab = ws.cell(r, 1); val = ws.cell(r, 2)
        if lab.value is not None:
            lab.font = Font(bold=True, color="1F2937"); lab.fill = fill(KPI_LABEL)
            lab.border = ALL_BORDER
            lab.alignment = Alignment(horizontal="left", vertical="center", indent=1)
        if val.value is not None:
            val.border = ALL_BORDER
            val.alignment = Alignment(horizontal="left", vertical="center",
                                      wrap_text=True, indent=1)
    for r in range(2, 8):
        sb = ws.cell(r, 4)
        if sb.value is not None:
            sb.border = ALL_BORDER
            sb.fill = fill(BAND_LIGHT if (r % 2 == 0) else WHITE)
            sb.font = Font(size=10)
            sb.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    set_widths(ws, {"A": 24, "B": 48, "C": 3, "D": 28})

    # ---------------- KAYNAKLAR ----------------
    ws = wb["KAYNAKLAR"]
    title_banner(ws, 4, 1)
    style_header(ws, 3, 1, 4)
    style_body(ws, 4, 8, 1, 4)
    for r in range(4, 9):
        c = ws.cell(r, 3)
        if isinstance(c.value, str) and c.value.startswith("http"):
            c.hyperlink = c.value
            c.font = Font(color="1155CC", underline="single", size=10)
    set_widths(ws, {"A": 32, "B": 30, "C": 52, "D": 40})
    ws.freeze_panes = "A4"

    # ---------------- KULLANIM ----------------
    ws = wb["KULLANIM"]
    title_banner(ws, 3, 1)
    style_header(ws, 3, 1, 3)
    style_body(ws, 4, 9, 1, 3)
    # Alt not bloğu (11. satır)
    for col in (1, 2):
        c = ws.cell(11, col)
        if c.value is not None:
            c.fill = fill(BLUE_FILL); c.border = ALL_BORDER
            c.font = Font(bold=(col == 1), size=10, color=BLUE_TXT)
            c.alignment = Alignment(horizontal="left", vertical="center",
                                    wrap_text=True, indent=1)
    set_widths(ws, {"A": 30, "B": 40, "C": 70})
    ws.freeze_panes = "A4"

    # ---------------- RAW_HESAP_KARTLARI ----------------
    ws = wb["RAW_HESAP_KARTLARI"]
    style_header(ws, 1, 1, 12, color=NAVY)
    money = {5, 6, 7, 9, 10, 11}
    last = ws.max_row
    for col in money:
        for r in range(2, last + 1):
            cell = ws.cell(r, col)
            if cell.value is not None:
                cell.number_format = MONEY_FMT
    set_widths(ws, {"A": 16, "B": 40, "C": 9, "D": 18, "E": 16, "F": 16,
                    "G": 16, "H": 7, "I": 16, "J": 16, "K": 16, "L": 7})
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = "A1:L%d" % last

    # ---------------- Genel: yazdırma ayarları + sekme renkleri ----------------
    tab_colors = {
        "DASHBOARD": NAVY, "RAW_HESAP_KARTLARI": "6B7280",
        "KDV_BEYAN_ICMAL": HEADER_BLUE, "KDV_ORAN_KONTROL": HEADER_BLUE,
        "HATA_NEDEN_MOTORU": "B45309", "KDV_HESAP_TABANI": ACCENT,
        "GIDER_7xx_191": ACCENT, "KDV_NASIL_HESAPLANIR": SUBHEAD,
        "BEYANNAME_YOL_HARITASI": SUBHEAD, "AYARLAR": "6B7280",
        "KAYNAKLAR": "6B7280", "KULLANIM": "6B7280",
    }
    for ws in wb.worksheets:
        ws.sheetView = ws.sheet_view
        ws.page_setup.orientation = "landscape"
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.print_options.horizontalCentered = True
        if ws.title in tab_colors:
            ws.sheet_properties.tabColor = tab_colors[ws.title]

    wb.active = wb.sheetnames.index("DASHBOARD")
    wb.save(dst)
    print("Kaydedildi:", dst)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
