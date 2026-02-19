const getAdminAllowlist = () =>
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const isAllowedAdmin = (email) => getAdminAllowlist().includes((email || '').toLowerCase());

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  const allowlist = getAdminAllowlist();
  if (allowlist.length === 0) {
    return res.status(503).json({ success: false, error: 'Admin access not configured' });
  }
  if (!isAllowedAdmin(req.user.email)) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

module.exports = { requireAdmin, isAllowedAdmin, getAdminAllowlist };
