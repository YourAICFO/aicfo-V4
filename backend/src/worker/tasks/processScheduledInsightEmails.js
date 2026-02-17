const { Op, Sequelize } = require('sequelize');
const {
  CompanyNotificationSetting,
  EmailDelivery,
  Company,
  User,
  AIInsight
} = require('../../models');
const { buildInsights } = require('../../insights/buildInsights');

const WINDOW_MINUTES = 15;
const WEEKDAY_MAP = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

const getZoneParts = (date, timezone) => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = dtf.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAY_MAP[parts.weekday] || 1
  };
};

const toDateString = ({ year, month, day }) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const parseHhmm = (hhmm) => {
  const [h, m] = String(hhmm || '09:00').split(':').map(Number);
  return { hour: Number.isFinite(h) ? h : 9, minute: Number.isFinite(m) ? m : 0 };
};

const minutesOfDay = ({ hour, minute }) => hour * 60 + minute;

const shouldRun = (nowParts, configuredHhmm) => {
  const configured = parseHhmm(configuredHhmm);
  const delta = Math.abs(minutesOfDay(nowParts) - minutesOfDay(configured));
  return delta <= WINDOW_MINUTES;
};

const getWeekPeriod = (nowParts) => {
  const base = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day));
  const offsetToMonday = nowParts.weekday - 1;
  const start = new Date(base);
  start.setUTCDate(start.getUTCDate() - offsetToMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10)
  };
};

const getMonthPeriod = (nowParts) => {
  const start = new Date(Date.UTC(nowParts.year, nowParts.month - 1, 1));
  const end = new Date(Date.UTC(nowParts.year, nowParts.month, 0));
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10)
  };
};

const severityRank = { critical: 3, high: 2, medium: 1, low: 0 };

const getDeterministicInsights = async (companyId) => {
  const rows = await AIInsight.findAll({
    where: {
      companyId,
      isDismissed: false,
      generatedAt: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    },
    order: [['generated_at', 'DESC']],
    raw: true,
    limit: 100
  });

  return rows
    .map((row) => {
      const severity = String(row.data_points?.severity || '').toLowerCase();
      const priority = Number(row.data_points?.priority_rank || 999);
      const evidence = Array.isArray(row.data_points?.evidence) ? row.data_points.evidence : [];
      return {
        id: row.id,
        title: row.title,
        content: row.content,
        severity,
        priority,
        evidence,
        recommended: Array.isArray(row.recommendations) ? row.recommendations : []
      };
    })
    .filter((item) => ['critical', 'high'].includes(item.severity))
    .sort((a, b) => {
      const sevDelta = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      if (sevDelta !== 0) return sevDelta;
      return a.priority - b.priority;
    })
    .slice(0, 10);
};

const buildDigest = ({ companyName, digestType, periodStart, periodEnd, insights }) => {
  const subject = `[AICFO] ${digestType === 'weekly' ? 'Weekly' : 'Monthly'} Risk Digest - ${companyName}`;
  const header = `${digestType === 'weekly' ? 'Weekly' : 'Monthly'} AI CFO digest for ${companyName}\nPeriod: ${periodStart} to ${periodEnd}\n`;

  if (!insights.length) {
    return {
      subject,
      bodyText: `${header}\nNo high or critical risks in stored insights for this period.`
    };
  }

  const lines = insights.map((insight, index) => {
    const evidenceLine = insight.evidence.slice(0, 3)
      .map((item) => `${item.metric_key}=${typeof item.value === 'number' ? item.value : JSON.stringify(item.value)}`)
      .join(', ');
    const rec = insight.recommended?.[0] || 'Review this risk in AI Insights.';
    return `${index + 1}. [${insight.severity.toUpperCase()}] ${insight.title}\n   ${insight.content}\n   Evidence: ${evidenceLine || 'N/A'}\n   Action: ${rec}`;
  });

  return {
    subject,
    bodyText: `${header}\n${lines.join('\n\n')}`
  };
};

const sendEmailViaWebhook = async ({ toEmails, subject, bodyText }) => {
  const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
  if (!webhookUrl) {
    return { status: 'skipped', error: 'EMAIL_WEBHOOK_URL not configured' };
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: toEmails, subject, text: bodyText })
  });

  if (!response.ok) {
    const responseText = await response.text();
    return { status: 'failed', error: `Webhook failed (${response.status}): ${responseText.slice(0, 500)}` };
  }

  return { status: 'sent', error: null };
};

