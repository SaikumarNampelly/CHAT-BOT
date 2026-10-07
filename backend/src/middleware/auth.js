const jwt = require('jsonwebtoken');
const supabase = require('../services/supabase');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — no token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Re-fetch user from DB — always use fresh name, not stale JWT payload
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', decoded.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116' || !user) {
        return res.status(401).json({ error: 'Unauthorized — user does not exist in database' });
      }
      console.warn('⚠️ Supabase user lookup warning, using decoded token:', error.message);
      req.user = decoded;
      return next();
    }

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized — user does not exist in database' });
    }

    // Merge decoded JWT with fresh DB values — DB name/email always wins
    req.user = { ...decoded, name: user.name, email: user.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized — invalid or expired token' });
  }
};
