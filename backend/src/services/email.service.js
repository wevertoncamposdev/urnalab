import { Resend } from 'resend';
import { config } from '../config.js';
import { EMAIL_VERIFICATION_RULES } from '../rules/email-verification-rules.js';
import { PASSWORD_RESET_RULES } from '../rules/password-reset-rules.js';

// Único ponto que conhece o SDK do Resend — services nunca importam `resend` direto,
// mesmo princípio já usado pra Prisma (database/index.js) e fotos (storage/photo-storage.js).
const resend = new Resend(config.resendApiKey);

// Mesma paleta de frontend/src/styles/globals.css (ver docs/identidade-visual.md) — repetida
// aqui em hex puro porque e-mail não lê CSS custom properties. Tipografia usa stack
// segura (Arial/Helvetica): webfont não é confiável em cliente de e-mail, a cor é que
// carrega a identidade aqui.
const COLORS = {
  deepBlue: '#171c3a',
  primary: '#2c3ed9',
  green: '#12795a',
  background: '#f5f6fa',
  foreground: '#161b26',
  muted: '#5c6478',
  border: '#dfe2ea',
};

// Cabeçalho (logo + wordmark + faixa azul profundo) e rodapé (aviso institucional) são
// sempre os mesmos — só o miolo muda por e-mail.
function emailLayout({ previewText, bodyHtml }) {
  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${previewText}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.background};padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;background:#ffffff;border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;">
            <tr><td style="height:6px;background:${COLORS.deepBlue};line-height:6px;font-size:0;">&nbsp;</td></tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:10px;">
                      <img src="${config.frontendUrl}/img/urnalab-logo.png" width="32" height="32" alt="" style="display:block;border-radius:50%;" />
                    </td>
                    <td style="font-size:20px;font-weight:800;letter-spacing:-0.02em;">
                      <span style="color:${COLORS.primary};">urna</span><span style="color:${COLORS.green};">lab</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 32px;color:${COLORS.foreground};font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid ${COLORS.border};color:${COLORS.muted};font-size:12px;line-height:1.5;text-align:center;">
                Projeto educacional. Não é uma urna eletrônica oficial.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

export const emailService = {
  async sendVerificationCode(to, code) {
    await resend.emails.send({
      from: `${config.emailFromName} <${config.emailFromAddress}>`,
      to,
      subject: 'Confirme seu e-mail — UrnaLab',
      html: emailLayout({
        previewText: `Seu código de confirmação: ${code}`,
        bodyHtml: `
          <h1 style="margin:0 0 12px;font-size:18px;color:${COLORS.deepBlue};">Confirme seu e-mail</h1>
          <p style="margin:0 0 20px;">Use o código abaixo para confirmar sua conta no UrnaLab:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
            <tr>
              <td style="background:${COLORS.background};border:1px solid ${COLORS.border};border-radius:10px;padding:16px 24px;font-size:28px;font-weight:800;letter-spacing:8px;color:${COLORS.deepBlue};">
                ${code}
              </td>
            </tr>
          </table>
          <p style="margin:0;color:${COLORS.muted};font-size:13px;">
            Vale por ${EMAIL_VERIFICATION_RULES.ttlMinutes} minutos. Se você não pediu esse código,
            pode ignorar este e-mail.
          </p>
        `,
      }),
    });
  },

  async sendPasswordResetLink(to, resetUrl) {
    await resend.emails.send({
      from: `${config.emailFromName} <${config.emailFromAddress}>`,
      to,
      subject: 'Redefinição de senha — UrnaLab',
      html: emailLayout({
        previewText: 'Clique para definir uma nova senha.',
        bodyHtml: `
          <h1 style="margin:0 0 12px;font-size:18px;color:${COLORS.deepBlue};">Redefinir senha</h1>
          <p style="margin:0 0 24px;">
            Clique no botão abaixo para definir uma nova senha. Ele vale por
            ${PASSWORD_RESET_RULES.ttlMinutes} minutos.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr>
              <td style="border-radius:8px;background:${COLORS.green};">
                <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                  Definir nova senha
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 4px;color:${COLORS.muted};font-size:13px;">
            Se o botão não funcionar, copie e cole este link no navegador:
          </p>
          <p style="margin:0 0 20px;word-break:break-all;">
            <a href="${resetUrl}" style="color:${COLORS.primary};">${resetUrl}</a>
          </p>
          <p style="margin:0;color:${COLORS.muted};font-size:13px;">
            Se você não pediu isso, ignore este e-mail — sua senha atual continua válida.
          </p>
        `,
      }),
    });
  },
};
