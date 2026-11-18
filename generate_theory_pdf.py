import os
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class TheoreticalNumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(TheoreticalNumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(TheoreticalNumberedCanvas, self).showPage()
        super(TheoreticalNumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "Theoretical Cryptographic Foundations | Proxy Re-Encryption (PRE)")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 744, 558, 744)
        
        # Footer
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 45, 558, 45)
        
        self.drawString(54, 32, "Applied Cryptography Laboratory — Academic Reference Manual")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 32, page_str)
        self.restoreState()

def build_theory_pdf(filename="docs/pdf/Proxy_Re_Encryption_Theoretical_Foundations.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Palette
    primary_navy = colors.HexColor("#1E3A8A")   # Blue 900
    accent_indigo = colors.HexColor("#4338CA")  # Indigo 700
    teal_heading = colors.HexColor("#0D9488")   # Teal 600
    dark_slate = colors.HexColor("#0F172A")     # Slate 900
    body_text = colors.HexColor("#334155")      # Slate 700
    math_bg = colors.HexColor("#F1F5F9")        # Slate 100
    callout_bg = colors.HexColor("#EEF2FF")     # Indigo 50
    callout_border = colors.HexColor("#6366F1") # Indigo 500

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=primary_navy,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=accent_indigo,
        spaceAfter=14
    )

    h1_style = ParagraphStyle(
        'Header1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=primary_navy,
        spaceBefore=12,
        spaceAfter=5,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Header2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=dark_slate,
        spaceBefore=9,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=body_text,
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'BulletText',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=3
    )

    math_block = ParagraphStyle(
        'MathBlock',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1E293B")
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#312E81")
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.8,
        leading=10.5,
        textColor=dark_slate
    )

    story = []

    # Title Banner
    story.append(Paragraph("Theoretical Foundations of Proxy Re-Encryption", title_style))
    story.append(Paragraph("A Formal Cryptographic Analysis for Secure IoT Cloud Data Sharing", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=primary_navy, spaceAfter=12))

    # Abstract / Executive Summary
    summary_p = Paragraph(
        "<b>Abstract:</b> Proxy Re-Encryption (PRE) is an advanced asymmetric cryptographic paradigm enabling an untrusted "
        "intermediary (a cloud proxy) to transform a ciphertext encrypted under a delegator's public key into a ciphertext "
        "that can be decrypted by a delegatee's secret key, without revealing the underlying plaintext or any private keys. "
        "This monograph formalizes the mathematical machinery (discrete logarithm, BBS98, and Umbral threshold schemes), "
        "classifies architectural properties, clearly defines what PRE is and is not, and examines security models in IoT environments.",
        callout_style
    )
    t_box = Table([[summary_p]], colWidths=[504])
    t_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), callout_bg),
        ('BOX', (0,0), (-1,-1), 1, callout_border),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_box)
    story.append(Spacer(1, 10))

    # 1. Introduction & Motivation
    story.append(Paragraph("1. Fundamental Problem & Threat Model in IoT", h1_style))
    story.append(Paragraph(
        "Internet of Things (IoT) sensors continuously produce sensitive telemetry (e.g., medical vitals, smart grid energy "
        "metrics, or industrial telemetry). To share encrypted streams with authorized third parties via cloud storage, traditional "
        "cryptography presents a crippling architectural trade-off:",
        body_style
    ))
    story.append(Paragraph("• <b>The Naive Asymmetric Bottleneck:</b> If Alice (the IoT sensor) must share data with N recipients, she must encrypt the stream N times or decrypt and re-encrypt locally. In battery-constrained IoT devices, asymmetric scalar operations cause rapid battery depletion and excessive bandwidth usage.", bullet_style))
    story.append(Paragraph("• <b>The Master-Key Vulnerability:</b> If Alice delegates decryption keys directly to the cloud proxy to manage re-distribution, the cloud gains full visibility over all raw data, violating the <i>Zero-Trust</i> security principle and failing under server compromise.", bullet_style))
    story.append(Spacer(1, 8))

    # 2. What PRE Is and What PRE Is Not
    story.append(Paragraph("2. Scope Definition: What PRE Is vs. What PRE Is Not", h1_style))
    story.append(Paragraph(
        "To evaluate PRE accurately in academic reviews, it is essential to establish exact boundary definitions:",
        body_style
    ))

    is_vs_not_data = [
        [Paragraph("What Proxy Re-Encryption IS", table_header), Paragraph("What Proxy Re-Encryption IS NOT", table_header)],
        [
            Paragraph("<b>Homomorphic Ciphertext Translation:</b> A mathematically provable operation transforming $C_A \\to C_B$ under public parameters.", table_cell),
            Paragraph("<b>NOT Fully Homomorphic Encryption (FHE):</b> PRE does not perform arbitrary algebraic computations (+, ×) on encrypted values. It only changes the target decryption key.", table_cell)
        ],
        [
            Paragraph("<b>Zero-Knowledge to the Proxy:</b> The proxy acts in a semi-honest model: it performs re-encryption without learning the plaintext $M$ or private keys $sk_A, sk_B$.", table_cell),
            Paragraph("<b>NOT Key Escrow or Cloud Decryption:</b> The cloud never acts as a Trusted Third Party (TTP) holding master private keys or session plaintexts.", table_cell)
        ],
        [
            Paragraph("<b>Delegated Fine-Grained Access Control:</b> Alice retains cryptographic autonomy to generate or revoke access via unidirectional re-encryption keys.", table_cell),
            Paragraph("<b>NOT Attribute-Based Encryption (ABE):</b> PRE does not evaluate complex boolean predicate access trees; access delegation is pairwise or threshold-partitioned.", table_cell)
        ],
        [
            Paragraph("<b>Hybrid Architecture:</b> Combines asymmetric PRE to wrap a symmetric session key (DEK) with AES-256-GCM for the payload.", table_cell),
            Paragraph("<b>NOT an End-to-End Bulk Cipher:</b> Raw data streams are never directly encrypted with asymmetric PRE due to message size limitations and computational overhead.", table_cell)
        ]
    ]

    t_is_not = Table(is_vs_not_data, colWidths=[248, 256])
    t_is_not.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_navy),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_is_not)
    story.append(Spacer(1, 10))

    story.append(PageBreak())

    # 3. Mathematical Foundations
    story.append(Paragraph("3. Mathematical Machinery & Formulations", h1_style))
    story.append(Paragraph(
        "Proxy Re-Encryption relies on cyclic groups over prime-order elliptic curves where the Discrete Logarithm Problem (DLP) "
        "and Decisional Diffie-Hellman (DDH) assumption hold.",
        body_style
    ))

    story.append(Paragraph("The Classic BBS98 Scheme (Blaze, Bleumer, Strauss - 1998):", h2_style))
    bbs_math = (
        "Let G be a cyclic group of prime order q with generator g.<br/>"
        "• <b>KeyGen:</b> Alice picks secret key a in Z_q*, public key A = g^a.<br/>"
        "             Bob picks secret key b in Z_q*, public key B = g^b.<br/>"
        "• <b>Encrypt:</b> Alice encrypts message m in G with random r in Z_q*:<br/>"
        "             C_A = (c_1, c_2) = (g^r, m * A^r) = (g^r, m * g^(a*r))<br/>"
        "• <b>ReKeyGen:</b> Alice computes re-encryption key: rk_{A-&gt;B} = b / a mod q<br/>"
        "• <b>ReEncrypt:</b> Proxy computes transformed ciphertext C_B:<br/>"
        "             c_1' = (c_1)^(rk_{A-&gt;B}) = (g^r)^(b/a) = g^(r * b / a)<br/>"
        "             (Note: In BBS98, Alice's public key transforms to B^r = g^(b*r))<br/>"
        "• <b>Decrypt:</b> Bob recovers message using his secret key b:<br/>"
        "             m = c_2 / (c_1')^(a) ... or directly: m = c_2 / (c_1')^b"
    )
    t_bbs = Table([[Paragraph(bbs_math, math_block)]], colWidths=[504])
    t_bbs.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), math_bg),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#94A3B8")),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_bbs)
    story.append(Spacer(1, 8))

    story.append(Paragraph("Modern Threshold PRE (Umbral & NuCypher Evolution):", h2_style))
    story.append(Paragraph(
        "BBS98 has two limitations: it is <i>bidirectional</i> ($b/a = (a/b)^{-1}$) and allows Bob and the proxy to collude to reveal Alice's key. "
        "Modern systems like <b>Umbral</b> solve this using <b>unidirectional, non-interactive threshold PRE</b> based on Shamir's Secret Sharing:",
        body_style
    ))
    story.append(Paragraph("• <b>Unidirectional Property:</b> $rk_{A \\to B}$ enables transformation from Alice to Bob, but cannot be inverted to transform Bob's data to Alice.", bullet_style))
    story.append(Paragraph("• <b>Threshold Splitting (m-of-n):</b> Alice splits the re-encryption key into N KeyFrags ($kfrag_i$) using Shamir's Secret Sharing over polynomial $f(x)$. The proxy must collect at least M matching CapsuleFrags ($cfrag_i$) to allow Bob to reconstruct the session secret.", bullet_style))
    story.append(Paragraph("• <b>Collusion Resistance:</b> Even if the proxy colludes with Bob, Alice's private key $sk_A$ remains mathematically insulated.", bullet_style))
    story.append(Spacer(1, 8))

    # 4. Taxonomic Classification Table
    story.append(Paragraph("4. Taxonomic Properties of PRE Schemes", h1_style))
    
    tax_data = [
        [Paragraph("Property", table_header), Paragraph("Definition", table_header), Paragraph("Implementation in Project", table_header)],
        [
            Paragraph("<b>Directionality</b>", table_cell),
            Paragraph("Unidirectional (A → B only) vs Bidirectional (A ↔ B simultaneously).", table_cell),
            Paragraph("<b>Unidirectional:</b> Bob cannot re-encrypt Alice's data back to himself or reverse the key.", table_cell)
        ],
        [
            Paragraph("<b>Transitivity</b>", table_cell),
            Paragraph("Transitive (can re-encrypt A → B → C) vs Non-transitive (A → B only once).", table_cell),
            Paragraph("<b>Non-transitive:</b> Level 2 ciphertexts cannot undergo further re-encryption.", table_cell)
        ],
        [
            Paragraph("<b>Interactivity</b>", table_cell),
            Paragraph("Interactive (requires Bob's participation) vs Non-interactive (Alice computes alone).", table_cell),
            Paragraph("<b>Non-interactive:</b> Alice generates $rk_{A \\to B}$ using only Bob's public key.", table_cell)
        ],
        [
            Paragraph("<b>Collusion Safety</b>", table_cell),
            Paragraph("Resistance to Proxy + Delegatee combining data to derive Delegator's key.", table_cell),
            Paragraph("<b>Collusion Resistant:</b> Alice's private key is mathematically unrecoverable.", table_cell)
        ]
    ]

    t_tax = Table(tax_data, colWidths=[90, 214, 200])
    t_tax.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_navy),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_tax)
    story.append(Spacer(1, 10))

    story.append(PageBreak())

    # 5. Hybrid Cryptography Workflow
    story.append(Paragraph("5. System Architecture: The Hybrid Cryptographic Pipeline", h1_style))
    story.append(Paragraph(
        "To achieve both high data throughput and military-grade privacy, this project implements a dual-layer hybrid protocol:",
        body_style
    ))

    story.append(Paragraph("Layer 1: Telemetry Payload Symmetric Encryption (AES-256-GCM)", h2_style))
    story.append(Paragraph(
        "• A cryptographically secure random 256-bit symmetric Data Encryption Key (DEK) is generated at the edge sensor.<br/>"
        "• Telemetry JSON payload $P$ is encrypted via AES-256-GCM with a fresh 96-bit Initialization Vector (IV).<br/>"
        "• A 128-bit authentication tag is computed to guarantee payload integrity and reject tampering.",
        body_style
    ))

    story.append(Paragraph("Layer 2: Key Encapsulation Mechanism (Umbral PRE)", h2_style))
    story.append(Paragraph(
        "• The 256-bit DEK is encapsulated using Alice's public key via Umbral Key Encapsulation.<br/>"
        "• The output consists of a cryptographic <b>Capsule</b> ($E, V, s$) and the encrypted DEK bytes.<br/>"
        "• The complete package $[IV, Tag, Ciphertext, Capsule, EncryptedDEK]$ is shipped to cloud storage.",
        body_style
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Layer 3: Cloud Proxy Re-Encryption Phase", h2_style))
    story.append(Paragraph(
        "• When Bob requests the file, the Cloud Proxy checks Alice's delegation table.<br/>"
        "• The proxy evaluates the re-encryption function: $Capsule_{re} = \\text{ReEncrypt}(Capsule, rk_{A \\to B})$.<br/>"
        "• The symmetric payload ciphertext remains untouched; only the key capsule is transformed.<br/>"
        "• Bob receives $[IV, Tag, Ciphertext, Capsule_{re}, EncryptedDEK]$, decapsulates the DEK using $sk_B$, and decrypts the payload.",
        body_style
    ))
    story.append(Spacer(1, 10))

    # 6. Security Analysis & Comparative Table
    story.append(Paragraph("6. Security Analysis & Performance Trade-offs", h1_style))
    
    comp_data = [
        [Paragraph("Scheme", table_header), Paragraph("IoT Device Overhead", table_header), Paragraph("Cloud Decryption Risk", table_header), Paragraph("Revocation Flexibility", table_header)],
        [
            Paragraph("<b>Traditional AES</b>", table_cell),
            Paragraph("Extremely Low", table_cell),
            Paragraph("<b>CRITICAL:</b> Cloud must hold master key to share", table_cell),
            Paragraph("Requires re-encrypting all files", table_cell)
        ],
        [
            Paragraph("<b>Pure Asymmetric (RSA/ECC)</b>", table_cell),
            Paragraph("<b>HIGH:</b> Battery drain for N recipients", table_cell),
            Paragraph("Zero (End-to-End)", table_cell),
            Paragraph("Must re-encrypt per recipient at edge", table_cell)
        ],
        [
            Paragraph("<b>Attribute-Based (CP-ABE)</b>", table_cell),
            Paragraph("<b>SEVERE:</b> Expensive bilinear pairings", table_cell),
            Paragraph("Zero (Attribute evaluated)", table_cell),
            Paragraph("Complex attribute revocation", table_cell)
        ],
        [
            Paragraph("<b>Our Scheme (Hybrid PRE)</b>", table_cell),
            Paragraph("<b>OPTIMAL:</b> 1 symmetric enc + 1 key capsule", table_cell),
            Paragraph("<b>ZERO:</b> Proxy never learns plaintext", table_cell),
            Paragraph("<b>Instant:</b> Alice revokes re-encryption key", table_cell)
        ]
    ]

    t_comp = Table(comp_data, colWidths=[100, 120, 150, 134])
    t_comp.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_navy),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_comp)
    story.append(Spacer(1, 10))

    # References
    story.append(Paragraph("Selected Academic References:", h2_style))
    story.append(Paragraph("[1] M. Blaze, G. Bleumer, and M. Strauss, \"Divertible protocols and atomic proxy cryptography,\" <i>Advances in Cryptology — EUROCRYPT '98</i>, Springer, 1998.", bullet_style))
    story.append(Paragraph("[2] G. Ateniese et al., \"Improved Proxy Re-Encryption Schemes with Applications to Secure Distributed Storage,\" <i>ACM Transactions on Information and System Security (TISSEC)</i>, 2006.", bullet_style))
    story.append(Paragraph("[3] D. Nuñez et al., \"Umbral: A Threshold Proxy Re-Encryption Scheme,\" <i>Applied Cryptography and Network Security (ACNS)</i>, 2019.", bullet_style))

    doc.build(story, canvasmaker=TheoreticalNumberedCanvas)
    print("Theory PDF generated successfully at:", filename)

if __name__ == "__main__":
    build_theory_pdf()
