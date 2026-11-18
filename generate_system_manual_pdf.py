import os
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class SystemManualCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(SystemManualCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(SystemManualCanvas, self).showPage()
        super(SystemManualCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "Complete System Architecture & UI Walkthrough Manual | PRE IoT Platform")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 744, 558, 744)
        
        # Footer
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 45, 558, 45)
        
        self.drawString(54, 32, "Proxy Re-Encryption for Secure IoT Cloud Data Sharing — Comprehensive Manual (A to Z)")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 32, page_str)
        self.restoreState()

def build_system_manual_pdf(filename="docs/pdf/PRE_IoT_Complete_System_Manual_A_to_Z.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    teal_dark = colors.HexColor("#0F766E")   # Teal 700
    cyan_dark = colors.HexColor("#0E7490")   # Cyan 700
    slate_dark = colors.HexColor("#0F172A")  # Slate 900
    body_color = colors.HexColor("#334155")  # Slate 700
    callout_bg = colors.HexColor("#F0FDFA")  # Teal 50
    callout_border = colors.HexColor("#14B8A6") # Teal 500
    gray_bg = colors.HexColor("#F8FAFC")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=teal_dark,
        spaceAfter=5
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=cyan_dark,
        spaceAfter=12
    )

    h1_style = ParagraphStyle(
        'Header1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12.5,
        leading=16,
        textColor=teal_dark,
        spaceBefore=12,
        spaceAfter=5,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Header2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13.5,
        textColor=slate_dark,
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.8,
        leading=12.5,
        textColor=body_color,
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'BulletText',
        parent=body_style,
        leftIndent=14,
        firstLineIndent=-9,
        spaceAfter=3
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#0F172A")
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#134E4A")
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
        textColor=slate_dark
    )

    story = []

    # Title Block
    story.append(Paragraph("System Architecture & UI Page-by-Page Manual", title_style))
    story.append(Paragraph("A Complete A to Z Guide: From Edge Sensor to Untrusted Cloud Proxy and Recipient", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=teal_dark, spaceAfter=10))

    # Executive Summary Box
    summary_text = (
        "<b>System Summary:</b> This document provides an exhaustive, end-to-end (A to Z) architectural and operational manual "
        "for the Proxy Re-Encryption (PRE) IoT Cloud Data Sharing platform. It details how edge sensors capture real-world signals, "
        "how hybrid encryption isolates sensitive data, how the semi-honest cloud transforms ciphertexts without decryption, "
        "and provides an exact, screen-by-screen breakdown of all 10 user interface modules."
    )
    t_summary = Table([[Paragraph(summary_text, callout_style)]], colWidths=[504])
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), callout_bg),
        ('BOX', (0,0), (-1,-1), 1, callout_border),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(t_summary)
    story.append(Spacer(1, 8))

    # Section 1: End-to-End Workflow (A to Z)
    story.append(Paragraph("1. The End-to-End System Journey (A to Z Lifecycle)", h1_style))
    story.append(Paragraph(
        "The system replaces conventional, insecure cloud storage with a 6-phase cryptographic lifecycle:",
        body_style
    ))

    lifecycle_data = [
        [Paragraph("Phase", table_header), Paragraph("Actor / Node", table_header), Paragraph("Cryptographic Operations & State Transition", table_header)],
        [
            Paragraph("<b>Phase A: Registration & KeyGen</b>", table_cell),
            Paragraph("Client / User Agent", table_cell),
            Paragraph("User registers with PBKDF2/Bcrypt auth. Ephemeral elliptic curve keypairs $(sk_u, pk_u)$ are generated via Umbral PRE. Public keys are registered on the proxy; secret keys remain strictly local to the user.", table_cell)
        ],
        [
            Paragraph("<b>Phase B: Sensor Telemetry Capture</b>", table_cell),
            Paragraph("Edge IoT Device", table_cell),
            Paragraph("Sensors (Cardiac ECG, Smart Grid, Thermostats) sample time-series telemetry into structured JSON: <code>{sensor_id, timestamp, vitals, unit, signature}</code>.", table_cell)
        ],
        [
            Paragraph("<b>Phase C: Hybrid Local Encryption</b>", table_cell),
            Paragraph("IoT Edge Processor", table_cell),
            Paragraph("1. Generates 256-bit symmetric session key (DEK).<br/>2. Encrypts payload with <b>AES-256-GCM</b> + 96-bit IV + 128-bit Auth Tag.<br/>3. Encapsulates DEK into an Umbral <b>Capsule</b> under Alice's $pk_A$. Level 1 ciphertext package produced.", table_cell)
        ],
        [
            Paragraph("<b>Phase D: Untrusted Cloud Ingestion</b>", table_cell),
            Paragraph("Cloud Proxy Storage", table_cell),
            Paragraph("The ciphertext package is uploaded over HTTPS to the proxy. The proxy logs metadata, size, and timestamp, but cannot decrypt the payload (Zero-Trust environment).", table_cell)
        ],
        [
            Paragraph("<b>Phase E: Access Delegation</b>", table_cell),
            Paragraph("Data Owner (Alice)", table_cell),
            Paragraph("Alice decides to grant Bob access. Her client derives a re-encryption key $rk_{A \\to B}$ from $sk_A$ and $pk_B$ without disclosing $sk_A$. The key fragment (KFrag) is stored at the proxy.", table_cell)
        ],
        [
            Paragraph("<b>Phase F: Re-Encryption & Decryption</b>", table_cell),
            Paragraph("Proxy $\\to$ Recipient (Bob)", table_cell),
            Paragraph("The proxy applies $rk_{A \\to B}$ to the Capsule, transforming Level 1 ciphertext ($C_A$) into Level 2 ciphertext ($C_B$). Bob receives $C_B$, decapsulates DEK using $sk_B$, and decrypts the pristine telemetry.", table_cell)
        ]
    ]

    t_lifecycle = Table(lifecycle_data, colWidths=[95, 105, 304])
    t_lifecycle.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), teal_dark),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4.5),
    ]))
    story.append(t_lifecycle)
    story.append(Spacer(1, 8))

    story.append(PageBreak())

    # Section 2: Complete Page-by-Page UI Guide
    story.append(Paragraph("2. Complete Page-by-Page UI Reference (Every Page Explained)", h1_style))
    story.append(Paragraph(
        "The frontend is organized into 10 intuitive pages. Below is the functional purpose, user controls, "
        "and underlying cryptographic activity for each page:",
        body_style
    ))

    pages_info = [
        ("1. Login & Identity Page (LoginPage.tsx)",
         "<b>Purpose:</b> Secure authentication and cryptographic session initialization.<br/>"
         "• <b>What it does:</b> Authenticates users using JWT tokens while restoring local elliptic curve cryptographic keys.<br/>"
         "• <b>Controls & Features:</b> Username and password inputs, error validation, remember-me options, and quick-fill demo buttons for Alice, Bob, and Charlie.<br/>"
         "• <b>Under the Hood:</b> Issues a POST request to <code>/api/auth/token</code> and stores the session state in secure browser memory."),

        ("2. Real-Time Dashboard (DashboardPage.tsx)",
         "<b>Purpose:</b> Central operations command center providing a holistic view of the cryptographic ecosystem.<br/>"
         "• <b>What it does:</b> Displays system-wide telemetry: total encrypted files, active re-encryption delegations, registered IoT nodes, and proxy status.<br/>"
         "• <b>Controls & Features:</b> Quick statistics metric cards, activity timeline charts, encryption pipeline visualizer, and rapid navigation shortcuts.<br/>"
         "• <b>Under the Hood:</b> Polls <code>/api/sensors</code>, <code>/api/uploads</code>, and <code>/api/sharing</code> to aggregate live counts and recent cryptographic transactions."),

        ("3. IoT Sensors Management Page (SensorPage.tsx)",
         "<b>Purpose:</b> Virtual IoT edge device fleet simulator and telemetry stream visualizer.<br/>"
         "• <b>What it does:</b> Simulates edge devices (Cardiac ECG, Smart Grid Energy Monitor, Temperature Sensor, Industrial Vibration).<br/>"
         "• <b>Controls & Features:</b> Sensor generator slider, sampling rate selector, live waveform preview, and 'Encrypt & Upload' trigger.<br/>"
         "• <b>Under the Hood:</b> Generates synthetic medical/industrial time-series datasets adhering to standard JSON device schema."),

        ("4. Edge Encryption Studio (EncryptionPage.tsx)",
         "<b>Purpose:</b> Detailed interactive view of the hybrid encryption process performed at the IoT device.<br/>"
         "• <b>What it does:</b> Shows the raw plaintext payload transformed into Level 1 ciphertext ($C_A$) step-by-step.<br/>"
         "• <b>Controls & Features:</b> Raw payload inspector, AES key generation toggle, Umbral public-key capsule preview, and one-click package builder.<br/>"
         "• <b>Under the Hood:</b> Invokes <code>aes_encrypt()</code> with a 256-bit DEK, encapsulates the DEK using <code>umbral_encrypt(alice_pk, dek)</code>, and logs hex values of the IV, Auth Tag, and Capsule."),

        ("5. Cloud Storage Inspector (CloudStoragePage.tsx)",
         "<b>Purpose:</b> Verifies the Zero-Knowledge property of the untrusted cloud server.<br/>"
         "• <b>What it does:</b> Displays all encrypted files hosted on the proxy server as seen by an untrusted cloud administrator.<br/>"
         "• <b>Controls & Features:</b> File explorer table, ciphertext viewer, raw hex dump inspector, metadata audit log, and download button.<br/>"
         "• <b>Under the Hood:</b> Shows that the storage database contains only encrypted bytes, hashes, and nonces. Demonstrates that without keys, the cloud administrator sees only high-entropy random data."),

        ("6. Access Delegation & Sharing Studio (SharingPage.tsx)",
         "<b>Purpose:</b> Granular access control and Re-Encryption Key generation.<br/>"
         "• <b>What it does:</b> Allows Alice to delegate decryption privileges to Bob without sharing her secret key or decrypting files.<br/>"
         "• <b>Controls & Features:</b> Recipient dropdown, file selector, expiration calendar, permissions list, and 'Generate Re-Encryption Key' action.<br/>"
         "• <b>Under the Hood:</b> Calls <code>generate_kfrags(alice_sk, bob_pk)</code>. Alice signs the delegation and uploads the verified KeyFrag to the cloud proxy."),

        ("7. Proxy Re-Encryption Engine (ProxyPage.tsx)",
         "<b>Purpose:</b> Dedicated visualization of the semi-honest cloud transformation engine.<br/>"
         "• <b>What it does:</b> Visualizes the homomorphic transformation of Level 1 ciphertext into Level 2 ciphertext.<br/>"
         "• <b>Controls & Features:</b> Pending re-encryption queue, manual transform trigger, cryptographic audit log, and latency counter.<br/>"
         "• <b>Under the Hood:</b> Executes <code>reencrypt(capsule, kfrag)</code> on the proxy server, producing a <code>CapsuleFrag</code> without learning the underlying data."),

        ("8. Recipient Decryption Dashboard (RecipientPage.tsx)",
         "<b>Purpose:</b> Authorized recipient interface for accessing and verifying shared datasets.<br/>"
         "• <b>What it does:</b> Enables Bob to view datasets shared with him, request proxy re-encryption, and decrypt the telemetry locally.<br/>"
         "• <b>Controls & Features:</b> 'Shared with Me' list, 'Fetch & Re-encrypt' button, local private key decapsulator, and interactive vitals chart display.<br/>"
         "• <b>Under the Hood:</b> Bob downloads the Level 2 package, combines <code>CapsuleFrag</code> with Bob's $sk_B$ to unwrap the 256-bit DEK, and decrypts the AES-GCM payload in milliseconds."),

        ("9. Security Attack Simulator (SecurityTestPage.tsx)",
         "<b>Purpose:</b> Rigorous adversarial evaluation testing against simulated cloud threats.<br/>"
         "• <b>What it does:</b> Simulates real-world cyber attacks: Direct Proxy Decryption, Unauthorized User Theft (Charlie), and Collusion.<br/>"
         "• <b>Controls & Features:</b> Interactive attack execution buttons, live test output console, status badges (PASS / REJECTED), and mathematical safety proofs.<br/>"
         "• <b>Under the Hood:</b> Demonstrates that unauthorized requests fail with HTTP 403 Forbidden or cryptographic GCM tag mismatch errors."),

        ("10. Benchmarks & Performance Analytics (PerformancePage.tsx)",
         "<b>Purpose:</b> Empirical latency, memory, and throughput profiling for IoT environments.<br/>"
         "• <b>What it does:</b> Visualizes execution times for KeyGen, Symmetric AES encryption, PRE capsule generation, and proxy transformation.<br/>"
         "• <b>Controls & Features:</b> Multi-scenario benchmark runner (1KB to 10MB payloads), latency breakdown bar charts, and CSV/JSON export tools.<br/>"
         "• <b>Under the Hood:</b> Measures exact cryptographic timings via high-resolution system timers (Python <code>time.perf_counter_ns()</code>).")
    ]

    for p_title, p_content in pages_info:
        story.append(Paragraph(p_title, h2_style))
        story.append(Paragraph(p_content, body_style))
        story.append(Spacer(1, 3))

    story.append(PageBreak())

    # Section 3: Summary Table & Architectural Cheat Sheet
    story.append(Paragraph("3. Quick Reference Matrix: Data Flow Across All Modules", h1_style))
    
    matrix_data = [
        [Paragraph("Page Module", table_header), Paragraph("Active Actor", table_header), Paragraph("Input Data", table_header), Paragraph("Cryptographic Output / Transformation", table_header)],
        [Paragraph("Sensor Page", table_cell), Paragraph("Alice (IoT)", table_cell), Paragraph("Physical sensor reading", table_cell), Paragraph("Structured JSON telemetry", table_cell)],
        [Paragraph("Encryption Page", table_cell), Paragraph("Alice (IoT)", table_cell), Paragraph("Plaintext JSON", table_cell), Paragraph("Level 1 Ciphertext ($C_A$) + Capsule ($E, V, s$)", table_cell)],
        [Paragraph("Cloud Storage", table_cell), Paragraph("Cloud Proxy", table_cell), Paragraph("Encrypted payload", table_cell), Paragraph("Zero-Knowledge raw byte storage", table_cell)],
        [Paragraph("Sharing Page", table_cell), Paragraph("Alice (Owner)", table_cell), Paragraph("Bob's Public Key $pk_B$", table_cell), Paragraph("Re-Encryption KeyFrag ($rk_{A \\to B}$)", table_cell)],
        [Paragraph("Proxy Engine", table_cell), Paragraph("Cloud Proxy", table_cell), Paragraph("Capsule + KeyFrag", table_cell), Paragraph("Level 2 Transformed Capsule ($C_B$)", table_cell)],
        [Paragraph("Recipient Page", table_cell), Paragraph("Bob (Doctor)", table_cell), Paragraph("Level 2 Capsule + $sk_B$", table_cell), Paragraph("Decrypted pristine plaintext JSON charts", table_cell)],
        [Paragraph("Security Tests", table_cell), Paragraph("Charlie (Hacker)", table_cell), Paragraph("Tampered bytes / Invalid key", table_cell), Paragraph("Cryptographic Tag Mismatch (403 Blocked)", table_cell)],
        [Paragraph("Performance", table_cell), Paragraph("Evaluator", table_cell), Paragraph("Test payload batches", table_cell), Paragraph("Sub-millisecond execution telemetry", table_cell)]
    ]

    t_matrix = Table(matrix_data, colWidths=[90, 80, 130, 204])
    t_matrix.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), teal_dark),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_matrix)
    story.append(Spacer(1, 12))

    # Section 4: Academic Defense Summary
    story.append(Paragraph("4. Summary for Academic & Viva Presentation", h1_style))
    story.append(Paragraph(
        "<b>Key Takeaway to Conclude Your Presentation:</b><br/>"
        "<i>\"This system successfully proves that Proxy Re-Encryption solves the fundamental IoT cloud data sharing problem. "
        "Edge devices encrypt data exactly once using lightweight symmetric AES-256-GCM. Decryption access is dynamically "
        "delegated by transferring non-interactive re-encryption keys to an untrusted cloud server. Plaintext privacy is "
        "provably preserved because the cloud proxy transforms ciphertexts blindly without learning private keys or data content.\"</i>",
        callout_style
    ))

    doc.build(story, canvasmaker=SystemManualCanvas)
    print("System Manual PDF generated successfully at:", filename)

if __name__ == "__main__":
    build_system_manual_pdf()
