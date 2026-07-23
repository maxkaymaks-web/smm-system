import { fal } from "@fal-ai/client";
import { writeFileSync } from "fs";


fal.config({ credentials: "f2e559a3-07a8-46d6-bad5-8703cd548531:80f6d8e95fb84328a08743948f0b3df9" });

const VIDEOS = [
  {
    id: "sabina_lawyer/C87F424oGmk",
    url: "https://instagram.fsac1-2.fna.fbcdn.net/o1/v/t2/f2/m86/AQP-rO8g7c3TLSysvnD4Exj9F1NwETb9lj9untKSWlLuquCVp97BawBuv6ksSHDMErwryZHZa_BoyjLY5OXCzKEzcT_s-c-BHOt3k0o.mp4?_nc_cat=102&_nc_oc=AdpgUk5E60krsz54PZgC5goMDyWDaTFyOm3FKZH8L1y8ma4K8On-MAuuq0Jptw-TZhw7aJbbC9T1rgIx3R5aZAT7&_nc_sid=5e9851&_nc_ht=instagram.fsac1-2.fna.fbcdn.net&_nc_ohc=x7E-ckb561EQ7kNvwEL94rd&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTUzMTk2MjI4MDczOTI0MiwiYXNzZXRfYWdlX2RheXMiOjc1MCwidmlfdXNlY2FzZV9pZCI6MTAwOTksImR1cmF0aW9uX3MiOjMwLCJ1cmxnZW5fc291cmNlIjoid3d3In0%3D&ccb=17-1&vs=ee56eb2ee62d6dea&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8zRjRBOEY2REREMEUzREZCNDY0QUE0MjEwOEFBNDJBOF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYR2lnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8xNDg5MTkyOTI1MDY5MjE4XzU5NDA2Mjc3MDE0OTUwNzgwNDcubXA0FQICyAESACgAGAAbAogHdXNlX29pbAExEnByb2dyZXNzaXZlX3JlY2lwZQExFQAAJtSG7Lj407gFFQIoAkMzLBdAPghysCDEnBgSZGFzaF9iYXNlbGluZV8xX3YxEQB1_gdl5p0BAA&_nc_gid=dflIaQFeqLN6VrlNi7xM9A&_nc_ss=72689&_nc_zt=28&oh=00_AQBPptAXYm3McZOeDMyxOWvoXZYsJts7DInsiMjEaBcMsA&oe=6A63C163",
    views: 829727,
    ratio: 192.3,
    caption: "Челлендж в комментах — провокационный хук",
  },
  {
    id: "insta_advokat/DGAPrOCtYyo",
    url: "https://scontent-iad3-2.cdninstagram.com/o1/v/t2/f2/m367/AQOk0P3Y66aW2l8-BSWlLfuRvHlNglwq7nsr3BKtjNfZxIHqBLqVq-gPeXnAG0WJbPpeC5SaNKJoL6vGeGQ-qj0duAH4KTr2bjCOFvE.mp4?_nc_cat=111&_nc_sid=5e9851&_nc_ht=scontent-iad3-2.cdninstagram.com&_nc_ohc=IaRatCBlqFgQ7kNvwHrhinF&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6NDA5Njc0NTk3MDY0OTU1MSwiYXNzZXRfYWdlX2RheXMiOjUyNSwidmlfdXNlY2FzZV9pZCI6MTAwOTksImR1cmF0aW9uX3MiOjM4LCJ1cmxnZW5fc291cmNlIjoid3d3In0%3D&ccb=17-1&vs=acdbb71ec99dbb0c&_nc_vs=HBksFQIYQGlnX2VwaGVtZXJhbC9ENDQ0MkYxREYwNUQ5MzQwNUUyOEFFOEI3RUI5M0Q5Rl92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYRmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC81OTM3ODA5MjY4NjMwMjdfNzk3ODI1MjY0OTgwMDQ2MjE1NC5tcDQVAgLIARIAKAAYABsCiAd1c2Vfb2lsATEScHJvZ3Jlc3NpdmVfcmVjaXBlATEVAAAmnqeGhYD-xg4VAigCQzMsF0BDHdLxqfvnGBJkYXNoX2Jhc2VsaW5lXzFfdjERAHX-B2XmnQEA&_nc_gid=LwrfbuKvCp8TQ1_C1vR94w&_nc_ss=72a8c&_nc_zt=28&oh=00_AQAYyOQ7UZuSi1fhuYy0FucwA77WfSA62SfezsUvPTAVJQ&oe=6A67DBE0",
    views: 815674,
    ratio: 20.7,
    caption: "Большая перемена — событийный коллаб",
  },
  {
    id: "sabina_lawyer/DW5tovRjMP0",
    url: "https://scontent-hou1-1.cdninstagram.com/o1/v/t2/f2/m86/AQPf6hG4zqYE9Tf-XK_cJsQPZlvmlrfu-vckTIT1KpE7BC7yKTvle25kI-MNY8SqZrcXeGJLMruox5RY7KarLejrHByWvpLQlHz_B_w.mp4?_nc_cat=103&_nc_sid=5e9851&_nc_ht=scontent-hou1-1.cdninstagram.com&_nc_ohc=eKLBQh0jylUQ7kNvwGM_k7w&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTgwNjU2OTAyNjc0NDA1MzAsImFzc2V0X2FnZV9kYXlzIjoxMDUsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoxMiwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=68701ba7ed951e2e&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8xQzQ0MzJEQkQ2Q0NCNDYxQUQ4RjRGRUMxMDMzOEI4Rl92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzVENDIzNzIxQzRFQkVBODBEQkZFNjExMkRERUFCMDlCX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACak1pqwyamXQBUCKAJDMywXQCkhysCDEm8YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=MLG-cJ1imVXdBjdIu159qA&_nc_ss=7ca8c&_nc_zt=28&oh=00_AQCxI9RT9KHEJJnFukR6ipffeuq_eGiQQ1486Wr4rt1aGg&oe=6A63F00C",
    views: 72741,
    ratio: 16.9,
    caption: "Кто ещё такой?😂 — мем-самопрезентация",
  },
  {
    id: "advokatzhorin/C3qDGFRo5pi",
    url: "https://scontent-atl3-2.cdninstagram.com/o1/v/t2/f2/m82/AQPDKRp96IxzdSDstrV6MVslw8suImMQ8d-9Q1l3f1eUKriw4hWVs-SL81o-o686jt2Hv1EA7gjXEW9ICLb1hrHaR5-7C4SLH-2B-P4.mp4?_nc_cat=102&_nc_sid=5e9851&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_ohc=HHX9QrJS7XAQ7kNvwEAXfXk&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6NzQxNzM1Mjg4ODI4NDc2NiwiYXNzZXRfYWdlX2RheXMiOjg4MSwidmlfdXNlY2FzZV9pZCI6MTAwOTksImR1cmF0aW9uX3MiOjg3LCJ1cmxnZW5fc291cmNlIjoid3d3In0%3D&ccb=17-1&vs=c70739404eff78c7&_nc_vs=HBksFQIYT2lnX3hwdl9yZWVsc19wZXJtYW5lbnRfcHJvZC9CMjRBM0I1RTI3RDkzRjI0ODJBNjAzNkY4QkE2Q0ZBM192aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYR2lnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC83MTY2Nzk3NzYwMTAxNDUwXzEzMjg2ODcwNjg2MjkzMzM5OTUubXA0FQICyAESACgAGAAbAogHdXNlX29pbAExEnByb2dyZXNzaXZlX3JlY2lwZQExFQAAJrzZo8Hhgq0aFQIoAkMzLBdAVfjU_fO2RhgSZGFzaF9iYXNlbGluZV8xX3YxEQB1_gdl5p0BAA&_nc_gid=8y5Bw-_FophVEYa-5wq_1g&_nc_ss=72689&_nc_zt=28&oh=00_AQB5jhEsm-uaX1zIsnCQmIQlqgQOwcRfvByQyGJlZlSpIQ&oe=6A63C323",
    views: 1466073,
    ratio: 11.0,
    caption: "Вправе ли полиция требовать показать телефон?",
  },
  {
    id: "advokatzhorin/C2o16bVI-vJ",
    url: "https://scontent-lax3-2.cdninstagram.com/o1/v/t2/f2/m82/AQMLhACM0zypR7uF1HRfpM9r8dijXxzlrE5mQ96B9GM4FpQDnT2vLTTE9PzvLwpKTPCCfhGtHKUCDdXjVxNnDNhlj4Qkrq9imYCPyGc.mp4?_nc_cat=100&_nc_sid=5e9851&_nc_ht=scontent-lax3-2.cdninstagram.com&_nc_ohc=DhOPS-hTtngQ7kNvwEFGzUA&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6NDAxMjEyNzI1NjIzODE4LCJhc3NldF9hZ2VfZGF5cyI6OTA3LCJ2aV91c2VjYXNlX2lkIjoxMDk5OSwiZHVyYXRpb25fcyI6MjgsInVybGdlbl9zb3VyY2UiOiJ3d3cifQ%3D%3D&ccb=17-1&vs=355a3133c80596df&_nc_vs=HBksFQIYT2lnX3hwdl9yZWVsc19wZXJtYW5lbnRfcHJvZC8yRTQ2QTI3RDUzQjYzNzZGRjQyRkJFMTg3OUY2OThCQl92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYRmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC80MTg0ODM0MjA1MTQyNTVfNDMzMzEyOTg5NjcyNzY1MTExMy5tcDQVAgLIARIAKAAYABsCiAd1c2Vfb2lsATEScHJvZ3Jlc3NpdmVfcmVjaXBlATEVAAAmlPDr39O5tgEVAigCQzMsF0A8_S8an753GBJkYXNoX2Jhc2VsaW5lXzFfdjERAHX-B2XmnQEA&_nc_gid=uwJoVPVxbjrZNo255eMBsw&_nc_ss=72a8c&_nc_zt=28&oh=00_AQDfizbnrxUxD-6gw6lE2fTnyRyV2CTAX10rY7FowFa2-Q&oe=6A63C73D",
    views: 661490,
    ratio: 5.0,
    caption: "Вправе ли работник игнорировать работодателя после рабочего дня?",
  },
];

