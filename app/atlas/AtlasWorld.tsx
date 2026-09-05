"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./atlasWorld.module.css";
import { logScanEvent } from "@/lib/telemetry/logScanEvent";

type Current = {
  id: string;
  cluster_key: string;
  scam_family: string;
  channel: string;
  primary_request: string;
  signal_count: number;
  high_risk_count: number;
  recent_30d_count: number;
  first_seen: string;
  last_seen: string;
  light_count: number;
};

type Tactic = {
  tactic: string;
  signal_count: number;
  high_risk_count: number;
  last_seen: string;
};

type AtlasPayload = {
  ok: boolean;
  totals: { signals: number; currents: number; lights: number };
  currents: Current[];
  tactics: Tactic[];
};

const words: Record<string, string> = {
  unclassified: "Unclassified",
  web: "Web",
  email: "Email",
  sms: "SMS",
  social: "Social",
  messaging_app: "Messaging app",
  phone: "Phone",
  other: "Other",
  marketplace: "Marketplace",
  click_link: "Click a link",
  pay_money: "Pay money",
  call_number: "Call a number",
  submit_credentials: "Give credentials",
  reply_sms: "Reply",
  download_app: "Download an app",
  delivery_scam: "Delivery",
  government_impersonation: "Government impersonation",
  account_verification: "Account verification",
  romance_scam: "Romance",
  reward_claim: "Prize / reward",
  employment_scam: "Employment",
  financial_phishing: "Financial phishing",
  investment_fraud: "Investment",
  prize_scam: "Prize",
  law_enforcement: "Law enforcement",
  recovery_scam: "Recovery",
  tech_support: "Tech support",
};

function label(value: string) {
  return words[value] || value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function pathFor(current: Current, index: number) {
  const h = hash(current.cluster_key);
  const y1 = 80 + (h % 510);
  const y2 = 90 + ((h >> 5) % 500);
  const y3 = 100 + ((h >> 11) % 480);
  const wobble = ((h >> 17) % 180) - 90;
  return `M -80 ${y1} C 170 ${y1 + wobble}, 250 ${y2 - 80}, 395 ${y2} S 700 ${y3 + 55}, 870 ${y3} S 1080 ${y3 - wobble / 2}, 1260 ${95 + ((h + index * 41) % 485)}`;
}

function familyTone(family: string) {
  const tones: Record<string, string> = {
    delivery_scam: "#f0b665",
    government_impersonation: "#d67862",
    account_verification: "#e5c786",
    romance_scam: "#cf7991",
    reward_claim: "#dbc56f",
    employment_scam: "#8db6ae",
    financial_phishing: "#a8866d",
    investment_fraud: "#b47a72",
    law_enforcement: "#ca6e5d",
    recovery_scam: "#95758e",
    tech_support: "#739ca4",
    unclassified: "#88685f",
  };
  return tones[family] || "#9a7769";
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  } catch {
    return "—";
  }
}

function currentSentence(current: Current) {
  const family = current.scam_family === "unclassified" ? "an unresolved pattern" : label(current.scam_family).toLowerCase();
  const channel = current.channel === "unclassified" ? "an unclear channel" : label(current.channel);
  const request = current.primary_request === "unclassified" ? "an unclear request" : label(current.primary_request).toLowerCase();
  return `${current.signal_count} traces connect ${family} with ${channel} and ${request}.`;
}

