const express = require('express');
const authMiddleware = require('../middleware/auth');
const supabase = require('../services/supabase');
const { streamGeminiResponse } = require('../services/gemini');

const router = express.Router();

router.use(authMiddleware);

// ─── GET /api/chat/history/:companionId ───────────────────────
router.get('/history/:companionId', async (req, res) => {
  try {
    const { companionId } = req.params;

    // Verify companion belongs to this user
    const { data: companion } = await supabase
      .from('companions')
      .select('id')
      .eq('id', companionId)
      .eq('user_id', req.user.id)
      .single();

    if (!companion) return res.status(403).json({ error: 'Access denied.' });

    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, role, content, mood, created_at')
      .eq('companion_id', companionId)
      .eq('user_id', req.user.id)
      .neq('content', '__GREETING_IN_PROGRESS__')
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/chat/message — SSE Streaming ───────────────────
router.post('/message', async (req, res) => {
  const { companionId, message, mood } = req.body;

  if (!companionId || !message) {
    return res.status(400).json({ error: 'companionId and message are required.' });
  }

  try {
    // Fetch companion
    const { data: companion, error: cErr } = await supabase
      .from('companions')
      .select('*')
      .eq('id', companionId)
      .eq('user_id', req.user.id)
      .single();

    if (cErr || !companion) return res.status(403).json({ error: 'Companion not found.' });

    // Fetch last 20 messages for context
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('companion_id', companionId)
      .order('created_at', { ascending: false })
      .limit(20);

    const reversedHistory = (history || []).reverse();

    // Save user message
    await supabase.from('messages').insert({
      companion_id: companionId,
      user_id: req.user.id,
      role: 'user',
      content: message,
      mood: mood || null,
    });

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let fullResponse = '';

    // Stream Gemini response
    await streamGeminiResponse(
      {
        companionName: companion.companion_name,
        role: companion.role,
        scenario: companion.scenario,
        language: companion.language,
        mood: mood || null,
        userName: req.user.name,
        history: reversedHistory,
        userMessage: message,
        userGender: req.body.userGender || 'male',
        assistantGender: req.body.assistantGender || 'other',
      },
      (chunk) => {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
    );

    // Save assistant message
    await supabase.from('messages').insert({
      companion_id: companionId,
      user_id: req.user.id,
      role: 'assistant',
      content: fullResponse,
      mood: mood || null,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Chat error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

// ─── POST /api/chat/greet/:companionId — auto first message ──
router.post('/greet/:companionId', async (req, res) => {
  const { companionId } = req.params;
  try {
    const { data: companion, error: cErr } = await supabase
      .from('companions')
      .select('*')
      .eq('id', companionId)
      .eq('user_id', req.user.id)
      .single();

    if (cErr || !companion) return res.status(403).json({ error: 'Companion not found.' });

    // Check if any messages already exist — don't double-greet
    const { data: existing } = await supabase
      .from('messages')
      .select('id')
      .eq('companion_id', companionId)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(200).json({ skipped: true });
    }

    // Immediately insert placeholder message to prevent duplicate triggers
    const { data: placeholder, error: pErr } = await supabase
      .from('messages')
      .insert({
        companion_id: companionId,
        user_id: req.user.id,
        role: 'assistant',
        content: '__GREETING_IN_PROGRESS__',
      })
      .select()
      .single();

    if (pErr) throw pErr;

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let fullResponse = '';

    try {
      await streamGeminiResponse(
        {
          companionName: companion.companion_name,
          role: companion.role,
          scenario: companion.scenario,
          language: companion.language,
          mood: null,
          userName: req.user.name,
          history: [],
          userMessage: '__GREET__',
        },
        (chunk) => {
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }
      );

      // Save the greeting by updating the placeholder
      await supabase
        .from('messages')
        .update({ content: fullResponse })
        .eq('id', placeholder.id);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (streamErr) {
      // Clean up placeholder if stream failed
      await supabase
        .from('messages')
        .delete()
        .eq('id', placeholder.id);
      throw streamErr;
    }
    } catch (err) {
      console.error('Greet error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
    }
  });

  // ─── DELETE /api/chat/history/:companionId — clear history ────
  router.delete('/history/:companionId', async (req, res) => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('companion_id', req.params.companionId)
        .eq('user_id', req.user.id);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  module.exports = router;