const PROMPT = `Ты эксперт по анализу Instagram Reels. Проанализируй это видео ПОДРОБНО:
1. ХУК (первые 2 секунды): что в кадре, текст на экране, что цепляет
2. РАСКАДРОВКА ПО СЕКУНДАМ: каждая сцена с таймингом, что в кадре, текст оверлей, монтажные приёмы
3. РЕЧЬ/СУБТИТРЫ: что говорит за кадром дословно, есть ли субтитры
4. МУЗЫКА: жанр, темп, настроение, название если слышно
5. CTA внутри видео: есть ли призыв (лайк/коммент/репост/директ), точный текст
6. ГИПОТЕЗЫ ПОЧЕМУ ЗАЛЕТЕЛО: 3-5 причин, психологический триггер, фактор удержания
Отвечай по-русски. Описывай только то, что реально видишь/слышишь.`;

async function analyzeVideo(video) {
  console.log(`\n[${video.id}] starting analysis...`);
  try {
    const result = await fal.subscribe("openrouter/router/video", {
      input: {
        video_urls: [video.url],
        prompt: PROMPT,
        model: "google/gemini-2.5-flash",
      },
      logs: false,
    });
    const text = result?.output || result?.data?.output || JSON.stringify(result);
    console.log(`[${video.id}] DONE ✓`);
    return { ...video, analysis: text };
  } catch (e) {
    console.error(`[${video.id}] ERROR: ${e.message}`);
    return { ...video, analysis: `ERROR: ${e.message}` };
  }
}

const results = await Promise.all(VIDEOS.map(analyzeVideo));

const outPath = "/private/tmp/claude-501/-Users-maxkaymaks-CLAUDE-smm-system/f85dc6be-8250-4527-8db4-a941ca070bd6/scratchpad/omnitrust_analysis.json";
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`\nSaved to ${outPath}`);
