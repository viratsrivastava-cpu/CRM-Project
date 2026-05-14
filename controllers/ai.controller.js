const Groq = require('groq-sdk');
const pool = require('../config/db');

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

// Fetch CRM context based on user role
const getCRMContext = async (userId, role) => {
  try {
    let leads, deals, activities, users = [];

    if (role === 'owner' || role === 'sales_head') {
      const leadsRes = await pool.query(
        `SELECT l.*, u.name as assigned_name 
         FROM leads l LEFT JOIN users u ON l.assigned_to = u.id 
         ORDER BY l.created_at DESC LIMIT 20`
      );
      leads = leadsRes.rows;

      const dealsRes = await pool.query(
        `SELECT d.*, l.name as lead_name 
         FROM deals d LEFT JOIN leads l ON d.lead_id = l.id 
         ORDER BY d.created_at DESC LIMIT 10`
      );
      deals = dealsRes.rows;

      const usersRes = await pool.query(
        `SELECT id, name, role, email FROM users ORDER BY created_at DESC`
      );
      users = usersRes.rows;

    } else if (role === 'manager') {
      const leadsRes = await pool.query(
        `SELECT l.*, u.name as assigned_name 
         FROM leads l 
         LEFT JOIN users u ON l.assigned_to = u.id
         WHERE u.manager_id = $1 OR l.assigned_to = $1
         ORDER BY l.created_at DESC LIMIT 20`,
        [userId]
      );
      leads = leadsRes.rows;

      const dealsRes = await pool.query(
        `SELECT d.*, l.name as lead_name 
         FROM deals d 
         LEFT JOIN leads l ON d.lead_id = l.id
         WHERE d.assigned_to = $1
         ORDER BY d.created_at DESC LIMIT 10`,
        [userId]
      );
      deals = dealsRes.rows;

    } else {
      const leadsRes = await pool.query(
        `SELECT * FROM leads WHERE assigned_to = $1 ORDER BY created_at DESC LIMIT 20`,
        [userId]
      );
      leads = leadsRes.rows;

      const dealsRes = await pool.query(
        `SELECT d.*, l.name as lead_name 
         FROM deals d LEFT JOIN leads l ON d.lead_id = l.id
         WHERE d.assigned_to = $1 ORDER BY d.created_at DESC LIMIT 10`,
        [userId]
      );
      deals = dealsRes.rows;
    }

    const activitiesRes = await pool.query(
      `SELECT a.*, l.name as lead_name 
       FROM activities a LEFT JOIN leads l ON a.lead_id = l.id
       WHERE a.created_by = $1 ORDER BY a.created_at DESC LIMIT 10`,
      [userId]
    );
    activities = activitiesRes.rows;

    // Stats
    const statsRes = await pool.query(
      `SELECT 
        COUNT(*) as total_leads,
        COUNT(CASE WHEN status = 'qualified' THEN 1 END) as hot_leads,
        COUNT(CASE WHEN status = 'contacted' THEN 1 END) as warm_leads,
        COUNT(CASE WHEN status = 'new' THEN 1 END) as cold_leads,
        COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_leads,
        COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost_leads
       FROM leads ${role === 'employee' ? 'WHERE assigned_to = $1' : ''}`,
      role === 'employee' ? [userId] : []
    );

    const followupRes = await pool.query(
      `SELECT * FROM leads 
       WHERE follow_up_date::date = CURRENT_DATE 
       AND status NOT IN ('converted', 'lost')
       ${role === 'employee' ? 'AND assigned_to = $1' : ''}
       ORDER BY priority DESC`,
      role === 'employee' ? [userId] : []
    );

    return {
      leads: leads || [],
      deals: deals || [],
      activities: activities || [],
      users: users || [],
      stats: statsRes.rows[0] || {},
      todayFollowups: followupRes.rows || [],
    };
  } catch (err) {
    console.error('CRM Context error:', err);
    return { leads: [], deals: [], activities: [], users: [], stats: {}, todayFollowups: [] };
  }
};

