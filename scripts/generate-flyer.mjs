/**
 * DREAM One-Page Flyer Generator
 * Produces: dream-flyer.docx in project root
 * Run: node scripts/generate-flyer.mjs
 */

import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  AlignmentType, HeadingLevel, BorderStyle, ShadingType,
  Table, TableRow, TableCell, WidthType, VerticalAlign,
  convertInchesToTwip as twip,
} from 'docx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ── Colours ─────────────────────────────────────────────────────────────
const GREEN       = '5CF28E';
const DARK_GREEN  = '33824D';
const NEAR_BLACK  = '0D0D0D';
const DARK_GREY   = '1A1A2E';
const MID_GREY    = '4A5568';
const LIGHT_GREY  = 'F0F4F8';
const WHITE       = 'FFFFFF';
const AMBER       = 'FEF3C7';
const AMBER_TEXT  = '92400E';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Load an image from public/ or root */
function loadImg(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full);
}

/** Small centred paragraph */
function centred(runs, spaceBefore = 0, spaceAfter = 0) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: spaceBefore, after: spaceAfter },
    children: Array.isArray(runs) ? runs : [runs],
  });
}

/** Left-aligned paragraph */
function left(runs, spaceBefore = 0, spaceAfter = 0) {
  return new Paragraph({
    spacing: { before: spaceBefore, after: spaceAfter },
    children: Array.isArray(runs) ? runs : [runs],
  });
}

function run(text, opts = {}) {
  return new TextRun({ text, ...opts });
}

/** Thick horizontal rule in dark-green */
function rule(color = GREEN, thickness = 24, before = 0, after = 0) {
  return new Paragraph({
    spacing: { before, after },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: thickness, color },
    },
    children: [],
  });
}

/** A shaded "pill" row (used for stats) */
function statCell(label, value, bg = DARK_GREY, fg = GREEN, labelFg = WHITE) {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill: bg },
    margins: { top: twip(0.1), bottom: twip(0.1), left: twip(0.15), right: twip(0.15) },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      centred(run(value, { bold: true, size: 48, color: fg }), 60, 0),
      centred(run(label, { size: 16, color: labelFg }), 0, 60),
    ],
  });
}

/** Benefit card cell */
function benefitCell(icon, title, desc, bg = LIGHT_GREY) {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill: bg },
    margins: { top: twip(0.12), bottom: twip(0.12), left: twip(0.15), right: twip(0.15) },
    verticalAlign: VerticalAlign.TOP,
    children: [
      centred([run(icon, { size: 28 })], 40, 0),
      centred([run(title, { bold: true, size: 20, color: NEAR_BLACK })], 40, 40),
      centred([run(desc, { size: 17, color: MID_GREY })], 0, 40),
    ],
  });
}

// ── Load logos ────────────────────────────────────────────────────────────
const dreamLogo      = loadImg('public/Dream.PNG');
const upstreamLogo   = loadImg('Upstreamworklogo.png');

if (!dreamLogo)    console.warn('⚠  Dream.PNG not found');
if (!upstreamLogo) console.warn('⚠  Upstreamworklogo.png not found');

// ── Page sections ─────────────────────────────────────────────────────────

// 1. HEADER — logos side by side
const logoRow = new TableRow({
  children: [
    // DREAM logo (left)
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      shading: { type: ShadingType.CLEAR, fill: NEAR_BLACK },
      margins: { top: twip(0.1), bottom: twip(0.1), left: twip(0.15), right: twip(0.1) },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: dreamLogo
            ? [new ImageRun({ data: dreamLogo, transformation: { width: 220, height: 80 }, type: 'png' })]
            : [run('DREAM', { bold: true, size: 52, color: GREEN })],
        }),
      ],
    }),
    // Upstream Works logo (right)
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      shading: { type: ShadingType.CLEAR, fill: NEAR_BLACK },
      margins: { top: twip(0.1), bottom: twip(0.1), left: twip(0.1), right: twip(0.15) },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: upstreamLogo
            ? [new ImageRun({ data: upstreamLogo, transformation: { width: 180, height: 60 }, type: 'png' })]
            : [run('Upstream Works', { bold: true, size: 32, color: WHITE })],
        }),
      ],
    }),
  ],
});

const headerTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [logoRow],
  borders: {
    top: { style: BorderStyle.NONE },
    bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    insideH: { style: BorderStyle.NONE },
    insideV: { style: BorderStyle.NONE },
  },
});

// 2. HERO BLOCK
const heroBlock = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 60 },
    shading: { type: ShadingType.CLEAR, fill: NEAR_BLACK },
    children: [
      run('THE WORLD\'S FIRST ', { bold: true, size: 20, color: GREEN, characterSpacing: 150 }),
      run('AGENTIC DECISION INTELLIGENCE PLATFORM', { bold: true, size: 20, color: GREEN, characterSpacing: 150 }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 80 },
    shading: { type: ShadingType.CLEAR, fill: NEAR_BLACK },
    children: [
      run('Stop Guessing.', { bold: true, size: 60, color: WHITE }),
      run('  Start Deciding With ', { bold: true, size: 60, color: WHITE }),
      run('Confidence.', { bold: true, size: 60, color: GREEN }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 160 },
    shading: { type: ShadingType.CLEAR, fill: NEAR_BLACK },
    children: [
      run(
        'DREAM transforms how leadership teams align strategy, cut through conflicting priorities, and produce\n' +
        'decisions executives can defend — in hours, not months.',
        { size: 22, color: 'AAAAAA' }
      ),
    ],
  }),
];

