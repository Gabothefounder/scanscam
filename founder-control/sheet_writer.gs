function writeTab_(tabName, rows) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
  // Strong reset so legacy spreadsheet formatting does not leak into new data.
  sh.clear();
  sh.setFrozenRows(0);

  if (!rows || rows.length === 0) {
    sh.getRange(1, 1).setValue("No rows returned");
    return;
  }

  const headers = Object.keys(rows[0]);
  const values = rows.map((r) => headers.map((h) => r[h]));

  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.getRange(2, 1, values.length, headers.length).setValues(values);
  sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sh.setFrozenRows(1);
  applyColumnFormats_(sh, headers, values.length);
  sh.autoResizeColumns(1, headers.length);
}
function ensureTabWithHeaders_(ss, tabName, headers) {
  const sh = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
  if (!headers || headers.length === 0) return;
  const lastCol = sh.getLastColumn();
  const lastRow = sh.getLastRow();
  if (lastRow === 0 || lastCol === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
  }
}

function applyColumnFormats_(sheet, headers, rowCount) {
  if (!headers || headers.length === 0 || rowCount <= 0) return;

  const startRow = 2;
  const totalCols = headers.length;
  const dataRange = sheet.getRange(startRow, 1, rowCount, totalCols);

  // Baseline to plain number format across full data block to prevent
  // old currency/percent formats from persisting.
  dataRange.setNumberFormat("0");

  headers.forEach((header, idx) => {
    const h = String(header || "").toLowerCase();
    const col = idx + 1;
    const colRange = sheet.getRange(startRow, col, rowCount, 1);

    const isRateCol =
      h.includes("rate") || h.includes("pct") || h.includes("ctr");
    const isDateCol = h === "day_montreal" || h === "date";

    if (isRateCol) {
      colRange.setNumberFormat("0.00%");
    } else if (isDateCol) {
      colRange.setNumberFormat("yyyy-mm-dd");
    }
  });
}
