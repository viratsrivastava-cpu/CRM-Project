const pool = require('../config/db');

// Create Deal
const createDeal = async (req, res) => {
  const { lead_id, title, amount, stage, closing_date, assigned_to } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO deals (lead_id, title, amount, stage, closing_date, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [lead_id, title, amount, stage || 'new', closing_date, assigned_to || null]
    );
    res.status(201).json({ message: 'Deal created ✅', deal: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get All Deals (role based)
const getDeals = async (req, res) => {
  try {
    let result;
    if (req.user.role === 'owner' || req.user.role === 'sales_head') {
      result = await pool.query(
        `SELECT deals.*, users.name as assigned_name, leads.name as lead_name
         FROM deals
         LEFT JOIN users ON deals.assigned_to = users.id
         LEFT JOIN leads ON deals.lead_id = leads.id
         ORDER BY deals.created_at DESC`
      );
    } else {
      result = await pool.query(
        `SELECT deals.*, users.name as assigned_name, leads.name as lead_name
         FROM deals
         LEFT JOIN users ON deals.assigned_to = users.id
         LEFT JOIN leads ON deals.lead_id = leads.id
         WHERE deals.assigned_to = $1
         ORDER BY deals.created_at DESC`,
        [req.user.id]
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get Single Deal
const getDealById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT deals.*, users.name as assigned_name, leads.name as lead_name
       FROM deals
       LEFT JOIN users ON deals.assigned_to = users.id
       LEFT JOIN leads ON deals.lead_id = leads.id
       WHERE deals.id = $1`,
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Deal not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update Deal
const updateDeal = async (req, res) => {
  const { id } = req.params;
  const { title, amount, stage, closing_date, assigned_to } = req.body;
  try {
    const result = await pool.query(
      `UPDATE deals SET
        title = COALESCE($1, title),
        amount = COALESCE($2, amount),
        stage = COALESCE($3, stage),
        closing_date = COALESCE($4, closing_date),
        assigned_to = COALESCE($5, assigned_to)
       WHERE id = $6 RETURNING *`,
      [title, amount, stage, closing_date, assigned_to, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Deal not found' });
    res.json({ message: 'Deal updated ✅', deal: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete Deal
const deleteDeal = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM deals WHERE id = $1 RETURNING *', [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Deal not found' });
    res.json({ message: 'Deal deleted ✅' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createDeal, getDeals, getDealById, updateDeal, deleteDeal };