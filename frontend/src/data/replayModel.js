export const normalizeReplayLength = value => Math.max(0, Number(value) || 0);

export const getDefaultReplayIndex = length => {
  const safeLength = normalizeReplayLength(length);
  if (safeLength <= 1) return 0;
  return Math.min(safeLength - 1, Math.max(20, Math.floor(safeLength * 0.35)));
};

export const clampReplayIndex = (index, length) => {
  const safeLength = normalizeReplayLength(length);
  if (safeLength <= 0) return 0;
  const safeIndex = Number.isFinite(Number(index)) ? Number(index) : getDefaultReplayIndex(safeLength);
  return Math.min(safeLength - 1, Math.max(0, Math.floor(safeIndex)));
};

export const getReplaySlice = (rows = [], index) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.slice(0, clampReplayIndex(index, rows.length) + 1);
};
