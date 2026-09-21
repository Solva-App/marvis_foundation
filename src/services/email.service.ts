import { Resend } from 'resend';
import { generateModerationToken } from './token.service';

const resend = new Resend(process.env.RESEND_API_KEY);
const adminEmail = process.env.ADMIN_EMAIL;
const APP_BASE_URL = process.env.APP_BASE_URL;

if (!adminEmail) {
  throw new Error('ADMIN_EMAIL environment variable is required');
}

export const sendModerationEmail = async (needId: string, data: any) => {
  const acceptToken = generateModerationToken(needId, 'accept');
  const rejectToken = generateModerationToken(needId, 'reject');

  const acceptUrl = `${APP_BASE_URL}/api/v1/needs/moderate?token=${acceptToken}`;
  const rejectUrl = `${APP_BASE_URL}/api/v1/needs/moderate?token=${rejectToken}`;

  let categorySpecificHtml = '';
  const cat = data.category;
  const details = data.categoryDetails || {};

  if (cat === 'Tuition & Educational Support') {
    categorySpecificHtml = `
      <p><strong>Category:</strong> Tuition & Educational Support</p>
      <p><strong>Institution Name:</strong> ${details.institutionName || 'N/A'}</p>
      <p><strong>Student ID / Matric No:</strong> ${details.studentId || 'N/A'}</p>
      <p><strong>Invoice Proof:</strong> ${details.invoiceImgUrl ? `<a href="${details.invoiceImgUrl}" target="_blank">View Invoice Image</a>` : 'None provided'}</p>
    `;
  } else if (cat === 'Basic Upkeep & Utilities') {
    categorySpecificHtml = `
      <p><strong>Category:</strong> Basic Upkeep & Utilities</p>
      <p><strong>Bill Type:</strong> ${details.billType || 'N/A'}</p>
      <p><strong>Proof of Bill:</strong> ${details.proofImgUrl ? `<a href="${details.proofImgUrl}" target="_blank">View Bill Proof</a>` : 'None provided'}</p>
    `;
  } else if (cat === 'Dignity & Care Kits') {
    categorySpecificHtml = `
      <p><strong>Category:</strong> Dignity & Care Kits</p>
      <p><strong>Local Pickup / Distribution:</strong> ${details.localPickupDistribution || 'N/A'}</p>
    `;
  }

  const html = `
    <h2>New Need Submission Review</h2>

    <h3>Part 1: Personal Details</h3>
    <p><strong>Passport Photo:</strong> ${data.passportUrl ? `<a href="${data.passportUrl}" target="_blank">View Passport</a>` : 'None provided'}</p>
    <p><strong>Full Name:</strong> ${data.fullName}</p>
    <p><strong>Age:</strong> ${data.age}</p>
    <p><strong>Phone:</strong> ${data.phoneNumber}</p>
    <p><strong>Email:</strong> ${data.email}</p>
    <p><strong>Location:</strong> ${data.location}</p>

    <hr />

    <h3>Part 2 & 3: Category Requirements</h3>
    ${categorySpecificHtml}
    <p><strong>Target Amount Requested:</strong> ₦${Number(data.targetAmount).toLocaleString()}</p>

    <hr />

    <h3>Part 4: Statement</h3>
    <p><strong>Current Situation & Personal Statement:</strong></p>
    <blockquote style="background:#f4f4f5;padding:12px;border-left:4px solid #3b82f6;">${data.currentSituationStatement}</blockquote>

    <hr />

    <p style="font-size:16px;"><strong>Take Action:</strong></p>
    <a href="${acceptUrl}" style="background:#22c55e;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;margin-right:12px;display:inline-block;font-weight:bold;">Accept Need</a>
    <a href="${rejectUrl}" style="background:#ef4444;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">Reject Need</a>
  `;

  await resend.emails.send({
    from: 'Needs Review <onboarding@resend.dev>',
    to: [adminEmail],
    subject: `[${data.category}] New Need Submission: ${data.fullName}`,
    html
  });
};