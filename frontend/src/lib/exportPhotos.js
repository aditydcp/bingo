// Builds the admin photo export ZIP in the browser:
//   <Name (abc123)>/
//     01 - <label>.jpg ...        photos on the current board
//     papan.png                   current board
//     bingo-pertama.png           first-Bingo snapshot (if any)
//     papan-penuh.png             full-board snapshot (if any)
//     board-lama-<round>/         one folder per rerolled board (photos + papan.png)
import JSZip from "jszip";
import { buildBoard } from "./bingo";
import { renderBoardImage, formatTime } from "./boardImage";

const clean = (s) =>
  String(s || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60) || "tanpa-nama";

const extOf = (url) => (url.match(/\.(\w+)(?:\?|$)/)?.[1] || "jpg").toLowerCase();

// Run async jobs with limited concurrency
async function runPool(jobs, limit, onDone) {
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      await job();
      onDone();
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
}

export async function buildPhotoExport(data, onProgress = () => {}) {
  const { users, states, boards, records, history, masterCells } = data;
  const zip = new JSZip();
  const photoJobs = [];
  const imageJobs = [];
  const failed = [];

  const addBoard = (folder, user, board, cells) => {
    board.forEach((cell) => {
      const url = cells?.[cell.id]?.photoUrl;
      if (!url) return;
      const file = `${String(cell.id + 1).padStart(2, "0")} - ${clean(cell.label)}.${extOf(url)}`;
      photoJobs.push(async () => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(res.status);
          folder.file(file, await res.blob());
        } catch {
          failed.push(`${user.name}: ${file}`);
        }
      });
    });
  };
  const addImage = (folder, file, params) =>
    imageJobs.push(async () => folder.file(file, await renderBoardImage(params)));

  Object.values(users).forEach((user) => {
    const folder = zip.folder(clean(`${clean(user.name)} (${user.id.slice(0, 6)})`));
    const who = { name: user.name };

    const board = buildBoard(boards[user.id]?.positions, masterCells);
    const cells = states[user.id]?.cells || {};
    if (board.length) {
      addBoard(folder, user, board, cells);
      addImage(folder, "papan.png", { ...who, board, cells, title: "PAPAN SAAT INI" });
    }

    const rec = records[user.id];
    if (rec?.firstBingoSnapshot) {
      const s = rec.firstBingoSnapshot;
      addImage(folder, "bingo-pertama.png", {
        ...who,
        board: s.board,
        cells: s.cells,
        highlightLines: s.lines,
        title: "BINGO PERTAMA",
        subtitle: formatTime(rec.firstBingoAt),
      });
    }
    if (rec?.fullSnapshot) {
      const s = rec.fullSnapshot;
      addImage(folder, "papan-penuh.png", {
        ...who,
        board: s.board,
        cells: s.cells,
        title: "PAPAN PENUH",
        subtitle: formatTime(rec.fullAt),
      });
    }

    (history[user.id] || []).forEach((h) => {
      const sub = folder.folder(`board-lama-${h.round}`);
      const oldBoard = buildBoard(h.positions, masterCells);
      addBoard(sub, user, oldBoard, h.cells);
      addImage(sub, "papan.png", {
        ...who,
        board: oldBoard,
        cells: h.cells,
        title: `PAPAN #${h.round} (DIACAK ULANG)`,
        subtitle: formatTime(h.archivedAt),
      });
    });
  });

  const total = photoJobs.length + imageJobs.length;
  let done = 0;
  const tick = () => onProgress({ stage: "files", done: ++done, total });
  onProgress({ stage: "files", done: 0, total });
  await runPool(photoJobs, 6, tick);
  await runPool(imageJobs, 2, tick);

  if (failed.length) zip.file("GAGAL-DIUNDUH.txt", failed.join("\n"));

  const blob = await zip.generateAsync({ type: "blob" }, (meta) =>
    onProgress({ stage: "zip", percent: Math.round(meta.percent) }),
  );
  return { blob, failed: failed.length, files: total };
}
