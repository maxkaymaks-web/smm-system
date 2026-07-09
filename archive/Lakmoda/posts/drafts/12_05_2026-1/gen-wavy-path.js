// Генерирует SVG path для волнистого квадрата (clipPath, objectBoundingBox = 0..1)
// 4 стороны × N бугров, амплитуда A. Гладкая кривая через cubic Beziers.

const N = 4;         // бугров на сторону
const A = 0.032;     // амплитуда (в долях стороны)
const PAD = 0.05;    // отступ от 0/1 чтобы кривая не вылезала за viewBox
const MID = 0.05;    // позиция средней линии стороны (0.05 = внутри box на 5%)

function segPoints(side) {
  // side: 'top' | 'right' | 'bottom' | 'left'
  // Возвращает массив точек [x, y] на этой стороне (между двумя углами)
  // Бугры чередуются: out, in, out, in (out = удаление от центра, in = приближение)
  const pts = [];
  const total = N * 2; // количество сегментов = бугров × 2 (восход + спад)
  for (let i = 0; i <= total; i++) {
    const t = i / total;            // 0..1 по длине стороны
    // позиция вдоль стороны
    const span = 1 - 2 * PAD;
    const along = PAD + span * t;

    // y = смещение от опорной линии (0 для top/bot, 0 для left/right в перпендикуляре)
    // Бугор out = вынос наружу. Чередуем: первый out, второй in, и т.д.
    let off;
    if (i === 0 || i === total) off = 0; // в углах строго на линии
    else {
      const halfIdx = (i - 1) / 2;
      const isCrest = (Math.floor(halfIdx) % 2 === 0);
      // пик в середине между точками — но мы располагаем точки на пиках/впадинах
      const direction = (i % 2 === 1) ? (isCrest ? -1 : +1) : (isCrest ? +1 : -1);
      off = direction * A;
    }

    let x, y;
    if (side === 'top')    { x = along; y = MID + off; }
    if (side === 'right')  { x = 1 - MID - off; y = along; }
    if (side === 'bottom') { x = 1 - along; y = 1 - MID - off; }
    if (side === 'left')   { x = MID + off; y = 1 - along; }
    pts.push([x, y]);
  }
  return pts;
}

function smoothPath(allPts) {
  // Cubic Bezier через смежные точки с контрольными точками на полпути.
  // Для гладких волн используем «catmull-rom-like» подход.
  let d = `M ${allPts[0][0].toFixed(4)} ${allPts[0][1].toFixed(4)}`;
  const n = allPts.length;
  for (let i = 0; i < n; i++) {
    const p0 = allPts[(i - 1 + n) % n];
    const p1 = allPts[i];
    const p2 = allPts[(i + 1) % n];
    const p3 = allPts[(i + 2) % n];
    const tension = 0.22;
    const cp1 = [p1[0] + (p2[0] - p0[0]) * tension, p1[1] + (p2[1] - p0[1]) * tension];
    const cp2 = [p2[0] - (p3[0] - p1[0]) * tension, p2[1] - (p3[1] - p1[1]) * tension];
    d += ` C ${cp1[0].toFixed(4)},${cp1[1].toFixed(4)} ${cp2[0].toFixed(4)},${cp2[1].toFixed(4)} ${p2[0].toFixed(4)},${p2[1].toFixed(4)}`;
  }
  d += ' Z';
  return d;
}

const top    = segPoints('top');
const right  = segPoints('right').slice(1);   // первая точка = угол (совпадает с last top)
const bottom = segPoints('bottom').slice(1);
const left   = segPoints('left').slice(1, -1); // последняя точка = старт (исключим)

const all = [...top, ...right, ...bottom, ...left];
const d = smoothPath(all);
console.log(d);
