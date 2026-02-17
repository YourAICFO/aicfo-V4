const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authenticate, requireCompany } = require('../middleware/auth');
const { BillingPlan, CompanySubscription, Invoice, Company, UserBillingProfile } = require('../models');

const jsonSafe = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
};

const callRazorpay = async (path, method, body) => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials are not configured');
  }

  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await jsonSafe(response);
  if (!response.ok) {
    throw new Error(data?.error?.description || data?.error?.message || `Razorpay request failed (${response.status})`);
  }
  return data;
};

const mapGatewayStatus = (status) => {
  switch (String(status || '').toLowerCase()) {
    case 'active':
      return 'active';
    case 'pending':
    case 'authenticated':
      return 'trialing';
    case 'halted':
    case 'pending_cancel':
      return 'past_due';
    case 'cancelled':
    case 'completed':
      return 'canceled';
    default:
      return 'past_due';
  }
};

const toDate = (unixTs) => (unixTs ? new Date(Number(unixTs) * 1000) : null);

const resolvePlanGatewayId = (planCode, featuresJson) => {
  if (featuresJson && typeof featuresJson === 'object' && featuresJson.gatewayPlanId) {
    return featuresJson.gatewayPlanId;
  }
  const envKey = `RAZORPAY_PLAN_ID_${String(planCode || '').toUpperCase()}`;
  return process.env[envKey] || null;
};

