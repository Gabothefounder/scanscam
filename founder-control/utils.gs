function getYesterdayMontrealDate_() {
  const today = parseYmd_(getTodayMontrealDate_());
  today.setUTCDate(today.getUTCDate() - 1);
  return formatYmd_(today);
}

function getTodayMontrealDate_() {
  return Utilities.formatDate(new Date(), "America/Montreal", "yyyy-MM-dd");
}

function setSecrets_(supabaseUrl, supabaseKey) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("SUPABASE_URL", String(supabaseUrl || "").trim());
  props.setProperty("SUPABASE_KEY", String(supabaseKey || "").trim());
}

function assertConfig_() {
  if (!CFG.SUPABASE_URL || !CFG.SUPABASE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_KEY in Script Properties.");
  }
}

function num_(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseYmd_(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
  if (!m) {
    throw new Error(`Invalid ymd: ${ymd}`);
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function formatYmd_(d) {
  return Utilities.formatDate(d, "UTC", "yyyy-MM-dd");
}
