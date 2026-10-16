import { m, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useState, type FocusEvent, type MouseEvent } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

const SUBJECTS = [
  {
    name: "Maths",
    kind: "maths",
    primary: "a² + b² = c²",
    lines: ["x² − 5x + 6 = (x − 2)(x − 3)", "A = πr²"],
  },
  {
    name: "Science",
    kind: "science",
    primary: "H₂O",
    lines: ["6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂", "F = ma"],
  },
  {
    name: "English",
    kind: "english",
    sentence: ["The", "quick brown", "fox", "jumps", "over the lazy dog."],
    tags: ["Adjective", "Noun", "Verb"],
    lines: ["Simile: as brave as a lion", "Synonym: happy → joyful"],
  },
  {
    name: "Social Science",
    kind: "social",
    chips: ["Latitude", "Longitude", "Democracy"],
  },
] as const;

const FLOATING_CHIPS = [
  { label: "√81 = 9", subject: 0, depth: 0.35 },
  { label: "π r²", subject: 0, depth: 0.7 },
  { label: "v = d / t", subject: 1, depth: 0.5 },
  { label: "H₂O", subject: 1, depth: 0.9 },
  { label: "NaCl", subject: 1, depth: 0.3 },
  { label: "Noun", subject: 2, depth: 0.8 },
  { label: "Simile", subject: 2, depth: 0.45 },
  { label: "Equator", subject: 3, depth: 1 },
] as const;

const DRAW = { hidden: { pathLength: 0, opacity: 0 }, shown: { pathLength: 1, opacity: 1 } };

export function HeroSubjectDeck() {
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(false);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateX = useSpring(useTransform(pointerY, [-1, 1], [10, -10]), { stiffness: 120, damping: 20 });
  const rotateY = useSpring(useTransform(pointerX, [-1, 1], [-10, 10]), { stiffness: 120, damping: 20 });

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const sync = () => setCoarsePointer(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reducedMotion || paused) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % SUBJECTS.length), 2000);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  const move = (event: MouseEvent<HTMLDivElement>) => {
    if (coarsePointer || reducedMotion) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 2);
    pointerY.set(((event.clientY - bounds.top) / bounds.height - 0.5) * 2);
  };

  const resetTilt = () => {
    pointerX.set(0);
    pointerY.set(0);
    setPaused(false);
  };

  const blur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
  };

  return (
    <div
      className="hero-subject-visual"
      onMouseMove={move}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={resetTilt}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={blur}
    >
      <m.div
        className="hero-subject-deck"
        style={reducedMotion || coarsePointer ? { rotateX: 0, rotateY: 0 } : { rotateX, rotateY }}
        animate={!reducedMotion && coarsePointer ? { y: [0, -6, 0, 6, 0] } : { y: 0 }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        {SUBJECTS.map((subject, index) => {
          const depth = (index - active + SUBJECTS.length) % SUBJECTS.length;
          const isActive = depth === 0;
          return (
            <m.article
              className={`hero-subject-card ${isActive ? "is-active" : ""}`}
              key={subject.name}
              aria-hidden={!isActive}
              animate={{
                y: 66 - depth * 22,
                z: -depth * 58,
                scale: 1 - depth * 0.025,
                rotateX: depth === 3 ? -7 : 0,
                opacity: isActive ? 1 : 1 - depth * 0.13,
              }}
              transition={{ duration: reducedMotion ? 0.4 : 0.8, ease: EASE }}
              style={{ zIndex: SUBJECTS.length - depth }}
            >
              <header>
                <strong>{subject.name}</strong>
                <span>{String(index + 1).padStart(2, "0")}/04</span>
                <SubjectIcon kind={subject.kind} />
              </header>
              {isActive && <SubjectLesson key={`${subject.kind}-${active}`} subject={subject} reduced={Boolean(reducedMotion)} />}
            </m.article>
          );
        })}
      </m.div>

      <div className="hero-subject-chips" aria-hidden="true">
        {FLOATING_CHIPS.map((chip, index) => (
          <DepthChip key={chip.label} chip={chip} index={index} active={active} x={pointerX} y={pointerY} reduced={Boolean(reducedMotion)} />
        ))}
      </div>

      <div className="hero-subject-tabs" role="tablist" aria-label="Choose a subject">
        {SUBJECTS.map((subject, index) => (
          <button
            key={subject.name}
            type="button"
            role="tab"
            aria-label={`Show ${subject.name} lesson`}
            aria-selected={active === index}
            onClick={() => setActive(index)}
          >
            <span>{subject.name}</span>
            <i key={active === index ? `${subject.name}-${active}` : subject.name} className={active === index ? `is-running ${paused ? "is-paused" : ""}` : ""} />
          </button>
        ))}
      </div>
    </div>
  );
}

