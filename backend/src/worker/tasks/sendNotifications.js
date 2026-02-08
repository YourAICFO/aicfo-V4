const { Notification } = require('../../models');
const { assertTrialOrActive } = require('../../services/subscriptionService');

const sendNotifications = async ({ companyId, userId, title, message, type = 'INFO', metadata = {} }) => {
  await assertTrialOrActive(companyId);
  const notification = await Notification.create({
    companyId,
    userId,
    type,
    title,
    message,
    metadata
  });

  return notification;
};

module.exports = { sendNotifications };
