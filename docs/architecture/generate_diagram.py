#!/usr/bin/env python3
"""Generate Faheem Math architecture-diagram.png using PIL."""

from PIL import Image, ImageDraw, ImageFont
import os

# ── Config ──────────────────────────────────────────────────────────────────
W, H = 2400, 3200
BG = "#02040a"
BORDER_RADIUS = 20

# Colors
C_EMERALD = "#10B981"
C_SKY = "#38BDF8"
C_ROSE = "#F43F5E"
C_PURPLE = "#A855F7"
C_ORANGE = "#F97316"
C_AMBER = "#F59E0B"
C_SLATE_50 = "#F8FAFC"
C_SLATE_200 = "#E2E8F0"
C_SLATE_400 = "#94A3B8"
C_SLATE_500 = "#64748B"
C_SLATE_700 = "#334155"
C_SLATE_800 = "#1E293B"
C_SLATE_900 = "#0b1221"

def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

BG_RGB = hex_to_rgb(BG)

# Try to load a good font, fallback to default
def get_font(size, bold=False):
    paths = [
        "/System/Library/Fonts/SFPro-Bold.otf" if bold else "/System/Library/Fonts/SFPro-Regular.otf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSMono.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()

font_title = get_font(48, bold=True)
font_h2 = get_font(36, bold=True)
font_h3 = get_font(28, bold=True)
font_body = get_font(22)
font_small = get_font(18)
font_tiny = get_font(14)

img = Image.new("RGB", (W, H), BG_RGB)
draw = ImageDraw.Draw(img)


def draw_rounded_rect(xy, fill, outline=None, radius=16, width=2):
    x0, y0, x1, y1 = xy
    fill_rgb = hex_to_rgb(fill) if fill else None
    outline_rgb = hex_to_rgb(outline) if outline else None
    draw.rounded_rectangle(xy, radius=radius, fill=fill_rgb, outline=outline_rgb, width=width)


def draw_text(x, y, text, font=font_body, fill=C_SLATE_200):
    draw.text((x, y), text, fill=hex_to_rgb(fill), font=font)


def draw_arrow(x0, y0, x1, y1, color=C_SLATE_500, width=3):
    c = hex_to_rgb(color)
    draw.line([(x0, y0), (x1, y1)], fill=c, width=width)
    # Arrowhead
    if y1 > y0:  # pointing down
        draw.polygon([(x1-8, y1-12), (x1+8, y1-12), (x1, y1)], fill=c)
    elif y1 < y0:  # pointing up
        draw.polygon([(x1-8, y1+12), (x1+8, y1+12), (x1, y1)], fill=c)


def draw_dot(x, y, r, color):
    draw.ellipse([x-r, y-r, x+r, y+r], fill=hex_to_rgb(color))


# ── Title ────────────────────────────────────────────────────────────────────
draw_text(80, 40, "FAHEEM MATH", font=font_title, fill=C_EMERALD)
draw_text(520, 50, "— Architecture Overview (v0.5.1)", font=font_h3, fill=C_SLATE_500)

# ── Layer 1: BROWSER ─────────────────────────────────────────────────────────
BROWSER_Y = 110
BROWSER_H = 1100
draw_rounded_rect((60, BROWSER_Y, W-60, BROWSER_Y+BROWSER_H), fill=C_SLATE_900, outline="#3b82f6", radius=24, width=3)
draw_text(80, BROWSER_Y+16, "BROWSER  —  Next.js 14 + Framer Motion + Tailwind CSS", font=font_h2, fill="#3b82f6")
draw_text(80, BROWSER_Y+60, "Deployed on Google Cloud Run  |  Obsidian Theme  |  Cairo Font", font=font_small, fill=C_SLATE_500)

# ── UI Components Section ────────────────────────────────────────────────────
UI_Y = BROWSER_Y + 95
draw_rounded_rect((100, UI_Y, W-100, UI_Y+550), fill="#0a1628", outline=C_SLATE_700, radius=16, width=1)
draw_text(120, UI_Y+12, "React Components", font=font_h3, fill=C_SLATE_400)

# Header bar
HB_Y = UI_Y + 55
draw_rounded_rect((130, HB_Y, W-130, HB_Y+75), fill=C_SLATE_800, outline=C_SLATE_700, radius=12)
items_header = [
    ("FaheemLogo", C_EMERALD),
    ("Brand + Status", C_SLATE_200),
    ("ModeSelector", C_SKY),
    ("Timer", C_EMERALD),
    ("Help", C_SLATE_400),
    ("Start/End", C_ROSE),
]
hx = 160
spacing = (W - 300 - 160) // len(items_header)
for label, color in items_header:
    bw = min(spacing - 20, len(label)*12 + 30)
    draw_rounded_rect((hx, HB_Y+12, hx+bw, HB_Y+62), fill="#0f1d32", outline=color, radius=8, width=1)
    draw_text(hx+12, HB_Y+22, label, font=font_small, fill=color)
    hx += spacing

# Main layout row
ML_Y = HB_Y + 95

# Center: Ambient Orb
draw_rounded_rect((130, ML_Y, 1200, ML_Y+200), fill="#0a1628", outline=C_PURPLE, radius=16, width=1)
draw_text(150, ML_Y+12, "Ambient State Visualization", font=font_h3, fill=C_PURPLE)
# Draw the orb
orb_cx, orb_cy = 400, ML_Y+120
for i, (r, c) in enumerate([(50, C_EMERALD), (38, C_SKY), (26, C_PURPLE)]):
    alpha = 80 - i*20
    draw.ellipse([orb_cx-r, orb_cy-r, orb_cx+r, orb_cy+r],
                 fill=hex_to_rgb(c), outline=hex_to_rgb(c))
draw_text(480, ML_Y+60, "AmbientOrb", font=font_body, fill=C_EMERALD)
draw_text(480, ML_Y+90, "Animated SVG reacts to LiveState", font=font_small, fill=C_SLATE_500)
draw_text(480, ML_Y+115, "9 states: idle, connecting, connected,", font=font_small, fill=C_SLATE_500)
draw_text(480, ML_Y+140, "listening, thinking, seeing, speaking,", font=font_small, fill=C_SLATE_500)
draw_text(480, ML_Y+165, "interrupted, error", font=font_small, fill=C_SLATE_500)

# Center: Transcript
TP_Y = ML_Y + 215
draw_rounded_rect((130, TP_Y, 1200, TP_Y+130), fill="#0a1628", outline=C_EMERALD, radius=16, width=1)
draw_text(150, TP_Y+12, "TranscriptPanel", font=font_h3, fill=C_EMERALD)
draw_text(150, TP_Y+50, "Scrollable chat: Tutor (F avatar) + Student (U avatar)", font=font_body, fill=C_SLATE_400)
draw_text(150, TP_Y+80, "Partial transcripts shown dimmed, finalized on speech end", font=font_small, fill=C_SLATE_500)

# Right side: Examples + Quick Tip
draw_rounded_rect((1240, ML_Y, W-130, ML_Y+200), fill="#0a1628", outline=C_AMBER, radius=16, width=1)
draw_text(1260, ML_Y+12, "ExamplesPanel", font=font_h3, fill=C_AMBER)
draw_text(1260, ML_Y+50, "Study Curriculum", font=font_body, fill=C_SLATE_400)
draw_text(1260, ML_Y+80, "Mode-aware example", font=font_small, fill=C_SLATE_500)
draw_text(1260, ML_Y+105, "problems (clickable)", font=font_small, fill=C_SLATE_500)

draw_rounded_rect((1240, ML_Y+215, W-130, ML_Y+345), fill="#0a1628", outline=C_EMERALD, radius=16, width=1)
draw_text(1260, ML_Y+228, "Quick Tip Card", font=font_h3, fill=C_EMERALD)
draw_text(1260, ML_Y+268, "Contextual tips for", font=font_small, fill=C_SLATE_500)
draw_text(1260, ML_Y+293, "using voice + interrupts", font=font_small, fill=C_SLATE_500)

# Floating Composer
FC_Y = TP_Y + 155
draw_rounded_rect((130, FC_Y, W-130, FC_Y+85), fill=C_SLATE_800, outline=C_EMERALD, radius=24, width=2)
draw_text(150, FC_Y+8, "Floating Composer", font=font_h3, fill=C_EMERALD)
comp_items = [
    ("Camera", "auto-capture+send", C_SLATE_400),
    ("Mic/MicOff", "voice+transcription", C_ROSE),
    ("Text Input", "textarea", C_SLATE_200),
    ("Send", "text message", C_EMERALD),
]
cx = 170
for name, desc, color in comp_items:
    draw_rounded_rect((cx, FC_Y+42, cx+180, FC_Y+72), fill="#0f1d32", outline=color, radius=8, width=1)
    draw_text(cx+10, FC_Y+47, f"{name}: {desc}", font=font_tiny, fill=color)
    cx += 200

# ── Hooks Section ────────────────────────────────────────────────────────────
HOOKS_Y = UI_Y + 570
draw_rounded_rect((100, HOOKS_Y, W-100, HOOKS_Y+200), fill="#0a1628", outline=C_SLATE_700, radius=16, width=1)
draw_text(120, HOOKS_Y+12, "Core Hooks & Web Audio", font=font_h3, fill=C_SLATE_400)

# useSessionSocket
draw_rounded_rect((130, HOOKS_Y+50, 830, HOOKS_Y+185), fill=C_SLATE_800, outline=C_SKY, radius=12, width=1)
draw_text(150, HOOKS_Y+58, "useSessionSocket.ts", font=font_body, fill=C_SKY)
draw_text(150, HOOKS_Y+88, "WebSocket client  |  Live state (9 states)", font=font_small, fill=C_SLATE_400)
draw_text(150, HOOKS_Y+110, "send: text, image, audio  |  playback: 24kHz PCM", font=font_small, fill=C_SLATE_400)
draw_text(150, HOOKS_Y+132, "Mic: native rate → 16kHz (linear interpolation)", font=font_small, fill=C_SLATE_400)
draw_text(150, HOOKS_Y+155, "AudioContext + ScriptProcessorNode", font=font_small, fill=C_SLATE_500)

# useVoiceTranscription
draw_rounded_rect((860, HOOKS_Y+50, 1500, HOOKS_Y+185), fill=C_SLATE_800, outline=C_ROSE, radius=12, width=1)
draw_text(880, HOOKS_Y+58, "useVoiceTranscription.ts", font=font_body, fill=C_ROSE)
draw_text(880, HOOKS_Y+88, "Web Speech API (browser-native)", font=font_small, fill=C_SLATE_400)
draw_text(880, HOOKS_Y+110, "Partial → update in-place (dimmed)", font=font_small, fill=C_SLATE_400)
draw_text(880, HOOKS_Y+132, "Final → finalize + sendTextQuiet()", font=font_small, fill=C_SLATE_400)
draw_text(880, HOOKS_Y+155, "Echo suppression (skip if isSpeaking)", font=font_small, fill=C_SLATE_500)

# useSessionTimer
draw_rounded_rect((1530, HOOKS_Y+50, W-130, HOOKS_Y+185), fill=C_SLATE_800, outline=C_AMBER, radius=12, width=1)
draw_text(1550, HOOKS_Y+58, "useSessionTimer", font=font_body, fill=C_AMBER)
draw_text(1550, HOOKS_Y+88, "mm:ss display", font=font_small, fill=C_SLATE_400)
draw_text(1550, HOOKS_Y+110, "Start on connect", font=font_small, fill=C_SLATE_400)
draw_text(1550, HOOKS_Y+132, "Freeze on stop", font=font_small, fill=C_SLATE_400)

# ── Arrow: Browser → Backend ─────────────────────────────────────────────────
ARROW1_Y = BROWSER_Y + BROWSER_H
draw_arrow(W//2, ARROW1_Y, W//2, ARROW1_Y+90, color=C_EMERALD, width=4)
draw_text(W//2+20, ARROW1_Y+15, "WebSocket: /ws/session", font=font_body, fill=C_EMERALD)
draw_text(W//2+20, ARROW1_Y+42, "Binary: PCM 16kHz↑ 24kHz↓  |  JSON: text/image/control", font=font_small, fill=C_SLATE_500)

# ── Layer 2: BACKEND ─────────────────────────────────────────────────────────
BACKEND_Y = ARROW1_Y + 100
BACKEND_H = 900
draw_rounded_rect((60, BACKEND_Y, W-60, BACKEND_Y+BACKEND_H), fill=C_SLATE_900, outline=C_EMERALD, radius=24, width=3)
draw_text(80, BACKEND_Y+16, "BACKEND  —  FastAPI + asyncio", font=font_h2, fill=C_EMERALD)
draw_text(80, BACKEND_Y+60, "Deployed on Google Cloud Run  |  Python 3.12 + uvicorn", font=font_small, fill=C_SLATE_500)

# main.py
MP_Y = BACKEND_Y + 95
draw_rounded_rect((100, MP_Y, W-100, MP_Y+70), fill="#0a1628", outline=C_SLATE_700, radius=12, width=1)
draw_text(120, MP_Y+10, "main.py — FastAPI Application", font=font_h3, fill=C_SLATE_400)
draw_text(120, MP_Y+42, "CORS middleware  |  GET /health  |  WS /ws/session", font=font_body, fill=C_SLATE_500)

# session_manager.py
SM_Y = MP_Y + 85
draw_rounded_rect((100, SM_Y, W-100, SM_Y+230), fill="#0a1628", outline=C_SKY, radius=12, width=1)
draw_text(120, SM_Y+10, "session_manager.py — WebSocket Lifecycle", font=font_h3, fill=C_SKY)

draw_rounded_rect((130, SM_Y+50, 900, SM_Y+215), fill=C_SLATE_800, outline=C_SLATE_700, radius=10)
draw_text(150, SM_Y+58, "handle_session()", font=font_body, fill=C_SLATE_200)
draw_text(150, SM_Y+86, "1. Accept WebSocket", font=font_small, fill=C_SLATE_400)
draw_text(150, SM_Y+108, "2. Create asyncio.Queue (decouple receive/send)", font=font_small, fill=C_SLATE_400)
draw_text(150, SM_Y+130, "3. receive_loop() — Browser → Queue", font=font_small, fill=C_SLATE_400)
draw_text(150, SM_Y+152, "4. LiveClient.run() — Queue → Gemini → Browser", font=font_small, fill=C_SLATE_400)
draw_text(150, SM_Y+178, "5. Build & send recap on disconnect", font=font_small, fill=C_SLATE_400)

draw_rounded_rect((930, SM_Y+50, W-130, SM_Y+215), fill=C_SLATE_800, outline=C_ORANGE, radius=10)
draw_text(950, SM_Y+58, "Mode Addendums", font=font_body, fill=C_ORANGE)
draw_text(950, SM_Y+90, "base_prompt + MODE_ADDENDUM[mode]", font=font_small, fill=C_SLATE_400)
draw_text(950, SM_Y+118, '"explain" → step-by-step coaching', font=font_small, fill=C_SLATE_400)
draw_text(950, SM_Y+144, '"quiz" → ask questions, check answers', font=font_small, fill=C_SLATE_400)
draw_text(950, SM_Y+170, '"homework" → full solution walkthrough', font=font_small, fill=C_SLATE_400)

# live_client.py
LC_Y = SM_Y + 245
draw_rounded_rect((100, LC_Y, W-100, LC_Y+200), fill="#0a1628", outline=C_PURPLE, radius=12, width=1)
draw_text(120, LC_Y+10, "live_client.py — Gemini Live API Bridge", font=font_h3, fill=C_PURPLE)

draw_rounded_rect((130, LC_Y+48, 700, LC_Y+185), fill=C_SLATE_800, outline=C_PURPLE, radius=10)
draw_text(150, LC_Y+56, "run() — Bidirectional Audio", font=font_body, fill=C_SLATE_200)
draw_text(150, LC_Y+86, "upstream: Queue → Gemini Live", font=font_small, fill=C_SLATE_400)
draw_text(150, LC_Y+108, "downstream: Gemini → Browser", font=font_small, fill=C_SLATE_400)
draw_text(150, LC_Y+130, "Barge-in detection → interrupt", font=font_small, fill=C_SLATE_400)
draw_text(150, LC_Y+155, "Tool calls → TutorAgent dispatch", font=font_small, fill=C_SLATE_400)

draw_rounded_rect((730, LC_Y+48, 1400, LC_Y+115), fill=C_SLATE_800, outline=C_SKY, radius=10)
draw_text(750, LC_Y+56, "generate_text_reply()", font=font_body, fill=C_SKY)
draw_text(750, LC_Y+82, "Standard Gemini API  |  Multi-turn chat history", font=font_small, fill=C_SLATE_400)

draw_rounded_rect((730, LC_Y+125, 1400, LC_Y+185), fill=C_SLATE_800, outline=C_AMBER, radius=10)
draw_text(750, LC_Y+133, "generate_image_reply()", font=font_body, fill=C_AMBER)
draw_text(750, LC_Y+158, "Decode base64  |  Gemini multimodal vision API", font=font_small, fill=C_SLATE_400)

# tutor_agent.py + Tools
TA_Y = LC_Y + 215
draw_rounded_rect((100, TA_Y, 800, TA_Y+130), fill="#0a1628", outline=C_EMERALD, radius=12, width=1)
draw_text(120, TA_Y+10, "tutor_agent.py — Persona & Tools", font=font_h3, fill=C_EMERALD)
draw_text(120, TA_Y+46, "System prompt: system_prompt.md", font=font_body, fill=C_SLATE_400)
draw_text(120, TA_Y+74, "Tool dispatch → local tool registry", font=font_small, fill=C_SLATE_400)
draw_text(120, TA_Y+96, "Voice config: Charon", font=font_small, fill=C_SLATE_500)

# Math Tools
draw_rounded_rect((830, TA_Y, W-100, TA_Y+130), fill="#0a1628", outline=C_AMBER, radius=12, width=1)
draw_text(850, TA_Y+10, "Math Tools", font=font_h3, fill=C_AMBER)

tools = [
    ("detect_problem_type", "classify"),
    ("check_answer", "verdict"),
    ("generate_next_hint", "3 lvls"),
    ("build_session_recap", "score"),
]
tx = 850
for name, desc in tools:
    tw = 280
    draw_rounded_rect((tx, TA_Y+48, tx+tw, TA_Y+118), fill=C_SLATE_800, outline=C_SLATE_700, radius=8)
    draw_text(tx+10, TA_Y+55, name, font=font_tiny, fill=C_SLATE_200)
    draw_text(tx+10, TA_Y+80, desc, font=font_tiny, fill=C_SLATE_500)
    tx += tw + 15

# ── Arrow: Backend → Gemini ──────────────────────────────────────────────────
ARROW2_Y = BACKEND_Y + BACKEND_H
draw_arrow(W//2, ARROW2_Y, W//2, ARROW2_Y+90, color=C_AMBER, width=4)
draw_text(W//2+20, ARROW2_Y+15, "google-genai SDK (Python)", font=font_body, fill=C_AMBER)
draw_text(W//2+20, ARROW2_Y+42, "GEMINI_API_KEY", font=font_small, fill=C_SLATE_500)

# ── Layer 3: GEMINI API ──────────────────────────────────────────────────────
GEMINI_Y = ARROW2_Y + 100
GEMINI_H = 280
draw_rounded_rect((60, GEMINI_Y, W-60, GEMINI_Y+GEMINI_H), fill=C_SLATE_900, outline=C_AMBER, radius=24, width=3)
draw_text(80, GEMINI_Y+16, "GEMINI API  —  Google Cloud", font=font_h2, fill=C_AMBER)

# Live model
draw_rounded_rect((100, GEMINI_Y+65, 1150, GEMINI_Y+255), fill="#0a1628", outline=C_PURPLE, radius=12, width=1)
draw_text(120, GEMINI_Y+73, "gemini-2.5-flash-native-audio-latest", font=font_body, fill=C_PURPLE)
draw_text(120, GEMINI_Y+105, "Real-time audio streaming (16kHz in, 24kHz out)", font=font_small, fill=C_SLATE_400)
draw_text(120, GEMINI_Y+130, "Full-duplex — listen and speak simultaneously", font=font_small, fill=C_SLATE_400)
draw_text(120, GEMINI_Y+155, "Barge-in detection (interruption-aware)", font=font_small, fill=C_SLATE_400)
draw_text(120, GEMINI_Y+180, "Tool use: detect_problem, check_answer, hints, recap", font=font_small, fill=C_SLATE_400)
draw_text(120, GEMINI_Y+205, "Voice: Charon", font=font_small, fill=C_SLATE_500)

# Text model
draw_rounded_rect((1190, GEMINI_Y+65, W-100, GEMINI_Y+255), fill="#0a1628", outline=C_SKY, radius=12, width=1)
draw_text(1210, GEMINI_Y+73, "gemini-2.5-flash", font=font_body, fill=C_SKY)
draw_text(1210, GEMINI_Y+105, "Text-based interactions", font=font_small, fill=C_SLATE_400)
draw_text(1210, GEMINI_Y+130, "Multi-turn chat history", font=font_small, fill=C_SLATE_400)
draw_text(1210, GEMINI_Y+155, "Multimodal vision (reads math", font=font_small, fill=C_SLATE_400)
draw_text(1210, GEMINI_Y+180, "from handwritten/printed images)", font=font_small, fill=C_SLATE_400)
draw_text(1210, GEMINI_Y+205, "Same tool schemas as audio model", font=font_small, fill=C_SLATE_500)

# ── Legend ────────────────────────────────────────────────────────────────────
LEG_Y = GEMINI_Y + GEMINI_H + 30
draw_text(80, LEG_Y, "Legend:", font=font_h3, fill=C_SLATE_400)
legend = [
    (C_EMERALD, "Backend / UI"),
    (C_SKY, "Text/Chat API"),
    (C_PURPLE, "Audio/Live API"),
    (C_AMBER, "Tools / Gemini"),
    (C_ROSE, "Voice / Mic"),
    (C_ORANGE, "Mode Routing"),
]
lx = 250
for color, label in legend:
    draw_dot(lx, LEG_Y+15, 8, color)
    draw_text(lx+16, LEG_Y+3, label, font=font_small, fill=color)
    lx += 220

# Version footer
draw_text(80, LEG_Y+50, "Faheem Math v0.5.1  |  2026-03-04  |  Gemini Live Agent Challenge", font=font_small, fill=C_SLATE_500)

# ── Save ─────────────────────────────────────────────────────────────────────
out_path = os.path.join(os.path.dirname(__file__), "..", "architecture-diagram.png")
img.save(out_path, "PNG", quality=95)
print(f"Saved: {os.path.abspath(out_path)}")

# Also save in the architecture directory
out_path2 = os.path.join(os.path.dirname(__file__), "architecture-diagram.png")
img.save(out_path2, "PNG", quality=95)
print(f"Saved: {os.path.abspath(out_path2)}")
