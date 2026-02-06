const { Notification } = require('../../models');

const sendNotifications = async ({ companyId, userId, title, message, type = 'INFO', metadata = {} }) => {
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
