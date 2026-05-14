const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const cron = require('node-cron');
const { google } = require('googleapis');

// --- GOOGLE CALENDAR CONFIG (Placeholder for Step 5) ---
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URL
);

// Function to sync task/activity to Google Calendar
const syncToGoogleCalendar = async (taskData, userTokens) => {
  try {
    oauth2Client.setCredentials(userTokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    // Yahan calendar event create karne ka logic aayega
    console.log('Syncing to Google Calendar...');
  } catch (err) {
    console.log('Calendar Sync Error:', err.message);
  }
};

// --- DAILY REMINDERS CRON JOB ---
// Ye roz subah 9 baje sabko unki pending activities ka mail bhejega
cron.schedule('0 9 * * *', async () => {
  try {
    console.log('Running Daily Reminder Cron...');
    // Logic: Database se aaj ki activities uthao aur sabko mail bhej do
  } catch (err) {
    console.error('Cron Error:', err.message);
  }
});

const sendWelcomeEmail = async (email, name, password = null, role = null) => {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const roleLabel = {
      owner: 'Owner',
      sales_head: 'Sales Head',
      manager: 'Sales Manager',
      inside_sales: 'Inside Sales',
      employee: 'Sales Executive',
    }[role] || role || 'Team Member';

    const credentialsBlock = password ? `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e2e8f0">
          <span style="color:#64748b;font-size:13px">Email</span><br>
          <strong style="color:#1e293b;font-size:15px">${email}</strong>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e2e8f0">
          <span style="color:#64748b;font-size:13px">Password</span><br>
          <strong style="color:#1e293b;font-size:15px;font-family:monospace">${password}</strong>
        </td>
      </tr>` : '';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#1e3a8a;padding:32px 40px;text-align:center">
            <h1 style="margin:0;color:#ffffff;font-size:24px;letter-spacing:1px">CCENTRIK CRM</h1>
            <p style="margin:6px 0 0;color:#93c5fd;font-size:13px">Sales Management Platform</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px">Welcome, ${name}!</h2>
            <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6">
              Your CCENTRIK CRM account has been set up. You can now access the platform and start managing your leads and sales pipeline.
            </p>

            <!-- Role Badge -->
            <p style="margin:0 0 20px">
              <span style="background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:bold;padding:4px 12px;border-radius:20px;border:1px solid #bfdbfe">${roleLabel}</span>
            </p>

            <!-- Credentials Box -->
            ${password ? `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px">
              <p style="margin:0 0 14px;color:#374151;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px">Your Login Details</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${credentialsBlock}
              </table>
            </div>` : ''}

            <!-- CTA Button -->
            <div style="text-align:center;margin:28px 0">
              <a href="https://ccentrik-crm-8a84c.web.app/login"
                 style="background:#1e3a8a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:bold;display:inline-block">
                Login to CCENTRIK CRM
              </a>
            </div>

            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6">
              If you have any questions, contact your administrator.<br>
              Please keep your login credentials safe and do not share them.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center">
            <p style="margin:0;color:#94a3b8;font-size:12px">
              This is an automated message from CCENTRIK CRM.<br>
              CCENTRIK &bull; India
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const text = `Welcome to CCENTRIK CRM, ${name}!

Your account has been created.
Role: ${roleLabel}
${password ? `Email: ${email}\nPassword: ${password}\n` : ''}
Login at: https://ccentrik-crm-8a84c.web.app/login

Keep your credentials safe.
- CCENTRIK CRM Team`;

    await resend.emails.send({
      from: 'CCENTRIK CRM <onboarding@resend.dev>',
      to: email,
      subject: 'Your CCENTRIK CRM account is ready',
      text,
      html,
    });
    console.log('✅ Welcome email sent to:', email);
  } catch (err) {
    console.log('❌ Email error:', err.message);
  }
};

// --- REST OF YOUR ORIGINAL FUNCTIONS (NO LOGIC CHANGE) ---

const register = async (req, res) => {
  const { name, email, password, role, manager_id } = req.body;
  try {
    if (!email.toLowerCase().endsWith('@ccentrik.com')) {
      return res.status(400).json({ message: 'Only @ccentrik.com emails are allowed!' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, manager_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role`,
      [name, email, hashedPassword, role, manager_id || null]
    );
    sendWelcomeEmail(email, name, password, role).catch(e => console.error('Email:', e.message));
    res.status(201).json({ message: 'User created successfully!', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'User not found' });
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({
      message: 'Login successful!',
      token,
      user: { id: user.id, name: user.name, role: user.role, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, manager_id, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, manager_id, password } = req.body;
  try {
    if (email && !email.toLowerCase().endsWith('@ccentrik.com')) {
        return res.status(400).json({ message: 'Only @ccentrik.com emails are allowed!' });
    }
    let query, params;
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = `UPDATE users SET name=$1, email=$2, role=$3, manager_id=$4, password=$5 WHERE id=$6 RETURNING id, name, email, role, manager_id`;
      params = [name, email, role, manager_id || null, hashedPassword, id];
    } else {
      query = `UPDATE users SET name=$1, email=$2, role=$3, manager_id=$4 WHERE id=$5 RETURNING id, name, email, role, manager_id`;
      params = [name, email, role, manager_id || null, id];
    }
    const result = await pool.query(query, params);
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User updated successfully!', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account!' });
    }
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userResult.rows.length > 0 && userResult.rows[0].role === 'owner') {
      return res.status(403).json({ message: 'Owner account cannot be deleted!' });
    }
    await pool.query('UPDATE leads SET assigned_to = NULL WHERE assigned_to = $1', [id]);
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully and leads unassigned!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const firebaseLogin = async (req, res) => {
  const { email, name, uid } = req.body;
  try {
    if (!email.toLowerCase().endsWith('@ccentrik.com')) {
        return res.status(403).json({ message: 'Access denied. Use @ccentrik.com email.' });
    }
    let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user;
    if (result.rows.length === 0) {
      const newUser = await pool.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, 'employee') RETURNING id, name, email, role`,
        [name, email, uid] 
      );
      user = newUser.rows[0];
      sendWelcomeEmail(email, name).catch(e => console.error('Email:', e.message));
    } else {
      user = result.rows[0];
    }
    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({
      message: 'Login successful!',
      token,
      user: { id: user.id, name: user.name, role: user.role, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { register, login, getAllUsers, updateUser, deleteUser, firebaseLogin };