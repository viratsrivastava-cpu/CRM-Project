const pool = require('../config/db');

const getAnalytics = async (req, res) => {
  try {
    // Total Leads
    const totalLeads = await pool.query('SELECT COUNT(*) FROM leads');

    // Leads by Status
    const leadsByStatus = await pool.query(
      `SELECT status, COUNT(*) as count FROM leads GROUP BY status`
    );

    // Total Deals + Revenue
    const dealStats = await pool.query(
      `SELECT COUNT(*) as total_deals, 
              SUM(amount) as total_revenue,
              COUNT(CASE WHEN stage = 'won' THEN 1 END) as won_deals,
              COUNT(CASE WHEN stage = 'lost' THEN 1 END) as lost_deals
       FROM deals`
    );

    // Conversion Rate
    const totalLeadsCount = parseInt(totalLeads.rows[0].count);
    const wonDeals = parseInt(dealStats.rows[0].won_deals);
    const conversionRate = totalLeadsCount > 0
      ? ((wonDeals / totalLeadsCount) * 100).toFixed(2)
      : 0;

    // Employee Performance
    const employeePerformance = await pool.query(
      `SELECT users.name, 
              COUNT(leads.id) as total_leads,
              COUNT(CASE WHEN leads.status = 'converted' THEN 1 END) as converted_leads
       FROM users
       LEFT JOIN leads ON leads.assigned_to = users.id
       WHERE users.role = 'employee'
       GROUP BY users.name
       ORDER BY total_leads DESC`
    );

    // Monthly Leads (last 6 months)
    const monthlyLeads = await pool.query(
      `SELECT TO_CHAR(created_at, 'Mon YYYY') as month,
              COUNT(*) as count
       FROM leads
       WHERE created_at >= NOW() - INTERVAL '6 months'
       GROUP BY month, DATE_TRUNC('month', created_at)
       ORDER BY DATE_TRUNC('month', created_at)`
    );

    res.json({
      total_leads: totalLeadsCount,
      leads_by_status: leadsByStatus.rows,
      deal_stats: dealStats.rows[0],
      conversion_rate: `${conversionRate}%`,
      employee_performance: employeePerformance.rows,
      monthly_leads: monthlyLeads.rows
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getAnalytics };