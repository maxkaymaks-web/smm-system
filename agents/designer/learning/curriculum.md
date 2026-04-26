# Curriculum — Дизайнер Self-Learning

> Этот файл читается скриптом `tools/designer_learning.py` каждый день.
> Агент выбирает стиль случайно, изучает Instagram-референсы, обновляет knowledge/.

---

## Принцип классификации

Делим НЕ по нишам, а по **характеру и визуальному стилю**.
Один стиль может подходить разным проектам и нишам.

---

## Стили

### A. НЕЖНОСТЬ И ЭСТЕТИКА
**Характер:** мягкость, забота, тактильность, тепло, editorial beauty
**Цвета:** кремовые, пудровые, nude, ivory, warm beige
**Типографика:** тонкий serif, много воздуха, мелкий трекинг
**Для проектов:** BeautyCulture и подобные (spa, skincare, wellness)
**Instagram аккаунты для обучения:**
- tatcha
- laneige_us
- aesopskincare
- summer_fridays
- byhumankind
- mbody.studio

---

### B. ТЕХНОЛОГИЧНОСТЬ И ИННОВАЦИИ
**Характер:** точность, данные, инженерия, прогресс, B2B доверие
**Цвета:** белый, чёрный, тёмно-синий, металлик, монохром
**Типографика:** bold sans-serif, строгие сетки, цифры как акцент
**Для проектов:** Bioprintex/Limatex и подобные (tech, industrial, B2B)
**Instagram аккаунты для обучения:**
- dyson
- notionhq
- figma
- linear_app
- spacex

---

### C. РОСКОШЬ И ПРЕМИУМ
**Характер:** heritage, exclusivity, quiet luxury, ювелирная точность
**Цвета:** чёрный, золото, ivory, глубокий зелёный, тёмный бордо
**Типографика:** крупный serif, uppercase, lots of whitespace
**Для проектов:** будущие luxury клиенты (ювелирка, premium hospitality)
**Instagram аккаунты для обучения:**
- chanelofficial
- dior
- bottegaveneta
- louboutinworld

---

### D. ЭНЕРГИЯ И ЛАЙФСТАЙЛ
**Характер:** движение, яркость, молодость, эмоция, bold personality
**Цвета:** яркие контрастные, neon акценты, насыщенные
**Типографика:** oversized bold, playful, expressive
**Для проектов:** будущие фитнес, фуд, lifestyle клиенты
**Instagram аккаунты для обучения:**
- gymshark
- oatly
- frankbody
- huel

---

### E. ПРОМПТ-ИНЖИНИРИНГ
**Характер:** не стиль — направление обучения. Изучение как писать промпты для fal.ai
**Источники:** веб (не Instagram) — fal.ai models page, PromptHero, блоги
**Фокус:** новые модели fal.ai, техники промптинга, aspect ratios, style keywords
**Instagram аккаунты:** — (веб-поиск вместо Instagram)

---

## Ротация

Скрипт выбирает стиль случайно каждый день.
Веса: A=25%, B=25%, C=15%, D=15%, E=20%

---

## Что записываем после обучения

По каждой итерации в `agents/designer/knowledge/references.md`:
- Новые визуальные паттерны найденные у аккаунтов
- Конкретные приёмы с примерами (не абстрактно)
- Обновлённые fal.ai промпты если изучали промпт-инжиниринг

В `agents/designer/learning/log.md`:
- Дата, стиль, что изучали, короткий итог
