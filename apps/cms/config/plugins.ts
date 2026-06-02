import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => {
  const smtpUsername = env('SMTP_USERNAME') || '';
  const smtpPassword = env('SMTP_PASSWORD') || '';

  // Extract domain dynamically from SMTP_USERNAME for the EHLO greeting name
  const domain = smtpUsername.includes('@')
    ? smtpUsername.split('@').pop()
    : 'boozedbunny.com';

  const providerOptions: any = {
    host: env('SMTP_HOST', 'smtp-relay.gmail.com'),
    port: env.int('SMTP_PORT', 587),
    name: domain,
    secure: env.bool('SMTP_SECURE', false),
    rejectUnauthorized: false,
  };

  if (smtpUsername && smtpPassword) {
    providerOptions.auth = {
      user: smtpUsername,
      pass: smtpPassword,
    };
  }

  return {
    email: {
      config: {
        provider: 'nodemailer',
        providerOptions,
        settings: {
          defaultFrom: env('SMTP_DEFAULT_FROM', 'bunny@boozedbunny.com'),
          defaultReplyTo: env('SMTP_DEFAULT_REPLY_TO', 'bunny@boozedbunny.com'),
        },
      },
    },
  };
};

export default config;
