#!/usr/bin/env python3
"""Generate the test PDF fixtures used by unit and end-to-end tests.

Requires: reportlab, pypdf, matplotlib  (pip install reportlab pypdf matplotlib)
Usage:    python3 scripts/make_fixtures.py
Output:   tests/fixtures/*.pdf

All names, e-mails and institutions below are fictional placeholders.
"""
from __future__ import annotations

import io
import os
import struct
import zlib

import reportlab
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject
from reportlab.lib.pagesizes import A4, letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "tests", "fixtures")
FONT_DIR = os.path.join(os.path.dirname(reportlab.__file__), "fonts")

pdfmetrics.registerFont(TTFont("Vera", os.path.join(FONT_DIR, "Vera.ttf")))
pdfmetrics.registerFont(TTFont("VeraBd", os.path.join(FONT_DIR, "VeraBd.ttf")))

LOREM = (
    "Deep models have shown strong results on many benchmarks. In this section we "
    "describe the method, the training setup and the evaluation protocol in detail. "
    "We compare against strong baselines and report mean and standard deviation over "
    "five random seeds. Results are summarised in Table 1 and discussed below."
)


def wrap(text: str, width: int = 95) -> list[str]:
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > width:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    if cur:
        lines.append(cur)
    return lines


class Doc:
    def __init__(self, path: str, pagesize=letter, font="Vera", bold="VeraBd"):
        self.c = canvas.Canvas(path, pagesize=pagesize, invariant=1, initialFontName=font, initialFontSize=10)
        self.w, self.h = pagesize
        self.font, self.bold = font, bold
        self.y = self.h - 72

    def heading(self, text: str):
        self.c.setFont(self.bold, 13)
        self.c.drawString(72, self.y, text)
        self.y -= 22

    def para(self, text: str):
        self.c.setFont(self.font, 10)
        for line in wrap(text):
            self.c.drawString(72, self.y, line)
            self.y -= 13
        self.y -= 6

    def link(self, label: str, url: str):
        self.c.setFont(self.font, 10)
        self.c.drawString(72, self.y, label)
        tw = pdfmetrics.stringWidth(label, self.font, 10)
        self.c.linkURL(url, (72, self.y - 2, 72 + tw, self.y + 10), relative=0)
        self.y -= 19

    def new_page(self):
        self.c.showPage()
        self.y = self.h - 72

    def body_page(self, n: int, extra: list[str] | None = None):
        self.heading(f"{n} Section {n}")
        for _ in range(3):
            self.para(LOREM)
        for e in extra or []:
            self.para(e)

    def save(self):
        self.c.save()


def png_bytes(w: int, h: int) -> bytes:
    """Tiny checkerboard PNG without needing PIL."""
    raw = b""
    for y in range(h):
        raw += b"\x00" + bytes(
            (255 if (x // 2 + y // 2) % 2 else 40) for x in range(w) for _ in range(3)
        )

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def references(d: Doc, pages: int = 2):
    for p in range(pages):
        if p == 0:
            d.heading("References")
        for i in range(12):
            d.para(f"[{p * 12 + i + 1}] A. Writer and B. Writer. A study of things, part {i}. In Proc. Conf., 2023.")
        d.new_page()


def make_clean():
    d = Doc(os.path.join(OUT, "clean.pdf"))
    d.c.setTitle("Anonymous Submission")
    d.c.setAuthor("")
    d.c.setCreator("LaTeX with hyperref")
    d.heading("A Clean Anonymous Submission")
    d.para("Anonymous Authors. Paper under double-blind review.")
    d.para(LOREM)
    d.para("Code is available at https://anonymous.4open.science/r/demo-1234 for review.")
    d.new_page()
    for n in range(2, 9):
        d.body_page(n, ["As shown in Figure 2 and Table 1, the method improves accuracy [4, 7]."])
        d.new_page()
    references(d)
    d.save()


def make_leaky():
    path = os.path.join(OUT, "leaky.pdf")
    d = Doc(path, font="Helvetica", bold="Helvetica-Bold")  # Base14, not embedded
    d.c.setTitle("My Paper by Alex Placeholder")
    d.c.setAuthor("Alex Placeholder")
    d.c.setCreator("LaTeX with hyperref")
    d.heading("A Not So Anonymous Submission")
    d.para("Alex Placeholder, Department of Computing, University of Exampleton. alex.placeholder@exampleton.edu")
    d.para(LOREM)
    d.link("Code: https://github.com/alexplaceholder/cool-model", "https://github.com/alexplaceholder/cool-model")
    d.new_page()
    d.body_page(2, ["Building on our previous work [3], we extend the model. As shown in Figure ?? the loss decreases."])
    img = io.BytesIO(png_bytes(24, 24))
    from reportlab.lib.utils import ImageReader

    d.c.drawImage(ImageReader(img), 72, 120, width=288, height=288)  # 24px over 4in = 6 DPI
    d.new_page()
    d.body_page(3, ["The baseline of [?] is weaker. See also https://huggingface.co/alexplaceholder for weights."])
    d.new_page()
    d.heading("Acknowledgments")
    d.para("We thank the Exampleton Robotics Lab for compute. This work was funded by grant 12345.")
    d.new_page()
    references(d, 1)
    d.save()

    # Add XMP metadata with a dc:creator entry.
    reader = PdfReader(path)
    writer = PdfWriter(clone_from=reader)
    xmp = (
        '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>'
        '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
        '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">'
        "<dc:creator><rdf:Seq><rdf:li>Alex Placeholder</rdf:li></rdf:Seq></dc:creator>"
        "</rdf:Description></rdf:RDF></x:xmpmeta>"
        '<?xpacket end="w"?>'
    ).encode()
    stream = DecodedStreamObject()
    stream.set_data(xmp)
    stream[NameObject("/Type")] = NameObject("/Metadata")
    stream[NameObject("/Subtype")] = NameObject("/XML")
    writer._root_object[NameObject("/Metadata")] = writer._add_object(stream)
    with open(path, "wb") as f:
        writer.write(f)


def make_overlength():
    d = Doc(os.path.join(OUT, "overlength.pdf"), pagesize=A4)
    d.c.setAuthor("")
    d.heading("An Overlength Submission")
    d.para("Anonymous Authors.")
    d.para(LOREM)
    d.new_page()
    for n in range(2, 13):
        d.body_page(n)
        d.new_page()
    references(d)
    d.save()


def make_type3():
    import matplotlib

    matplotlib.use("Agg")
    matplotlib.rcParams["pdf.fonttype"] = 3
    import matplotlib.pyplot as plt
    from matplotlib.backends.backend_pdf import PdfPages

    with PdfPages(os.path.join(OUT, "type3.pdf"), metadata={"Creator": "matplotlib", "Author": None}) as pdf:
        fig, ax = plt.subplots(figsize=(8.5, 11))
        ax.plot([0, 1, 2, 3], [1, 3, 2, 4])
        ax.set_title("Figure exported with pdf.fonttype = 3")
        ax.set_xlabel("epoch")
        ax.set_ylabel("loss")
        pdf.savefig(fig)
        plt.close(fig)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    make_clean()
    make_leaky()
    make_overlength()
    make_type3()
    for f in sorted(os.listdir(OUT)):
        print(f, os.path.getsize(os.path.join(OUT, f)))
