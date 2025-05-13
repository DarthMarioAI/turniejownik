import React, { useState } from "react";
import * as XLSX from "xlsx";

/* -------------------------------------------------------------
 *  Turniejownik 1.8.1
 *  • minimalna liczba rund  (fair‑play: max 2 kolejne mecze na tym samym boisku)
 *  • para specjalna w ostatniej rundzie, jeśli to możliwe
 *  • etykiety czasowe przy rundach
 *  • EXPORT → plik .xlsx
 *      ‑ Arkusz 1 „Harmonogram” – tabela: Runda | Godzina | [Boisko 1 A B] | [Boisko 2 A B] …
 *      ‑ Arkusze „Boisko 1”, „Boisko 2”, … – lista meczów danego boiska z czasem
 * ------------------------------------------------------------- */

// Domyślne kolory drużyn
const defaultColors = [
  "#FFB6C1", "#87CEFA", "#90EE90", "#FFD700", "#FFA07A",
  "#DDA0DD", "#00CED1", "#F08080", "#98FB98", "#DA70D6"
];

/** Największy podzbiór meczów (≤ limit) bez powtórek drużyn */
const getBestMatching = (pairs, limit) => {
  let best = [];
  const dfs = (idx, curr, used) => {
    if (curr.length > best.length) best = [...curr];
    if (best.length === limit || idx >= pairs.length) return;
    for (let i = idx; i < pairs.length; i++) {
      const [a, b] = pairs[i];
      if (used.has(a) || used.has(b)) continue;
      used.add(a); used.add(b);
      curr.push(pairs[i]);
      dfs(i + 1, curr, used);
      curr.pop();
      used.delete(a); used.delete(b);
    }
  };
  dfs(0, [], new Set());
  return best;
};

