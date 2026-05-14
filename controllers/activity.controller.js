const pool = require('../config/db');

const ACTIVITY_TYPES = ['call', 'meeting', 'follow_up', 'visit', 'virtual_meeting', 'phone_call', 'email', 'note'];

const createActivity = async (req, res) => {
  const { lead_id, type, note, scheduled_at } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO activities (lead_id, type, note, scheduled_at, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [lead_id, type, note, scheduled_at || null, req.user.id]
    );
    res.status(201).json({ message: 'Activity created', activity: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllActivities = async (req, res) => {
  try {
    let result;
    if (req.user.role === 'owner' || req.user.role === 'sales_head') {
      result = await pool.query(
        `SELECT activities.*, leads.name as lead_name, users.name as created_by_name
         FROM activities
         LEFT JOIN leads ON activities.lead_id = leads.id
         LEFT JOIN users ON activities.created_by = users.id
         ORDER BY activities.created_at DESC`
      );
    } else {
      result = await pool.query(
        `SELECT activities.*, leads.name as lead_name, users.name as created_by_name
         FROM activities
         LEFT JOIN leads ON activities.lead_id = leads.id
         LEFT JOIN users ON activities.created_by = users.id
         WHERE activities.created_by = $1
         ORDER BY activities.created_at DESC`,
        [req.user.id]
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getActivitiesByLead = async (req, res) => {
  const { lead_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT activities.*, users.name as created_by_name
       FROM activities
       LEFT JOIN users ON activities.created_by = users.id
       WHERE activities.lead_id = $1
       ORDER BY activities.created_at DESC`,
      [lead_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateActivity = async (req, res) => {
  const { id } = req.params;
  const { type, note, scheduled_at } = req.body;
  try {
    const result = await pool.query(
      `UPDATE activities SET
        type = COALESCE($1, type),
        note = COALESCE($2, note),
        scheduled_at = COALESCE($3, scheduled_at)
       WHERE id = $4 RETURNING *`,
      [type, note, scheduled_at, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Activity not found' });
    res.json({ message: 'Activity updated', activity: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteActivity = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM activities WHERE id = $1 RETURNING *', [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Activity not found' });
    res.json({ message: 'Activity deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createActivity, getAllActivities, getActivitiesByLead, updateActivity, deleteActivity };