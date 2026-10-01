const Team = require('../models/Team');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 2 }); // 2 seconds TTL

// GET /api/leaderboard
const getLeaderboard = async (req, res) => {
  try {
    const cachedData = cache.get('leaderboard');
    if (cachedData) {
      return res.json({ leaderboard: cachedData });
    }

    // Get all teams, sorted by points DESC then by time ASC
    const teams = await Team.find({
      start_time: { $ne: null }
    }).sort({
      total_points: -1,
      end_time: 1
    });

    const leaderboard = teams.map((team, index) => {
      let timeTaken = null;
      if (team.start_time) {
        const isCompleted = team.current_level >= 6;
        // Completed teams: use end_time (set atomically when they finished level 5).
        // In-progress teams: use updatedAt (last answer save) for tie-breaking,
        // with Date.now() as fallback.
        const endRef = isCompleted && team.end_time
          ? team.end_time
          : (team.updatedAt || new Date());
        timeTaken = endRef.getTime() - team.start_time.getTime();
      }

      return {
        rank: index + 1,
        team_name: team.team_name,
        leader_name: team.leader_name,
        total_points: team.total_points,
        current_level: team.current_level,
        time_taken: timeTaken,
        completed: team.current_level >= 6
      };
    });

    // Re-sort: completed teams first (by points desc, time asc), then in-progress teams
    leaderboard.sort((a, b) => {
      // First by points descending
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      // Then by time ascending (less time = better)
      if (a.time_taken && b.time_taken) {
        return a.time_taken - b.time_taken;
      }
      // Teams with completion time come first
      if (a.time_taken && !b.time_taken) return -1;
      if (!a.time_taken && b.time_taken) return 1;
      return 0;
    });

    // Re-assign ranks after final sort
    leaderboard.forEach((entry, i) => {
      entry.rank = i + 1;
    });

    cache.set('leaderboard', leaderboard);
    res.json({ leaderboard });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Server error fetching leaderboard' });
  }
};

module.exports = { getLeaderboard };
