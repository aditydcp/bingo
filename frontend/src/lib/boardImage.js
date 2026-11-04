// Renders a player's bingo board (with photos) to a PNG blob. Browser only.
import { FREE_POS, LETTERS, thumb } from "./bingo";

// Same palette as globals.css
const FONT = "'Nunito', system-ui, sans-serif";
const INK = "#1e293b";
const CREAM = "#fffaf2";
const HEADER_COLORS = ["#ff6b6b", "#ff9f43", "#ffc93c", "#2ec4b6", "#4d96ff"];

function loadImg(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function rrPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
function rrFill(ctx, x, y, w, h, r, fill) {
  rrPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}
function rrStroke(ctx, x, y, w, h, r) {
  rrPath(ctx, x, y, w, h, r);
  ctx.stroke();
}
function wrapText(ctx, text, cx, cy, maxW, lineH) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const total = lines.length * lineH;
  let y = cy - total / 2 + lineH * 0.75;
  for (const l of lines) {
    ctx.fillText(l, cx, y);
    y += lineH;
  }
}

/**
 * @param {object} p
 * @param {string} p.name               player's alias
 * @param {Array<{id, label}>} p.board    25 cells in position order
 * @param {object} p.cells                marks keyed by position
 * @param {number[][]} p.highlightLines   lines drawn with a gold border
 * @param {string} p.title                footer headline, e.g. "BINGO!"
 * @param {string} [p.subtitle]           footer second line, e.g. a timestamp
 */
export async function renderBoardImage({ name, board, cells, highlightLines = [], title, subtitle }) {
  const W = 720;
  const PAD = 28;
  const GAP = 6;
  const gridW = W - PAD * 2;
  const cellSize = Math.floor((gridW - GAP * 4) / 5);
  const headerH = Math.floor(cellSize * 0.38);
  const topH = 148;
  const gridH = headerH + GAP + 5 * (cellSize + GAP);
  const botH = 84;
  const H = topH + gridH + botH;
  const winSet = new Set(highlightLines.flat());

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // background
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  // title
  ctx.textAlign = "left";
  ctx.font = `900 34px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.fillText("FIRST", PAD, 62);
  const firstW = ctx.measureText("FIRST ").width;
  ctx.fillStyle = "#ff9f43";
  ctx.fillText("Bingo", PAD + firstW, 62);

  // player alias
  ctx.font = `800 20px ${FONT}`;
  ctx.fillStyle = "#64748b";
  ctx.fillText(name, PAD, 104);

  // divider
  const divGrad = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
  HEADER_COLORS.forEach((c, i) => divGrad.addColorStop(i / 4, c));
  rrFill(ctx, PAD, 124, W - PAD * 2, 5, 2.5, divGrad);

  // FIRST header row
  for (let c = 0; c < 5; c++) {
    const x = PAD + c * (cellSize + GAP);
    const y = topH;
    rrFill(ctx, x, y, cellSize, headerH, 8, HEADER_COLORS[c]);
    ctx.font = `900 ${Math.floor(headerH * 0.6)}px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(LETTERS[c], x + cellSize / 2, y + headerH * 0.72);
  }

  // load photos
  const photoImgs = {};
  await Promise.all(
    Object.entries(cells || {}).map(async ([pos, state]) => {
      if (state?.photoUrl) {
        const img = await loadImg(thumb(state.photoUrl, 400));
        if (img) photoImgs[pos] = img;
      }
    }),
  );

  // draw 5×5 cells
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const pos = r * 5 + c;
      const x = PAD + c * (cellSize + GAP);
      const y = topH + headerH + GAP + r * (cellSize + GAP);
      const state = cells?.[pos];
      const isMarked = !!state?.marked;
      const isFree = pos === FREE_POS;
      const isWin = winSet.has(pos);
      const cellData = board[pos];

      // bg + border
      rrFill(ctx, x, y, cellSize, cellSize, 8, isFree ? "#fff4cc" : "#ffffff");
      ctx.strokeStyle = isWin ? "#ff9f43" : isFree ? "#ffc93c" : isMarked ? "#8ee3d8" : "#f1e6da";
      ctx.lineWidth = isWin ? 4 : 2;
      rrStroke(ctx, x, y, cellSize, cellSize, 8);

      // content
      if (photoImgs[pos]) {
        ctx.save();
        rrPath(ctx, x + 2, y + 2, cellSize - 4, cellSize - 4, 6);
        ctx.clip();
        const img = photoImgs[pos];
        const scale = Math.max(cellSize / img.naturalWidth, cellSize / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, x + (cellSize - dw) / 2, y + (cellSize - dh) / 2, dw, dh);
        ctx.restore();
        if (isWin) {
          ctx.strokeStyle = "#ff9f43";
          ctx.lineWidth = 4;
          rrStroke(ctx, x, y, cellSize, cellSize, 8);
        }
        const bs = Math.floor(cellSize * 0.28);
        ctx.fillStyle = "#2ec4b6";
        ctx.beginPath();
        ctx.arc(x + cellSize - bs / 2 - 3, y + bs / 2 + 3, bs / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `bold ${Math.floor(bs * 0.6)}px system-ui`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText("✓", x + cellSize - bs / 2 - 3, y + bs / 2 + 3 + bs * 0.22);
      } else if (isFree) {
        ctx.font = `${Math.floor(cellSize * 0.3)}px system-ui`;
        ctx.fillStyle = "#f59e0b";
        ctx.textAlign = "center";
        ctx.fillText("★", x + cellSize / 2, y + cellSize * 0.54);
        ctx.fillStyle = "#b45309";
        ctx.font = `900 ${Math.floor(cellSize * 0.15)}px ${FONT}`;
        ctx.fillText(cellData?.label || "GARUT", x + cellSize / 2, y + cellSize * 0.76);
      } else {
        const label = cellData?.label || "";
        const fs = Math.max(9, Math.floor(cellSize * 0.118));
        ctx.font = `700 ${fs}px ${FONT}`;
        ctx.fillStyle = "#475569";
        ctx.textAlign = "center";
        wrapText(ctx, label, x + cellSize / 2, y + cellSize / 2, cellSize - 10, fs + 3);
      }
    }
  }

  // footer
  const fy = topH + gridH + 22;
  ctx.textAlign = "center";
  ctx.font = `900 18px ${FONT}`;
  ctx.fillStyle = "#ff6b6b";
  ctx.fillText(title || "", W / 2, fy);
  if (subtitle) {
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = "#64748b";
    ctx.fillText(subtitle, W / 2, fy + 22);
  }
  ctx.font = `700 10px ${FONT}`;
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText("FIRST Summit Bingo", W / 2, fy + 46);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export const formatTime = (iso) =>
  iso ? new Date(iso).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "medium" }) : "";
