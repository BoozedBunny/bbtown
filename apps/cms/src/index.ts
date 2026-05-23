import type { Core } from '@strapi/strapi';

const PUBLIC_PERMISSION_ACTIONS = [
  'api::global-setting.global-setting.find',
  'api::global-setting.global-setting.findOne',
  'api::town-news.town-news.find',
  'api::town-news.town-news.findOne',
  'api::market-company-profile.market-company-profile.find',
  'api::market-company-profile.market-company-profile.findOne',
  'api::player-profile.player-profile.find',
  'api::player-profile.player-profile.findOne',
] as const;

const AUTHENTICATED_PERMISSION_ACTIONS = [
  'api::player-profile.player-profile.create',
  'api::player-profile.player-profile.find',
  'api::player-profile.player-profile.findOne',
  'api::player-profile.player-profile.update',
] as const;

async function ensureRolePermissions(
  strapi: Core.Strapi,
  roleType: 'public' | 'authenticated',
  actions: readonly string[],
) {
  const role = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: roleType } });

  if (!role) {
    strapi.log.warn(`[bootstrap] ${roleType} role not found; skipping permission bootstrap.`);
    return;
  }

  for (const action of actions) {
    const existing = await strapi.db
      .query('plugin::users-permissions.permission')
      .findOne({ where: { role: role.id, action } });

    if (!existing) {
      await strapi.db.query('plugin::users-permissions.permission').create({
        data: {
          role: role.id,
          action,
        },
      });
      strapi.log.info(`[bootstrap] Added ${roleType} permission: ${action}`);
    }
  }
}

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureRolePermissions(strapi, 'public', PUBLIC_PERMISSION_ACTIONS);
    await ensureRolePermissions(
      strapi,
      'authenticated',
      AUTHENTICATED_PERMISSION_ACTIONS,
    );
  },
};
