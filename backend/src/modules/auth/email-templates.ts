/**
 * QuickPDF - Premium Responsive HTML Email Templates
 */

interface OtpTemplateOptions {
  title: string;
  subtitle: string;
  code: string;
  expireMinutes?: number;
}

export function generateOtpEmailHtml({
  title,
  subtitle,
  code,
  expireMinutes = 10,
}: OtpTemplateOptions): string {
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Top Gradient Accent Bar -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #FF512F 0%, #DD2476 100%);"></td>
          </tr>

          <!-- Header / Brand -->
          <tr>
            <td style="padding: 32px 36px 16px 36px; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td style="vertical-align: middle;">
                    <img src="cid:quickpdf-logo" width="48" height="48" alt="QuickPDF" style="display: block; width: 48px; height: 48px; border: 0;" />
                  </td>
                  <td style="vertical-align: middle; padding-left: 12px;">
                    <span style="font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Quick<span style="color: #E5322D;">PDF</span></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 8px 36px 28px 36px;">
              <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #0f172a; text-align: center;">
                ${title}
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569; text-align: center;">
                ${subtitle}
              </p>

              <!-- OTP Display Box -->
              <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 22px 16px; text-align: center; margin: 24px 0;">
                <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 8px;">
                  Verification Code
                </div>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0f172a; text-indent: 8px;">
                  ${code}
                </div>
                <div style="font-size: 12px; color: #e11d48; margin-top: 10px; font-weight: 600;">
                  ⏱️ Expires in ${expireMinutes} minutes
                </div>
              </div>

              <!-- Security Tips -->
              <div style="background-color: #fff1f2; border-left: 4px solid #f43f5e; padding: 12px 16px; border-radius: 6px; margin: 24px 0;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #9f1239;">
                  <strong>Security Tip:</strong> Never share this code with anyone. QuickPDF support will never ask for your verification code.
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b; text-align: center;">
                If you didn't request this code, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #94a3b8;">
                © ${currentYear} QuickPDF Platform. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
                Fast, Private & Secure PDF Document Management
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

interface MagicLinkTemplateOptions {
  title: string;
  subtitle: string;
  confirmUrl: string;
  expireMinutes?: number;
}

export function generateMagicLinkEmailHtml({
  title,
  subtitle,
  confirmUrl,
  expireMinutes = 15,
}: MagicLinkTemplateOptions): string {
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Top Gradient Accent Bar -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #FF512F 0%, #DD2476 100%);"></td>
          </tr>

          <!-- Header / Brand -->
          <tr>
            <td style="padding: 32px 36px 16px 36px; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td style="vertical-align: middle;">
                    <img src="cid:quickpdf-logo" width="48" height="48" alt="QuickPDF" style="display: block; width: 48px; height: 48px; border: 0;" />
                  </td>
                  <td style="vertical-align: middle; padding-left: 12px;">
                    <span style="font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Quick<span style="color: #E5322D;">PDF</span></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 8px 36px 28px 36px; text-align: center;">
              <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: #0f172a;">
                ${title}
              </h1>
              <p style="margin: 0 0 28px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                ${subtitle}
              </p>

              <!-- Big Direct Action Button -->
              <div style="margin: 32px 0;">
                <a href="${confirmUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #FF512F 0%, #DD2476 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; padding: 16px 36px; border-radius: 12px; box-shadow: 0 4px 14px rgba(221,36,118,0.35); text-transform: uppercase; letter-spacing: 0.5px;">
                  Confirm & Sign in to QuickPDF
                </a>
              </div>

              <div style="font-size: 12px; color: #e11d48; margin-top: 14px; font-weight: 600;">
                ⏱️ This confirmation link expires in ${expireMinutes} minutes
              </div>

              <!-- Fallback Direct URL -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 28px 0; text-align: left; word-break: break-all;">
                <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b; font-weight: 600;">
                  Or click or copy this direct link into your browser:
                </p>
                <a href="${confirmUrl}" style="font-size: 11px; color: #E5322D; text-decoration: underline;">
                  ${confirmUrl}
                </a>
              </div>

              <!-- Security Tips -->
              <div style="background-color: #fff1f2; border-left: 4px solid #f43f5e; padding: 12px 16px; border-radius: 6px; margin: 24px 0; text-align: left;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #9f1239;">
                  <strong>Security Note:</strong> If you did not request this sign-in, you can safely ignore this email. No access will be granted without clicking this link.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #94a3b8;">
                © ${currentYear} QuickPDF Platform. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
                Fast, Private & Secure PDF Document Management
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

