/* =========================================================================
   ECG-SVG.JS
   Procedurally draws each ECG rhythm as an SVG path, so the game never
   depends on external/copyrighted medical images. Every waveform is drawn
   large, on a classic monitor grid, so the trace is easy to read clearly.
   ========================================================================= */

/* ---- small deterministic PRNG so a given rhythm always looks the same ---- */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

function gauss(t, c, w, a) {
  return a * Math.exp(-((t - c) * (t - c)) / (2 * w * w));
}
function triangle(t, c, w, a) {
  const d = Math.abs(t - c);
  if (d > w) return 0;
  return a * (1 - d / w);
}

/* One "textbook normal" beat shape, reused/modified by several rhythms */
function normalBeat(t, opts) {
  opts = opts || {};
  const pC = opts.pC ?? 0.15, pW = opts.pW ?? 0.035, pA = opts.pA ?? 8;
  const tC = opts.tC ?? 0.58, tW = opts.tW ?? 0.07, tA = opts.tA ?? 15;
  const stLift = opts.stLift ?? 0;
  let y = 0;
  y += gauss(t, pC, pW, pA);
  y += triangle(t, 0.32, 0.02, -8);   // Q
  y += triangle(t, 0.345, 0.02, 42);  // R
  y += triangle(t, 0.37, 0.02, -16);  // S
  // ST segment lift (used for STEMI) - trapezoid plateau between QRS and T
  if (stLift) {
    const stStart = 0.39, stEnd = tC - tW * 0.6;
    if (t >= stStart && t <= stEnd) y += stLift;
    else if (t > stEnd && t < tC) y += stLift * Math.max(0, 1 - (t - stEnd) / (tC - stEnd));
  }
  y += gauss(t, tC, tW, tA);
  return y;
}

