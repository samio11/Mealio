import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";

import { env, features } from "../../app/config/env.ts";
import { db } from "../../app/db/prisma.ts";
import { logger } from "../../app/utils/logger.ts";
import { sendMail } from "../../app/utils/mailer.ts";

/**
 * Better-Auth is the single source of identity. Sessions are HTTP-only cookies
 * issued by this server; the frontend never holds a token it can trust.
 */
export const auth = betterAuth({
  appName: "Mess Management",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),

  trustedOrigins: [env.FRONTEND_URL, env.BETTER_AUTH_URL],

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Email verification is offered via OTP but does not block sign-in for the MVP.
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Reset your Mess Management password",
        text: `Use this link to reset your password: ${url}`,
        html: `<p>Use the link below to reset your password.</p><p><a href="${url}">Reset password</a></p>`,
      });
    },
  },

  socialProviders: features.googleOAuth
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID as string,
          clientSecret: env.GOOGLE_CLIENT_SECRET as string,
          redirectURI: env.GOOGLE_CALLBACK_URL ?? `${env.BETTER_AUTH_URL}/api/auth/callback/google`,
          // Always show Google's account chooser so the user can pick a
          // different account after logging out of the app. Without this,
          // Google silently reuses the browser's active Google session and
          // the user cannot switch emails.
          prompt: "select_account",
        },
      }
    : {},

  user: {
    additionalFields: {
      phone: { type: "string", required: false, input: true },
      locale: { type: "string", required: false, input: true, defaultValue: "bn" },
    },
  },

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { blockedAt: true },
          });
          return Boolean(user && !user.blockedAt);
        },
      },
    },
  },

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      async sendVerificationOTP({ email, otp, type }) {
        if (!features.email) {
          logger.warn({ email, type }, "email OTP requested but SMTP is not configured");
          return;
        }
        const purpose =
          type === "forget-password"
            ? "reset your password"
            : type === "sign-in"
              ? "sign in"
              : "verify your email";
        await sendMail({
          to: email,
          subject: `Your Mess Management verification code: ${otp}`,
          text: `Your code to ${purpose} is ${otp}. It expires in 5 minutes.`,
          html: `<p>Your code to ${purpose} is <strong>${otp}</strong>.</p><p>It expires in 5 minutes.</p>`,
        });
      },
    }),
  ],
});

export type Auth = typeof auth;
