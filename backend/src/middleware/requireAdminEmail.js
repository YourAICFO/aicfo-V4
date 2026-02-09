const requireAdminEmail = (req, res, next) => {
  const allowlist = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  const email = (req.user?.email || '').toLowerCase();
  if (!email || allowlist.length === 0 || !allowlist.includes(email)) {
    return res.status(403).json({ success: false, error: 'Admin access only' });
  }
  return next();
};

module.exports = { requireAdminEmail };