type Subject = (typeof SUBJECTS)[number];

function SubjectLesson({ subject, reduced }: { subject: Subject; reduced: boolean }) {
  if (subject.kind === "maths") return <MathsLesson subject={subject} reduced={reduced} />;
  if (subject.kind === "science") return <ScienceLesson subject={subject} reduced={reduced} />;
  if (subject.kind === "english") return <EnglishLesson subject={subject} reduced={reduced} />;
  return <SocialLesson subject={subject} reduced={reduced} />;
}

function MathsLesson({ subject, reduced }: { subject: (typeof SUBJECTS)[0]; reduced: boolean }) {
  return (
    <div className="lesson lesson-maths">
      <svg viewBox="0 0 180 130" aria-label="Right triangle with sides a, b and c">
        <m.path d="M28 105V24l122 81H28Z" variants={DRAW} initial={reduced ? "shown" : "hidden"} animate="shown" transition={{ duration: 0.8, ease: EASE }} />
        <m.path d="M28 87h18v18" variants={DRAW} initial={reduced ? "shown" : "hidden"} animate="shown" transition={{ delay: reduced ? 0 : 0.08, duration: 0.8, ease: EASE }} />
        <text x="12" y="68">a</text><text x="83" y="121">b</text><text x="95" y="55">c</text>
      </svg>
      <div>
        <TypeLine text={subject.primary} reduced={reduced} />
        <p>{subject.lines[0]}</p>
        <div className="circle-formula"><p>{subject.lines[1]}</p><svg viewBox="0 0 42 42"><m.circle cx="21" cy="21" r="15" variants={DRAW} initial={reduced ? "shown" : "hidden"} animate="shown" transition={{ delay: reduced ? 0 : 0.24, duration: 0.8, ease: EASE }} /><path d="M21 21h15" /></svg></div>
      </div>
    </div>
  );
}

function ScienceLesson({ subject, reduced }: { subject: (typeof SUBJECTS)[1]; reduced: boolean }) {
  return (
    <div className="lesson lesson-science">
      <svg viewBox="0 0 150 160" aria-label="Beaker with rising liquid">
        <m.path d="M52 18h46M61 18v48l-34 62c-5 9 2 17 12 17h72c10 0 17-8 12-17L89 66V18" variants={DRAW} initial={reduced ? "shown" : "hidden"} animate="shown" transition={{ duration: 0.8, ease: EASE }} />
        <m.path className="beaker-liquid" d="M38 119h74l10 18c2 4-2 8-8 8H36c-6 0-10-4-8-8Z" initial={reduced ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: reduced ? 0 : 0.16, duration: 0.8, ease: EASE }} />
        {[48, 66, 84, 101].map((cx, index) => <m.circle key={cx} className="bubble" cx={cx} cy={112 - index * 8} r={3 + index % 2} animate={reduced ? false : { y: [10, -18], opacity: [0, 1, 0] }} transition={{ delay: index * 0.08, duration: 2 + index * 0.2, repeat: Infinity, ease: "easeOut" }} />)}
      </svg>
      <div><TypeLine text={subject.primary} reduced={reduced} /><p>{subject.lines[0]}</p><p>{subject.lines[1]}</p></div>
    </div>
  );
}

