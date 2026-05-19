/**
 * Generates round-robin fixtures for a set of teams divided into pools.
 * @param {Array} teams - Array of team objects
 * @param {number} numPools - Number of pools to divide teams into
 * @param {string} mode - Tournament mode: league or knockout
 * @returns {Object} { pools, fixtures }
 */
const generateFixtures = (teams, numPools = 4, mode = "league") => {
  const normalizedMode = (mode || "league").toString().toLowerCase();
  const shuffled = [...teams].sort(() => 0.5 - Math.random());

  if (normalizedMode === "knockout") {
    const pools = { KO: shuffled };
    const fixtures = [];

    for (let i = 0; i < shuffled.length; i += 2) {
      const teamA = shuffled[i];
      const teamB = shuffled[i + 1];

      if (!teamB) {
        // Odd team count gets a BYE in round 1.
        fixtures.push({
          id: `match_KO_bye_${i}_${Date.now()}`,
          teamAId: teamA.id,
          teamBId: "",
          teamAName: teamA.name,
          teamBName: "BYE",
          pool: "KO",
          round: "Round 1",
          tournamentMode: normalizedMode,
          status: "finished",
          scoreA: 0,
          scoreB: 0,
          half: 1,
          timer: 0,
          events: [],
        });
        continue;
      }

      fixtures.push({
        id: `match_KO_r1_${i}_${Date.now()}`,
        teamAId: teamA.id,
        teamBId: teamB.id,
        teamAName: teamA.name,
        teamBName: teamB.name,
        pool: "KO",
        round: "Round 1",
        tournamentMode: normalizedMode,
        status: "scheduled",
        scoreA: 0,
        scoreB: 0,
        half: 1,
        timer: 1200,
        events: [],
      });
    }

    return { pools, fixtures };
  }

  const pools = {};

  for (let i = 0; i < numPools; i++) {
    const poolKey = String.fromCharCode(65 + i);
    pools[poolKey] = [];
  }

  shuffled.forEach((team, index) => {
    const poolKey = String.fromCharCode(65 + (index % numPools));
    pools[poolKey].push(team);
  });

  const fixtures = [];
  Object.entries(pools).forEach(([pool, poolTeams]) => {
    for (let i = 0; i < poolTeams.length; i++) {
      for (let j = i + 1; j < poolTeams.length; j++) {
        fixtures.push({
          id: `match_${pool}_${i}_${j}_${Date.now()}`,
          teamAId: poolTeams[i].id,
          teamBId: poolTeams[j].id,
          teamAName: poolTeams[i].name,
          teamBName: poolTeams[j].name,
          pool,
          round: "League",
          tournamentMode: normalizedMode,
          status: "scheduled",
          scoreA: 0,
          scoreB: 0,
          half: 1,
          timer: 1200,
          events: [],
        });
      }
    }
  });

  return { pools, fixtures };
};

module.exports = { generateFixtures };
