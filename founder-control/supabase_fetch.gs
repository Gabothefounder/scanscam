function fetchViewRows_(viewName, orderBy) {
  const order = orderBy || "day_montreal.desc";
  const url =
    `${CFG.SUPABASE_URL}/rest/v1/${encodeURIComponent(viewName)}` +
    `?select=*&order=${encodeURIComponent(order)}`;

  const resp = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true,
    headers: {
      apikey: CFG.SUPABASE_KEY,
      Authorization: `Bearer ${CFG.SUPABASE_KEY}`,
    },
  });

  const code = resp.getResponseCode();
  const text = resp.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error(`Supabase fetch failed for ${viewName}. HTTP ${code}.`);
  }

  const payload = JSON.parse(text);
  return Array.isArray(payload) ? payload : [];
}
