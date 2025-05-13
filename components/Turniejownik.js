import React, { useState } from "react";
import * as XLSX from "xlsx";

/* -------------------------------------------------------------
 *  Turniejownik – minimalne rundy, para specjalna w ostatniej,
 *  etykiety czasowe rund i „fair‑play” przydział boisk:
 *  ta sama drużyna max 2 razy z rzędu na tym samym boisku.
 * ------------------------------------------------------------- */

// Domyślna paleta kolorów dla nowych drużyn
const defaultColors = [
  "#FFB6C1", "#87CEFA", "#90EE90", "#FFD700", "#FFA07A",
  "#DDA0DD", "#00CED1", "#F08080", "#98FB98", "#DA70D6"
];

/**
 * Zwraca największy podzbiór meczów (≤ limit) bez powtórek drużyn.
 * Back‑tracking DFS – przy ≤ 10 drużynach działa w ułamku sekundy.
 */
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
  /* ---------------------- STATE ---------------------- */
  const [teams, setTeams] = useState([{ name: "", club: "", color: defaultColors[0] }]);
  const [fields, setFields] = useState(4);
  const [matchDuration, setMatchDuration] = useState(12);   // minuty
  const [breakDuration, setBreakDuration] = useState(3);    // minuty
  const [startTime, setStartTime] = useState("10:00");      // HH:MM
  const [schedule, setSchedule] = useState([]);
  const [specialTeamA, setSpecialTeamA] = useState("");
  const [specialTeamB, setSpecialTeamB] = useState("");
  const [versionTag, setVersionTag] = useState("1.7");

  /* -------------------- HELPERS ---------------------- */
  const handleTeamChange = (idx, key, val) => {
    const next = [...teams];
    next[idx][key] = val;
    setTeams(next);
  };

  const addTeam = () => {
    const usedColors = teams.map(t => t.color);
    const color = defaultColors.find(c => !usedColors.includes(c)) || "#cccccc";
    setTeams([...teams, { name: "", club: "", color }]);
  };

  const removeTeam = idx => setTeams(teams.filter((_, i) => i !== idx));

  /* ----------------- HARMONOGRAM --------------------- */
  const generateSchedule = () => {
    const names = teams.map(t => t.name.trim()).filter(Boolean);
    const clubOf = n => (teams.find(t => t.name === n)?.club || "").trim().toLowerCase();

    /* 1. lista wszystkich dozwolonych par */
    const pairs = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i], b = names[j];
        if (clubOf(a) && clubOf(a) === clubOf(b)) continue; // ten sam klub
        if ((a === specialTeamA && b === specialTeamB) || (a === specialTeamB && b === specialTeamA)) continue; // para specjalna (dodamy później)
        pairs.push([a, b]);
      }
    }
    pairs.sort((p, q) => (p[0] + p[1]).localeCompare(q[0] + q[1], "pl")); // deterministycznie

    /* 2. minimalna liczba rund przy maks. wykorzystaniu boisk */
    let remaining = [...pairs];
    const rawRounds = [];
    while (remaining.length) {
      const best = getBestMatching(remaining, fields);
      rawRounds.push(best);
      const used = new Set(best.map(p => `${p[0]}|${p[1]}`));
      remaining = remaining.filter(p => !used.has(`${p[0]}|${p[1]}`));
    }

    /* 3. wstaw parę specjalną do ostatniej rundy lub nowej */
    if (specialTeamA && specialTeamB) {
      const last = rawRounds[rawRounds.length - 1] || [];
      const usedTeams = new Set(last.flat());
      if (!usedTeams.has(specialTeamA) && !usedTeams.has(specialTeamB) && last.length < fields) {
        last.push([specialTeamA, specialTeamB]);
      } else {
        rawRounds.push([[specialTeamA, specialTeamB]]);
      }
    }

    /* 4. przydział boisk z limitem 2 kolejnych gier */
    const lastField = Object.fromEntries(names.map(n => [n, null]));
    const streak = Object.fromEntries(names.map(n => [n, 0]));

    const finalRounds = rawRounds.map(matches => {
      const assigned = [];
      const usedThisRound = new Set();
      for (const pair of matches) {
        let field = null;
        for (let f = 1; f <= fields; f++) {
          if (usedThisRound.has(f)) continue;
          const okA = lastField[pair[0]] !== f || streak[pair[0]] < 2;
          const okB = lastField[pair[1]] !== f || streak[pair[1]] < 2;
          if (okA && okB) { field = f; break; }
        }
        if (field == null) {
          for (let f = 1; f <= fields; f++) if (!usedThisRound.has(f)) { field = f; break; }
        }
        const [a, b] = pair;
        if (lastField[a] === field) streak[a] += 1; else { streak[a] = 1; lastField[a] = field; }
        if (lastField[b] === field) streak[b] += 1; else { streak[b] = 1; lastField[b] = field; }
        usedThisRound.add(field);
        assigned.push({ field, pair });
      }
      assigned.sort((x, y) => x.field - y.field);
      return { matches: assigned };
    });

    setSchedule(finalRounds);
  };

  /* -------------- CZAS RUND -------------------------- */
  const totalRoundDuration = matchDuration + breakDuration;
  const startMinutes = (() => { const [h, m] = startTime.split(":" ).map(Number); return h * 60 + m; })();
  const fmt = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const roundTimeLabel = idx => `${fmt(startMinutes + idx * totalRoundDuration)}‑${fmt(startMinutes + idx * totalRoundDuration + matchDuration)}`;

  /* -------------- EXPORT TEAMS ----------------------- */
  const exportTeamsToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(teams);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Druzyny");
    XLSX.writeFile(wb, "turniejownik_druzyny.xlsx");
  };

  /* -------------------- RENDER ----------------------- */
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Turniejownik ⚽</h1>

      {/* --- Ustawienia turnieju --- */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block font-medium">Liczba boisk:</label>
          <input type="number" min="1" max="8" className="border p-2 w-full" value={fields} onChange={e => setFields(parseInt(e.target.value) || 1)} />
        </div>
        <div>
          <label className="block font-medium">Czas meczu (minuty):</label>
          <input type="number" min="5" max="30" className="border p-2 w-full" value={matchDuration} onChange={e => setMatchDuration(parseInt(e.target.value) || 5)} />
        </div>
        <div>
          <label className="block font-medium">Przerwa po meczu (minuty):</label>
          <input type="number" min="0" max="15" className="border p-2 w-full" value={breakDuration} onChange={e => setBreakDuration(parseInt(e.target.value) ?? 0)} />)
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
            <option value="">Wybierz drużynę A</option>
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
            <option value="">Wybierz drużynę B</option>
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
          onClick={exportTeamsToExcel}
          className="bg-gray-600 text-white px-4 py-2 rounded"
        >
          📥 Eksportuj do Excela
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
                <span className="text-sm text-gray-600">
                  {" "}
                  ({roundTimeLabel(idx)})
                </span>
              </h3>
              <ul className="list-disc list-inside">
                {round.matches.map((m, j) => (
                  <li key={j}>
                    Boisko {m.field}: {m.pair[0]} vs {m.pair[1]}
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

