const express = require('express');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { CompanyNotificationSetting } = require('../models');

const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

const sanitizePayload = (payload = {}) => {
  const weeklyDay = payload.weekly_day_of_week == null ? null : Number(payload.weekly_day_of_week);
  const monthlyDay = payload.monthly_day_of_month == null ? null : Number(payload.monthly_day_of_month);

  return {
    enabledWeekly: Boolean(payload.enabled_weekly),
    weeklyDayOfWeek: weeklyDay,
    weeklyTimeHhmm: String(payload.weekly_time_hhmm || '09:00'),
    enabledMonthly: Boolean(payload.enabled_monthly),
    monthlyDayOfMonth: monthlyDay,
    monthlyTimeHhmm: String(payload.monthly_time_hhmm || '09:00'),
    timezone: String(payload.timezone || 'Asia/Kolkata')
  };
};

const validatePayload = (input) => {
  const errors = [];

  if (input.enabledWeekly) {
    if (!Number.isInteger(input.weeklyDayOfWeek) || input.weeklyDayOfWeek < 1 || input.weeklyDayOfWeek > 7) {
      errors.push('weekly_day_of_week must be between 1 and 7');
    }
    if (!TIME_PATTERN.test(input.weeklyTimeHhmm)) {
      errors.push('weekly_time_hhmm must be HH:MM (24h)');
    }
  }

  if (input.enabledMonthly) {
    if (!Number.isInteger(input.monthlyDayOfMonth) || input.monthlyDayOfMonth < 1 || input.monthlyDayOfMonth > 28) {
      errors.push('monthly_day_of_month must be between 1 and 28');
    }
    if (!TIME_PATTERN.test(input.monthlyTimeHhmm)) {
      errors.push('monthly_time_hhmm must be HH:MM (24h)');
    }
  }

  if (!input.timezone) {
    errors.push('timezone is required');
  }

  return errors;
};

router.get('/', authenticate, requireCompany, async (req, res) => {
  try {
    const setting = await CompanyNotificationSetting.findByPk(req.companyId);
    const data = setting ? {
      enabled_weekly: setting.enabledWeekly,
      weekly_day_of_week: setting.weeklyDayOfWeek,
      weekly_time_hhmm: setting.weeklyTimeHhmm,
      enabled_monthly: setting.enabledMonthly,
      monthly_day_of_month: setting.monthlyDayOfMonth,
      monthly_time_hhmm: setting.monthlyTimeHhmm,
      timezone: setting.timezone
    } : {
      enabled_weekly: false,
      weekly_day_of_week: 1,
      weekly_time_hhmm: '09:00',
      enabled_monthly: false,
      monthly_day_of_month: 1,
      monthly_time_hhmm: '09:00',
      timezone: 'Asia/Kolkata'
    };

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', authenticate, requireCompany, async (req, res) => {
  try {
    const payload = sanitizePayload(req.body || {});
    const errors = validatePayload(payload);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: errors.join(', ') });
    }

    const existing = await CompanyNotificationSetting.findByPk(req.companyId);
    if (existing) {
      await existing.update({
        enabledWeekly: payload.enabledWeekly,
        weeklyDayOfWeek: payload.enabledWeekly ? payload.weeklyDayOfWeek : null,
        weeklyTimeHhmm: payload.weeklyTimeHhmm,
        enabledMonthly: payload.enabledMonthly,
        monthlyDayOfMonth: payload.enabledMonthly ? payload.monthlyDayOfMonth : null,
        monthlyTimeHhmm: payload.monthlyTimeHhmm,
        timezone: payload.timezone
      });
    } else {
      await CompanyNotificationSetting.create({
        companyId: req.companyId,
        enabledWeekly: payload.enabledWeekly,
        weeklyDayOfWeek: payload.enabledWeekly ? payload.weeklyDayOfWeek : null,
        weeklyTimeHhmm: payload.weeklyTimeHhmm,
        enabledMonthly: payload.enabledMonthly,
        monthlyDayOfMonth: payload.enabledMonthly ? payload.monthlyDayOfMonth : null,
        monthlyTimeHhmm: payload.monthlyTimeHhmm,
        timezone: payload.timezone
      });
    }

    return res.json({ success: true, message: 'Notification settings updated' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
