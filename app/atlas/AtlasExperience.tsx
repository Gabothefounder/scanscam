"use client";

import { useMemo, useState } from "react";
import styles from "./atlas.module.css";

type TerritoryId = "fear" | "hope" | "authority" | "belonging" | "shame" | "anger";
type LayerId = "triggers" | "emotions" | "tactics" | "demands" | "antidotes";

type Territory = {
  id: TerritoryId;
  name: string;
  short: string;
  description: string;
  places: string[];
  antidote: string;
  recognition: string;
  path: string;
  label: [number, number];
};

const territories: Territory[] = [
  {
    id: "fear",
    name: "Fear",
    short: "Danger, punishment, loss",
    description: "Fear narrows attention. Deception uses urgency to make the threatened consequence feel closer than the evidence.",
    places: ["Cliffs of Urgency", "Valley of Threats", "The Alarm Gate"],
    antidote: "Slow the clock. Verify the threat through a channel you find yourself.",
    recognition: "My attention is narrowing because I feel in immediate danger.",
    path: "M72 92 C115 45 214 45 258 92 C286 123 264 172 212 181 C157 191 86 170 65 132 C55 115 58 104 72 92Z",
    label: [160, 116],
  },
  {
    id: "hope",
    name: "Hope",
    short: "Reward, rescue, transformation",
    description: "Hope becomes a lever when a promised future is used to suspend ordinary skepticism.",
    places: ["The Golden Promise", "Miracle Market", "Harbour of Returns"],
    antidote: "Test the promise against independent evidence, base rates, and the cost of being wrong.",
    recognition: "The promised future is making ordinary skepticism feel inconvenient.",
    path: "M284 67 C336 37 418 47 444 98 C463 136 429 174 377 180 C326 186 276 160 265 124 C257 98 265 79 284 67Z",
    label: [355, 112],
  },
  {
    id: "authority",
    name: "Authority",
    short: "Status, institutions, credentials",
    description: "Borrowed symbols, titles, and procedures can make a request feel legitimate before its source is verified.",
    places: ["Palace of Credentials", "The False Tribunal", "Official Seal"],
    antidote: "Separate the claim from the costume. Contact the institution independently.",
    recognition: "Symbols and titles are being used as substitutes for verification.",
    path: "M476 81 C523 47 613 54 644 96 C668 128 649 175 596 188 C537 202 472 178 456 137 C447 113 457 95 476 81Z",
    label: [555, 122],
  },
  {
    id: "belonging",
    name: "Belonging",
    short: "Love, loyalty, recognition",
    description: "Connection can be counterfeited. Intimacy and group identity are used to make verification feel like betrayal.",
    places: ["Island of Intimacy", "The Borrowed Face", "Circle of Trust"],
    antidote: "Bring a trusted third person in. Real relationships can survive verification.",
    recognition: "I am being made to feel that checking would betray the relationship.",
    path: "M101 229 C151 197 229 210 257 254 C280 291 251 340 196 348 C139 356 76 326 69 279 C65 256 78 239 101 229Z",
    label: [165, 278],
  },
  {
    id: "shame",
    name: "Shame",
    short: "Secrecy, exposure, isolation",
    description: "Shame keeps people alone. The demand for secrecy protects the deception from outside reality.",
    places: ["Province of Silence", "Blackmail Passage", "The Hidden Room"],
    antidote: "Tell one safe person. Shame weakens when the story leaves the closed room.",
    recognition: "Secrecy is isolating me from the people who could restore perspective.",
    path: "M302 223 C351 195 422 207 451 249 C478 287 450 337 398 348 C345 359 286 333 277 289 C272 262 281 237 302 223Z",
    label: [365, 280],
  },
  {
    id: "anger",
    name: "Anger",
    short: "Injustice, outrage, revenge",
    description: "Anger accelerates action and rewards certainty. Manipulators offer a target before the facts can settle.",
    places: ["Outrage Furnace", "Revenge Road", "The Enemy Shore"],
    antidote: "Delay irreversible action. Look for the missing perspective and who benefits from haste.",
    recognition: "Outrage is pushing me toward certainty and immediate action.",
    path: "M489 225 C542 198 619 212 646 258 C667 295 640 338 588 347 C530 357 470 326 461 281 C456 255 470 235 489 225Z",
    label: [558, 281],
  },
];

const layerLabels: Record<LayerId, string> = {
  triggers: "Triggers",
  emotions: "Emotions",
  tactics: "Tactics",
  demands: "Demands",
  antidotes: "Antidotes",
};

const journey = ["Pressure", "Recognize", "Take back agency", "Report"];

