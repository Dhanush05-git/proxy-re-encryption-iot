import os
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "Project Demonstration & Viva Guide | Proxy Re-Encryption for Secure IoT Cloud Data Sharing")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 744, 558, 744)
        
        # Footer (all pages)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 45, 558, 45)
        
        self.drawString(54, 32, "Confidential — Academic & Laboratory Demonstration Manual")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 32, page_str)
        self.restoreState()

def build_pdf(filename="docs/pdf/PRE_IoT_Demonstration_Guide.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom palette: Emerald / Slate / Blue
    primary_color = colors.HexColor("#065F46") # Emerald 800
    accent_color = colors.HexColor("#0284C7")  # Sky 600
    dark_neutral = colors.HexColor("#0F172A")  # Slate 900
    body_color = colors.HexColor("#334155")    # Slate 700
    code_bg = colors.HexColor("#F8FAFC")
    box_bg = colors.HexColor("#F0FDF4")
    box_border = colors.HexColor("#10B981")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=primary_color,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=accent_color,
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'Header1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=primary_color,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Header2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=dark_neutral,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=body_color,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'BulletStyle',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#064E3B")
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0F172A")
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=dark_neutral
    )

    story = []

    # Title block
    story.append(Paragraph("Live Demonstration & Control Guide", title_style))
    story.append(Paragraph("Project: Proxy Re-Encryption for Secure IoT Cloud Data Sharing", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=primary_color, spaceAfter=14))

    # Executive Overview
    overview_text = (
        "<b>Purpose:</b> This manual equips students and presenters with an exact, step-by-step walkthrough "
        "to demonstrate the operational capabilities of the Proxy Re-Encryption (PRE) platform to evaluators, professors, "
        "and technical reviewers. It bridges live interactive actions on the UI with cryptographic theory and provides "
        "rock-solid answers to tough oral defense (viva) questions."
    )
    story.append(Paragraph(overview_text, body_style))
    story.append(Spacer(1, 8))

    # Section 1: System Startup
    story.append(Paragraph("1. System Setup & Environment Control", h1_style))
    story.append(Paragraph("The software stack is decoupled into a high-performance Python FastAPI backend and a responsive React 19 / Vite frontend:", body_style))

    setup_data = [
        [Paragraph("Component", table_header), Paragraph("Command / Script", table_header), Paragraph("Default Port & Access Point", table_header)],
        [Paragraph("Full Stack One-Click", table_cell), Paragraph("<b>./start.sh</b>", table_cell), Paragraph("Frontend: http://localhost:4321<br/>Backend: http://localhost:8000", table_cell)],
        [Paragraph("Backend Manual", table_cell), Paragraph(".venv/bin/uvicorn app.main:app --port 8000 --reload", table_cell), Paragraph("API Docs: http://localhost:8000/docs", table_cell)],
        [Paragraph("Frontend Manual", table_cell), Paragraph("npm run dev (inside frontend/)", table_cell), Paragraph("Vite Dev Server: http://localhost:4321", table_cell)]
    ]
    t_setup = Table(setup_data, colWidths=[110, 214, 180])
    t_setup.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_setup)
    story.append(Spacer(1, 10))

    # User Accounts
    story.append(Paragraph("Pre-configured Demonstration Personas (Password: <code>password123</code>):", body_style))
    story.append(Paragraph("• <b>Alice (IoT Data Owner):</b> Owns edge sensors (Cardiac ECG, Smart Grid, Industrial Thermostat). Encrypts telemetry and generates re-encryption keys.", bullet_style))
    story.append(Paragraph("• <b>Bob (Authorized Recipient):</b> Data analyst or medical specialist granted cryptographic access through cloud re-encryption.", bullet_style))
    story.append(Paragraph("• <b>Charlie (Unauthorized Adversary):</b> Represents malicious actor attempting eavesdropping, direct decryption, or proxy collusion.", bullet_style))
    story.append(Spacer(1, 8))

    # Section 2: Narrative Script
    story.append(Paragraph("2. Professor Presentation Script & Flow", h1_style))
    story.append(Paragraph("Deliver this opening statement to frame the project with rigorous academic relevance:", body_style))

    p_quote = Paragraph(
        "<i>\"Professor, modern IoT architectures routinely stream sensitive telemetry to public cloud storage. "
        "Standard public-key encryption forces IoT devices to repeatedly decrypt and re-encrypt data when sharing with new parties, "
        "draining low-power batteries. Alternatively, trusting the cloud with master decryption keys violates Zero-Trust principles. "
        "Our system resolves this dilemma using Umbral / BBS98 Proxy Re-Encryption: the cloud securely transforms ciphertexts "
        "from Alice's public key to Bob's public key without ever decrypting or learning the underlying plaintext.\"</i>",
        callout_style
    )
    t_callout = Table([[p_quote]], colWidths=[504])
    t_callout.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), box_bg),
        ('BOX', (0,0), (-1,-1), 1, box_border),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_callout)
    story.append(Spacer(1, 12))

    story.append(PageBreak())

    # Section 3: Live 5-Stage Demo
    story.append(Paragraph("3. Step-by-Step Live UI Demonstration Flow", h1_style))
    
    stages = [
        ("Stage 1: IoT Edge Telemetry Generation & Local Encryption",
         "1. Click the top-bar persona pill to switch to <b>Alice</b>.<br/>"
         "2. Navigate to <b>IoT Sensors / Encryption</b> page.<br/>"
         "3. Select a sensor: <i>Cardiac ECG Monitor</i> or <i>Smart Grid Thermostat</i>.<br/>"
         "4. Click <b>Generate Telemetry & Encrypt</b>.<br/>"
         "<b>What to show your professor:</b> Show the raw plaintext telemetry (heart rate, temperature, timestamp) "
         "contrasted with the generated Level 1 Ciphertext ($C_A$), the ephemeral capsule, and AES-256-GCM auth tag. "
         "Explain that hybrid encryption encapsulates the 256-bit symmetric session key with Umbral curve math."),
        
        ("Stage 2: Zero-Knowledge Inspection of the Cloud Proxy",
         "1. Navigate to the <b>Cloud Storage</b> tab.<br/>"
         "2. Point out the uploaded package marked with <b>Status: Encrypted (Level 1)</b>.<br/>"
         "<b>What to show your professor:</b> Highlight that the cloud holds only ciphertext blobs and metadata. "
         "Even a compromised server administrator with raw SQL database access cannot read the medical vitals."),
        
        ("Stage 3: Access Delegation & Re-Encryption Key Generation",
         "1. Navigate to the <b>Access Delegation / Sharing</b> tab.<br/>"
         "2. Select target recipient: <b>Bob</b> (<code>bob</code>).<br/>"
         "3. Click <b>Generate Re-Encryption Key & Delegate</b>.<br/>"
         "<b>What to show your professor:</b> Alice computes the re-encryption key $rk_{A \\to B} = b/a \\pmod q$ "
         "(or BBS98/Umbral KFrag) locally using her private key and Bob's public key. The key fragment is sent to the cloud. "
         "The proxy can transform ciphertexts but CANNOT decrypt either Alice's or Bob's records."),
        
        ("Stage 4: Recipient Re-Encryption & Decryption",
         "1. Switch persona to <b>Bob</b> via the top persona pill.<br/>"
         "2. Navigate to <b>Recipient / Shared with Me</b> tab.<br/>"
         "3. Click <b>Fetch & Re-encrypt</b>.<br/>"
         "<b>What to show your professor:</b> The cloud proxy transforms $C_A \\to C_B$ (Level 2 Ciphertext) dynamically. "
         "Bob's browser receives $C_B$ and uses Bob's private key $sk_B$ to unwrap the symmetric session key, revealing the "
         "original cardiac charts flawlessly without Alice ever coming back online!"),
        
        ("Stage 5: Adversarial Resistance Verification",
         "1. Switch persona to <b>Charlie</b> (Unauthorized attacker).<br/>"
         "2. Open the <b>Security Test / Attack Simulator</b> page.<br/>"
         "3. Attempt direct decryption and unauthorized proxy delegation.<br/>"
         "<b>What to show your professor:</b> Point out the immediate HTTP 403 Forbidden and cryptographic authentication "
         "failures. Prove that without $rk_{A \\to C}$ or $sk_A$, recovering plaintext requires solving the Elliptic Curve "
         "Discrete Logarithm Problem (ECDLP), which is computationally infeasible.")
    ]

    for title, desc in stages:
        story.append(Paragraph(title, h2_style))
        story.append(Paragraph(desc, body_style))
        story.append(Spacer(1, 4))

    story.append(Spacer(1, 10))

    # Section 4: Viva Defense Table
    story.append(Paragraph("4. Defense Q&A: Winning Responses to Professor Questions", h1_style))
    
    qa_data = [
        [Paragraph("Professor Question", table_header), Paragraph("Winning Technical Defense Answer", table_header)],
        [
            Paragraph("<b>What if the Cloud Proxy and Bob collude?</b>", table_cell),
            Paragraph("In standard bidirectional schemes, collusion between Bob and the proxy can recover Alice's secret key. In our implementation (Umbral/unidirectional PRE), re-encryption keys are non-interactive and strictly unidirectional ($rk_{A \\to B} \\neq rk_{B \\to A}$), preventing transitive key recovery.", table_cell)
        ],
        [
            Paragraph("<b>Why use Hybrid Encryption instead of pure PRE?</b>", table_cell),
            Paragraph("Asymmetric elliptic curve operations are computationally heavy. By combining Umbral PRE for the 256-bit symmetric Data Encryption Key (DEK) and AES-256-GCM for telemetry payload, encryption overhead on low-power IoT microcontrollers remains under 5 milliseconds.", table_cell)
        ],
        [
            Paragraph("<b>How is ciphertext integrity guaranteed?</b>", table_cell),
            Paragraph("AES-256-GCM is an Authenticated Encryption with Associated Data (AEAD) cipher. A 128-bit authentication tag is calculated over both ciphertext and headers. Any bit flipping by an adversarial cloud invalidates the tag and halts decryption.", table_cell)
        ],
        [
            Paragraph("<b>Can the proxy re-encrypt Bob's data to Charlie?</b>", table_cell),
            Paragraph("No. The transformation produces a Level 2 ciphertext. Our system enforces non-transitive re-encryption, meaning a Level 2 ciphertext cannot undergo a second re-encryption without Alice's direct authority.", table_cell)
        ]
    ]

    t_qa = Table(qa_data, colWidths=[160, 344])
    t_qa.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_qa)

    doc.build(story, canvasmaker=NumberedCanvas)
    print("Demo PDF generated successfully at:", filename)

if __name__ == "__main__":
    build_pdf()
