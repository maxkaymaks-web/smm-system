import sharp from 'sharp';

const jobs = [
  { in: 'slide2.jpg', out: 'slide2_final.jpg', pos: 'top' },
  { in: 'slide3.jpg', out: 'slide3_final.jpg', pos: 'centre' },
  { in: 'slide4.jpg', out: 'slide4_final.jpg', pos: 'top' },
  { in: 'slide5.jpg', out: 'slide5_final.jpg', pos: 'centre' },
];

for (const j of jobs) {
  await sharp(j.in)
    .resize(1080, 1350, { fit: 'cover', position: j.pos })
    .jpeg({ quality: 90 })
    .toFile(j.out);
  console.log('done', j.out);
}
