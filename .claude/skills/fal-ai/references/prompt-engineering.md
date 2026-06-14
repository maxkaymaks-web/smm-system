# Prompt Engineering для fal.ai

## Главный принцип

Пиши как режиссёр, брифующий оператора — не как набор тегов.

❌ `"fox, snow, golden, cinematic, 8k, hdr, dramatic"`  
✅ `"a lone red fox perched on a wind-swept snow hill at golden hour, side-lit by warm amber sunlight, shallow depth of field, Canon 5D atmosphere, muted blues against warm fur"`

---

## Структура промпта: SLCT

| Блок | Что описывает | Пример |
|------|--------------|--------|
| **S**ubject | Главный объект: кто/что, сколько, детали | `"a young woman in her 30s, curly auburn hair, freckles"` |
| **L**ook/Lighting | Настроение, освещение, цвет | `"golden hour rim lighting, soft shadows, warm amber palette"` |
| **C**amera | Угол, движение, кадрирование | `"low angle, 35mm lens, shallow DOF, slight bokeh"` |
| **T**echnical | Стиль, разрешение, референс | `"photorealistic, editorial fashion photography, Vogue aesthetic"` |

**Формула:**  
`[Subject с деталями], [Setting/контекст], [Lighting], [Camera/composition], [Style/mood]`

---

## Reverse-Prompt: анализ → улучшение

Когда видишь хороший результат (или референс-изображение) — разбери его на составляющие:

### Шаги:
1. **Опиши предметно** — что именно изображено? Материалы, текстуры, позы
2. **Опиши свет** — откуда идёт, цвет, мягкий/жёсткий, время суток
3. **Опиши камеру** — угол, фокусное расстояние, глубина резкости
4. **Определи стиль** — фото/иллюстрация/кино, какой художник/бренд/издание
5. **Соберись в промпт** — от конкретного к общему

### Пример reverse-prompt:

Референс: тёмная мужская рука держит кофейную чашку, пар, кафе в боке  

```
Reverse-анализ:
- Subject: male hand (mid-30s skin tone) holding ceramic espresso cup, wisps of steam rising
- Lighting: warm tungsten backlight from left, creating rim on steam; dark foreground shadow
- Camera: macro lens ~90mm, extreme shallow DOF, background blurred to abstract warmth
- Style: commercial food photography, lifestyle editorial

Собранный промпт:
"close-up of a weathered male hand cradling a white ceramic espresso cup, 
delicate tendrils of steam backlit by warm tungsten light, 
blurred café interior bokeh in warm amber tones, 
90mm macro, commercial lifestyle photography, moody and intimate"
```

---

## Модельно-специфичные паттерны

> Разрешённые text-to-image модели в проекте — только две: `fal-ai/nano-banana-2` (default) и `openai/gpt-image-2` (для сложного текста). Всё остальное (Flux, Ideogram, Recraft, Seedream, Imagen, Qwen, SDXL и т.п.) — нельзя.

### nano-banana-2 (Gemini-based) — дефолт

- Понимает длинные детальные промпты, неплохо рендерит короткий текст
- Хорошо реагирует на `thinking_level: "high"` для сложных сцен
- Поддерживает `enable_web_search: true` — полезно для актуальных визуальных трендов
- Поддерживает до 14 референс-изображений (через `image_urls` массив)
- Пиши на русском — понимает, переводить не обязательно
- Когда нужно: фон, продукт, портрет, lifestyle, любой визуал без длинного текста на картинке

```
Хороший промпт для nano-banana-2:
"Минималистичная упаковка крема для рук премиум-класса, 
матовый белый флакон с золотым тиснением названия 'AURA', 
на фоне белого мрамора с тонкими серыми прожилками, 
мягкий диффузный свет студийный, никаких теней, 
overhead shot, product photography, luxury skincare"
```

### gpt-image-2 (OpenAI) — для сложного текста

- Специализация: **разборчивый текст / типографика на картинке**, в т.ч. длинные надписи, мульти-язык, мелкий шрифт, плотные параграфы
- `quality: "low"` — черновики ($0.005–0.012/img), `"medium"` — рабочее качество, `"high"` — финал ($0.15–0.40 в зависимости от размера)
- `image_size`: preset (`square_hd`, `portrait_4_3`, `landscape_16_9`, …) или `{ width, height }` до 3840px
- Цвет нейтральный (тёплый кастинг GPT Image 1.5 убран в 2.0)
- Когда нужно: плакаты, цитаты, инфографика, упаковка с длинным текстом, мульти-язычные надписи
- Когда НЕ нужно: обычный фон, портрет без текста, продукт без надписей — там nano-banana-2 в 2–10 раз дешевле

