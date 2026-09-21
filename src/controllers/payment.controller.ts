import { Request, Response } from 'express';
import { admin, db } from '../config/firebase';
import { PAYSTACK_CONFIG } from '../config/paystack';

const recordSuccessfulDonation = async ({
  reference,
  needId,
  amountInNaira,
  donorEmail
}: {
  reference: string;
  needId: string;
  amountInNaira: number;
  donorEmail: string;
}) => {
  const transactionRef = db.collection('donations').doc(reference);
  let alreadyProcessed = false;

  await db.runTransaction(async (transaction) => {
    const donationDoc = await transaction.get(transactionRef);

    if (donationDoc.exists) {
      alreadyProcessed = true;
      return;
    }

    const needRef = db.collection('needs').doc(needId);
    const needDoc = await transaction.get(needRef);

    if (!needDoc.exists) {
      throw new Error('Associated need document not found.');
    }

    const needData = needDoc.data();
    const raisedAmount = Number(needData?.raisedAmount ?? 0);
    const targetAmount = Number(needData?.targetAmount);
    const willComplete = Number.isFinite(targetAmount)
      && raisedAmount + amountInNaira >= targetAmount;

    transaction.set(transactionRef, {
      needId,
      amount: amountInNaira,
      donorEmail,
      paystackReference: reference,
      status: 'success',
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    transaction.update(needRef, {
      raisedAmount: admin.firestore.FieldValue.increment(amountInNaira),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(willComplete && {
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    });
  });

  return alreadyProcessed;
};

const recordSuccessfulTransfer = async (transfer: Record<string, any>) => {
  const reference = transfer.reference;

  if (!reference) {
    return;
  }

  const transferRef = db.collection('transfers').doc(reference);

  await db.runTransaction(async (transaction) => {
    const transferDoc = await transaction.get(transferRef);

    if (transferDoc.exists) {
      return;
    }

    transaction.set(transferRef, {
      reference,
      transferCode: transfer.transfer_code,
      amount: Number(transfer.amount ?? 0) / 100,
      currency: transfer.currency,
      status: 'success',
      recipient: transfer.recipient,
      reason: transfer.reason,
      transferredAt: transfer.transferred_at ?? null,
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
};

export const initializePayment = async (req: Request, res: Response) => {
  const { needId, amount, donorEmail } = req.body;

  if (!needId || !amount || !donorEmail) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: needId, amount, donorEmail'
    });
  }

  const needDoc = await db.collection('needs').doc(needId).get();
  if (!needDoc.exists) {
    return res.status(404).json({ success: false, error: 'Need not found' });
  }

  const needData = needDoc.data();
  if (needData?.status !== 'approved') {
    return res.status(400).json({ success: false, error: 'This need is not open for donations' });
  }

  const amountInKobo = Math.round(Number(amount) * 100);

  const paystackResponse = await fetch(`${PAYSTACK_CONFIG.baseUrl}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_CONFIG.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: donorEmail,
      amount: amountInKobo,
      metadata: {
        needId,
        donorEmail,
      },
      callback_url: `${process.env.APP_BASE_URL}/donation-success?needId=${needId}`,
    }),
  });

  const data = await paystackResponse.json();

  if (!data.status) {
    return res.status(500).json({ success: false, error: data.message || 'Payment initialization failed' });
  }

  return res.json({
    success: true,
    data: {
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
      reference: data.data.reference,
    },
  });
};

export const handlePaystackWebhook = async (req: Request, res: Response) => {
  const event = req.body;

  if (event.event === 'charge.success') {
    const { amount, reference, customer, metadata } = event.data;
    const needId = metadata?.needId;

    if (needId && reference && customer?.email) {
      const amountInNaira = amount / 100;

      await recordSuccessfulDonation({
        reference,
        needId,
        amountInNaira,
        donorEmail: customer.email
      });
    }
  }

  if (event.event === 'transfer.success') {
    await recordSuccessfulTransfer(event.data);
  }

  return res.status(200).send('Webhook processed');
};

export const verifyPayment = async (req: Request, res: Response) => {
  const { reference } = req.params;

  if (!reference) {
    return res.status(400).json({ success: false, error: 'Transaction reference is required' });
  }
   const response = await fetch(`${PAYSTACK_CONFIG.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${PAYSTACK_CONFIG.secretKey}`
    }
  });

  const paystackData = await response.json();

  if (!paystackData.status || paystackData.data.status !== 'success') {
    return res.status(400).json({
      success: false,
      error: paystackData.message || 'Payment verification failed or status is not successful.'
    });
  }

  const { amount, customer, metadata } = paystackData.data;
  const needId = metadata?.needId;

  if (!needId) {
    return res.status(400).json({ success: false, error: 'No need ID associated with this transaction metadata.' });
  }

  const amountInNaira = amount / 100;
  const alreadyProcessed = await recordSuccessfulDonation({
    reference,
    needId,
    amountInNaira,
    donorEmail: customer.email
  });

  return res.json({
    success: true,
    message: alreadyProcessed
      ? 'Payment already processed and verified.'
      : 'Payment verified successfully and target need updated.',
    amount: amountInNaira
  });
};