// Execute AI actions
const executeAction = async (action, userId, role) => {
  try {
    if (action.type === 'create_lead') {
      const { name, phone, email, company, source, temperature, remarks } = action.data;
      const result = await pool.query(
        `INSERT INTO leads (name, phone, email, company, source, temperature, remarks, assigned_to, created_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, 'new') RETURNING *`,
        [name, phone, email || null, company || null, source || 'other',
         temperature || 'Warm', remarks || 'Created via AI Assistant', userId]
      );
      return { success: true, message: `Lead created for ${name}!`, data: result.rows[0] };
    }

    if (action.type === 'create_activity') {
      const { lead_id, type, note, scheduled_at } = action.data;
      const result = await pool.query(
        `INSERT INTO activities (lead_id, type, note, scheduled_at, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [lead_id, type || 'follow_up', note, scheduled_at || null, userId]
      );
      return { success: true, message: `Activity logged successfully!`, data: result.rows[0] };
    }

    if (action.type === 'update_lead_status') {
      const { lead_id, status } = action.data;
      const result = await pool.query(
        `UPDATE leads SET status = $1 WHERE id = $2 RETURNING *`,
        [status, lead_id]
      );
      return { success: true, message: `Lead status updated to ${status}!`, data: result.rows[0] };
    }

    return { success: false, message: 'Unknown action type' };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

const chat = async (req, res) => {
  const { message, history = [] } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;
  const userName = req.user.name;

  try {
    // Get live CRM data
    const crmData = await getCRMContext(userId, userRole);

    const systemPrompt = `You are CCENTRIK AI, an intelligent CRM assistant for CCENTRIK company. You have direct access to live CRM data.

CURRENT USER:
- Name: ${userName}
- Role: ${userRole}
- User ID: ${userId}

LIVE CRM DATA:
Stats: ${JSON.stringify(crmData.stats)}
Today's Follow-ups: ${JSON.stringify(crmData.todayFollowups)}
Recent Leads (last 20): ${JSON.stringify(crmData.leads)}
Recent Deals: ${JSON.stringify(crmData.deals)}
Recent Activities: ${JSON.stringify(crmData.activities)}
${userRole !== 'employee' ? `Team Members: ${JSON.stringify(crmData.users)}` : ''}

YOUR CAPABILITIES:
1. Answer questions about CRM data
2. Create leads — respond with JSON action
3. Log activities — respond with JSON action
4. Update lead status — respond with JSON action
5. Give sales insights and recommendations

ROLE PERMISSIONS:
- owner/sales_head: Full access — all leads, deals, users
- manager: Team leads and deals only
- employee: Own leads and activities only

RESPONSE FORMAT:
- For normal answers: Reply in clear, professional English
- For actions (create/update): Include a JSON block like:
  \`\`\`action
  {"type": "create_lead", "data": {"name": "John", "phone": "9876543210", "source": "website"}}
  \`\`\`
  OR
  \`\`\`action
  {"type": "create_activity", "data": {"lead_id": 1, "type": "call", "note": "Called John"}}
  \`\`\`
  OR
  \`\`\`action
  {"type": "update_lead_status", "data": {"lead_id": 1, "status": "contacted"}}
  \`\`\`

IMPORTANT:
- Always be helpful, concise and professional
- Use actual data from the CRM context provided
- Give specific insights based on real numbers
- Today's date: ${new Date().toLocaleDateString('en-IN')}`;

    const messages = [
      ...history.slice(-6).map(h => ({ role: h.role, content: h.text })),
      { role: 'user', content: message }
    ];

    if (!groq) {
      return res.status(503).json({ message: 'AI service unavailable: GROQ_API_KEY missing' });
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content || 'Sorry, I could not process that.';

    // Check for action in response
    const actionMatch = aiResponse.match(/```action\n([\s\S]*?)\n```/);
    let actionResult = null;

    if (actionMatch) {
      try {
        const action = JSON.parse(actionMatch[1]);
        actionResult = await executeAction(action, userId, userRole);
      } catch (err) {
        console.error('Action parse error:', err);
      }
    }

    // Clean response — remove action block
    const cleanResponse = aiResponse.replace(/```action\n[\s\S]*?\n```/g, '').trim();

    res.json({
      message: cleanResponse,
      actionResult,
      usage: completion.usage,
    });

  } catch (err) {
    console.error('AI Error:', err);
    res.status(500).json({ message: 'AI service error: ' + err.message });
  }
};

module.exports = { chat };