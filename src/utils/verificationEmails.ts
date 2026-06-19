import { Profile } from '../types/database';

const EMAIL_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: #FAF7EA;
  color: #1A3C2E;
  margin: 0;
  padding: 40px 20px;
`;

const CARD_STYLE = `
  max-width: 550px;
  background: #ffffff;
  border-radius: 24px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  margin: 0 auto;
  box-shadow: 0 4px 12px rgba(26,60,46,0.05);
`;

const HEADER_STYLE = `
  background-color: #1A3C2E;
  color: #ffffff;
  padding: 30px;
  text-align: center;
`;

const HEADER_H1_STYLE = `
  margin: 0;
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 1px;
`;

const SUBHEADER_STYLE = `
  color: #F5B400;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-top: 5px;
  font-weight: bold;
`;

const BODY_STYLE = `
  padding: 30px;
`;

const TITLE_STYLE = `
  font-size: 22px;
  font-weight: 900;
  color: #1A3C2E;
  margin: 0 0 20px 0;
  text-align: center;
`;

const DETAILS_GRID_STYLE = `
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 25px;
`;

const LABEL_STYLE = `
  padding: 10px 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
  width: 40%;
`;

const VALUE_STYLE = `
  padding: 10px 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 13px;
  font-weight: 700;
  color: #1A3C2E;
  text-align: right;
`;

const NOTICE_BOX_STYLE = `
  font-size: 13px;
  line-height: 1.6;
  color: #1A3C2E;
  background-color: #F5B400/15;
  border-left: 3px solid #F5B400;
  padding: 15px;
  border-radius: 0 12px 12px 0;
  margin-top: 20px;
  margin-bottom: 20px;
`;

const FOOTER_STYLE = `
  text-align: center;
  font-size: 11px;
  color: #64748b;
  margin-top: 30px;
  line-height: 1.5;
`;

const BUTTON_STYLE = `
  display: block;
  text-align: center;
  background-color: #F5B400;
  color: #1A3C2E;
  font-weight: bold;
  text-decoration: none;
  padding: 12px 24px;
  border-radius: 12px;
  margin: 20px auto 0 auto;
  width: fit-content;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