function EnglishLesson({ subject, reduced }: { subject: (typeof SUBJECTS)[2]; reduced: boolean }) {
  return (
    <div className="lesson lesson-english">
      <p className="grammar-sentence">
        <span>{subject.sentence[0]}</span>{" "}
        {subject.sentence.slice(1, 4).map((part, index) => <m.span className="grammar-word" key={part} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08, duration: 0.4 }}><i>{subject.tags[index]}</i>{part}</m.span>)}{" "}
        <span>{subject.sentence[4]}</span>
      </p>
      <div className="english-lines"><p>{subject.lines[0]}</p><p>{subject.lines[1]}</p></div>
    </div>
  );
}

function SocialLesson({ subject, reduced }: { subject: (typeof SUBJECTS)[3]; reduced: boolean }) {
  return (
    <div className="lesson lesson-social">
      <svg viewBox="0 0 180 170" aria-label="Globe with latitude and longitude lines">
        <circle cx="90" cy="84" r="58" />
        <m.ellipse cx="90" cy="84" rx="27" ry="58" animate={reduced ? false : { scaleX: [1, 0.35, 1] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />
        <ellipse cx="90" cy="84" rx="58" ry="23" /><path d="M32 84h116" />
        <m.g initial={reduced ? false : { y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: reduced ? 0 : 0.16, duration: 0.8, type: "spring", bounce: 0.45 }}><path d="M122 43c-10 0-18 8-18 18 0 15 18 31 18 31s18-16 18-31c0-10-8-18-18-18Z" /><circle cx="122" cy="61" r="5" /></m.g>
      </svg>
      <div className="social-labels">{subject.chips.map((chip, index) => <m.span key={chip} initial={reduced ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.08, duration: 0.4 }}>{chip}</m.span>)}</div>
    </div>
  );
}

function TypeLine({ text, reduced }: { text: string; reduced: boolean }) {
  return <p className="type-line" aria-label={text}>{text.split("").map((character, index) => <m.span key={`${character}-${index}`} aria-hidden="true" initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.035 + 0.12, duration: 0.12 }}>{character}</m.span>)}</p>;
}

function SubjectIcon({ kind }: { kind: Subject["kind"] }) {
  const paths = {
    maths: "M7 29 18 9l13 20H7Zm3-4h5v-8",
    science: "M12 6h14m-11 0v10L8 30h22l-7-14V6",
    english: "M7 10h25M7 19h18M7 28h22",
    social: "M20 5a15 15 0 1 0 0 30 15 15 0 0 0 0-30Zm0 0c7 8 7 22 0 30m0-30c-7 8-7 22 0 30M5 20h30",
  } as const;
  return <svg className="subject-mini-icon" viewBox="0 0 40 40" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

type Chip = (typeof FLOATING_CHIPS)[number];
function DepthChip({ chip, index, active, x, y, reduced }: { chip: Chip; index: number; active: number; x: ReturnType<typeof useMotionValue<number>>; y: ReturnType<typeof useMotionValue<number>>; reduced: boolean }) {
  const offsetX = useTransform(x, (value) => value * chip.depth * 18);
  const offsetY = useTransform(y, (value) => value * chip.depth * 14);
  return <m.span className={`depth-chip chip-${index + 1} ${active === chip.subject ? "is-active" : ""}`} style={reduced ? { x: 0, y: 0, translateZ: chip.depth * 70 } : { x: offsetX, y: offsetY, translateZ: chip.depth * 70 }}><m.i animate={reduced ? false : { x: [0, index % 2 ? -8 : 8, 0], y: [0, index % 2 ? 10 : -6, 0] }} transition={{ duration: 5.5 + index * 0.65, repeat: Infinity, ease: "easeInOut" }}>{chip.label}</m.i></m.span>;
}