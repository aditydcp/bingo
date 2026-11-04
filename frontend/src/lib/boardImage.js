// Renders a player's bingo board (with photos) to a PNG blob. Browser only.
import { FREE_POS, LETTERS, thumb } from "./bingo";

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
 * @param {string} p.name, p.entitas
 * @param {Array<{id, label}>} p.board    25 cells in position order
 * @param {object} p.cells                marks keyed by position
 * @param {number[][]} p.highlightLines   lines drawn with a gold border
 * @param {string} p.title                footer headline, e.g. "BINGO!"
 * @param {string} [p.subtitle]           footer second line, e.g. a timestamp
 */
export async function renderBoardImage({ name, entitas, board, cells, highlightLines = [], title, subtitle }) {
  const W = 720;
  const PAD = 28;
  const GAP = 3;
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
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#060d1f");
  bgGrad.addColorStop(0.4, "#0a1628");
  bgGrad.addColorStop(0.7, "#0d2248");
  bgGrad.addColorStop(1, "#0a3a7a");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // subtle grid lines
  ctx.strokeStyle = "rgba(0,150,255,0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // logo
  const logoImg = await loadImg("/logo.png");
  if (logoImg) {
    const lh = 56;
    const lw = (lh / logoImg.naturalHeight) * logoImg.naturalWidth;
    ctx.drawImage(logoImg, PAD, 18, Math.min(lw, 130), lh);
  }

  // title
  ctx.textAlign = "right";
  ctx.font = "800 20px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = "#00d4ff";
  ctx.fillText("FIRST SUMMIT BINGO", W - PAD, 42);
  ctx.font = "600 13px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = "#60a5fa";
  ctx.fillText(`'${new Date().getFullYear().toString().slice(2)}`, W - PAD, 62);

  // user info
  ctx.textAlign = "left";
  ctx.font = "700 17px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(name, PAD, 100);
  ctx.font = "500 12px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = "#93c5fd";
  ctx.fillText(entitas, PAD, 118);

  // divider
  const divGrad = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
  divGrad.addColorStop(0, "rgba(0,150,255,0.9)");
  divGrad.addColorStop(1, "rgba(0,200,255,0.1)");
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, 130); ctx.lineTo(W - PAD, 130); ctx.stroke();

  // FIRST header row
  for (let c = 0; c < 5; c++) {
    const x = PAD + c * (cellSize + GAP);
    const y = topH;
    const hg = ctx.createLinearGradient(x, y, x + cellSize, y + headerH);
    hg.addColorStop(0, "#0066ff");
    hg.addColorStop(1, "#00aaff");
    rrFill(ctx, x, y, cellSize, headerH, 5, hg);
    ctx.font = `900 ${Math.floor(headerH * 0.56)}px 'Inter', system-ui, sans-serif`;
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
      if (isWin) {
        rrFill(ctx, x, y, cellSize, cellSize, 6, "rgba(0,50,120,0.9)");
        ctx.shadowColor = "rgba(245,158,11,0.8)";
        ctx.shadowBlur = 14;
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2.5;
        rrStroke(ctx, x, y, cellSize, cellSize, 6);
        ctx.shadowBlur = 0;
      } else if (isFree) {
        rrFill(ctx, x, y, cellSize, cellSize, 6, "rgba(15,50,120,0.9)");
        ctx.strokeStyle = "rgba(245,158,11,0.8)";
        ctx.lineWidth = 2;
        rrStroke(ctx, x, y, cellSize, cellSize, 6);
      } else if (isMarked) {
        rrFill(ctx, x, y, cellSize, cellSize, 6, "rgba(0,50,120,0.8)");
        ctx.strokeStyle = "rgba(0,200,255,0.4)";
        ctx.lineWidth = 1;
        rrStroke(ctx, x, y, cellSize, cellSize, 6);
      } else {
        rrFill(ctx, x, y, cellSize, cellSize, 6, "rgba(0,20,60,0.7)");
        ctx.strokeStyle = "rgba(0,150,255,0.25)";
        ctx.lineWidth = 1;
        rrStroke(ctx, x, y, cellSize, cellSize, 6);
      }

      // content
      if (photoImgs[pos]) {
        ctx.save();
        rrPath(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, 5);
        ctx.clip();
        const img = photoImgs[pos];
        const scale = Math.max(cellSize / img.naturalWidth, cellSize / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, x + (cellSize - dw) / 2, y + (cellSize - dh) / 2, dw, dh);
        ctx.fillStyle = "rgba(0,0,40,0.25)";
        ctx.fillRect(x, y, cellSize, cellSize);
        ctx.restore();
        const bs = Math.floor(cellSize * 0.28);
        ctx.fillStyle = "rgba(0,200,100,0.9)";
        ctx.beginPath();
        ctx.arc(x + cellSize - bs / 2 - 3, y + bs / 2 + 3, bs / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `bold ${Math.floor(bs * 0.6)}px system-ui`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText("✓", x + cellSize - bs / 2 - 3, y + bs / 2 + 3 + bs * 0.22);
      } else if (isFree) {
        ctx.font = `${Math.floor(cellSize * 0.3)}px system-ui`;
        ctx.fillStyle = "#fde68a";
        ctx.textAlign = "center";
        ctx.fillText("★", x + cellSize / 2, y + cellSize * 0.54);
        ctx.font = `bold ${Math.floor(cellSize * 0.15)}px 'Inter', sans-serif`;
        ctx.fillText(cellData?.label || "GARUT", x + cellSize / 2, y + cellSize * 0.76);
      } else {
        const label = cellData?.label || "";
        const fs = Math.max(9, Math.floor(cellSize * 0.118));
        ctx.font = `${fs}px 'Inter', system-ui, sans-serif`;
        ctx.fillStyle = isMarked ? "#86efac" : "#bfdbfe";
        ctx.textAlign = "center";
        wrapText(ctx, label, x + cellSize / 2, y + cellSize / 2, cellSize - 10, fs + 3);
      }
    }
  }

  // footer
  const fy = topH + gridH + 22;
  ctx.shadowBlur = 0;
  ctx.textAlign = "center";
  ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = "#4ade80";
  ctx.fillText(title || "", W / 2, fy);
  if (subtitle) {
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#93c5fd";
    ctx.fillText(subtitle, W / 2, fy + 22);
  }
  ctx.font = "10px 'Inter', system-ui, sans-serif";
  ctx.fillStyle = "rgba(100,150,255,0.45)";
  ctx.fillText("FIRST Summit Bingo", W / 2, fy + 46);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export const formatTime = (iso) =>
  iso ? new Date(iso).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "medium" }) : "";