const verifyWebhookSignature = (rawBody, signature, secret) => {
  if (!rawBody || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const getActiveCompanySubscription = async (companyId) => {
  return CompanySubscription.findOne({
    where: { companyId },
    order: [['updatedAt', 'DESC']]
  });
};

const getOrCreateUserBillingProfile = async (userId) => {
  let profile = await UserBillingProfile.findOne({ where: { userId } });
  if (!profile) {
    profile = await UserBillingProfile.create({ userId, hasUsedTrial: false });
  }
  return profile;
};

router.get('/status', authenticate, requireCompany, async (req, res) => {
  try {
    const [subscription, invoices, trialProfile] = await Promise.all([
      getActiveCompanySubscription(req.companyId),
      Invoice.findAll({
        where: { companyId: req.companyId },
        order: [['issuedAt', 'DESC']],
        limit: 10
      }),
      UserBillingProfile.findOne({ where: { userId: req.userId } })
    ]);

    const plan = subscription
      ? await BillingPlan.findOne({ where: { code: subscription.planCode } })
      : await BillingPlan.findOne({ where: { code: 'starter_5000' } });

    const paidInvoices = invoices.filter((item) => item.status === 'paid');
    const totalPaid = paidInvoices.reduce((sum, item) => sum + Number(item.total || 0), 0);

    const now = new Date();
    const trialActive = Boolean(
      trialProfile?.trialEndsAt && new Date(trialProfile.trialEndsAt) > now
    );

    res.json({
      success: true,
      data: {
        plan: plan ? {
          code: plan.code,
          name: plan.name,
          price_amount: plan.priceAmount,
          currency: plan.currency,
          interval: plan.interval
        } : null,
        status: subscription?.status || 'trialing',
        trial_ends_at: subscription?.trialEndsAt || null,
        current_period_end: subscription?.currentPeriodEnd || null,
        user_trial: {
          has_used_trial: Boolean(trialProfile?.hasUsedTrial),
          trial_started_at: trialProfile?.trialStartedAt || null,
          trial_ends_at: trialProfile?.trialEndsAt || null,
          is_active: trialActive
        },
        invoices: {
          count: invoices.length,
          paid_total: totalPaid,
          latest: invoices.slice(0, 5)
        }
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/subscribe', authenticate, requireCompany, async (req, res) => {
  try {
    const { planCode } = req.body || {};
    if (!planCode) {
      return res.status(400).json({ success: false, error: 'planCode is required' });
    }

    const [plan, company, trialProfile] = await Promise.all([
      BillingPlan.findOne({ where: { code: planCode } }),
      Company.findByPk(req.companyId),
      getOrCreateUserBillingProfile(req.userId)
    ]);

    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const now = new Date();
    const trialStillActive = Boolean(
      trialProfile?.trialEndsAt && new Date(trialProfile.trialEndsAt) > now
    );
    const trialNeverUsed = !trialProfile?.hasUsedTrial;

    // User-level trial can be activated only once across all companies.
    if (trialNeverUsed || trialStillActive) {
      const trialStart = trialProfile?.trialStartedAt || now;
      const trialEnd = trialStillActive
        ? new Date(trialProfile.trialEndsAt)
        : new Date(trialStart.getTime() + 30 * 24 * 60 * 60 * 1000);

      await trialProfile.update({
        trialStartedAt: trialStart,
        trialEndsAt: trialEnd,
        hasUsedTrial: true
      });

      let companySubscription = await getActiveCompanySubscription(req.companyId);
      const trialPayload = {
        companyId: req.companyId,
        planCode: plan.code,
        status: 'trialing',
        trialEndsAt: trialEnd,
        currentPeriodStart: trialStart,
        currentPeriodEnd: trialEnd,
        gateway: 'razorpay',
        updatedAt: new Date()
      };

      if (companySubscription) {
        await companySubscription.update(trialPayload);
      } else {
        companySubscription = await CompanySubscription.create(trialPayload);
      }

      return res.json({
        success: true,
        data: {
          subscriptionId: companySubscription.id,
          status: companySubscription.status,
          trial_ends_at: trialEnd,
          trial_applied: true
        }
      });
    }

    const gatewayPlanId = resolvePlanGatewayId(plan.code, plan.featuresJson);
    if (!gatewayPlanId) {
      return res.status(400).json({
        success: false,
        error: `Gateway plan id missing for ${plan.code}. Configure env RAZORPAY_PLAN_ID_${plan.code.toUpperCase()}`
      });
    }

    let companySubscription = await getActiveCompanySubscription(req.companyId);
    let customerId = companySubscription?.gatewayCustomerId || null;

    if (!customerId) {
      const customer = await callRazorpay('/customers', 'POST', {
        name: company?.name || 'AICFO Company',
        email: req.user?.email || undefined,
        notes: { companyId: req.companyId }
      });
      customerId = customer.id;
    }

    const gatewaySubscription = await callRazorpay('/subscriptions', 'POST', {
      plan_id: gatewayPlanId,
      customer_notify: 1,
      total_count: 120,
      customer_id: customerId,
      notes: { companyId: req.companyId, planCode: plan.code }
    });

    const payload = {
      companyId: req.companyId,
      planCode: plan.code,
      status: mapGatewayStatus(gatewaySubscription.status),
      trialEndsAt: toDate(gatewaySubscription.current_end),
      currentPeriodStart: toDate(gatewaySubscription.current_start),
      currentPeriodEnd: toDate(gatewaySubscription.current_end),
      gateway: 'razorpay',
      gatewayCustomerId: customerId,
      gatewaySubscriptionId: gatewaySubscription.id,
      updatedAt: new Date()
    };

    if (companySubscription) {
      await companySubscription.update(payload);
    } else {
      companySubscription = await CompanySubscription.create(payload);
    }

    res.json({
      success: true,
      data: {
        subscriptionId: companySubscription.id,
        gatewaySubscriptionId: gatewaySubscription.id,
        status: companySubscription.status,
        short_url: gatewaySubscription.short_url || null
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

const handleBillingWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];
  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({ success: false, error: 'Invalid webhook payload format' });
  }
  const rawBody = req.body;

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return res.status(400).json({ success: false, error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid payload' });
  }

  try {
    const eventType = event?.event;
    const subEntity = event?.payload?.subscription?.entity || null;
    const paymentEntity = event?.payload?.payment?.entity || null;
    const gatewaySubscriptionId = subEntity?.id || paymentEntity?.subscription_id || null;

    if (!gatewaySubscriptionId) {
      return res.json({ success: true });
    }

    const companySubscription = await CompanySubscription.findOne({
      where: { gatewaySubscriptionId }
    });
    if (!companySubscription) {
      return res.json({ success: true });
    }

    if (eventType === 'subscription.activated') {
      await companySubscription.update({
        status: 'active',
        currentPeriodStart: toDate(subEntity?.current_start),
        currentPeriodEnd: toDate(subEntity?.current_end),
        updatedAt: new Date()
      });
    }

    if (eventType === 'subscription.cancelled') {
      await companySubscription.update({
        status: 'canceled',
        updatedAt: new Date()
      });
    }

    if (eventType === 'subscription.charged' || eventType === 'payment.captured') {
      const amount = Number(paymentEntity?.amount || 0);
      const taxAmount = Number(paymentEntity?.tax || 0);
      const paidAt = toDate(paymentEntity?.created_at) || new Date();
      const periodStart = toDate(subEntity?.current_start) || paidAt;
      const periodEnd = toDate(subEntity?.current_end) || paidAt;
      const gatewayPaymentId = paymentEntity?.id || null;
      if (gatewayPaymentId) {
        const existingInvoice = await Invoice.findOne({ where: { gatewayPaymentId } });
        if (existingInvoice) {
          return res.json({ success: true, duplicate: true });
        }
      }
      const invoiceNo = `INV-${companySubscription.companyId.slice(0, 8)}-${gatewayPaymentId || Date.now()}`;

      await Invoice.findOrCreate({
        where: { invoiceNo },
        defaults: {
          companyId: companySubscription.companyId,
          invoiceNo,
          periodStart: periodStart.toISOString().slice(0, 10),
          periodEnd: periodEnd.toISOString().slice(0, 10),
          amount,
          taxAmount,
          total: amount + taxAmount,
          status: 'paid',
          paidAt,
          issuedAt: paidAt,
          gateway: 'razorpay',
          gatewayPaymentId,
          gatewayInvoiceId: event?.payload?.invoice?.entity?.id || null,
          metaJson: { event: eventType }
        }
      });

      await companySubscription.update({
        status: 'active',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        updatedAt: new Date()
      });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

router.get('/invoices', authenticate, requireCompany, async (req, res) => {
  try {
    const invoices = await Invoice.findAll({
      where: { companyId: req.companyId },
      order: [['issuedAt', 'DESC']]
    });
    res.json({ success: true, data: invoices });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/invoices/:id', authenticate, requireCompany, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      where: { id: req.params.id, companyId: req.companyId }
    });
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = {
  billingRouter: router,
  handleBillingWebhook
};
