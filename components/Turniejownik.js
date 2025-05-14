import React, { useState } from "react";
import * as XLSX from "xlsx";

/* -------------------------------------------------------------
 *  Turniejownik 2.0  (optymalny harmonogram)
 * -------------------------------------------------------------
 *  • Edge‑colouring DFS – minimalna liczba rund zagwarantowana
 *  • Para specjalna i max 2 kolejne mecze na tym samym boisku
 *  • Eksport: arkusz zbiorczy + arkusze boisk
 * ------------------------------------------------------------- */

const defaultColors = [
  "#FFB6C1", "#87CEFA", "#90EE90", "#FFD700", "#FFA07A",
  "#DDA0DD", "#00CED1", "#F08080", "#98FB98", "#DA70D6"
];

/* -----------------------------  HELPERS  ----------------------------- */

/* minimalne k‑kolorowanie krawędzi (k = fields) z limitem „≤k per round” */
function buildOptimalRounds(pairs, fields) {
  const lower = Math.ceil(pairs.length / fields);

  const canPlace = (round, [a, b]) =>
    round.matches.length < fields &&
    !round.teamSet.has(a) && !round.teamSet.has(b);

  function dfs(idx, rounds) {
    if (idx === pairs.length) return true;                // plan gotowy
    const pair = pairs[idx];

    // heurystyka: próbuj rundy z najmniejszą liczbą meczów
    const order = [...rounds].sort((r1, r2) => r1.matches.length - r2.matches.length);
    for (const rnd of order) {
      if (!canPlace(rnd, pair)) continue;
      rnd.matches.push({ pair });               // field = null na razie
      rnd.teamSet.add(pair[0]); rnd.teamSet.add(pair[1]);

      if (dfs(idx + 1, rounds)) return true;

      rnd.matches.pop();
      rnd.teamSet.delete(pair[0]); rnd.teamSet.delete(pair[1]);
    }
    return false;
  }

  for (let R = lower; R <= pairs.length; R++) {
    const rounds = Array.from({ length: R }, () => ({ matches: [], teamSet: new Set() }));
    if (dfs(0, rounds)) return rounds.filter(r => r.matches.length);
  }
  return null;   // nie powinno się zdarzyć
}

/* przydział numerów pól z zasadą „max 2 kolejne na tym samym boisku” */
function assignFieldsFairPlay(rounds, fields) {
  const lastField = new Map();
  const streak    = new Map();

  rounds.forEach(rnd => {
    const usedFld = new Set();
    rnd.matches.forEach(m => {
      const [a, b] = m.pair;

      let field = null;
      for (let f = 1; f <= fields; f++) {
        if (usedFld.has(f)) continue;
        const okA = lastField.get(a) !== f || (streak.get(a) || 0) < 2;
        const okB = lastField.get(b) !== f || (streak.get(b) || 0) < 2;
        if (okA && okB) { field = f; break; }
      }
      if (!field) {                         // awaryjnie – pierwsze wolne
        for (let f = 1; f <= fields; f++) if (!usedFld.has(f)) { field = f; break; }
      }
      m.field = field;

      // update streaks
      if (lastField.get(a) === field) streak.set(a, (streak.get(a) || 0) + 1);
      else { streak.set(a, 1); lastField.set(a, field); }

      if (lastField.get(b) === field) streak.set(b, (streak.get(b) || 0) + 1);
      else { streak.set(b, 1); lastField.set(b, field); }

      usedFld.add(field);
    });
    rnd.matches.sort((x, y) => x.field - y.field);
  });

  return rounds;
}

