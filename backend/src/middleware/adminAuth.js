const isAllowedAdmin = (email) => {
  const allowlist = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes((email || '').toLowerCase());
};

const requireAdmin = (req, res, next) => {
  if (!req.user || !isAllowedAdmin(req.user.email)) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

module.exports = { requireAdmin };