// 3. STATS STRIP
const statsTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({
      children: [
        statCell('Insights per session',  '1,000+'),
        statCell('Faster than surveys',   '10×',    DARK_GREY, GREEN, WHITE),
        statCell('Analytical views',      '7',      DARK_GREY, GREEN, WHITE),
        statCell('Lenses covered',        '5',      DARK_GREY, GREEN, WHITE),
      ],
    }),
  ],
  borders: {
    top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
    insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE },
  },
});

// 4. SECTION TITLE helper
function sectionTitle(text, color = NEAR_BLACK, bg = WHITE) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 80 },
    shading: { type: ShadingType.CLEAR, fill: bg },
    children: [run(text, { bold: true, size: 32, color })],
  });
}

// 5. BENEFITS GRID
const benefitsTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({
      children: [
        benefitCell('🤖', 'Agentic AI Engine',
          'Multiple specialist agents — Discovery, Facilitation, Synthesis — working in concert. Not a chatbot wrapper.'),
        benefitCell('🔮', '7 Analytical Views',
          'Hemisphere, Sentiment, Bias, Balance, Multi-Lens, Psyche Diagnostic, Executive Scratchpad. Surfaces what surveys miss.'),
        benefitCell('⚡', 'Before · During · After',
          'AI discovery prep, live cognitive guidance, and instant intelligence — all in one continuous workflow.'),
      ],
    }),
    new TableRow({
      children: [
        benefitCell('🗺️', 'DREAM Methodology',
          'Discover → Reimagine → Educate → Apply → Mobilise. Five structured phases from raw insight to board-ready strategy.'),
        benefitCell('🎯', 'Field + Remote Discovery',
          'Stream A (remote AI interviews) and Stream B (on-site field capture) synthesised together for a complete picture.'),
        benefitCell('🔒', 'Enterprise Ready',
          'GDPR compliant, consent-first, encrypted transcripts. Built for regulated industries from day one.'),
      ],
    }),
  ],
  borders: {
    top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
    insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE },
  },
});

// 6. HOW IT WORKS — three columns
function phaseCell(phase, timing, desc) {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill: DARK_GREY },
    margins: { top: twip(0.12), bottom: twip(0.12), left: twip(0.15), right: twip(0.15) },
    verticalAlign: VerticalAlign.TOP,
    children: [
      centred([run(timing, { bold: true, size: 16, color: GREEN, characterSpacing: 120 })], 40, 20),
      centred([run(phase, { bold: true, size: 24, color: WHITE })], 0, 40),
      centred([run(desc, { size: 17, color: 'AAAAAA' })], 0, 40),
    ],
  });
}

const howItWorksTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({
      children: [
        phaseCell('Before',
          'PRE-WORKSHOP',
          'Participants complete a 15-minute AI-guided conversation. Themes, insights and a facilitator brief are ready before anyone enters the room.'),
        phaseCell('During',
          'LIVE SESSION',
          'Specialist agents generate questions in real time. The 360° Hemisphere builds live on screen. Contradictions and consensus surface as they happen.'),
        phaseCell('After',
          'INSTANT INTELLIGENCE',
          'The full 7-view analytical dashboard is available immediately — no waiting for consultants to write reports.'),
      ],
    }),
  ],
  borders: {
    top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
    insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE },
  },
});

// 7. CLOSING CTA
const ctaBlock = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 60 },
    shading: { type: ShadingType.CLEAR, fill: NEAR_BLACK },
    children: [
      run('Ready to see DREAM in action?', { bold: true, size: 34, color: WHITE }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 60 },
    shading: { type: ShadingType.CLEAR, fill: NEAR_BLACK },
    children: [
      run('Book a live demonstration with Upstream Works', { size: 22, color: 'AAAAAA' }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 200 },
    shading: { type: ShadingType.CLEAR, fill: NEAR_BLACK },
    children: [
      run('www.upstreamworks.co.uk  ·  hello@upstreamworks.co.uk', { bold: true, size: 22, color: GREEN }),
    ],
  }),
];

// ── Assemble document ─────────────────────────────────────────────────────
const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          margin: { top: twip(0.4), bottom: twip(0.4), left: twip(0.5), right: twip(0.5) },
        },
      },
      children: [
        // Header (logos on dark bg)
        ...(() => {
          // Wrap in shaded paragraph container manually via table
          return [headerTable];
        })(),

        // Hero
        ...heroBlock,

        // Stats
        rule(GREEN, 8, 0, 80),
        statsTable,
        rule(GREEN, 8, 80, 0),

        // Benefits
        sectionTitle('Why Organisations Choose DREAM', NEAR_BLACK, WHITE),
        benefitsTable,

        // How it works
        sectionTitle('One Platform. Three Moments That Matter.', WHITE, NEAR_BLACK),
        new Paragraph({ shading: { type: ShadingType.CLEAR, fill: NEAR_BLACK }, children: [], spacing: { before: 0, after: 80 } }),
        howItWorksTable,
        new Paragraph({ shading: { type: ShadingType.CLEAR, fill: NEAR_BLACK }, children: [], spacing: { before: 80, after: 0 } }),

        // CTA footer
        ...ctaBlock,
      ],
    },
  ],
});

// ── Write file ────────────────────────────────────────────────────────────
const outPath = path.join(root, 'dream-flyer.docx');
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outPath, buffer);
console.log(`✅  Flyer written to: ${outPath}`);