/* ---------------------------  KOMPONENT  ------------------------------ */
export default function Turniejownik() {
  /* ---- state ---- */
  const [teams, setTeams] = useState([{ name: "", club: "", color: defaultColors[0] }]);
  const [fields, setFields] = useState(4);
  const [matchDuration, setMatchDuration] = useState(12);
  const [breakDuration, setBreakDuration] = useState(3);
  const [startTime, setStartTime]   = useState("10:00");
  const [schedule, setSchedule]     = useState([]);
  const [specialTeamA, setSpecialTeamA] = useState("");
  const [specialTeamB, setSpecialTeamB] = useState("");
  const [versionTag,  setVersionTag]    = useState("2.0");

  /* ---- team helpers ---- */
  const handleTeamChange = (i, k, v) => {
    const next = [...teams]; next[i][k] = v; setTeams(next);
  };
  const addTeam = () => {
    const used = teams.map(t => t.color);
    const color = defaultColors.find(c => !used.includes(c)) || "#cccccc";
    setTeams([...teams, { name: "", club: "", color }]);
  };
  const removeTeam = i => setTeams(teams.filter((_, idx) => idx !== i));

  /* ---- scheduler ---- */
  const generateSchedule = () => {
    /* 0) listy nazw */
    const names = teams
      .map(t => t.name.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pl"));
    if (names.length < 2) { setSchedule([]); return; }

    const clubOf = n => (teams.find(t => t.name === n)?.club || "").trim().toLowerCase();

    /* 1) wszystkie mecze (bez pary specjalnej, bez wewnątrz‑klubowych) */
    const pairs = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i], b = names[j];
        if (clubOf(a) && clubOf(a) === clubOf(b)) continue;
        if ((a === specialTeamA && b === specialTeamB) || (a === specialTeamB && b === specialTeamA)) continue;
        pairs.push([a, b]);
      }
    }

    /* 2) optymalne rundy */
    const rounds0 = buildOptimalRounds(pairs, fields);

    /* 3) para specjalna */
    if (specialTeamA && specialTeamB) {
      const last = rounds0[rounds0.length - 1];
      const used = new Set(last.matches.flatMap(m => m.pair));
      if (used.has(specialTeamA) || used.has(specialTeamB) || last.matches.length >= fields) {
        rounds0.push({ matches: [{ pair: [specialTeamA, specialTeamB] }] });
      } else {
        last.matches.push({ pair: [specialTeamA, specialTeamB] });
      }
    }

    /* 4) przydział boisk (fair‑play) */
    const final = assignFieldsFairPlay(rounds0, fields);
    setSchedule(final);
  };

  /* ---- time utils ---- */
  const totalRound = matchDuration + breakDuration;
  const startMin = (()=>{ const [h,m]=startTime.split(':').map(Number); return h*60+m; })();
  const fmt = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  const roundLabel = idx => `${fmt(startMin + idx*totalRound)}‑${fmt(startMin + idx*totalRound + matchDuration)}`;

  /* ---- export excel ---- */
  const exportToExcel = () => {
    if (!schedule.length) return;
    const wb = XLSX.utils.book_new();

    const header = ["Runda","Godzina"];
    for (let f=1; f<=fields; f++) header.push(`Boisko ${f} A`,`Boisko ${f} B`);
    const rows = [header];

    schedule.forEach((rnd,idx)=>{
      const r=[idx+1, roundLabel(idx)];
      for (let f=1; f<=fields; f++){
        const m = rnd.matches.find(x=>x.field===f);
        if (m) r.push(m.pair[0], m.pair[1]); else r.push("","");
      }
      rows.push(r);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!merges"]=Array.from({length:fields},(_,i)=>({s:{r:0,c:2+i*2},e:{r:0,c:3+i*2}}));
    XLSX.utils.book_append_sheet(wb,ws,"Harmonogram");

    for (let f=1; f<=fields; f++){
      const sheetRows=[["Runda","Godzina","A","B"]];
      schedule.forEach((rnd,idx)=>{
        const m=rnd.matches.find(x=>x.field===f);
        if(m) sheetRows.push([idx+1,roundLabel(idx),m.pair[0],m.pair[1]]);
      });
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(sheetRows),`Boisko ${f}`);
    }

    XLSX.writeFile(wb,"harmonogram_turnieju.xlsx");
  };
  /* ---------- RENDER ---------- */
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Turniejownik ⚽</h1>

      {/* Ustawienia turnieju */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block font-medium">Liczba boisk:</label>
          <input type="number" min="1" max="8" className="border p-2 w-full"
                 value={fields} onChange={e=>setFields(parseInt(e.target.value)||1)}/>
        </div>
        <div>
          <label className="block font-medium">Czas meczu (minuty):</label>
          <input type="number" min="5" max="30" className="border p-2 w-full"
                 value={matchDuration} onChange={e=>setMatchDuration(parseInt(e.target.value)||5)}/>
        </div>
        <div>
          <label className="block font-medium">Przerwa po meczu (minuty):</label>
          <input type="number" min="0" max="15" className="border p-2 w-full"
                 value={breakDuration} onChange={e=>setBreakDuration(parseInt(e.target.value)||0)}/>
        </div>
        <div>
          <label className="block font-medium">Godzina rozpoczęcia:</label>
          <input type="time" className="border p-2 w-full"
                 value={startTime} onChange={e=>setStartTime(e.target.value)}/>
        </div>
      </div>

      {/* Specjalna para */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block font-medium">Specjalna para na ostatnią rundę:</label>
          <select className="border p-2 w-full" value={specialTeamA}
                  onChange={e=>setSpecialTeamA(e.target.value)}>
            <option value="">Wybierz drużynę A</option>
            {teams.map((t,i)=>(
              <option key={`sa-${i}`} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="pt-6">
          <select className="border p-2 w-full" value={specialTeamB}
                  onChange={e=>setSpecialTeamB(e.target.value)}>
            <option value="">Wybierz drużynę B</option>
            {teams.map((t,i)=>(
              <option key={`sb-${i}`} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista drużyn */}
      <h2 className="text-xl font-semibold mb-2">Drużyny:</h2>
      {teams.map((team,i)=>(
        <div key={i} className="grid grid-cols-6 gap-2 mb-2">
          <input type="text" className="border p-2 col-span-2" placeholder={`Drużyna ${i+1}`}
                 value={team.name}  onChange={e=>handleTeamChange(i,"name",e.target.value)}/>
          <input type="text" className="border p-2 col-span-2" placeholder="Klub"
                 value={team.club}  onChange={e=>handleTeamChange(i,"club",e.target.value)}/>
          <input type="color" className="w-full h-10 p-1"
                 value={team.color} onChange={e=>handleTeamChange(i,"color",e.target.value)}/>
          <button onClick={()=>removeTeam(i)} className="text-red-600 font-bold">✕</button>
        </div>
      ))}

      {/* Przyciski */}
      <div className="flex gap-4 mt-4">
        <button onClick={addTeam}          className="bg-blue-600 text-white px-4 py-2 rounded">➕ Dodaj drużynę</button>
        <button onClick={generateSchedule} className="bg-green-600 text-white px-4 py-2 rounded">🏁 Generuj harmonogram</button>
        <button onClick={exportToExcel}    className="bg-purple-600 text-white px-4 py-2 rounded">📤 Exportuj harmonogram</button>
      </div>

      {/* Harmonogram */}
      {schedule.length>0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">📋 Harmonogram</h2>
          {schedule.map((rnd,idx)=>(
            <div key={idx} className="mb-4">
              <h3 className="font-semibold mb-2">
                Runda {idx+1} <span className="text-sm text-gray-600">({roundLabel(idx)})</span>
              </h3>
              <ul className="list-disc list-inside">
                {rnd.matches.map((m,j)=>(
                  <li key={j}>Boisko {m.field}: {m.pair[0]} vs {m.pair[1]}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Wersja robocza */}
      <div className="mt-12">
        <label className="block font-medium">🔢 Wersja robocza:</label>
        <input type="text" className="border p-2 w-full max-w-xs"
               value={versionTag} onChange={e=>setVersionTag(e.target.value)}/>
      </div>
    </div>
  );
}