export default function AtlasWorld({ onJourney }: { onJourney: () => void }) {
  const [data, setData] = useState<AtlasPayload | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mineStatus, setMineStatus] = useState<"idle" | "looking" | "missing">("idle");
  const [autoFindAttempted, setAutoFindAttempted] = useState(false);

  useEffect(() => {
    logScanEvent("atlas_viewed", { props: { surface: "atlas", flow: "atlas" } });
    let active = true;
    fetch("/api/atlas/currents", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: AtlasPayload) => {
        if (active && payload.ok) setData(payload);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const currents = useMemo(
    () => (data?.currents || []).filter((item) => item.signal_count > 0).slice(0, 52),
    [data]
  );

  const selected = useMemo(
    () => data?.currents.find((item) => item.cluster_key === selectedKey) || null,
    [data, selectedKey]
  );

  const maxCount = Math.max(...currents.map((item) => Number(item.signal_count || 0)), 1);

  const findMine = async () => {
    logScanEvent("atlas_find_mine_clicked", {
      props: { surface: "atlas", intent: "find_patterns_like_mine" },
    });
    let scanId: string | null = null;
    try {
      const stored = JSON.parse(window.sessionStorage.getItem("scanResult") || "{}") as Record<string, unknown>;
      scanId = [stored.scan_id, stored.id].find((value) => typeof value === "string") as string | undefined || null;
    } catch {}
    if (!scanId) {
      setMineStatus("missing");
      return;
    }
    setMineStatus("looking");
    try {
      const response = await fetch(`/api/atlas/current-for-scan?scan_id=${encodeURIComponent(scanId)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload?.current?.cluster_key) throw new Error("not_found");
      setSelectedKey(payload.current.cluster_key);
      logScanEvent("atlas_current_opened", {
        scan_id: scanId || undefined,
        props: {
          surface: "atlas",
          intent: "find_patterns_like_mine",
          current_family: String(payload.current.scam_family || "unclassified"),
          channel: String(payload.current.channel || "unclassified"),
          primary_request: String(payload.current.primary_request || "unclassified"),
          signal_count: Number(payload.current.signal_count || 0),
        },
      });
      setMineStatus("idle");
    } catch {
      setMineStatus("missing");
    }
  };

  useEffect(() => {
    if (!data || autoFindAttempted) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("find") !== "scan") return;
    setAutoFindAttempted(true);
    void findMine();
  }, [data, autoFindAttempted]);

  return (
    <main className={styles.world}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.brand}>ScanScam</Link>
        <span>Atlas of Deception</span>
        <div className={styles.navActions}>
          <Link href="/scan">Scan something</Link>
          <button onClick={() => {
            logScanEvent("journey_started", { props: { surface: "atlas_nav", entry_mode: "lived" } });
            onJourney();
          }}>Something happened</button>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p>THE ATLAS IS ALIVE</p>
          <h1>Patterns appear<br />when experiences overlap.</h1>
          <span>
            Every faint trace comes from a scan. Repeated behaviors gather into currents.
            A Light appears only when someone deliberately contributes a Journey.
          </span>
          <div className={styles.heroActions}>
            <button onClick={() => document.getElementById("atlas-vessel")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
              Explore the currents
            </button>
            <button className={styles.secondary} onClick={findMine}>Find patterns like mine</button>
            <button className={styles.secondary} onClick={() => {
              logScanEvent("journey_started", { props: { surface: "atlas_hero", entry_mode: "lived", intent: "leave_a_light" } });
              onJourney();
            }}>Leave a light</button>
          </div>
          {mineStatus === "missing" && (
            <p className={styles.mineNote}>
              I can center the Atlas on you after a scan. <Link href="/scan">Scan something first.</Link>
            </p>
          )}
        </div>
        <div className={styles.totals} aria-label="Atlas totals">
          <div><b>{data?.totals.signals?.toLocaleString() || "1,381"}</b><span>traces</span></div>
          <div><b>{data?.totals.currents?.toLocaleString() || "119"}</b><span>currents</span></div>
          <div><b>{data?.totals.lights?.toLocaleString() || "0"}</b><span>lights</span></div>
        </div>
      </section>

      <section id="atlas-vessel" className={styles.vesselSection}>
        <div className={styles.vesselCopy}>
          <p>THE LIVING MAP</p>
          <h2>Follow a current.</h2>
          <span>
            Thickness shows how many traces gather there. Brighter strands carry a larger share of high-risk scans.
          </span>
        </div>

        <div className={styles.vesselStage}>
          <svg className={styles.vessel} viewBox="0 0 1180 680" role="img" aria-label="A flowing Atlas of scam-pattern currents">
            <defs>
              <linearGradient id="cylinderFill" x1="0" x2="1">
                <stop offset="0%" stopColor="#5b1d1b" stopOpacity=".22" />
                <stop offset="50%" stopColor="#c35d43" stopOpacity=".19" />
                <stop offset="100%" stopColor="#5b1d1b" stopOpacity=".22" />
              </linearGradient>
              <radialGradient id="cylinderCore">
                <stop offset="0%" stopColor="#d86d4f" stopOpacity=".2" />
                <stop offset="100%" stopColor="#5b1d1b" stopOpacity="0" />
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <clipPath id="vesselClip"><rect x="300" y="62" width="590" height="554" rx="210" /></clipPath>
            </defs>

            <ellipse cx="595" cy="338" rx="330" ry="286" fill="url(#cylinderCore)" />
            <rect x="300" y="62" width="590" height="554" rx="210" fill="url(#cylinderFill)" stroke="#df8064" strokeOpacity=".24" />
            <ellipse cx="595" cy="74" rx="226" ry="47" fill="none" stroke="#e29377" strokeOpacity=".24" />
            <ellipse cx="595" cy="604" rx="226" ry="47" fill="none" stroke="#8c3b31" strokeOpacity=".3" />
            <path d="M365 90 C 316 190 314 472 367 580" fill="none" stroke="#f2ad8f" strokeOpacity=".1" strokeWidth="2" />
            <path d="M824 92 C 874 194 873 466 822 578" fill="none" stroke="#5b1d1b" strokeOpacity=".26" strokeWidth="3" />

            <g className={styles.currentField}>
              {currents.map((current, index) => {
                const d = pathFor(current, index);
                const width = 1.1 + Math.sqrt(current.signal_count / maxCount) * 9;
                const riskShare = current.signal_count ? current.high_risk_count / current.signal_count : 0;
                const active = selectedKey === current.cluster_key;
                return (
                  <g key={current.cluster_key}>
                    <path
                      id={`atlas-current-${index}`}
                      d={d}
                      className={active ? styles.currentActive : styles.current}
                      stroke={familyTone(current.scam_family)}
                      strokeOpacity={active ? .98 : .18 + Math.min(.5, riskShare * .7)}
                      strokeWidth={active ? width + 4 : width}
                      onClick={() => {
                        setSelectedKey(current.cluster_key);
                        logScanEvent("atlas_current_opened", {
                          props: {
                            surface: "atlas",
                            intent: "explore_current",
                            current_family: current.scam_family,
                            channel: current.channel,
                            primary_request: current.primary_request,
                            signal_count: Number(current.signal_count || 0),
                          },
                        });
                      }}
                    />
                    {index < 16 && (
                      <circle r={active ? 5.5 : 2.8} fill={familyTone(current.scam_family)} opacity={active ? 1 : .68} filter="url(#glow)">
                        <animateMotion dur={`${8 + (index % 6)}s`} begin={`-${index * .7}s`} repeatCount="indefinite" path={d} />
                      </circle>
                    )}
                  </g>
                );
              })}
            </g>

            <g clipPath="url(#vesselClip)" opacity=".55">
              {Array.from({ length: 34 }).map((_, index) => {
                const x = 342 + ((index * 83) % 506);
                const y = 105 + ((index * 137) % 452);
                const r = 1.4 + (index % 4) * .55;
                return <circle key={index} cx={x} cy={y} r={r} fill="#f2bd89" className={styles.memoryDust} style={{ animationDelay: `-${index * .31}s` }} />;
              })}
            </g>
          </svg>

          <div className={styles.legend}>
            <span><i className={styles.traceDot} /> Trace</span>
            <span><i className={styles.currentLine} /> Current</span>
            <span><i className={styles.lightDot} /> Light</span>
          </div>

          {selected ? (
            <aside className={styles.currentPanel}>
              <button className={styles.panelClose} onClick={() => setSelectedKey(null)} aria-label="Close current">×</button>
              <p>CURRENT</p>
              <h3>{selected.scam_family === "unclassified" ? label(selected.channel) : label(selected.scam_family)}</h3>
              <span className={styles.currentSentence}>{currentSentence(selected)}</span>
              <div className={styles.currentStats}>
                <div><b>{Number(selected.signal_count).toLocaleString()}</b><span>traces</span></div>
                <div><b>{Number(selected.high_risk_count).toLocaleString()}</b><span>high-risk</span></div>
                <div><b>{Number(selected.light_count).toLocaleString()}</b><span>lights</span></div>
              </div>
              <dl>
                <div><dt>Channel</dt><dd>{label(selected.channel)}</dd></div>
                <div><dt>Request</dt><dd>{label(selected.primary_request)}</dd></div>
                <div><dt>Last seen</dt><dd>{formatDate(selected.last_seen)}</dd></div>
              </dl>
              <div className={styles.panelActions}>
                <button onClick={() => {
                  logScanEvent("journey_started", {
                    props: {
                      surface: "atlas_current",
                      entry_mode: "lived",
                      current_family: selected.scam_family,
                      channel: selected.channel,
                      primary_request: selected.primary_request,
                    },
                  });
                  onJourney();
                }}>Something like this happened</button>
                <button className={styles.ghost} onClick={() => setSelectedKey(null)}>Return to the whole</button>
              </div>
            </aside>
          ) : (
            <div className={styles.vesselPrompt}>
              <span>Click a strand</span>
              <b>Enter a current</b>
            </div>
          )}
        </div>
      </section>

      <section className={styles.forces}>
        <div>
          <p>FORCES RUNNING THROUGH THE ATLAS</p>
          <h2>The story changes. The mechanisms repeat.</h2>
        </div>
        <div className={styles.forceGrid}>
          {(data?.tactics || []).slice(0, 8).map((tactic) => (
            <article key={tactic.tactic}>
              <b>{label(tactic.tactic)}</b>
              <span>{Number(tactic.signal_count).toLocaleString()} traces</span>
              <i style={{ transform: `scaleX(${Math.max(.08, Math.min(1, tactic.signal_count / Math.max(data?.tactics?.[0]?.signal_count || 1, 1)))})` }} />
            </article>
          ))}
        </div>
      </section>

      <section className={styles.network}>
        <p>HELP BUILD THE DEFENSE</p>
        <h2>This gets stronger when different kinds of people connect.</h2>
        <span>
          Fraud professionals, researchers, psychologists, educators, builders, institutions,
          and people with lived experience are welcome.
        </span>
        <a
          href="mailto:hello@scanscam.ca?subject=I%20want%20to%20help%20build%20ScanScam"
          onClick={() => logScanEvent("network_contact_clicked", {
            props: { surface: "atlas", intent: "join_network", target: "hello@scanscam.ca" },
          })}
        >
          hello@scanscam.ca <b>→</b>
        </a>
      </section>

      <section className={styles.closure}>
        <p>ONE EXPERIENCE CAN STAY PRIVATE AND STILL BECOME USEFUL.</p>
        <h2>Your words can remain yours.<br />The pattern can become a light.</h2>
        <div>
          <button onClick={() => {
            logScanEvent("journey_started", { props: { surface: "atlas_closure", entry_mode: "lived" } });
            onJourney();
          }}>Something happened to me</button>
          <Link href="/scan">Scan something suspicious</Link>
        </div>
      </section>
    </main>
  );
}
