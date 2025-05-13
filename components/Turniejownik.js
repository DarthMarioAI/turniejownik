// Turniejownik – wersja pełna z harmonogramem, boiskami i eksportem
import React, { useState } from "react";
import * as XLSX from "xlsx";

const defaultColors = [
  "#FFB6C1", "#87CEFA", "#90EE90", "#FFD700", "#FFA07A",
  "#DDA0DD", "#00CED1", "#F08080", "#98FB98", "#DA70D6"
];

const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export default function Turniejownik() {
  const [teams, setTeams] = useState([{ name: "", club: "", color: defaultColors[0] }]);
  const [fields, setFields] = useState(4);
  const [matchDuration, setMatchDuration] = useState(12);
  const [breakDuration, setBreakDuration] = useState(3);
  const [startTime, setStartTime] = useState("10:00");
  const [schedule, setSchedule] = useState([]);
  const [specialTeamA, setSpecialTeamA] = useState("");
  const [specialTeamB, setSpecialTeamB] = useState("");
  const [versionTag, setVersionTag] = useState("1.0");

  const handleTeamChange = (index, key, value) => {
    const updated = [...teams];
    updated[index][key] = value;
    setTeams(updated);
  };

  const addTeam = () => {
    const usedColors = teams.map(t => t.color);
    const availableColor = defaultColors.find(color => !usedColors.includes(color)) || "#cccccc";
    setTeams([...teams, { name: "", club: "", color: availableColor }]);
  };

  const removeTeam = (index) => {
    const updated = [...teams];
    updated.splice(index, 1);
    setTeams(updated);
  };

  const generateSchedule = () => {
    const matches = [];
    const scheduled = new Set();
    const getClub = name => {
      const raw = teams.find(t => t.name === name)?.club || "";
      return raw.trim().toLowerCase();
    };

    const teamNames = teams.map(t => t.name.trim()).filter(Boolean);

    for (let i = 0; i < teamNames.length; i++) {
      for (let j = i + 1; j < teamNames.length; j++) {
        const a = teamNames[i];
        const b = teamNames[j];
        const clubA = getClub(a);
        const clubB = getClub(b);

        const isSameClub = clubA !== "" && clubA === clubB;

        if (
          a !== b &&
          !scheduled.has(`${a}|${b}`) &&
          !scheduled.has(`${b}|${a}`) &&
          !isSameClub &&
          !(a === specialTeamA && b === specialTeamB) &&
          !(a === specialTeamB && b === specialTeamA)
        ) {
          matches.push([a, b]);
        }
      }
    }

    const rounds = [];
    const played = new Set();

    while (matches.length > 0) {
      const usedTeams = new Set();
      const round = [];
      const remaining = [];
      for (const match of matches) {
        const [a, b] = match;
        if (!usedTeams.has(a) && !usedTeams.has(b)) {
          round.push({ field: round.length + 1, pair: [a, b] });
          usedTeams.add(a);
          usedTeams.add(b);
          scheduled.add(`${a}|${b}`);
          if (round.length >= fields) break;
        } else {
          remaining.push(match);
        }
      }
      if (round.length > 0) rounds.push({ matches: round });
      matches.length = 0;
      matches.push(...remaining);
    }

    if (specialTeamA && specialTeamB && !scheduled.has(`${specialTeamA}|${specialTeamB}`) && !scheduled.has(`${specialTeamB}|${specialTeamA}`)) {
      rounds.push({ matches: [{ field: 1, pair: [specialTeamA, specialTeamB] }] });
    }

    setSchedule(rounds);
  };

  const exportTeamsToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(teams);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Drużyny");
    XLSX.writeFile(wb, "turniejownik_druzyny.xlsx");
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Turniejownik ⚽</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block font-medium">Liczba boisk:</label>
          <input type="number" min="1" max="6" className="border p-2 w-full" value={fields} onChange={(e) => setFields(parseInt(e.target.value))} />
        </div>
        <div>
          <label className="block font-medium">Czas meczu (minuty):</label>
          <input type="number" min="5" max="30" className="border p-2 w-full" value={matchDuration} onChange={(e) => setMatchDuration(parseInt(e.target.value))} />
        </div>
        <div>
          <label className="block font-medium">Przerwa po meczu (minuty):</label>
          <input type="number" min="1" max="15" className="border p-2 w-full" value={breakDuration} onChange={(e) => setBreakDuration(parseInt(e.target.value))} />
        </div>
        <div>
          <label className="block font-medium">Godzina rozpoczęcia:</label>
          <input type="time" className="border p-2 w-full" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block font-medium">Specjalna para na ostatnią rundę:</label>
          <select className="border p-2 w-full" value={specialTeamA} onChange={(e) => setSpecialTeamA(e.target.value)}>
            <option value="">Wybierz drużynę A</option>
            {teams.map((t, i) => (
              <option key={`a-${i}`} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="pt-6">
          <select className="border p-2 w-full" value={specialTeamB} onChange={(e) => setSpecialTeamB(e.target.value)}>
            <option value="">Wybierz drużynę B</option>
            {teams.map((t, i) => (
              <option key={`b-${i}`} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-2">Drużyny:</h2>
      {teams.map((team, i) => (
        <div key={i} className="grid grid-cols-6 gap-2 mb-2">
          <input type="text" className="border p-2 col-span-2" placeholder={`Drużyna ${i + 1}`} value={team.name} onChange={(e) => handleTeamChange(i, "name", e.target.value)} />
          <input type="text" className="border p-2 col-span-2" placeholder="Klub" value={team.club} onChange={(e) => handleTeamChange(i, "club", e.target.value)} />
          <input type="color" className="w-full h-10 p-1" value={team.color} onChange={(e) => handleTeamChange(i, "color", e.target.value)} />
          <button onClick={() => removeTeam(i)} className="text-red-600 font-bold">✕</button>
        </div>
      ))}

      <div className="flex gap-4 mt-4">
        <button onClick={addTeam} className="bg-blue-600 text-white px-4 py-2 rounded">➕ Dodaj drużynę</button>
        <button onClick={generateSchedule} className="bg-green-600 text-white px-4 py-2 rounded">🏁 Generuj harmonogram</button>
        <button onClick={exportTeamsToExcel} className="bg-gray-600 text-white px-4 py-2 rounded">📥 Eksportuj do Excela</button>
      </div>

      {schedule.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">📋 Harmonogram</h2>
          {schedule.map((round, i) => (
            <div key={i} className="mb-4">
              <h3 className="font-semibold mb-2">Runda {i + 1}</h3>
              <ul className="list-disc list-inside">
                {round.matches.map((m, j) => (
                  <li key={j}>Boisko {m.field}: {m.pair[0]} vs {m.pair[1]}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12">
        <label className="block font-medium">🔢 Wersja robocza:</label>
        <input
          type="text"
          value={versionTag}
          onChange={(e) => setVersionTag(e.target.value)}
          className="border p-2 w-full max-w-xs"
        />
      </div>
    </div>
  );
}
