#!/usr/bin/env bash
# setup-cron.sh — установить ежедневные cron-задачи для spend отчётов.
# Запускать на prod-сервере (root@5.42.117.201).
#
# Расписание (UTC):
#   00:01 — snapshot текущих cumulative (baseline для следующего дня)
#   06:00 — daily отчёт за 24h → топик finance в Telegram
#   07:00 1-го числа — monthly отчёт → топик finance
#
# Логи: /var/log/smm-spend.log

set -euo pipefail

REPO=/root/smm-system
LOG=/var/log/smm-spend.log

# Создать файл лога если нет
touch "$LOG"

# Добавить новые jobs, не затрагивая существующие
crontab -l 2>/dev/null > /tmp/crontab-current || true

# Удалить старые SMM spend строки (если были)
grep -v 'smm-spend\|spend-report\|spend-send' /tmp/crontab-current > /tmp/crontab-new || true

cat >> /tmp/crontab-new <<EOF

# SMM spend tracking
1 0 * * *   cd $REPO && node tools/spend-report.mjs --snapshot >> $LOG 2>&1  # snapshot в полночь
0 6 * * *   cd $REPO && node tools/spend-send.mjs --period 24h >> $LOG 2>&1  # daily отчёт в 09:00 Moscow
0 7 1 * *   cd $REPO && node tools/spend-send.mjs --period month >> $LOG 2>&1  # monthly 1-го числа
EOF

crontab /tmp/crontab-new
rm /tmp/crontab-current /tmp/crontab-new

echo "✓ Cron задачи установлены:"
crontab -l | grep -A1 'SMM spend'