export default function Turniejownik() {
  /* ---------- STATE ---------- */
  const [teams, setTeams] = useState([{ name: "", club: "", color: defaultColors[0] }]);
  const [fields, setFields] = useState(4);
  const [matchDuration, setMatchDuration] = useState(12);
  const [breakDuration, setBreakDuration] = useState(3);
  const [startTime, setStartTime] = useState("10:00");
  const [schedule, setSchedule] = useState([]);
  const [specialTeamA, setSpecialTeamA] = useState("");
  const [specialTeamB, setSpecialTeamB] = useState("");
  const [versionTag, setVersionTag] = useState("1.8.1");

  /* ---------- HELPERS ---------- */
  const handleTeamChange = (idx, key, val) => {
    const next = [...teams];
    next[idx][key] = val;
    setTeams(next);
  };
  const addTeam = () => {
    const used = teams.map(t => t.color);
    const color = defaultColors.find(c => !used.includes(c)) || "#cccccc";
    setTeams([...teams, { name: "", club: "", color }]);
  };
  const removeTeam = idx => setTeams(teams.filter((_, i) => i !== idx));

  /* ---------- SCHEDULER ---------- */
  const generateSchedule = () => {
    const names = teams.map(t => t.name.trim()).filter(Boolean);
    if (names.length < 2) { setSchedule([]); return; }

    const clubOf = n => (teams.find(t => t.name === n)?.club || "").trim().toLowerCase();

    // wszystkie dozwolone pary
    const pairs = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i], b = names[j];
        if (clubOf(a) && clubOf(a) === clubOf(b)) continue;
        if ((a === specialTeamA && b === specialTeamB) || (a === specialTeamB && b === specialTeamA)) continue;
        pairs.push([a, b]);
      }
    }
    pairs.sort((p, q) => (p[0] + p[1]).localeCompare(q[0] + q[1], "pl"));

    // minimalna liczba rund
    let remaining = [...pairs];
    const rawRounds = [];
    while (remaining.length) {
      const best = getBestMatching(remaining, fields);
      rawRounds.push(best);
      const used = new Set(best.map(p => `${p[0]}|${p[1]}`));
      remaining = remaining.filter(p => !used.has(`${p[0]}|${p[1]}`));
    }

    // para specjalna
    if (specialTeamA && specialTeamB) {
      const last = rawRounds[rawRounds.length - 1] || [];
      const used = new Set(last.flat());
      if (!used.has(specialTeamA) && !used.has(specialTeamB) && last.length < fields) last.push([specialTeamA, specialTeamB]);
      else rawRounds.push([[specialTeamA, specialTeamB]]);
    }

    // przydział boisk fair‑play
    const lastField = Object.fromEntries(names.map(n => [n, null]));
    const streak = Object.fromEntries(names.map(n => [n, 0]));

    const final = rawRounds.map(matches => {
      const round = [];
      const used = new Set();
      for (const [a, b] of matches) {
        let field = null;
        for (let f = 1; f <= fields; f++) {
          if (used.has(f)) continue;
          const okA = lastField[a] !== f || streak[a] < 2;
          const okB = lastField[b] !== f || streak[b] < 2;
          if (okA && okB) { field = f; break; }
        }
        if (!field) { for (let f = 1; f <= fields; f++) if (!used.has(f)) { field = f; break; } }
        if (lastField[a] === field) streak[a]++; else { streak[a] = 1; lastField[a] = field; }
        if (lastField[b] === field) streak[b]++; else { streak[b] = 1; lastField[b] = field; }
        used.add(field);
        round.push({ field, pair: [a, b] });
      }
      round.sort((x, y) => x.field - y.field);
      return { matches: round };
    });

    setSchedule(final);
  };

  /* ---------- TIME UTILS ---------- */
  const totalRound = matchDuration + breakDuration;
  const startMin = (() => {
    const [h, m] = startTime.split(":" ).map(Number);
    return h * 60 + m;
  })();
  const fmt = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const roundLabel = idx => `${fmt(startMin + idx * totalRound)}‑${fmt(startMin + idx * totalRound + matchDuration)}`;

  /* ---------- EXPORT EXCEL ---------- */
  const exportToExcel = () => {
    if (!schedule.length) return;
    const wb = XLSX.utils.book_new();

    /* Arkusz 1: Harmonogram */
    const header = ["Runda", "Godzina"];
    for (let f = 1; f <= fields; f++) header.push(`Boisko ${f} A`, `Boisko ${f} B`);
    const rows = [header];

    schedule.forEach((rnd, idx) => {
      const row = [idx + 1, roundLabel(idx)];
      for (let f = 1; f <= fields; f++) {
        const match = rnd.matches.find(m => m.field === f);
        if (match) row.push(match.pair[0], match.pair[1]);
        else row.push("", "");
      }
      rows.push(row);
    });

    const wsMain = XLSX.utils.aoa_to_sheet(rows);
    const merges = [];
    for (let i = 0; i < fields; i++) merges.push({ s: { r: 0, c: 2 + i * 2 }, e: { r: 0, c: 3 + i * 2 } });
    wsMain["!merges"] = merges;
    XLSX.utils.book_append_sheet(wb, wsMain, "Harmonogram");

    /* Arkusze poszczególnych boisk */
      for (let f = 1; f <= fields; f++) {
        const sheetRows = [
          ["Runda", "Godzina", "Drużyna A", "Drużyna B"]
        ];
        schedule.forEach((rnd, idx) => {
          const m = rnd.matches.find(x => x.field === f);
          if (m) sheetRows.push([idx + 1, roundLabel(idx), m.pair[0], m.pair[1]]);
        });
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet(sheetRows),
          `Boisko ${f}`
        );
      }

      /* Zapis pliku */
      XLSX.writeFile(wb, "harmonogram_turnieju.xlsx");
    };
    /* ----- END exportToExcel ----- */

    return wb;
  };

  /* ---------- RENDER ---------- */
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Turniejownik ⚽</h1>

      {/* --- Ustawienia turnieju --- */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block font-medium">Liczba boisk:</label>
          <input
            type="number"
            min="1"
            max="8"
            className="border p-2 w-full"
            value={fields}
            onChange={e => setFields(parseInt(e.target.value) || 1)}
          />
        </div>
        <div>
          <label className="block font-medium">Czas meczu (minuty):</label>
          <input
            type="number"
            min="5"
            max="30"
            className="border p-2 w-full"
            value={matchDuration}
            onChange={e => setMatchDuration(parseInt(e.target.value) || 5)}
          />
        </div>
        <div>
          <label className="block font-medium">Przerwa po meczu (minuty):</label>
          <input
            type="number"
            min="0"
            max="15"
            className="border p-2 w-full"
            value={breakDuration}
            onChange={e => setBreakDuration(parseInt(e.target.value) ?? 0)}
          />
        </div>
        <div>
          <label className="block font-medium">Godzina rozpoczęcia:</label>
          <input
            type="time"
            className="border p-2 w-full"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
          />
        </div>
      </div>

      {/* --- Specjalna para --- */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block font-medium">Specjalna para na ostatnią rundę:</label>
          <select
            className="border p-2 w-full"
            value={specialTeamA}
            onChange={e => setSpecialTeamA(e.target.value)}
          >
            <option value="">Wybierz drużynę A</option>
            {teams.map((t, i) => (
              <option key={`sa-${i}`} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="pt-6">
          <select
            className="border p-2 w-full"
            value={specialTeamB}
            onChange={e => setSpecialTeamB(e.target.value)}
          >
            <option value="">Wybierz drużynę B</option>
            {teams.map((t, i) => (
              <option key={`sb-${i}`} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* --- Lista drużyn --- */}
      <h2 className="text-xl font-semibold mb-2">Drużyny:</h2>
      {teams.map((team, i) => (
        <div key={i} className="grid grid-cols-6 gap-2 mb-2">
          <input
            type="text"
            className="border p-2 col-span-2"
            placeholder={`Drużyna ${i + 1}`}
            value={team.name}
            onChange={e => handleTeamChange(i, "name", e.target.value)}
          />
          <input
            type="text"
            className="border p-2 col-span-2"
            placeholder="Klub"
            value={team.club}
            onChange={e => handleTeamChange(i, "club", e.target.value)}
          />
          <input
            type="color"
            className="w-full h-10 p-1"
            value={team.color}
            onChange={e => handleTeamChange(i, "color", e.target.value)}
          />
          <button
            onClick={() => removeTeam(i)}
            className="text-red-600 font-bold"
          >
            ✕
          </button>
        </div>
      ))}

      {/* --- Przyciski akcji --- */}
      <div className="flex gap-4 mt-4">
        <button
          onClick={addTeam}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          ➕ Dodaj drużynę
        </button>
        <button
          onClick={generateSchedule}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          🏁 Generuj harmonogram
        </button>
        <button
          onClick={exportToExcel}
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          📤 Exportuj harmonogram
        </button>
      </div>

      {/* --- Harmonogram --- */}
      {schedule.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">📋 Harmonogram</h2>
          {schedule.map((round, idx) => (
            <div key={idx} className="mb-4">
              <h3 className="font-semibold mb-2">
                Runda {idx + 1}
                <span className="text-sm text-gray-600"> ({roundLabel(idx)})</span>
              </h3>
              <ul className="list-disc list-inside">
                {round.matches.map((m, j) => (
                  <li key={j}>
                    Boisko {m.field}: {m.pair[0]} vs {m.pair[1]}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* --- Wersja robocza --- */}
      <div className="mt-12">
        <label className="block font-medium">🔢 Wersja robocza:</label>
        <input
          type="text"
          value={versionTag}
          onChange={e => setVersionTag(e.target.value)}
          className="border p-2 w-full max-w-xs"
        />
      </div>
    </div>
  );
}
