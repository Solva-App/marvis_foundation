import { Request, Response } from 'express';
import { admin, db } from '../config/firebase';
import { sendModerationEmail } from '../services/email.service';
import { uploadFileToFirebase } from '../services/storage.service';
import { verifyModerationToken } from '../services/token.service';

export const submitNeed = async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      age,
      phoneNumber,
      email,
      location,
      category,
      targetAmount,
      currentSituationStatement,
      institutionName,
      studentId,
      billType,
      localPickupDistribution
    } = req.body;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    let passportUrl = '';
    if (files?.passport?.[0]) {
      passportUrl = await uploadFileToFirebase(files.passport[0], 'passports');
    }

    const categoryDetails: Record<string, any> = {};

    if (category === 'Tuition & Educational Support') {
      categoryDetails.institutionName = institutionName || '';
      categoryDetails.studentId = studentId || '';
      if (files?.invoice?.[0]) {
        categoryDetails.invoiceImgUrl = await uploadFileToFirebase(files.invoice[0], 'invoices');
      }
    } else if (category === 'Basic Upkeep & Utilities') {
      categoryDetails.billType = billType || '';

      if (files?.billProof?.[0]) {
        categoryDetails.proofImgUrl = await uploadFileToFirebase(files.billProof[0], 'bill-proofs');
      }
    } else if (category === 'Dignity & Care Kits') {
      categoryDetails.localPickupDistribution = localPickupDistribution || '';
    }

    const newDocRef = db.collection('needs').doc();

    const needPayload = {
      id: newDocRef.id,
      passportUrl,
      fullName,
      age: Number(age),
      phoneNumber,
      email,
      location,
      category,
      categoryDetails,
      targetAmount: Number(targetAmount),
      raisedAmount: 0,
      currentSituationStatement,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await newDocRef.set(needPayload);

    try {
      await sendModerationEmail(newDocRef.id, {
        ...needPayload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (emailError: any) {
      console.error('Failed to send moderation email:', emailError);
      return res.status(500).json({
        success: false,
        error: 'Need was saved, but the moderation email could not be sent.'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Need application submitted successfully with files auto-routed.',
      id: newDocRef.id
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const renderModerationPage = (req: Request, res: Response) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing moderation token.');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Processing Action...</title>
        <style>
          body { font-family: sans-serif; display: flex; height: 100vh; align-items: center; justify-content: center; background: #f4f4f5; }
          .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2 id="status">Updating status...</h2>
        </div>
        <script>
          fetch('/api/v1/needs/moderate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: "${token}" })
          })
          .then(res => res.json())
          .then(data => {
            document.getElementById('status').innerText = data.message || 'Updated successfully!';
          })
          .catch(() => {
            document.getElementById('status').innerText = 'Failed to update. Link may be invalid or expired.';
          });
        </script>
      </body>
    </html>
  `;
  return res.send(html);
};

export const executeModerationAction = async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Invalid or missing moderation token.');
  }

  try {
    const payload = verifyModerationToken(String(token));
    const { needId, action } = payload;

    const needRef = db.collection('needs').doc(needId);
    const doc = await needRef.get();

    if (!doc.exists) {
      return res.status(404).send('Need document not found.');
    }
    if (doc.data()?.status !== 'pending') {
      return res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h2>Action Already Processed</h2>
            <p>This need has already been moderated.</p>
            <script>setTimeout(() => { window.close(); }, 3000);</script>
          </body>
        </html>
      `);
    }
    const newStatus = action === 'accept' ? 'approved' : 'rejected';
    await needRef.update({
      status: newStatus,
      updatedAt: new Date()
    });
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Moderation Complete</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding-top: 80px; background-color: #f9fafb; color: #111827; }
            .card { background: white; padding: 40px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
            .badge { display: inline-block; padding: 6px 12px; border-radius: 9999px; font-weight: bold; text-transform: uppercase; font-size: 14px; margin-bottom: 16px; }
            .approved { background: #dcfce7; color: #166534; }
            .rejected { background: #fee2e2; color: #991b1b; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge ${action === 'accept' ? 'approved' : 'rejected'}">
              Need ${action === 'accept' ? 'Approved' : 'Rejected'}
            </div>
            <h2>Status Updated Successfully</h2>
            <p>This tab will automatically close in 2 seconds...</p>
            <p style="font-size: 12px; color: #6b7280;">If it doesn't close automatically, you can safely close this tab manually.</p>
          </div>

          <script>
             setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    return res.status(400).send(`Invalid or expired moderation link: ${err.message}`);
  }
};

export const getNeedDetails = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, error: 'Need ID is required' });
  }

  const docRef = db.collection('needs').doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    return res.status(404).json({ success: false, error: 'Need not found' });
  }

  const data = doc.data();

  const targetAmount = data?.targetAmount || 0;
  const raisedAmount = data?.raisedAmount || 0;
  const remainingAmount = Math.max(0, targetAmount - raisedAmount);
  const percentageRaised = targetAmount > 0 ? Math.min(100, (raisedAmount / targetAmount) * 100) : 0;

  return res.json({
    success: true,
    data: {
      id: doc.id,
      title: data?.title,
      description: data?.description,
      status: data?.status,
      targetAmount,
      raisedAmount,
      remainingAmount,
      percentageRaised: Number(percentageRaised.toFixed(2)),
      updatedAt: data?.updatedAt
    }
  });
};

export const getAllNeeds = async (req: Request, res: Response) => {
  try {
    const { status, category, limit = 20 } = req.query;

    let query: admin.firestore.Query = db.collection('needs');
    if (status) {
      query = query.where('status', '==', String(status));
    }
    if (category) {
      query = query.where('category', '==', String(category));
    }
    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(Number(limit))
      .get();

    const needs = snapshot.docs.map((doc) => {
      const data = doc.data();
      const targetAmount = data.targetAmount || 0;
      const raisedAmount = data.raisedAmount || 0;
      const remainingAmount = Math.max(0, targetAmount - raisedAmount);
      const percentageRaised = targetAmount > 0 ? Math.min(100, (raisedAmount / targetAmount) * 100) : 0;

      return {
        id: doc.id,
        ...data,
        targetAmount,
        raisedAmount,
        remainingAmount,
        percentageRaised: Number(percentageRaised.toFixed(2))
      };
    });

    return res.json({
      success: true,
      count: needs.length,
      data: needs
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

interface NeedState {
  raisedAmount: number;
  disbursedAmount: number;
}

export const handleAllNeedsSSE = async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(`data: ${JSON.stringify({ event: 'INITIALIZED', scope: 'ALL_NEEDS' })}\n\n`);

  const heartbeatInterval = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 25000);

  const previousStates = new Map<string, NeedState>();

  const unsubscribe = db.collection('needs').onSnapshot(
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const doc = change.doc;
        const needId = doc.id;
        const data = doc.data();

        if (change.type === 'removed') {
          previousStates.delete(needId);
          res.write(
            `data: ${JSON.stringify({
              type: 'NEED_DELETED',
              needId,
              timestamp: new Date().toISOString()
            })}\n\n`
          );
          return;
        }

        const targetAmount = data?.targetAmount || 0;
        const raisedAmount = data?.raisedAmount || 0;
        const disbursedAmount = data?.disbursedAmount || 0;
        const availableBalance = Math.max(0, raisedAmount - disbursedAmount);
        const percentageFunded = targetAmount > 0 ? Math.min(100, (raisedAmount / targetAmount) * 100) : 0;

        const prevState = previousStates.get(needId);

        if (!prevState || change.type === 'added') {
          previousStates.set(needId, { raisedAmount, disbursedAmount });

          const payload = {
            type: prevState ? 'NEED_CREATED' : 'INITIAL_STATE',
            needId,
            targetAmount,
            raisedAmount,
            disbursedAmount,
            availableBalance,
            percentageFunded: Number(percentageFunded.toFixed(2)),
            status: data?.status
          };

          res.write(`data: ${JSON.stringify(payload)}\n\n`);
          return;
        }

        if (raisedAmount > prevState.raisedAmount) {
          const deltaAmount = raisedAmount - prevState.raisedAmount;

          const donationPayload = {
            type: 'DONATION_RECEIVED',
            needId,
            amountAdded: deltaAmount,
            raisedAmount,
            disbursedAmount,
            availableBalance,
            percentageFunded: Number(percentageFunded.toFixed(2)),
            timestamp: new Date().toISOString()
          };

          res.write(`data: ${JSON.stringify(donationPayload)}\n\n`);
        }

        if (disbursedAmount > prevState.disbursedAmount) {
          const deltaAmount = disbursedAmount - prevState.disbursedAmount;

          const disbursementPayload = {
            type: 'DISBURSEMENT_MADE',
            needId,
            amountDeducted: deltaAmount,
            raisedAmount,
            disbursedAmount,
            availableBalance,
            timestamp: new Date().toISOString()
          };

          res.write(`data: ${JSON.stringify(disbursementPayload)}\n\n`);
        }

        previousStates.set(needId, { raisedAmount, disbursedAmount });
      });
    },
    (error) => {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      cleanup();
      res.end();
    }
  );

  const cleanup = () => {
    clearInterval(heartbeatInterval);
    unsubscribe();
  };

  req.on('close', () => {
    cleanup();
    res.end();
  });
};