export default function AtlasExperience() {
  const [selected, setSelected] = useState<TerritoryId>("fear");
  const [layers, setLayers] = useState<Record<LayerId, boolean>>({
    triggers: true,
    emotions: true,
    tactics: true,
    demands: true,
    antidotes: true,
  });

  const territory = useMemo(
    () => territories.find((item) => item.id === selected) ?? territories[0],
    [selected]
  );

  const toggleLayer = (layer: LayerId) => {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  };

  return (
    <main className={styles.page}>
      <header className={styles.atlasHeader}>
        <div>
          <p className={styles.eyebrow}>A living map of human influence</p>
          <h1>Atlas of Deception</h1>
        </div>
        <nav aria-label="Atlas navigation">
          <a className={styles.activeLink} href="#map">Explore</a>
          <a href="/scan">Scan a message</a>
        </nav>
      </header>

      <section className={styles.workspace} id="map">
        <aside className={styles.introPanel}>
          <p className={styles.panelKicker}>Begin here</p>
          <h2>How are they trying to move you?</h2>
          <p>Locate the state. See the method. Recover your judgment. Help stop the pattern.</p>
          <a className={styles.primaryAction} href="/scan">
            Start with a message <span aria-hidden="true">→</span>
          </a>
          <p className={styles.privacy}>Patterns, never identities.</p>
        </aside>

        <div className={styles.mapShell} aria-label="Interactive map of emotional pressure territories">
          <svg className={styles.map} viewBox="0 0 720 410" role="img" aria-labelledby="map-title map-desc">
            <title id="map-title">The emotional territories of deception</title>
            <desc id="map-desc">Six interactive territories: Fear, Hope, Authority, Belonging, Shame, and Anger, surrounded by the Sea of Calm.</desc>
            <defs>
              <filter id="paper" x="-10%" y="-10%" width="120%" height="120%">
                <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="9" result="noise" />
                <feColorMatrix in="noise" type="saturate" values="0" result="mono" />
                <feBlend in="SourceGraphic" in2="mono" mode="soft-light" />
              </filter>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            <g className={styles.contours} aria-hidden="true">
              <path d="M34 202 C130 167 223 203 302 185 S477 151 682 201" />
              <path d="M25 217 C131 183 226 221 306 201 S493 168 692 217" />
              <path d="M36 368 C158 382 262 365 362 379 S558 387 686 362" />
            </g>

            {territories.map((item) => (
              <g
                key={item.id}
                className={`${styles.territory} ${styles[item.id]} ${selected === item.id ? styles.selected : styles.receded}`}
                role="button"
                tabIndex={0}
                aria-label={`${item.name}: ${item.short}`}
                aria-pressed={selected === item.id}
                onClick={() => setSelected(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(item.id);
                  }
                }}
              >
                <path d={item.path} filter="url(#paper)" />
                {layers.emotions ? (
                  <text x={item.label[0]} y={item.label[1]} textAnchor="middle">{item.name}</text>
                ) : null}
              </g>
            ))}

            <text className={styles.seaLabel} x="358" y="205" textAnchor="middle">Field of Clear Judgment</text>

            {layers.tactics || layers.demands || layers.antidotes ? (
              <g className={styles.journey} aria-label="Example manipulation journey">
                <path d="M118 151 C225 174 267 198 346 211 S487 230 617 211" />
                {journey.map((step, index) => {
                  const points = [[118,151],[260,191],[430,224],[617,211]];
                  const [x,y] = points[index];
                  return (
                    <g key={step} transform={`translate(${x} ${y})`}>
                      <circle r="7" />
                      <text x="0" y={index % 2 === 0 ? -14 : 24} textAnchor="middle">{step}</text>
                    </g>
                  );
                })}
              </g>
            ) : null}
          </svg>
          <p className={styles.mapInstruction}>Choose a territory to explore its landscape.</p>
        </div>

        <aside className={styles.layerPanel} aria-label="Map layers">
          <p className={styles.panelKicker}>Map layers</p>
          {(Object.keys(layerLabels) as LayerId[]).map((layer) => (
            <button key={layer} type="button" onClick={() => toggleLayer(layer)} aria-pressed={layers[layer]}>
              <span>{layerLabels[layer]}</span>
              <span className={layers[layer] ? styles.layerOn : styles.layerOff} aria-hidden="true" />
            </button>
          ))}
        </aside>
      </section>

      <section className={styles.detail} aria-live="polite">
        <div className={`${styles.detailMarker} ${styles[selected]}`} aria-hidden="true" />
        <div className={styles.detailLead}>
          <p className={styles.panelKicker}>Emotional state</p>
          <h2>State of {territory.name}</h2>
          <p className={styles.short}>{territory.short}</p>
        </div>
        <div className={styles.description}>
          <p>{territory.description}</p>
          <blockquote>“{territory.recognition}”</blockquote>
        </div>
        <div>
          <p className={styles.panelKicker}>Landmarks</p>
          <ul>{territory.places.map((place) => <li key={place}>{place}</li>)}</ul>
        </div>
        <div className={styles.antidote}>
          <p className={styles.panelKicker}>Transformation</p>
          <p>{territory.antidote}</p>
          <div className={styles.helpActions}>
            <a href="/scan">Examine the message</a>
            <a href="https://antifraudcentre-centreantifraude.ca/report-signalez-eng.htm" target="_blank" rel="noreferrer">Report in Canada ↗</a>
          </div>
        </div>
      </section>
    </main>
  );
}
