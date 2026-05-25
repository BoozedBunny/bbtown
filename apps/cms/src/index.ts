import type { Core } from '@strapi/strapi';

const PUBLIC_PERMISSION_ACTIONS = [
  'api::global-setting.global-setting.find',
  'api::global-setting.global-setting.findOne',
  'api::town-news.town-news.find',
  'api::town-news.town-news.findOne',
  'api::stock.stock.find',
  'api::stock.stock.findOne',
  'api::stock-history.stock-history.find',
  'api::stock-history.stock-history.findOne',
] as const;

const AUTHENTICATED_PERMISSION_ACTIONS: readonly string[] = [];

const PLAYER_PROFILE_ACTIONS = [
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

async function removeRolePermissions(
  strapi: Core.Strapi,
  roleType: 'public' | 'authenticated',
  actions: readonly string[],
) {
  const role = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: roleType } });

  if (!role) {
    strapi.log.warn(`[bootstrap] ${roleType} role not found; skipping permission cleanup.`);
    return;
  }

  for (const action of actions) {
    const existing = await strapi.db
      .query('plugin::users-permissions.permission')
      .findOne({ where: { role: role.id, action } });

    if (existing) {
      await strapi.db
        .query('plugin::users-permissions.permission')
        .delete({ where: { id: existing.id } });
      strapi.log.info(`[bootstrap] Removed ${roleType} permission: ${action}`);
    }
  }
}

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await removeRolePermissions(strapi, 'public', PLAYER_PROFILE_ACTIONS);
    await removeRolePermissions(strapi, 'authenticated', PLAYER_PROFILE_ACTIONS);
    await ensureRolePermissions(strapi, 'public', PUBLIC_PERMISSION_ACTIONS);
    await ensureRolePermissions(
      strapi,
      'authenticated',
      AUTHENTICATED_PERMISSION_ACTIONS,
    );
  },
};