/* Builds an array of [x,y] SVG points for the requested rhythm type. */
function generateWaveformPoints(typeId, width, height, cycles) {
  const baseline = height * 0.55;
  const pts = [];
  const rand = mulberry32(seedFromString(typeId));
  const step = 2; // px between samples -> smooth curve, still cheap

  const push = (x, offsetUp) => pts.push([x, baseline - offsetUp]);

  switch (typeId) {
    case "NSR":
    case "STACH":
    case "SBRAD": {
      const cycleLen = typeId === "STACH" ? width / 7.2 : typeId === "SBRAD" ? width / 3.1 : width / 4.8;
      for (let x = 0; x <= width; x += step) {
        const t = (x % cycleLen) / cycleLen;
        push(x, normalBeat(t));
      }
      break;
    }
    case "AVB1": {
      const cycleLen = width / 4.6;
      for (let x = 0; x <= width; x += step) {
        const t = (x % cycleLen) / cycleLen;
        push(x, normalBeat(t, { pC: 0.05, pW: 0.03 })); // P pulled earlier -> long PR
      }
      break;
    }
    case "STEMI": {
      const cycleLen = width / 4.8;
      for (let x = 0; x <= width; x += step) {
        const t = (x % cycleLen) / cycleLen;
        push(x, normalBeat(t, { stLift: 14 }));
      }
      break;
    }
    case "PVC": {
      const cycleLen = width / 4.8;
      let beatIndex = 0;
      let x = 0;
      while (x <= width) {
        const isPVC = beatIndex % 4 === 3;
        const thisLen = isPVC ? cycleLen * 0.85 : cycleLen;
        const segStart = x;
        for (let lx = 0; lx <= thisLen; lx += step) {
          const t = lx / thisLen;
          let y;
          if (isPVC) {
            // no P wave, single wide bizarre QRS, exaggerated T
            y = triangle(t, 0.3, 0.09, 55) + gauss(t, 0.62, 0.09, -18);
          } else {
            y = normalBeat(t);
          }
          push(segStart + lx, y);
        }
        x += thisLen;
        // compensatory pause after a PVC
        if (isPVC) x += cycleLen * 0.55;
        beatIndex++;
      }
      break;
    }
    case "AFIB": {
      let x = 0;
      while (x <= width) {
        const cycleLen = width / 4.6 + (rand() - 0.5) * (width / 8); // irregularly irregular
        for (let lx = 0; lx <= cycleLen && x + lx <= width; lx += step) {
          const t = lx / cycleLen;
          // fibrillatory wobble instead of a clean P wave
          const wobble =
            3.5 * Math.sin((x + lx) * 0.18) +
            2 * Math.sin((x + lx) * 0.35 + 1.3) +
            1.5 * (rand() - 0.5);
          const y = triangle(t, 0.32, 0.02, -8) + triangle(t, 0.345, 0.02, 38) +
                    triangle(t, 0.37, 0.02, -16) + gauss(t, 0.6, 0.07, 12) + wobble;
          push(x + lx, y);
        }
        x += cycleLen;
      }
      break;
    }
    case "AFLUT": {
      const flutterLen = width / 26; // fast saw-tooth flutter waves
      let flutterCount = 0;
      for (let x = 0; x <= width; x += step) {
        const t = (x % flutterLen) / flutterLen;
        let y = 8 * (t < 0.5 ? t * 2 : (1 - t) * 2) - 3; // saw-tooth
        pts.push([x, baseline - y]);
      }
      // overlay a QRS every 3rd flutter wave (3:1 conduction)
      for (let x = flutterLen * 1.5; x <= width; x += flutterLen * 3) {
        for (let lx = -flutterLen * 0.4; lx <= flutterLen * 0.4; lx += step) {
          const idx = Math.round((x + lx) / step);
          if (idx >= 0 && idx < pts.length) {
            const localT = (lx + flutterLen * 0.4) / (flutterLen * 0.8);
            pts[idx][1] -= triangle(localT, 0.5, 0.45, 42) + triangle(localT, 0.5, 0.15, -12);
          }
        }
      }
      break;
    }
    case "VTACH": {
      const cycleLen = width / 11;
      for (let x = 0; x <= width; x += step) {
        const t = (x % cycleLen) / cycleLen;
        // wide, smooth, sine-like complexes - no discernible P
        const y = 34 * Math.sin(2 * Math.PI * t) + 6 * Math.sin(6 * Math.PI * t);
        push(x, y);
      }
      break;
    }
    case "VFIB": {
      const freqs = [0.07, 0.13, 0.21, 0.34, 0.5].map((f) => f * (0.8 + rand() * 0.4));
      const phases = freqs.map(() => rand() * Math.PI * 2);
      const amps = [16, 12, 9, 7, 5].map((a) => a * (0.7 + rand() * 0.6));
      for (let x = 0; x <= width; x += step) {
        let y = 0;
        for (let i = 0; i < freqs.length; i++) y += amps[i] * Math.sin(freqs[i] * x + phases[i]);
        y += (rand() - 0.5) * 4;
        push(x, y);
      }
      break;
    }
    case "SINUSARR": {
      // normal beat morphology, but cycle length gently rides a slow sine —
      // respiratory sinus arrhythmia, not chaotic like AFib
      let x = 0, beatIdx = 0;
      const baseCycle = width / 4.8;
      while (x <= width) {
        const cycleLen = baseCycle * (1 + 0.22 * Math.sin(beatIdx * 0.9));
        for (let lx = 0; lx <= cycleLen && x + lx <= width; lx += step) {
          const t = lx / cycleLen;
          push(x + lx, normalBeat(t));
        }
        x += cycleLen;
        beatIdx++;
      }
      break;
    }
    case "SVT": {
      // very fast, perfectly regular, narrow QRS — P wave suppressed/buried
      const cycleLen = width / 9.5;
      for (let x = 0; x <= width; x += step) {
        const t = (x % cycleLen) / cycleLen;
        push(x, normalBeat(t, { pA: 0 }));
      }
      break;
    }
    case "PAC": {
      // mostly normal beats; occasional early beat with an abnormal P wave
      // but a normal narrow QRS, then a non-compensatory (short) pause
      const cycleLen = width / 4.8;
      let beatIndex = 0, x = 0;
      while (x <= width) {
        const isPAC = beatIndex % 4 === 3;
        const thisLen = isPAC ? cycleLen * 0.72 : cycleLen;
        for (let lx = 0; lx <= thisLen && x + lx <= width; lx += step) {
          const t = lx / thisLen;
          const y = isPAC ? normalBeat(t, { pC: 0.08, pW: 0.025, pA: 5 }) : normalBeat(t);
          push(x + lx, y);
        }
        x += thisLen;
        if (isPAC) x += cycleLen * 0.18;
        beatIndex++;
      }
      break;
    }
    case "AVB2A": {
      // Mobitz I / Wenckebach: PR grows each beat, then a P wave drops its QRS
      const cycleLen = width / 5.2;
      let beatIndex = 0, x = 0;
      const prShift = [0.15, 0.10, 0.045, null];
      while (x <= width) {
        const pc = prShift[beatIndex % 4];
        for (let lx = 0; lx <= cycleLen && x + lx <= width; lx += step) {
          const t = lx / cycleLen;
          const y = pc === null ? gauss(t, 0.15, 0.035, 8) : normalBeat(t, { pC: pc, pW: 0.03 });
          push(x + lx, y);
        }
        x += cycleLen;
        beatIndex++;
      }
      break;
    }
    case "AVB2B": {
      // Mobitz II: constant PR, but a P wave is periodically not conducted
      const cycleLen = width / 5.2;
      let beatIndex = 0, x = 0;
      while (x <= width) {
        const dropped = beatIndex % 4 === 3;
        for (let lx = 0; lx <= cycleLen && x + lx <= width; lx += step) {
          const t = lx / cycleLen;
          const y = dropped ? gauss(t, 0.15, 0.035, 8) : normalBeat(t);
          push(x + lx, y);
        }
        x += cycleLen;
        beatIndex++;
      }
      break;
    }
    case "AVB3": {
      // complete heart block: P waves and QRS complexes at independent rates
      const pCycle = width / 9;
      for (let x = 0; x <= width; x += step) {
        const t = (x % pCycle) / pCycle;
        push(x, gauss(t, 0.5, 0.06, 7));
      }
      const qrsCycle = width / 3.4;
      for (let qx = qrsCycle * 0.4; qx <= width; qx += qrsCycle) {
        for (let lx = -qrsCycle * 0.18; lx <= qrsCycle * 0.18; lx += step) {
          const idx = Math.round((qx + lx) / step);
          if (idx >= 0 && idx < pts.length) {
            const localT = (lx + qrsCycle * 0.18) / (qrsCycle * 0.36);
            pts[idx][1] -= triangle(localT, 0.5, 0.4, 46) + triangle(localT, 0.5, 0.15, -14);
          }
        }
      }
      break;
    }
    case "ATACH": {
      // regular, fast, narrow QRS — but the P wave shape is abnormal (flipped)
      const cycleLen = width / 7.6;
      for (let x = 0; x <= width; x += step) {
        const t = (x % cycleLen) / cycleLen;
        push(x, normalBeat(t, { pC: 0.12, pW: 0.03, pA: -6 }));
      }
      break;
    }
    case "TDP": {
      // Torsades: polymorphic VT whose amplitude envelope twists/inverts slowly
      const cycleLen = width / 11;
      for (let x = 0; x <= width; x += step) {
        const t = (x % cycleLen) / cycleLen;
        const envelope = Math.sin(x * 0.02);
        const y = envelope * (30 * Math.sin(2 * Math.PI * t) + 6 * Math.sin(6 * Math.PI * t));
        push(x, y);
      }
      break;
    }
    case "WPW": {
      // short PR interval plus a slurred delta-wave upstroke before the R spike
      const cycleLen = width / 4.8;
      for (let x = 0; x <= width; x += step) {
        const t = (x % cycleLen) / cycleLen;
        let y = normalBeat(t, { pC: 0.10, pW: 0.03 });
        y += triangle(t, 0.29, 0.035, 14);
        push(x, y);
      }
      break;
    }
    case "BRUGADA": {
      // coved ST-segment dome curving straight into an inverted T wave
      const cycleLen = width / 4.8;
      for (let x = 0; x <= width; x += step) {
        const t = (x % cycleLen) / cycleLen;
        let y = triangle(t, 0.32, 0.02, -8) + triangle(t, 0.345, 0.02, 42) + triangle(t, 0.37, 0.02, -16);
        y += gauss(t, 0.15, 0.035, 8);
        y += gauss(t, 0.44, 0.05, 12);
        y += gauss(t, 0.58, 0.06, -13);
        push(x, y);
      }
      break;
    }
    case "LQT": {
      // normal QRS, but the QT segment (QRS through T wave) is stretched long
      const cycleLen = width / 3.6;
      for (let x = 0; x <= width; x += step) {
        const t = (x % cycleLen) / cycleLen;
        push(x, normalBeat(t, { tC: 0.72, tW: 0.11, tA: 14 }));
      }
      break;
    }
    case "SSS": {
      // slow sinus rhythm with intermittent unexpectedly long pauses
      let x = 0, beatIndex = 0;
      const cycleLen = width / 3.1;
      while (x <= width) {
        const longPause = beatIndex > 0 && beatIndex % 3 === 2;
        for (let lx = 0; lx <= cycleLen && x + lx <= width; lx += step) {
          const t = lx / cycleLen;
          push(x + lx, normalBeat(t));
        }
        x += cycleLen;
        if (longPause) x += cycleLen * 1.3;
        beatIndex++;
      }
      break;
    }
    case "BIGEM": {
      // strict alternation: normal beat, PVC, normal beat, PVC...
      let x = 0, beatIndex = 0;
      const cycleLen = width / 4.8;
      while (x <= width) {
        const isPVC = beatIndex % 2 === 1;
        const thisLen = isPVC ? cycleLen * 0.85 : cycleLen;
        for (let lx = 0; lx <= thisLen && x + lx <= width; lx += step) {
          const t = lx / thisLen;
          const y = isPVC ? (triangle(t, 0.3, 0.09, 55) + gauss(t, 0.62, 0.09, -18)) : normalBeat(t);
          push(x + lx, y);
        }
        x += thisLen;
        beatIndex++;
      }
      break;
    }
    case "TRIGEM": {
      // two normal beats, then a PVC, repeating
      let x = 0, beatIndex = 0;
      const cycleLen = width / 4.8;
      while (x <= width) {
        const isPVC = beatIndex % 3 === 2;
        const thisLen = isPVC ? cycleLen * 0.85 : cycleLen;
        for (let lx = 0; lx <= thisLen && x + lx <= width; lx += step) {
          const t = lx / thisLen;
          const y = isPVC ? (triangle(t, 0.3, 0.09, 55) + gauss(t, 0.62, 0.09, -18)) : normalBeat(t);
          push(x + lx, y);
        }
        x += thisLen;
        beatIndex++;
      }
      break;
    }
    default: {
      for (let x = 0; x <= width; x += step) push(x, 0);
    }
  }
  return pts;
}

