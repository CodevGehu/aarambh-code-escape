const ExcelJS = require('exceljs');
const Team = require('../models/Team');

// GET /api/export/excel
const exportExcel = async (req, res) => {
  try {
    const teams = await Team.find({
      start_time: { $ne: null }
    });

    // Build leaderboard data with same logic as leaderboard endpoint
    const data = teams.map((team) => {
      let timeTaken = null;
      let timeFormatted = 'In Progress';
      let lastSubmittedStr = 'N/A';

      if (team.start_time) {
        const isCompleted = team.current_level >= 6;

        if (isCompleted && team.end_time) {
          // Completed teams: exact duration from start to when they finished level 5
          timeTaken = team.end_time.getTime() - team.start_time.getTime();
        } else {
          // In-progress teams: live snapshot at export time
          timeTaken = Date.now() - team.start_time.getTime();
        }

        const hours = Math.floor(timeTaken / 3600000);
        const minutes = Math.floor((timeTaken % 3600000) / 60000);
        const seconds = Math.floor((timeTaken % 60000) / 1000);
        timeFormatted = `${hours}h ${minutes}m ${seconds}s`;

        // "Last Submitted at" — for completed teams use end_time (the exact moment
        // they answered the final question). For in-progress teams, updatedAt is the
        // best proxy (it updates on each answer save).
        if (isCompleted && team.end_time) {
          lastSubmittedStr = new Date(team.end_time).toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } else if (team.current_level > 1 && team.updatedAt) {
          lastSubmittedStr = new Date(team.updatedAt).toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
      }

      return {
        team_name: team.team_name,
        leader_name: team.leader_name,
        members: team.members.join(', '),
        total_points: team.total_points,
        current_level: team.current_level >= 6 ? 'Completed' : `Level ${team.current_level}`,
        time_taken: timeTaken,
        time_formatted: timeFormatted,
        last_submitted: lastSubmittedStr
      };
    });

    // Sort same way as leaderboard
    data.sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      if (a.time_taken && b.time_taken) return a.time_taken - b.time_taken;
      if (a.time_taken && !b.time_taken) return -1;
      if (!a.time_taken && b.time_taken) return 1;
      return 0;
    });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Treasure Hunt Platform';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Leaderboard Results');

    // Define columns
    worksheet.columns = [
      { header: 'Rank', key: 'rank', width: 8 },
      { header: 'Team Name', key: 'team_name', width: 25 },
      { header: 'Leader Name', key: 'leader_name', width: 20 },
      { header: 'Members', key: 'members', width: 40 },
      { header: 'Points', key: 'total_points', width: 12 },
      { header: 'Status', key: 'current_level', width: 15 },
      { header: 'Time Taken', key: 'time_formatted', width: 18 },
      { header: 'Last Submitted at', key: 'last_submitted', width: 22 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD4A843' }
    };

    // Add data rows
    data.forEach((entry, index) => {
      worksheet.addRow({
        rank: index + 1,
        team_name: entry.team_name,
        leader_name: entry.leader_name,
        members: entry.members,
        total_points: entry.total_points,
        current_level: entry.current_level,
        time_formatted: entry.time_formatted,
        last_submitted: entry.last_submitted
      });
    });

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=treasure-hunt-results.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: 'Server error exporting Excel' });
  }
};

module.exports = { exportExcel };
