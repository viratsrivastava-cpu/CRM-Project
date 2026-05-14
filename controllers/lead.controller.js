const pool = require('../config/db');

// Fields whose changes are recorded as system audit activities
const TRACKED_FIELDS = [
  { key: 'status',         label: 'Status' },
  { key: 'temperature',    label: 'Stage' },
  { key: 'priority',       label: 'Priority' },
  { key: 'assigned_to',    label: 'Assigned To' },
  { key: 'follow_up_date', label: 'Follow-up Date' },
];

const writeAuditActivity = async (leadId, userId, label, oldVal, newVal) => {
  try {
    await pool.query(
      `INSERT INTO activities (lead_id, type, note, created_by)
       VALUES ($1, 'system_update', $2, $3)`,
      [leadId, `${label}: "${oldVal ?? '—'}" → "${newVal ?? '—'}"`, userId]
    );
  } catch (err) {
    console.error('Audit write failed:', err.message);
  }
};

// Create Lead
const createLead = async (req, res) => {
  const {
    name, phone, email, company, company_website, company_linkedin,
    city, state, budget, product_interest, source, temperature,
    priority, remarks, other, follow_up_date, assigned_to
  } = req.body;
  try {
    // Employee can only self-assign. Inside Sales / Manager / Sales Head / Owner can pick.
    const finalAssignedTo = req.user.role === 'employee'
      ? req.user.id
      : (assigned_to || req.user.id);

    // Inside Sales: if explicitly assigning to someone else, must be upward (manager/sales_head)
    if (req.user.role === 'inside_sales' && assigned_to && parseInt(assigned_to) !== req.user.id) {
      const target = await pool.query('SELECT role FROM users WHERE id = $1', [assigned_to]);
      const role = target.rows[0]?.role;
      if (role && !['manager', 'sales_head'].includes(role)) {
        return res.status(403).json({
          message: 'Inside Sales can only assign leads upward (Sales Manager or Sales Head)'
        });
      }
    }

    const inserted = await pool.query(
      `INSERT INTO leads (
         name, phone, email, company, company_website, company_linkedin,
         city, state, budget, product_interest, source, temperature,
         priority, remarks, other, follow_up_date, assigned_to, created_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
       ) RETURNING *`,
      [
        name, phone, email || null, company || null,
        company_website || null, company_linkedin || null,
        city || null, state || null, budget || null,
        product_interest || null, source || 'other',
        temperature || 'Warm', priority || 'medium',
        remarks || null, other || null, follow_up_date || null,
        finalAssignedTo, req.user.id
      ]
    );
    const lead = inserted.rows[0];

    // Generate human-readable Lead ID (LEAD-00001 style)
    const leadCode = 'LEAD-' + String(lead.id).padStart(5, '0');
    const finalized = await pool.query(
      `UPDATE leads SET lead_code = $1 WHERE id = $2 RETURNING *`,
      [leadCode, lead.id]
    );

    // Seed history: creation event
    await writeAuditActivity(lead.id, req.user.id, 'Lead', null, 'Created');

    res.status(201).json({ message: 'Lead created successfully!', lead: finalized.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get All Leads (role based)
const getLeads = async (req, res) => {
  try {
    let result;
    if (req.user.role === 'owner' || req.user.role === 'sales_head') {
      result = await pool.query(
        `SELECT leads.*, users.name as assigned_name
         FROM leads
         LEFT JOIN users ON leads.assigned_to = users.id
         ORDER BY leads.created_at DESC`
      );
    } else if (req.user.role === 'manager') {
      result = await pool.query(
        `SELECT leads.*, users.name as assigned_name
         FROM leads
         LEFT JOIN users ON leads.assigned_to = users.id
         WHERE users.manager_id = $1 OR leads.assigned_to = $1
         ORDER BY leads.created_at DESC`,
        [req.user.id]
      );
    } else {
      // inside_sales + employee — only leads assigned to them
      result = await pool.query(
        `SELECT leads.*, users.name as assigned_name
         FROM leads
         LEFT JOIN users ON leads.assigned_to = users.id
         WHERE leads.assigned_to = $1
         ORDER BY leads.created_at DESC`,
        [req.user.id]
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get Single Lead
const getLeadById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT leads.*, users.name as assigned_name
       FROM leads
       LEFT JOIN users ON leads.assigned_to = users.id
       WHERE leads.id = $1`,
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Lead not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update Lead — covers all editable fields and writes audit rows for tracked changes
const updateLead = async (req, res) => {
  const { id } = req.params;
  const {
    name, phone, email, company, company_website, company_linkedin,
    city, state, budget, product_interest, source, status,
    temperature, priority, remarks, other, follow_up_date, assigned_to
  } = req.body;
  try {
    const before = await pool.query('SELECT * FROM leads WHERE id = $1', [id]);
    if (before.rows.length === 0)
      return res.status(404).json({ message: 'Lead not found' });
    const old = before.rows[0];

    // Inside Sales: re-assignment only allowed upward (manager / sales_head) or to self
    if (req.user.role === 'inside_sales' && assigned_to
        && parseInt(assigned_to) !== req.user.id
        && parseInt(assigned_to) !== old.assigned_to) {
      const target = await pool.query('SELECT role FROM users WHERE id = $1', [assigned_to]);
      const role = target.rows[0]?.role;
      if (role && !['manager', 'sales_head'].includes(role)) {
        return res.status(403).json({
          message: 'Inside Sales can only assign leads upward (Sales Manager or Sales Head)'
        });
      }
    }

    const result = await pool.query(
      `UPDATE leads SET
        name             = COALESCE($1,  name),
        phone            = COALESCE($2,  phone),
        email            = COALESCE($3,  email),
        company          = COALESCE($4,  company),
        company_website  = COALESCE($5,  company_website),
        company_linkedin = COALESCE($6,  company_linkedin),
        city             = COALESCE($7,  city),
        state            = COALESCE($8,  state),
        budget           = COALESCE($9,  budget),
        product_interest = COALESCE($10, product_interest),
        source           = COALESCE($11, source),
        status           = COALESCE($12, status),
        temperature      = COALESCE($13, temperature),
        priority         = COALESCE($14, priority),
        remarks          = COALESCE($15, remarks),
        other            = COALESCE($16, other),
        follow_up_date   = COALESCE($17, follow_up_date),
        assigned_to      = COALESCE($18, assigned_to)
       WHERE id = $19 RETURNING *`,
      [
        name, phone, email, company, company_website, company_linkedin,
        city, state, budget, product_interest, source, status,
        temperature, priority, remarks, other, follow_up_date,
        assigned_to, id
      ]
    );
    const updated = result.rows[0];

    // Audit: record one activity per tracked field change
    for (const f of TRACKED_FIELDS) {
      const a = old[f.key];
      const b = updated[f.key];
      if (String(a ?? '') !== String(b ?? '')) {
        await writeAuditActivity(id, req.user.id, f.label, a, b);
      }
    }

    res.json({ message: 'Lead updated ✅', lead: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete Lead
const deleteLead = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM leads WHERE id = $1 RETURNING *', [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Lead not found' });
    res.json({ message: 'Lead deleted ✅' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Bulk Create
const bulkCreateLeads = async (req, res) => {
  const { leads } = req.body;
  if (!leads || !Array.isArray(leads))
    return res.status(400).json({ message: 'Invalid data format!' });

  const results = { success: 0, failed: 0, errors: [] };

  for (const lead of leads) {
    try {
      const finalAssignedTo = req.user.role === 'employee'
        ? req.user.id
        : (lead.assigned_to || req.user.id);

      const ins = await pool.query(
        `INSERT INTO leads (
           name, phone, email, company, company_website, company_linkedin,
           city, state, budget, product_interest, source, temperature,
           priority, remarks, assigned_to, created_by
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
         ) RETURNING id`,
        [
          lead.name, lead.phone, lead.email || null,
          lead.company || null,
          lead.company_website || null, lead.company_linkedin || null,
          lead.city || null, lead.state || null,
          lead.budget || null, lead.product_interest || null,
          lead.source || 'other', lead.temperature || 'Warm',
          lead.priority || 'medium', lead.remarks || 'Bulk uploaded',
          finalAssignedTo, req.user.id
        ]
      );
      const newId = ins.rows[0].id;
      const code = 'LEAD-' + String(newId).padStart(5, '0');
      await pool.query('UPDATE leads SET lead_code = $1 WHERE id = $2', [code, newId]);

      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push(`Row ${results.success + results.failed}: ${err.message}`);
    }
  }

  res.json({
    message: `${results.success} leads uploaded successfully!`,
    ...results
  });
};

module.exports = { createLead, getLeads, getLeadById, updateLead, deleteLead, bulkCreateLeads };
