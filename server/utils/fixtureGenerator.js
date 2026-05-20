/**
 * Generates fixtures for a set of teams divided into pools.
 * @param {Array} teams - Array of team objects
 * @param {number} numPools - Number of pools to divide teams into
 * @param {string} mode - Tournament mode: league or knockout
 * @returns {Object} { pools, fixtures }
 */
const generateFixtures = (teams, numPools = 4, mode = "league") => {
  const normalizedMode = (mode || "league").toString().toLowerCase();
  const shuffled = [...teams].sort(() => 0.5 - Math.random());

  const effectivePoolCount = Math.max(
    1,
    Math.min(numPools || 1, Math.floor(shuffled.length / 2) || 1),
  );

  const pools = {};

  for (let i = 0; i < effectivePoolCount; i++) {
    const poolKey = String.fromCharCode(65 + i);
    pools[poolKey] = [];
  }

  shuffled.forEach((team, index) => {
    const poolKey = String.fromCharCode(65 + (index % effectivePoolCount));
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
          round: normalizedMode === "knockout" ? "Pool Stage" : "League",
          stage: "pool",
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
