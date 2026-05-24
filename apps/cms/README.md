# BBTown CMS (Strapi)

Pfad:
- /root/projects/bbtown/apps/cms

Laufende Vorschau-Instanz:
- PM2 Prozess: bbtown-cms
- URL: http://<server-ip>:1338/admin

## Phase-1 Setup (erledigt)

- Strapi v5 (TypeScript) mit PostgreSQL
- Datenbank: bbtown_strapi
- Erste Content-Types:
  - global-setting (Single Type)
  - town-news (Collection Type)
- Public Read Permissions werden beim Bootstrap automatisch gesetzt für:
  - api::global-setting.global-setting.find
  - api::global-setting.global-setting.findOne
  - api::town-news.town-news.find
  - api::town-news.town-news.findOne

## Wichtige Befehle

Im Repo-Root ausführen:

- CMS entwickeln:
  npm run develop --workspace cms

- CMS Build:
  npm run build --workspace cms

- PM2 Logs:
  /root/.hermes/node/bin/pm2 logs bbtown-cms --lines 100 --nostream

## Nächster Schritt (Phase 2)

- Web-App an Strapi anbinden (STRAPI_URL/STRAPI_API_TOKEN)
- Erste Read-Pfade umstellen (zuerst risikoarm: News + globale Settings)
- Danach schrittweise Prisma-Fallback zurückbauen