function pointsToPath(pts) {
  if (!pts.length) return "";
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  return d;
}

/* Public: returns a full, ready-to-inject <svg> string for a rhythm type. */
function renderWaveformSVG(typeId, width, height, opts) {
  opts = opts || {};
  const gridColor = opts.gridColor || "rgba(57,255,136,0.12)";
  const traceColor = opts.traceColor || "#39ff88";
  const pts = generateWaveformPoints(typeId, width, height);
  const path = pointsToPath(pts);
  const gridStep = 20;
  let gridLines = "";
  for (let gx = 0; gx <= width; gx += gridStep) {
    gridLines += `<line x1="${gx}" y1="0" x2="${gx}" y2="${height}" stroke="${gridColor}" stroke-width="${gx % 100 === 0 ? 1.4 : 0.6}"/>`;
  }
  for (let gy = 0; gy <= height; gy += gridStep) {
    gridLines += `<line x1="0" y1="${gy}" x2="${width}" y2="${gy}" stroke="${gridColor}" stroke-width="${gy % 100 === 0 ? 1.4 : 0.6}"/>`;
  }
  return `
  <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"/>
    <g>${gridLines}</g>
    <path d="${path}" fill="none" stroke="${traceColor}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round" class="ecg-trace-path"/>
  </svg>`;
}

