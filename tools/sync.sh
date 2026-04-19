#!/bin/bash
# sync.sh — синхронизация с GitHub
# Использование:
#   ./tools/sync.sh pull   — получить новые задачи от агентов
#   ./tools/sync.sh push   — отправить выполненную работу

ACTION=$1

if [ "$ACTION" = "pull" ]; then
  echo "📥 Получаю новые задачи..."
  git pull origin girl
  echo "✅ Готово. Смотри папку posts/inbox/ в своём проекте."

elif [ "$ACTION" = "push" ]; then
  echo "📤 Отправляю работу..."
  git add posts/ feedback/
  CHANGES=$(git diff --cached --name-only | wc -l)
  if [ "$CHANGES" -eq 0 ]; then
    echo "ℹ️  Нет изменений для отправки."
    exit 0
  fi
  git commit -m "girl: $(date '+%Y-%m-%d') работа выполнена"
  git push origin girl
  echo "✅ Готово. Разработчик увидит изменения."

else
  echo "Использование: ./tools/sync.sh pull | push"
  exit 1
fi