export function getAdminNotificationEmail(profile: Partial<Profile>) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="${EMAIL_STYLE}">
      <div style="${CARD_STYLE}">
        <div style="${HEADER_STYLE}">
          <div style="${SUBHEADER_STYLE}">Admin Alert</div>
          <h1 style="${HEADER_H1_STYLE}">CCIS STUDENT COUNCIL</h1>
        </div>
        <div style="${BODY_STYLE}">
          <h2 style="${TITLE_STYLE}">New Profile Submitted</h2>
          <p style="font-size: 14px; color: #334155; line-height: 1.5; margin-bottom: 20px;">
            A new user has submitted their details for verification. Please log into the admin dashboard to review their credentials.
          </p>
          <table style="${DETAILS_GRID_STYLE}">
            <tr>
              <td style="${LABEL_STYLE}">Full Name</td>
              <td style="${VALUE_STYLE}">${profile.full_name || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${LABEL_STYLE}">Student ID</td>
              <td style="${VALUE_STYLE}">${profile.student_number || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${LABEL_STYLE}">Program &amp; Year</td>
              <td style="${VALUE_STYLE}">${profile.program || 'N/A'} - Year ${profile.year_level || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${LABEL_STYLE}">Section</td>
              <td style="${VALUE_STYLE}">${profile.section || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${LABEL_STYLE}">Email</td>
              <td style="${VALUE_STYLE}">${profile.email || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${LABEL_STYLE}">Contact Number</td>
              <td style="${VALUE_STYLE}">${profile.contact_number || 'N/A'}</td>
            </tr>
          </table>
          <a href="${window.location.origin}/admin" style="${BUTTON_STYLE}">Open Admin Portal</a>
        </div>
      </div>
      <div style="${FOOTER_STYLE}">
        CCIS Student Council Portal Administration.<br>
        This is an automated system notification.
      </div>
    </body>
    </html>
  `;
}

export function getStudentReceiptEmail(profile: Partial<Profile>) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="${EMAIL_STYLE}">
      <div style="${CARD_STYLE}">
        <div style="${HEADER_STYLE}">
          <div style="${SUBHEADER_STYLE}">Account Verification</div>
          <h1 style="${HEADER_H1_STYLE}">CCIS STUDENT COUNCIL</h1>
        </div>
        <div style="${BODY_STYLE}">
          <h2 style="${TITLE_STYLE}">Profile Received</h2>
          <p style="font-size: 14px; color: #334155; line-height: 1.5; margin-bottom: 20px;">
            Hi <strong>${profile.full_name || 'Tiger'}</strong>, your CCIS Student Portal profile has been submitted and is currently pending verification.
          </p>
          <div style="${NOTICE_BOX_STYLE} background-color: rgba(245, 180, 0, 0.1);">
            <strong>📋 Next Step Required:</strong><br>
            Please prepare your <strong>Certificate of Registration (COR)</strong> for verification. CCIS Student Council representatives may require you to present or submit your COR to complete the verification process.
          </div>
          <table style="${DETAILS_GRID_STYLE}">
            <tr>
              <td style="${LABEL_STYLE}">Full Name</td>
              <td style="${VALUE_STYLE}">${profile.full_name || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${LABEL_STYLE}">Student ID</td>
              <td style="${VALUE_STYLE}">${profile.student_number || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${LABEL_STYLE}">Program &amp; Section</td>
              <td style="${VALUE_STYLE}">${profile.program} - ${profile.section}</td>
            </tr>
            <tr>
              <td style="${LABEL_STYLE}">Verification Status</td>
              <td style="${VALUE_STYLE} color: #F5B400;">Pending Review</td>
            </tr>
          </table>
          <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
            You will have temporary, limited access to the portal while verification is in progress. The review process is normally completed within 24 hours.
          </p>
        </div>
      </div>
      <div style="${FOOTER_STYLE}">
        CCIS Student Council Office, University of Makati.<br>
        If you did not initiate this request, please contact us immediately.
      </div>
    </body>
    </html>
  `;
}

export function getApprovalEmail(profile: Partial<Profile>) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="${EMAIL_STYLE}">
      <div style="${CARD_STYLE}">
        <div style="${HEADER_STYLE}">
          <div style="${SUBHEADER_STYLE}">Account Status Update</div>
          <h1 style="${HEADER_H1_STYLE}">CCIS STUDENT COUNCIL</h1>
        </div>
        <div style="${BODY_STYLE}">
          <h2 style="${TITLE_STYLE} color: #16a34a;">Account Approved!</h2>
          <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
            Hi <strong>${profile.full_name || 'Tiger'}</strong>, your student profile has been verified and approved by the administrator. 
          </p>
          <div style="${NOTICE_BOX_STYLE} background-color: rgba(22, 163, 74, 0.1); border-left-color: #16a34a; color: #14532d;">
            <strong>🎉 Full Access Granted:</strong><br>
            You now have complete access to the CCIS Student Portal, including announcement subscriptions, event registrations, and ticketing features!
          </div>
          <a href="${window.location.origin}" style="${BUTTON_STYLE} background-color: #1A3C2E; color: #ffffff;">Go to Portal</a>
        </div>
      </div>
      <div style="${FOOTER_STYLE}">
        CCIS Student Council Office, University of Makati.<br>
        This is an automated status update.
      </div>
    </body>
    </html>
  `;
}

export function getRejectionEmail(profile: Partial<Profile>, reason: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="${EMAIL_STYLE}">
      <div style="${CARD_STYLE}">
        <div style="${HEADER_STYLE}">
          <div style="${SUBHEADER_STYLE}">Account Status Update</div>
          <h1 style="${HEADER_H1_STYLE}">CCIS STUDENT COUNCIL</h1>
        </div>
        <div style="${BODY_STYLE}">
          <h2 style="${TITLE_STYLE} color: #dc2626;">Verification Declined</h2>
          <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
            Hi <strong>${profile.full_name || 'Tiger'}</strong>, your profile submission was reviewed, but could not be approved due to discrepancies in the submitted details.
          </p>
          <div style="${NOTICE_BOX_STYLE} background-color: rgba(220, 38, 38, 0.1); border-left-color: #dc2626; color: #7f1d1d;">
            <strong>❌ Reason for Rejection:</strong><br>
            ${reason || 'No specific reason provided.'}
          </div>
          <p style="font-size: 13px; color: #334155; line-height: 1.5; margin-bottom: 20px;">
            Your profile has been unlocked. Please sign in to the CCIS Portal, correct the information in your onboarding form, and re-submit for review.
          </p>
          <a href="${window.location.origin}" style="${BUTTON_STYLE} background-color: #dc2626; color: #ffffff;">Update Profile</a>
        </div>
      </div>
      <div style="${FOOTER_STYLE}">
        CCIS Student Council Office, University of Makati.<br>
        Please ensure your details match your official Certificate of Registration (COR).
      </div>
    </body>
    </html>
  `;
}
