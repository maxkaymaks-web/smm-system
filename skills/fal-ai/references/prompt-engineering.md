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

### nano-banana-2 (Gemini-based)

- Понимает длинные, детальные промпты лучше чем Flux
- Хорошо реагирует на `thinking_level: "high"` для сложных сцен
- Поддерживает `enable_web_search: true` — полезно для актуальных визуальных трендов
- Отлично рендерит **текст** — описывай шрифт, расположение, стиль
- Поддерживает до 14 референс-изображений (через `image_urls` массив)
- Пиши на русском — понимает, переводить не обязательно

```
Хороший промпт для nano-banana-2:
"Минималистичная упаковка крема для рук премиум-класса, 
матовый белый флакон с золотым тиснением названия 'AURA', 
на фоне белого мрамора с тонкими серыми прожилками, 
мягкий диффузный свет студийный, никаких теней, 
overhead shot, product photography, luxury skincare"
```

### flux/schnell и flux/dev

- Работает лучше с английским
- Короткие промпты работают хорошо (< 100 слов)
- Style tokens: `"hyperrealistic"`, `"cinematic"`, `"illustration"`, `"watercolor"`
- Для деталей используй запятые, не длинные предложения
- `guidance_scale: 3.5` — стандарт; выше = строже следует промпту

```
"red fox sitting on snowy hill, golden hour, cinematic lighting, 
photorealistic, shallow depth of field, Canon 5D, nature photography"
```

### flux-pro/v1.1-ultra

- Лучший для фотореализма людей
- Указывай конкретные характеристики лица, кожи, освещения
- `aspect_ratio: "16:9"` оптимален для кино-кадров

### ideogram/v3

- Специализация: **текст на изображениях**
- Используй кавычки для текста: `"the word 'SALE' in bold red serif font"`
- Описывай шрифт, цвет, позицию, стиль

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
