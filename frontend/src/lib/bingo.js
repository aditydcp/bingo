// Shared by pages and API routes.

export const FREE_POS = 12; // center of the 5×5 grid — always FREE
export const LETTERS = ["F", "I", "R", "S", "T"];
export const ENTITIES = ["PT IDSurvey", "PT SUCOFINDO", "PT SI", "PT BKI"];

export function checkBingo(markedSet) {
  const has = (id) => markedSet.has(id);
  const lines = [];
  for (let r = 0; r < 5; r++) {
    const row = [0, 1, 2, 3, 4].map((c) => r * 5 + c);
    if (row.every(has)) lines.push(row);
  }
  for (let c = 0; c < 5; c++) {
    const col = [0, 1, 2, 3, 4].map((r) => r * 5 + c);
    if (col.every(has)) lines.push(col);
  }
  if ([0, 6, 12, 18, 24].every(has)) lines.push([0, 6, 12, 18, 24]);
  if ([4, 8, 12, 16, 20].every(has)) lines.push([4, 8, 12, 16, 20]);
  return lines;
}

// Set of marked board positions; FREE always counts as marked
export function markedSetFrom(cells) {
  const set = new Set(
    Object.entries(cells || {})
      .filter(([, v]) => v?.marked)
      .map(([k]) => Number(k)),
  );
  set.add(FREE_POS);
  return set;
}

// Ordered board array from a positions array + master cells
export function buildBoard(positions, masterCells) {
  const cellById = {};
  (masterCells || []).forEach((c) => {
    cellById[c.id] = c;
  });
  return (positions || []).map((cellId, pos) => ({
    id: pos,
    cellId,
    label: cellById[cellId]?.label || "",
  }));
}

// Cloudinary delivery URL with an on-the-fly transformation
export function photoVariant(url, transform) {
  if (!url) return url;
  return url.replace("/image/upload/", `/image/upload/${transform}/`);
}
export const thumb = (url, size = 300) =>
  photoVariant(url, `c_fill,w_${size},h_${size},q_auto,f_auto`);
export const fullPhoto = (url) =>
  photoVariant(url, "c_limit,w_1200,h_1200,q_auto,f_auto");
