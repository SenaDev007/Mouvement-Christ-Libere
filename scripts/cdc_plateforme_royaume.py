#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cahier des charges — Méga-plateforme du Royaume Yeshoua
Pour Afrika Alkebulane Pamela Dali & Pasteur Kongo
Version 1.0 — Équipe interne
"""

import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
    PageBreak, Table, TableStyle, Image, KeepTogether,
    NextPageTemplate, HRFlowable, ListFlowable, ListItem
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfgen import canvas

# ============================================================
# PALETTE — Élégance sacrée (bleu nuit + or + ivoire)
# ============================================================
PAGE_BG       = colors.HexColor('#FAF7F0')   # ivoire
INK_PRIMARY   = colors.HexColor('#0B1F3A')   # bleu nuit profond
INK_SECONDARY = colors.HexColor('#1E3A5F')   # bleu moyen
INK_MUTED     = colors.HexColor('#4A5568')   # gris bleuté
ACCENT_GOLD   = colors.HexColor('#C9A227')   # or sacré
ACCENT_GOLD_L = colors.HexColor('#E8D78A')   # or pâle
BORDER_LIGHT  = colors.HexColor('#E2D9C6')   # bordure crème
TABLE_HEADER  = colors.HexColor('#0B1F3A')   # bleu nuit
TABLE_STRIPE  = colors.HexColor('#F5EFE0')   # crème
DIVIDER       = colors.HexColor('#C9A227')   # or
CALLOUT_BG    = colors.HexColor('#F0E9D6')   # crème or

# ============================================================
# FONTS
# ============================================================
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('Tinos',         f'{FONT_DIR}/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Tinos-Bold',    f'{FONT_DIR}/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Tinos-Italic',  f'{FONT_DIR}/truetype/liberation/LiberationSerif-Italic.ttf'))
pdfmetrics.registerFont(TTFont('Tinos-BoldItalic', f'{FONT_DIR}/truetype/liberation/LiberationSerif-BoldItalic.ttf'))
registerFontFamily('Tinos', normal='Tinos', bold='Tinos-Bold', italic='Tinos-Italic', boldItalic='Tinos-BoldItalic')

pdfmetrics.registerFont(TTFont('Carlito',         f'{FONT_DIR}/truetype/liberation/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Carlito-Bold',    f'{FONT_DIR}/truetype/liberation/LiberationSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Carlito-Italic',  f'{FONT_DIR}/truetype/liberation/LiberationSans-Italic.ttf'))
pdfmetrics.registerFont(TTFont('Carlito-BoldItalic', f'{FONT_DIR}/truetype/liberation/LiberationSans-BoldItalic.ttf'))
registerFontFamily('Carlito', normal='Carlito', bold='Carlito-Bold', italic='Carlito-Italic', boldItalic='Carlito-BoldItalic')

# ============================================================
# STYLES
# ============================================================
S_BODY = ParagraphStyle('Body', fontName='Tinos', fontSize=10.5, leading=15.5,
                        textColor=INK_PRIMARY, alignment=TA_JUSTIFY,
                        spaceBefore=2, spaceAfter=6, firstLineIndent=14)

S_BODY_NOINDENT = ParagraphStyle('BodyNI', parent=S_BODY, firstLineIndent=0)

S_LEAD = ParagraphStyle('Lead', parent=S_BODY, fontSize=11.5, leading=17,
                        textColor=INK_SECONDARY, firstLineIndent=0,
                        spaceBefore=4, spaceAfter=10)

S_H1 = ParagraphStyle('H1', fontName='Carlito-Bold', fontSize=22, leading=28,
                      textColor=INK_PRIMARY, spaceBefore=18, spaceAfter=6,
                      keepWithNext=1)

S_H1_NUM = ParagraphStyle('H1Num', fontName='Carlito-Bold', fontSize=11, leading=14,
                          textColor=ACCENT_GOLD, spaceBefore=0, spaceAfter=2,
                          keepWithNext=1)

S_H2 = ParagraphStyle('H2', fontName='Carlito-Bold', fontSize=14, leading=18,
                      textColor=INK_PRIMARY, spaceBefore=14, spaceAfter=4,
                      keepWithNext=1)

S_H3 = ParagraphStyle('H3', fontName='Carlito-Bold', fontSize=11.5, leading=15,
                      textColor=ACCENT_GOLD, spaceBefore=10, spaceAfter=3,
                      keepWithNext=1)

S_QUOTE = ParagraphStyle('Quote', fontName='Tinos-Italic', fontSize=11, leading=16,
                         textColor=INK_SECONDARY, alignment=TA_CENTER,
                         leftIndent=20, rightIndent=20, spaceBefore=10, spaceAfter=10)

S_CAPTION = ParagraphStyle('Caption', fontName='Carlito-Italic', fontSize=9, leading=12,
                           textColor=INK_MUTED, alignment=TA_CENTER,
                           spaceBefore=2, spaceAfter=10)

S_TABLE_HEAD = ParagraphStyle('TH', fontName='Carlito-Bold', fontSize=9.5, leading=12,
                              textColor=colors.white, alignment=TA_LEFT)

S_TABLE_CELL = ParagraphStyle('TC', fontName='Tinos', fontSize=9, leading=12,
                              textColor=INK_PRIMARY, alignment=TA_LEFT)

S_TABLE_CELL_C = ParagraphStyle('TCc', parent=S_TABLE_CELL, alignment=TA_CENTER)

S_CALLOUT = ParagraphStyle('Callout', fontName='Tinos-Italic', fontSize=10.5, leading=15,
                           textColor=INK_PRIMARY, alignment=TA_LEFT,
                           leftIndent=10, rightIndent=10, spaceBefore=4, spaceAfter=4)

S_BULLET = ParagraphStyle('Bullet', fontName='Tinos', fontSize=10.5, leading=15,
                          textColor=INK_PRIMARY, alignment=TA_LEFT,
                          leftIndent=18, bulletIndent=6, spaceBefore=1, spaceAfter=3)

S_TOC1 = ParagraphStyle('TOC1', fontName='Carlito-Bold', fontSize=11, leading=15,
                        textColor=INK_PRIMARY, leftIndent=0, spaceBefore=6)
S_TOC2 = ParagraphStyle('TOC2', fontName='Tinos', fontSize=10, leading=14,
                        textColor=INK_MUTED, leftIndent=18, spaceBefore=1)

S_FOOTER = ParagraphStyle('Footer', fontName='Carlito', fontSize=8, leading=10,
                          textColor=INK_MUTED, alignment=TA_CENTER)

# ============================================================
# HELPERS
# ============================================================
def P(text, style=S_BODY):
    return Paragraph(text, style)

def H1(text, num=None):
    flow = []
    if num:
        flow.append(P(num, S_H1_NUM))
    flow.append(Paragraph(text, S_H1, ))
    return flow

def H2(text):
    return Paragraph(text, S_H2)

def H3(text):
    return Paragraph(text, S_H3)

def Bullet(text):
    return Paragraph(text, S_BULLET, bulletText='•')

def Divider():
    return HRFlowable(width="100%", thickness=0.6, color=DIVIDER,
                     spaceBefore=6, spaceAfter=6, lineCap='round')

def CalloutBox(title, body_text):
    """Encadré or sur fond crème."""
    inner = [
        P(f'<b>{title}</b>', ParagraphStyle('cbT', fontName='Carlito-Bold', fontSize=10.5,
                                            leading=14, textColor=ACCENT_GOLD, spaceAfter=4)),
        P(body_text, S_CALLOUT)
    ]
    t = Table([[inner]], colWidths=[16*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CALLOUT_BG),
        ('BOX', (0,0), (-1,-1), 0.8, ACCENT_GOLD),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
        ('RIGHTPADDING', (0,0), (-1,-1), 14),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LINEBEFORE', (0,0), (0,-1), 3, ACCENT_GOLD),
    ]))
    return KeepTogether([Spacer(1,6), t, Spacer(1,6)])

def make_table(headers, rows, col_widths=None):
    """Table standard avec header bleu nuit et stripes crème."""
    avail = 16*cm
    if col_widths is None:
        col_widths = [avail / len(headers)] * len(headers)
    data = [[P(h, S_TABLE_HEAD) for h in headers]]
    for row in rows:
        data.append([P(c, S_TABLE_CELL) for c in row])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style = [
        ('BACKGROUND', (0,0), (-1,0), TABLE_HEADER),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('GRID', (0,0), (-1,-1), 0.3, BORDER_LIGHT),
        ('LINEBELOW', (0,0), (-1,0), 1.2, ACCENT_GOLD),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(('BACKGROUND', (0,i), (-1,i), TABLE_STRIPE))
    t.setStyle(TableStyle(style))
    return t

# ============================================================
# COVER (custom ReportLab canvas)
# ============================================================
def draw_cover(canv, doc):
    w, h = A4
    # Fond bleu nuit
    canv.setFillColor(INK_PRIMARY)
    canv.rect(0, 0, w, h, fill=1, stroke=0)

    # Cadre or intérieur
    canv.setStrokeColor(ACCENT_GOLD)
    canv.setLineWidth(1.2)
    canv.rect(1.5*cm, 1.5*cm, w - 3*cm, h - 3*cm, fill=0, stroke=1)
    canv.setLineWidth(0.4)
    canv.rect(1.7*cm, 1.7*cm, w - 3.4*cm, h - 3.4*cm, fill=0, stroke=1)

    # Filet or supérieur
    canv.setStrokeColor(ACCENT_GOLD)
    canv.setLineWidth(0.8)
    canv.line(4*cm, h - 6.5*cm, w - 4*cm, h - 6.5*cm)

    # Petite étoile de David discrète (deux triangles superposés) en haut
    cx, cy = w/2, h - 4.5*cm
    r = 0.55*cm
    canv.setStrokeColor(ACCENT_GOLD)
    canv.setLineWidth(0.7)
    # Triangle pointe haut
    p1 = canv.beginPath()
    p1.moveTo(cx, cy + r)
    p1.lineTo(cx - r*0.866, cy - r*0.5)
    p1.lineTo(cx + r*0.866, cy - r*0.5)
    p1.close()
    canv.drawPath(p1, fill=0, stroke=1)
    # Triangle pointe bas
    p2 = canv.beginPath()
    p2.moveTo(cx, cy - r)
    p2.lineTo(cx - r*0.866, cy + r*0.5)
    p2.lineTo(cx + r*0.866, cy + r*0.5)
    p2.close()
    canv.drawPath(p2, fill=0, stroke=1)

    # Sur-titre
    canv.setFillColor(ACCENT_GOLD_L)
    canv.setFont('Carlito', 10)
    canv.drawCentredString(w/2, h - 5.8*cm, 'CAHIER DES CHARGES  •  VERSION 1.0')

    # Titre principal
    canv.setFillColor(colors.white)
    canv.setFont('Carlito-Bold', 30)
    canv.drawCentredString(w/2, h - 9*cm, 'Méga-plateforme')
    canv.drawCentredString(w/2, h - 10.4*cm, 'du Royaume')

    # Sous-titre
    canv.setFillColor(ACCENT_GOLD_L)
    canv.setFont('Tinos-Italic', 13)
    canv.drawCentredString(w/2, h - 12.2*cm,
                           'Plateforme numérique centralisée pour la servante de l\'Éternel')
    canv.drawCentredString(w/2, h - 13.0*cm,
                           'Afrika Alkebulane Pamela Dali  &  Pasteur Kongo')

    # Filet or médian
    canv.setStrokeColor(ACCENT_GOLD)
    canv.setLineWidth(0.5)
    canv.line(5*cm, h - 14.5*cm, w - 5*cm, h - 14.5*cm)

    # Citation
    canv.setFillColor(colors.white)
    canv.setFont('Tinos-Italic', 10.5)
    canv.drawCentredString(w/2, h - 15.6*cm,
                           '« Et Hénoch marcha avec Dieu ; et il ne fut plus,')
    canv.drawCentredString(w/2, h - 16.3*cm,
                           'car Dieu le prit. »')
    canv.setFillColor(ACCENT_GOLD_L)
    canv.setFont('Carlito', 8.5)
    canv.drawCentredString(w/2, h - 17.1*cm, 'Genèse 5:24')

    # Mention mission
    canv.setFillColor(ACCENT_GOLD_L)
    canv.setFont('Carlito', 9.5)
    canv.drawCentredString(w/2, h - 19.5*cm,
                           'Rassemblement des fils d\'Israël dispersés')
    canv.drawCentredString(w/2, h - 20.1*cm,
                           'Préparation au retour de Yeshoua au son du chofar')

    # Pied de page
    canv.setStrokeColor(ACCENT_GOLD)
    canv.setLineWidth(0.4)
    canv.line(4*cm, 4*cm, w - 4*cm, 4*cm)
    canv.setFillColor(colors.white)
    canv.setFont('Carlito', 9)
    canv.drawCentredString(w/2, 3.3*cm, 'Document confidentiel — Équipe interne')
    canv.setFillColor(ACCENT_GOLD_L)
    canv.setFont('Carlito-Italic', 8)
    canv.drawCentredString(w/2, 2.5*cm, 'À valider par PAM et le Pasteur Kongo avant lancement des travaux')

# ============================================================
# PAGE TEMPLATE (body)
# ============================================================
def draw_body_page(canv, doc):
    w, h = A4
    # Fond ivoire léger
    canv.setFillColor(PAGE_BG)
    canv.rect(0, 0, w, h, fill=1, stroke=0)

    # En-tête : filet or + titre court
    canv.setStrokeColor(ACCENT_GOLD)
    canv.setLineWidth(0.4)
    canv.line(2*cm, h - 1.5*cm, w - 2*cm, h - 1.5*cm)
    canv.setFillColor(INK_MUTED)
    canv.setFont('Carlito', 8)
    canv.drawString(2*cm, h - 1.2*cm, 'Cahier des charges — Méga-plateforme du Royaume')
    canv.drawRightString(w - 2*cm, h - 1.2*cm, 'V1.0 — Confidentiel')

    # Pied : numéro de page centré avec petits filets or
    canv.setStrokeColor(ACCENT_GOLD)
    canv.setLineWidth(0.3)
    canv.line(2*cm, 1.6*cm, w - 2*cm, 1.6*cm)
    canv.setFillColor(INK_MUTED)
    canv.setFont('Carlito', 8)
    canv.drawCentredString(w/2, 1.0*cm, f'— {doc.page} —')
    canv.setFont('Carlito-Italic', 7.5)
    canv.drawString(2*cm, 1.0*cm, 'Afrika A. P. Dali  &  Pasteur Kongo')
    canv.drawRightString(w - 2*cm, 1.0*cm, 'Au son du chofar')

# ============================================================
# DOC TEMPLATE WITH TOC SUPPORT
# ============================================================
class MyDocTemplate(BaseDocTemplate):
    def __init__(self, filename, **kw):
        super().__init__(filename, **kw)
        # Cover page template
        cover_frame = Frame(0, 0, A4[0], A4[1], id='cover',
                            leftPadding=0, rightPadding=0,
                            topPadding=0, bottomPadding=0)
        cover_tpl = PageTemplate(id='Cover', frames=[cover_frame],
                                 onPage=draw_cover)
        # Body template
        body_frame = Frame(2*cm, 2*cm, A4[0]-4*cm, A4[1]-4*cm, id='body',
                           leftPadding=0, rightPadding=0,
                           topPadding=0, bottomPadding=0)
        body_tpl = PageTemplate(id='Body', frames=[body_frame],
                                onPage=draw_body_page)
        self.addPageTemplates([cover_tpl, body_tpl])

    def afterFlowable(self, flowable):
        """Register TOC entries."""
        if isinstance(flowable, Paragraph):
            style = flowable.style.name
            text = flowable.getPlainText()
            if style == 'H1':
                self.notify('TOCEntry', (0, text, self.page))
            elif style == 'H2':
                self.notify('TOCEntry', (1, text, self.page))

# ============================================================
# CONTENT — TO BE ADDED IN NEXT STEP
# ============================================================
def build_story():
    story = []

    # ===== COVER =====
    story.append(NextPageTemplate('Body'))
    story.append(PageBreak())  # End cover, move to body

    # ===== AVANT-PROPOS =====
    story.extend(H1('Avant-propos', 'PRÉAMBULE'))
    story.append(P(
        'Ce cahier des charges formalise la vision portée par une fratrie rassemblée autour '
        'd\'une conviction spirituelle majeure : celle de bâtir, pour la servante de l\'Éternel '
        'Afrika Alkebulane Pamela Dali et pour son époux le Pasteur Kongo, une infrastructure '
        'numérique sans équivalent, capable de centraliser leur ministère, de diffuser leur '
        'témoignage au-delà des censures, et de préparer activement le rassemblement des fils '
        'd\'Israël dispersés en vue du retour du Maître Yeshoua.', S_LEAD))
    story.append(P(
        'Le présent document n\'est pas un simple cahier des charges technique. Il est l\'expression '
        'd\'une obéissance spirituelle traduite en exigences d\'ingénierie. Chaque fonctionnalité '
        'décrite ici porte une intention de Royaume : que la Parole circule sans entrave, que les '
        'témoignages subsistent même lorsque les nations voudront les effacer, que les croyants '
        'puissent se reconnaître, s\'assembler, s\'instruire et s\'encourager dans l\'attente du '
        'son du chofar. La servante PAM est présentée par ses proches comme une figure '
        'contemporaine du patriarche Hénoch — celle qui marche avec Dieu, qui est enlevée au ciel, '
        'qui reçoit des instructions directes et qui rapporte fidèlement ce qui lui a été confié. '
        'Tout le projet est pensé pour honorer cette dimension prophétique sans la sensationaliser.'))
    story.append(P(
        'Le cahier est volontairement exhaustif. Il couvre la vision spirituelle, l\'identité '
        'duale des deux serviteurs, les fonctionnalités porteuses, le média social intégré, '
        'l\'architecture technique, les innovations attendues, la sécurité, la conformité légale, '
        'la roadmap, le budget, et surtout — c\'est là sa spécificité — une analyse explicite '
        'des gaps, c\'est-à-dire des dimensions manquantes ou sous-estimées qu\'il faudra traiter '
        'pour produire une plateforme réellement inédite. Une section est également consacrée à '
        'la comparaison avec ce que les groupes ésotériques préparent pour le nouvel ordre '
        'mondial, non par mimétisme, mais par contre-stratégie consciente et alignée sur la '
        'Parole. L\'objectif n\'est pas de rivaliser avec Babylone, mais d\'édifier une '
        'alternative sainte, résiliente, et prête pour le gouvernement de Yeshoua.'))
    story.append(Divider())
    story.append(P(
        'Ce document est destiné en premier lieu à l\'équipe interne (porteurs de vision et équipe '
        'technique). Il servira de référence contractuelle et spirituelle pour toutes les décisions '
        'à venir. Il devra être validé par PAM et le Pasteur Kongo avant tout lancement de travaux, '
        'afin que l\'œuvre technique reste soumise à l\'œuvre spirituelle qu\'elle est censée servir.',
        S_BODY_NOINDENT))

    story.append(PageBreak())

    # ===== SOMMAIRE =====
    story.extend(H1('Sommaire', 'NAVIGATION'))
    toc = TableOfContents()
    toc.levelStyles = [S_TOC1, S_TOC2]
    story.append(toc)
    story.append(PageBreak())

    return story

# ============================================================
# MAIN
# ============================================================
def main():
    out_path = '/home/z/my-project/download/Cahier_des_charges_Plateforme_Royaume_Yeshoua.pdf'
    doc = MyDocTemplate(
        out_path,
        pagesize=A4,
        title='Cahier des charges — Méga-plateforme du Royaume Yeshoua',
        author='Équipe interne — Pour PAM & Pasteur Kongo',
        subject='Cahier des charges technique et spirituel V1.0',
        creator='Z.ai',
    )

    story = build_story()

    # Expose all needed names for sections module
    from reportlab.lib.units import cm, mm
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
    g = dict(globals())
    g['cm'] = cm
    g['mm'] = mm
    g['TA_LEFT'] = TA_LEFT
    g['TA_CENTER'] = TA_CENTER
    g['TA_JUSTIFY'] = TA_JUSTIFY
    g['TA_RIGHT'] = TA_RIGHT

    # Import section builders
    from cdc_sections import add_all_sections
    add_all_sections(story, g)

    doc.multiBuild(story)
    print(f'PDF généré : {out_path}')
    print(f'Taille : {os.path.getsize(out_path) / 1024:.1f} Ko')

if __name__ == '__main__':
    main()
