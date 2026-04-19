# Проектный оркестратор: Студия красоты «Культура»

## Контекст проекта

Клиент: Студия красоты «Культура» (Дарья Сопкина, СПб)
Агентство: bit&pix · Специалист: Максим

## При каждом запуске читай

1. `projects/BeautyCulture_DariaSopkina/context.md` — контекст клиента
2. `projects/BeautyCulture_DariaSopkina/strategy.md` — стратегия
3. `projects/BeautyCulture_DariaSopkina/content-plan.md` — текущий план
4. `global/rules.md` — общие правила
5. `global/standards.md` — критерии качества
6. `projects/BeautyCulture_DariaSopkina/feedback/` — непрочитанный фидбек → обрабатывай первым

## ЖЁСТКИЕ ОГРАНИЧЕНИЯ — повторяю для агентов

- ❌ Хэштеги — полный запрет
- ❌ Скидки/акции без одобрения Дарьи
- ❌ Мифы о лазере, RSL vs LPG, лазер vs шугаринг
- ❌ Личная история Дарьи, она лично в контенте

## Формат ТЗ для копирайтера

```
Прочитай agents/copywriter/skill.md.

Контекст клиента:
[вставить полное содержимое context.md]

Глобальные правила:
[вставить содержимое global/rules.md]

Задача: написать пост №[NN]
Рубрика: [из контент-плана]
Тема: [точная тема из плана]
Формат: [пост / карусель / видео]
CTA: запись через сообщения сообщества ВКонтакте
Особые требования: без хэштегов, без скидок, экспертный тон

Сохранить в: projects/BeautyCulture_DariaSopkina/posts/drafts/post-NN.md
```

## Формат ТЗ для дизайнера

```
Прочитай agents/designer/skill.md.

Контекст дизайна клиента:
- Размер: 1080×1350px (портрет)
- Шрифт заголовков: Cormorant Garamond
- Шрифт текста: Raleway
- Светлый фон: #F5F0EA, тёмный фон: #1a1714
- Стиль: минималистичный, плёночная эстетика
- Логотип «Культура»: top-right мелко

Текст поста: [содержимое post-NN.md]
Промпт для картинки: [раздел "Промпт для дизайнера" из post-NN.md]
Тип холста: портрет 1080×1350

Сохранить HTML: projects/BeautyCulture_DariaSopkina/posts/drafts/post-NN.html
Запустить рендер: node tools/render-html.js projects/BeautyCulture_DariaSopkina/posts/drafts/post-NN.html projects/BeautyCulture_DariaSopkina/posts/drafts/post-NN.png
```

## Задача на следующий запуск

Создать пост №01: Карусель «Комплексы лазерной эпиляции S/M/L/XL — выбери свой» (04 Продающий)
