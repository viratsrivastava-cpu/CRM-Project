const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cron = require('node-cron'); // Added for daily reminders
const { google } = require('googleapis'); // Added for Calendar Sync

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

const sendWelcomeEmail = async (email, name) => {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: { rejectUnauthorized: false }
    });
    
    await transporter.verify();
    await transporter.sendMail({
      from: `"CCENTRIK CRM" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎉 Welcome to CCENTRIK CRM!',
      // Anti-Spam Headers
      headers: { 'X-Priority': '1', 'X-MSMail-Priority': 'High' }, 
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0">
          <h2 style="color:#1e3a8a">Welcome, ${name}! 🎉</h2>
          <p style="color:#475569">Your CCENTRIK CRM account has been created successfully!</p>
          <div style="background:#eff6ff;border-radius:8px;padding:16px;margin:20px 0">
            <p style="color:#1d4ed8;margin:0"><strong>Login at:</strong> <a href="https://ccentrik-crm-8a84c.web.app/login">ccentrik-crm.web.app</a></p>
          </div>
          <p style="color:#94a3b8;font-size:12px">If you didn't request this, please ignore this email.</p>
          <p style="color:#94a3b8;font-size:12px">CCENTRIK CRM Team</p>
        </div>
      `,
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
    await sendWelcomeEmail(email, name);
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
      await sendWelcomeEmail(email, name);
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