// Turniejownik – wersja pełna z harmonogramem, boiskami i eksportem
import React, { useState } from "react";
import * as XLSX from "xlsx";

const defaultColors = [
  "#FFB6C1", "#87CEFA", "#90EE90", "#FFD700", "#FFA07A",
  "#DDA0DD", "#00CED1", "#F08080", "#98FB98", "#DA70D6"
];

export default function Turniejownik() {
  const [teams, setTeams] = useState([{ name: "", club: "", color: defaultColors[0] }]);
  const [fields, setFields] = useState(4);
  const [matchDuration, setMatchDuration] = useState(12);
  const [breakDuration, setBreakDuration] = useState(3);
  const [startTime, setStartTime] = useState("10:00");

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
    alert("(Demo) Harmonogram generowany — backend w przygotowaniu");
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
          <input
            type="number"
            min="1"
            max="6"
            className="border p-2 w-full"
            value={fields}
            onChange={(e) => setFields(parseInt(e.target.value))}
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
            onChange={(e) => setMatchDuration(parseInt(e.target.value))}
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
            onChange={(e) => setBreakDuration(parseInt(e.target.value))}
          />
        </div>
        <div>
          <label className="block font-medium">Godzina rozpoczęcia:</label>
          <input
            type="time"
            className="border p-2 w-full"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-2">Drużyny:</h2>
      {teams.map((team, i) => (
        <div key={i} className="grid grid-cols-6 gap-2 mb-2">
          <input
            type="text"
            className="border p-2 col-span-2"
            placeholder={`Drużyna ${i + 1}`}
            value={team.name}
            onChange={(e) => handleTeamChange(i, "name", e.target.value)}
          />
          <input
            type="text"
            className="border p-2 col-span-2"
            placeholder="Klub"
            value={team.club}
            onChange={(e) => handleTeamChange(i, "club", e.target.value)}
          />
          <input
            type="color"
            className="w-full h-10 p-1"
            value={team.color}
            onChange={(e) => handleTeamChange(i, "color", e.target.value)}
          />
          <button
            onClick={() => removeTeam(i)}
            className="text-red-600 font-bold"
          >✕</button>
        </div>
      ))}

      <div className="flex gap-4 mt-4">
        <button onClick={addTeam} className="bg-blue-600 text-white px-4 py-2 rounded">
          ➕ Dodaj drużynę
        </button>
        <button onClick={generateSchedule} className="bg-green-600 text-white px-4 py-2 rounded">
          🏁 Generuj harmonogram
        </button>
        <button onClick={exportTeamsToExcel} className="bg-gray-600 text-white px-4 py-2 rounded">
          📥 Eksportuj do Excela
        </button>
      </div>
    </div>
  );
}
