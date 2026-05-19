/**
 * Generates round-robin fixtures for a set of teams divided into pools.
 * @param {Array} teams - Array of team objects
 * @param {number} numPools - Number of pools to divide teams into
 * @returns {Object} { pools, fixtures }
 */
const generateFixtures = (teams, numPools = 4) => {
    // Shuffle teams
    const shuffled = [...teams].sort(() => 0.5 - Math.random());
    const pools = {};
    
    // Initialize pools (A, B, C, D, etc.)
    for (let i = 0; i < numPools; i++) {
        const poolKey = String.fromCharCode(65 + i);
        pools[poolKey] = [];
    }
    
    // Distribute into pools
    shuffled.forEach((team, index) => {
        const poolKey = String.fromCharCode(65 + (index % numPools)); 
        pools[poolKey].push(team);
    });

    const fixtures = [];
    Object.entries(pools).forEach(([pool, poolTeams]) => {
        // Round Robin within each pool
        for (let i = 0; i < poolTeams.length; i++) {
            for (let j = i + 1; j < poolTeams.length; j++) {
                fixtures.push({
                    id: `match_${pool}_${i}_${j}_${Date.now()}`,
                    teamAId: poolTeams[i].id,
                    teamBId: poolTeams[j].id,
                    teamAName: poolTeams[i].name,
                    teamBName: poolTeams[j].name,
                    pool,
                    status: 'scheduled',
                    scoreA: 0,
                    scoreB: 0,
                    half: 1,
                    timer: 1200, // 20 mins
                    events: []
                });
            }
        }
    });

    return { pools, fixtures };
};

module.exports = { generateFixtures };
