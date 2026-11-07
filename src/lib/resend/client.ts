import { Resend } from "resend";

export async function sendEmail(params: { apiKey: string; from: string; to: string; subject: string; html: string }) {
  const resend = new Resend(params.apiKey);
  const { data, error } = await resend.emails.send({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  if (error) throw new Error(error.message);
  return data;
}
