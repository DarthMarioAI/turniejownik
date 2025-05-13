import React, { useState } from "react";
import * as XLSX from "xlsx";

// Domyślna paleta kolorów – każda kolejna drużyna dostaje unikalny odcień
const defaultColors = [
  "#FFB6C1", "#87CEFA", "#90EE90", "#FFD700", "#FFA07A",
  "#DDA0DD", "#00CED1", "#F08080", "#98FB98", "#DA70D6"
];

/**
 * Zwraca największy możliwy zbiór meczów (nie więcej niż `limit`),
 * w którym żadna drużyna się nie powtarza.
 * Dla 8 drużyn algorytm DFS jest błyskawiczny i gwarantuje optimum.
 */
const getBestMatching = (pairs, limit) => {
  let best = [];

  const dfs = (idx, current, used) => {
    if (current.length > best.length) best = [...current];
    if (best.length === limit || idx >= pairs.length) return;

    for (let i = idx; i < pairs.length; i++) {
      const [a, b] = pairs[i];
      if (used.has(a) || used.has(b)) continue;
      used.add(a);
      used.add(b);
      current.push(pairs[i]);
      dfs(i + 1, current, used);
      current.pop();
      used.delete(a);
      used.delete(b);
    }
  };

  dfs(0, [], new Set());
  return best;
};

export default function Turniejownik() {
  /* ------------------   STATE   ------------------ */
  const [teams, setTeams] = useState([{ name: "", club: "", color: defaultColors[0] }]);
  const [fields, setFields] = useState(4);
  const [matchDuration, setMatchDuration] = useState(12);
  const [breakDuration, setBreakDuration] = useState(3);
  const [startTime, setStartTime] = useState("10:00");
  const [schedule, setSchedule] = useState([]);
  const [specialTeamA, setSpecialTeamA] = useState("");
  const [specialTeamB, setSpecialTeamB] = useState("");
  const [versionTag, setVersionTag] = useState("1.3");

  /* ------------------   HANDLERS   ------------------ */
  const handleTeamChange = (idx, key, value) => {
    const next = [...teams];
    next[idx][key] = value;
    setTeams(next);
  };

  const addTeam = () => {
    const used = teams.map(t => t.color);
    const color = defaultColors.find(c => !used.includes(c)) || "#cccccc";
    setTeams([...teams, { name: "", club: "", color }]);
  };

  const removeTeam = idx => setTeams(teams.filter((_, i) => i !== idx));

  /* ------------------   LOGIKA HARMONOGRAMU   ------------------ */
  const generateSchedule = () => {
    const names = teams.map(t => t.name.trim()).filter(Boolean);
    const clubOf = n => (teams.find(t => t.name === n)?.club || "").trim().toLowerCase();

    // wszystkie dozwolone pary (bez pary specjalnej i wewnątrz‑klubowych)
    const pairs = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i];
        const b = names[j];
        if (clubOf(a) && clubOf(a) === clubOf(b)) continue; // ten sam klub
        if ((a === specialTeamA && b === specialTeamB) || (a === specialTeamB && b === specialTeamA)) continue;
        pairs.push([a, b]);
      }
    }

    // deterministyczne sortowanie – te same rundy przy każdym kliknięciu
    pairs.sort((p, q) => (p[0] + p[1]).localeCompare(q[0] + q[1], "pl"));

    let remaining = [...pairs];
    const rounds = [];

    while (remaining.length) {
      const best = getBestMatching(remaining, fields);
      if (!best.length) break;
      rounds.push({ matches: best.map((pair, i) => ({ field: i + 1, pair })) });
      const usedStrings = new Set(best.map(p => `${p[0]}|${p[1]}`));
      remaining = remaining.filter(p => !usedStrings.has(`${p[0]}|${p[1]}`));
    }

    if (specialTeamA && specialTeamB) {
      rounds.push({ matches: [{ field: 1, pair: [specialTeamA, specialTeamB] }] });
    }

    setSchedule(rounds);
  };

  /* ------------------   EKSPORT DO EXCELA   ------------------ */
  const exportTeamsToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(teams);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Druzyny");
    XLSX.writeFile(wb, "turniejownik_druzyny.xlsx");
  };

  /* ------------------   RENDER   ------------------ */
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Turniejownik ⚽</h1>

      {/* Ustawienia turnieju */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block font-medium">Liczba boisk:</label>
          <input
            type="number"
            min="1"
            max="6"
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
            min="1"
            max="15"
            className="border p-2 w-full"
            value={breakDuration}
            onChange={e => setBreakDuration(parseInt(e.target.value) || 1)}
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

      {/* Specjalna para */}
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
              <option key={`a-${i}`} value={t.name}>{t.name}</option>
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
              <option key={`b-${i}`} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista drużyn */}
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
          <button onClick={() => removeTeam(i)} className="text-red-600 font-bold">✕</button>
        </div>
      ))}

      {/* Przyciski akcji */}
      <div className="flex gap-4 mt-4">
        <button onClick={addTeam} className="bg-blue-600 text-white px-4 py-2 rounded">➕ Dodaj drużynę</button>
        <button onClick={generateSchedule} className="bg-green-600 text-white px-4 py-2 rounded">🏁 Generuj harmonogram</button>
        <button onClick={exportTeamsToExcel} className="bg-gray-600 text-white px-4 py-2 rounded">📥 Eksportuj do Excela</button>
      </div>

      {/* Harmonogram */}
      {schedule.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">📋 Harmonogram</h2>
          {schedule.map((round, idx) => (
            <div key={idx} className="mb-4">
              <h3 className="font-semibold mb-2">Runda {idx + 1}</h3>
              <ul className="list-disc list-inside">
                {round.matches.map((m, j) => (
                  <li key={j}>Boisko {m.field}: {m.pair[0]} vs {m.pair[1]}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Wersja robocza */}
      <div className="mt-12">
        <label className="block font-medium">🔢 Wersja robocza:</label>
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
