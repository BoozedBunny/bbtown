import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'smtp-relay.gmail.com'),
        port: env.int('SMTP_PORT', 587),
        auth: {
          user: env('SMTP_USERNAME'),
          pass: env('SMTP_PASSWORD'),
        },
        secure: env.bool('SMTP_SECURE', false),
        rejectUnauthorized: false,
      },
      settings: {
        defaultFrom: env('SMTP_DEFAULT_FROM', 'no-reply@boozedbunnytown.com'),
        defaultReplyTo: env('SMTP_DEFAULT_REPLY_TO', 'no-reply@boozedbunnytown.com'),
      },
    },
  },
});

export default config;
