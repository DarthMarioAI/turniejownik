import React, { useState } from "react";
import * as XLSX from "xlsx";

const defaultColors = [
  "#FFB6C1", "#87CEFA", "#90EE90", "#FFD700", "#FFA07A",
  "#DDA0DD", "#00CED1", "#F08080", "#98FB98", "#DA70D6"
];

export default function Turniejownik() {
  const [teams, setTeams] = useState([{ name: "", club: "", color: defaultColors[0] }]);

  const handleTeamChange = (index, key, value) => {
    const newTeams = [...teams];
    newTeams[index][key] = value;
    setTeams(newTeams);
  };

  const addTeam = () => {
    const usedColors = teams.map(t => t.color);
    const availableColor = defaultColors.find(color => !usedColors.includes(color)) || "#cccccc";
    setTeams([...teams, { name: "", club: "", color: availableColor }]);
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(teams);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Drużyny");
    XLSX.writeFile(wb, "turniejownik.xlsx");
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Turniejownik – demo</h1>
      {teams.map((team, index) => (
        <div key={index} className="flex space-x-2 mb-2">
          <input
            type="text"
            className="border p-2 flex-1"
            value={team.name}
            onChange={(e) => handleTeamChange(index, "name", e.target.value)}
            placeholder={`Drużyna ${index + 1}`}
          />
          <input
            type="text"
            className="border p-2 flex-1"
            value={team.club}
            onChange={(e) => handleTeamChange(index, "club", e.target.value)}
            placeholder="Klub"
          />
          <input
            type="color"
            value={team.color}
            onChange={(e) => handleTeamChange(index, "color", e.target.value)}
          />
        </div>
      ))}
      <button
        onClick={addTeam}
        className="bg-blue-600 text-white px-4 py-2 rounded mr-2"
      >
        ➕ Dodaj drużynę
      </button>
      <button
        onClick={exportToExcel}
        className="bg-green-600 text-white px-4 py-2 rounded"
      >
        📥 Eksport do Excela
      </button>
    </div>
  );
}