```
Хороший промпт для gpt-image-2:
"Vintage travel poster reading 'WELCOME TO SOCHI — БАЛТИКА 2026' 
in bold condensed serif at top, smaller hand-written caption 
'Black Sea Riviera since 1838' below, terracotta and cream palette, 
art-deco border with palm-tree silhouettes, slight paper grain texture"
```

### Kling / Veo / Sora (видео)

- Добавляй **движение камеры**: `"slow push-in"`, `"orbital shot"`, `"tracking from left"`
- Описывай **темп**: `"slow motion"`, `"timelapse"`, `"real-time"`
- Физика: `"realistic water physics"`, `"cloth simulation"`
- Для Kling: `cfg_scale: 0.5` — баланс творчество/точность

---

## Техники усиления

### Освещение (выбирай конкретное)
```
"golden hour backlight"        → тёплый силуэт
"soft diffused studio light"   → без теней, ровно
"dramatic rim lighting"        → контур, кино-эффект
"overcast daylight"            → мягкий, натуральный
"neon signs ambient"           → cyberpunk, ночной город
"candlelight"                  → тёплое, мерцающее
```

### Камера и линзы
```
"35mm lens"      → широкий, репортаж, натуральный угол
"85mm portrait"  → классический портрет, лёгкое сжатие
"macro 90mm"     → детали, поверхности
"fish-eye"       → экстремальный широкий угол
"tilt-shift"     → миниатюрный эффект, архитектура
```

### Референсные стили
```
"Vogue editorial"              → мода, глянец
"National Geographic"          → природа, документальность  
"Apple product photography"    → минимализм, белый фон
"A24 film still"               → кино-атмосфера, мрачно
"Wes Anderson aesthetic"       → симметрия, пастель, квирки
"brutalist architecture photo" → бетон, угловатость, грубость
```

---

## Анти-паттерны

| ❌ Плохо | ✅ Хорошо |
|----------|----------|
| `"beautiful woman"` | `"woman, early 30s, sharp cheekbones, short black hair, confident gaze"` |
| `"good lighting"` | `"warm side lighting at 45°, soft shadows on right side"` |
| `"cinematic"` | `"35mm anamorphic lens, letterbox ratio, teal-orange grade"` |
| `"realistic"` | `"photorealistic, Canon EOS R5, f/2.8, commercial photography"` |
| `"nice background"` | `"blurred urban street background, bokeh, warm evening light"` |
| Негативные описания `"no blur"` | Позитивные `"sharp, crisp focus throughout"` |
| Более 3 главных объектов | Max 2–3 в кадре |
| Текст без описания шрифта | `"bold sans-serif font, white, centered, neon glow effect"` |

---

## Итеративный цикл

```
1. Генерируй с базовым промптом
2. Смотри на результат: что работает? что нет?
3. Reverse-prompt: что конкретно нужно изменить?
   - Свет не тот? → переписать lighting-блок
   - Объект нечёткий? → добавить материалы/детали субъекта
   - Настроение не то? → пересмотреть palette + mood
4. Добавь seed предыдущего → сравни изменение
5. Зафиксируй лучший промпт
```

---

## Шаблоны для SMM-контента

### Продуктовое фото
```
"[product name], [material/texture], [color], on [surface], 
[lighting type], [angle/framing], [style: commercial/editorial/lifestyle], 
[background], [mood]"
```

### Портрет / lifestyle
```
"[person: age, gender, ethnicity, hair], [action/pose], 
in [setting], wearing [clothing], 
[lighting: type + direction], [camera: lens + DOF], 
[mood/tone], [style reference]"
```

### Архитектура / интерьер
```
"[space type], [materials: concrete/wood/marble], [key features], 
[time of day], [natural/artificial light], 
[camera: wide/normal], [style: minimalist/industrial/luxury]"
```

### Видео-промпт (добавляй к любому)
```
"[base scene description], 
[camera movement: slow push-in / orbital / tracking shot / handheld],
[duration: steady / gradually], [atmosphere]"
```