const tryCreateDelivery = async ({ companyId, type, periodStart, periodEnd, toEmailsJson, subject, bodyText, metaJson, status, sentAt }) => {
  try {
    await EmailDelivery.create({
      companyId,
      type,
      periodStart,
      periodEnd,
      toEmailsJson,
      subject,
      bodyText,
      metaJson,
      status,
      sentAt
    });
    return true;
  } catch (error) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return false;
    }
    throw error;
  }
};

const processOneSchedule = async ({ setting, type, nowParts, periodStart, periodEnd, ownerEmail, ownerId, companyName }) => {
  const companyId = setting.companyId;
  const toEmails = ownerEmail ? [ownerEmail] : [];

  const deliveryExists = await EmailDelivery.findOne({
    where: { companyId, type, periodStart, periodEnd },
    attributes: ['id'],
    raw: true
  });
  if (deliveryExists) return { status: 'skipped', reason: 'already_sent' };

  await buildInsights(companyId, ownerId, { limit: 10 });
  const insights = await getDeterministicInsights(companyId);
  const { subject, bodyText } = buildDigest({ companyName, digestType: type, periodStart, periodEnd, insights });

  if (!toEmails.length) {
    await tryCreateDelivery({
      companyId,
      type,
      periodStart,
      periodEnd,
      toEmailsJson: [],
      subject,
      bodyText,
      metaJson: { reason: 'no_recipient_email', insight_count: insights.length },
      status: 'skipped',
      sentAt: null
    });
    return { status: 'skipped', reason: 'no_recipient_email' };
  }

  const sendResult = await sendEmailViaWebhook({ toEmails, subject, bodyText });
  await tryCreateDelivery({
    companyId,
    type,
    periodStart,
    periodEnd,
    toEmailsJson: toEmails,
    subject,
    bodyText,
    metaJson: { insight_count: insights.length, send_error: sendResult.error || null },
    status: sendResult.status,
    sentAt: sendResult.status === 'sent' ? new Date() : null
  });

  return sendResult;
};

const processScheduledInsightEmails = async () => {
  const settings = await CompanyNotificationSetting.findAll({
    where: {
      [Op.or]: [{ enabledWeekly: true }, { enabledMonthly: true }]
    },
    include: [
      {
        model: Company,
        as: 'company',
        required: true,
        where: { isDeleted: false },
        include: [
          {
            model: User,
            as: 'owner',
            required: false,
            attributes: ['id', 'email']
          }
        ]
      }
    ]
  });

  const results = [];
  const now = new Date();

  for (const setting of settings) {
    const timezone = setting.timezone || 'Asia/Kolkata';
    const nowParts = getZoneParts(now, timezone);
    const companyName = setting.company?.name || 'Company';
    const ownerEmail = setting.company?.owner?.email || null;
    const ownerId = setting.company?.owner?.id || null;

    if (setting.enabledWeekly && shouldRun(nowParts, setting.weeklyTimeHhmm) && nowParts.weekday === setting.weeklyDayOfWeek) {
      const { periodStart, periodEnd } = getWeekPeriod(nowParts);
      const result = await processOneSchedule({
        setting,
        type: 'weekly',
        nowParts,
        periodStart,
        periodEnd,
        ownerEmail,
        ownerId,
        companyName
      });
      results.push({ companyId: setting.companyId, type: 'weekly', result: result.status || result.reason });
    }

    if (setting.enabledMonthly && shouldRun(nowParts, setting.monthlyTimeHhmm) && nowParts.day === setting.monthlyDayOfMonth) {
      const { periodStart, periodEnd } = getMonthPeriod(nowParts);
      const result = await processOneSchedule({
        setting,
        type: 'monthly',
        nowParts,
        periodStart,
        periodEnd,
        ownerEmail,
        ownerId,
        companyName
      });
      results.push({ companyId: setting.companyId, type: 'monthly', result: result.status || result.reason });
    }
  }

  return { processed: results.length, results };
};

module.exports = {
  processScheduledInsightEmails
};
