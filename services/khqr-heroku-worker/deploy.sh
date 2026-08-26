#!/usr/bin/env bash
set -euo pipefail

# This script is intentionally not executed by the repository. It deploys only
# after the owner has created a local secret file and explicitly runs it.
APP_NAME="${1:-}"
CONFIG_FILE="${CONFIG_FILE:-.env}"

if ! command -v heroku >/dev/null 2>&1; then
  echo "Heroku CLI is required. Install it, authenticate it in your own terminal, then re-run this script." >&2
  exit 1
fi
if ! heroku auth:whoami >/dev/null 2>&1; then
  echo "Heroku CLI is not authenticated. Run 'heroku login' in your own terminal, then re-run this script." >&2
  exit 1
fi
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing $CONFIG_FILE. Copy .env.example to a local .env and populate it without committing it." >&2
  exit 1
fi

for key in DATABASE_URL WORKER_API_KEY CALLBACK_HMAC_SECRET BAKONG_REGISTERED_EMAIL BAKONG_ACCESS_TOKEN; do
  value="$(grep -E "^${key}=" "$CONFIG_FILE" | head -n 1 | cut -d '=' -f2- || true)"
  if [[ -z "$value" ]]; then
    echo "Missing required $key in $CONFIG_FILE." >&2
    exit 1
  fi
done

if [[ -z "$APP_NAME" ]]; then
  read -r -p "Heroku application name: " APP_NAME
fi
if [[ ! "$APP_NAME" =~ ^[a-z][a-z0-9-]{2,29}$ ]]; then
  echo "Use a lowercase Heroku app name of 3–30 characters." >&2
  exit 1
fi

if ! heroku apps:info --app "$APP_NAME" >/dev/null 2>&1; then
  heroku create "$APP_NAME"
fi

while IFS='=' read -r key value; do
  [[ -z "${key// }" || "$key" == \#* ]] && continue
  [[ -z "$value" ]] && continue
  heroku config:set --app "$APP_NAME" "$key=$value" >/dev/null
done < "$CONFIG_FILE"

# DATABASE_URL must already be supplied by the owner. This script deliberately
# does not provision an add-on or choose a billable plan.
heroku config:get DATABASE_URL --app "$APP_NAME" >/dev/null

if [[ ! -d .git ]]; then
  git init -q
  git add .
  git commit -qm "Prepare KHQR payment worker"
fi

heroku git:remote --app "$APP_NAME"
git push heroku HEAD:main
heroku ps:scale web=1 --app "$APP_NAME"
heroku open --app "$APP_NAME" --path /health

echo "Worker source deployed. Configure the matching main-site URL/key/secret only after reviewing the production rollout checklist."
