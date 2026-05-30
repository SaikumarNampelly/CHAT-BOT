const express = require('express');
const authMiddleware = require('../middleware/auth');
const supabase = require('../services/supabase');

const router = express.Router();

// All routes require auth
router.use(authMiddleware);

// ─── GET /api/companions — list user's companions ─────────────
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('companions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/companions — create a new companion ────────────
router.post('/', async (req, res) => {
  try {
    const { companion_name, role, scenario, language } = req.body;

    if (!companion_name || !role) {
      return res.status(400).json({ error: 'companion_name and role are required.' });
    }

    const validRoles = [
      'friend', 'best_friend', 'girlfriend', 'boyfriend', 'mentor', 'study_buddy', 'gaming_buddy', 'motivator',
      'female', 'male', 'other'
    ];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('companions')
      .insert({
        user_id: req.user.id,
        companion_name,
        role,
        scenario: scenario || '',
        language: language || 'telugu',
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/companions/:id — delete companion + history ──
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('companions')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
