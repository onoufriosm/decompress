import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  console.warn("RESEND_API_KEY not set - email functionality disabled");
}

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "digest@decompress.app";
export const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || "Decompress";
