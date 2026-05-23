import type { Core } from '@strapi/strapi';

const PUBLIC_PERMISSION_ACTIONS = [
  'api::global-setting.global-setting.find',
  'api::global-setting.global-setting.findOne',
  'api::town-news.town-news.find',
  'api::town-news.town-news.findOne',
] as const;

async function ensurePublicPermissions(strapi: Core.Strapi) {
  const publicRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });

  if (!publicRole) {
    strapi.log.warn('[bootstrap] Public role not found; skipping permission bootstrap.');
    return;
  }

  for (const action of PUBLIC_PERMISSION_ACTIONS) {
    const existing = await strapi.db
      .query('plugin::users-permissions.permission')
      .findOne({ where: { role: publicRole.id, action } });

    if (!existing) {
      await strapi.db.query('plugin::users-permissions.permission').create({
        data: {
          role: publicRole.id,
          action,
        },
      });
      strapi.log.info(`[bootstrap] Added public permission: ${action}`);
    }
  }
}

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensurePublicPermissions(strapi);
  },
};
