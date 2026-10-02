const Team = require('../models/Team');
const { compareTeams, progressTime } = require('../services/rankings');
const { rosterFilter } = require('../services/registrationPolicy');

const getLeaderboard = async (req, res) => {
  try {
    const teams = await Team.find({ ...rosterFilter(), start_time: { $ne: null } }).lean();
    teams.sort(compareTeams);
    res.json({ leaderboard: teams.map((team, index) => ({
      rank: index + 1, team_name: team.team_name, leader_name: team.leader_name,
      total_points: team.total_points, current_level: team.current_level,
      time_taken: progressTime(team), completed: team.current_level >= 6,
      solved_rounds: (team.outcomes || []).filter(outcome => outcome.status === 'solved').length,
      skipped_rounds: (team.outcomes || []).filter(outcome => outcome.status === 'skipped').length
    })) });
  } catch {
    res.status(503).json({ error: 'Unable to load rankings. Try refreshing.' });
  }
};

module.exports = { getLeaderboard };
