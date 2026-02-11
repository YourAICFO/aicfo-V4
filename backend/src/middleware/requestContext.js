const { v4: uuidv4 } = require('uuid');
const { childLogger } = require('../utils/logger');

const requestContext = (req, res, next) => {
  const runId = uuidv4();
  req.run_id = runId;
  res.setHeader('x-run-id', runId);

  const base = {
    run_id: runId,
    route: req.originalUrl,
    method: req.method,
    ip: req.ip
  };

  if (req.user?.id) base.user_id = req.user.id;
  if (req.companyId) base.company_id = req.companyId;
  if (req.company?.id) base.company_id = req.company.id;

  req.log = childLogger(base);
  next();
};

module.exports = { requestContext };