window.renderWaveformSVG = renderWaveformSVG;

/* ---------------------------------------------------------------------
   PIECE SLICING — cuts any rhythm's continuous trace into N equal-width
   segments so the game can hand out small draggable "puzzle pieces" that
   either continue a target strip correctly, or don't (decoys).
   Deterministic: the same typeId always produces the same full trace
   (seeded PRNG), so a piece sliced from segment i always lines up with
   the same piece sliced again later.
   --------------------------------------------------------------------- */
function renderPieceSVG(typeId, segIndex, totalSegments, trackWidth, trackHeight, opts) {
  opts = opts || {};
  const gridColor = opts.gridColor || "rgba(57,255,136,0.10)";
  const traceColor = opts.traceColor || "#39ff88";
  const full = generateWaveformPoints(typeId, trackWidth, trackHeight);
  const segW = trackWidth / totalSegments;
  const xStart = segIndex * segW;
  const xEnd = xStart + segW;
  const slice = full
    .filter((p) => p[0] >= xStart - 1 && p[0] <= xEnd + 1)
    .map((p) => [Math.max(0, Math.min(segW, p[0] - xStart)), p[1]]);
  const path = pointsToPath(slice);
  const gridStep = 20;
  let gridLines = "";
  for (let gx = 0; gx <= segW; gx += gridStep) {
    gridLines += `<line x1="${gx}" y1="0" x2="${gx}" y2="${trackHeight}" stroke="${gridColor}" stroke-width="0.6"/>`;
  }
  for (let gy = 0; gy <= trackHeight; gy += gridStep) {
    gridLines += `<line x1="0" y1="${gy}" x2="${segW}" y2="${gy}" stroke="${gridColor}" stroke-width="0.6"/>`;
  }
  return `
  <svg viewBox="0 0 ${segW} ${trackHeight}" width="100%" height="100%" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <g>${gridLines}</g>
    <path d="${path}" fill="none" stroke="${traceColor}" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

window.renderPieceSVG = renderPieceSVG;
