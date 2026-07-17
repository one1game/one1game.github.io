const { FFmpeg } = require('@ffmpeg/ffmpeg');
const { fetchFile } = require('@ffmpeg/util');
const fs = require('fs');
const path = require('path');

const videos = [
  'img/game/fonsclep.mp4',
  'img/game/haus.mp4',
  'img/game/warp.mp4',
];

async function main() {
  const ffmpeg = new FFmpeg();
  ffmpeg.on('log', ({ message }) => { /* quiet */ });

  console.log('Loading ffmpeg.wasm...');
  await ffmpeg.load();
  console.log('Loaded!');

  for (const inputPath of videos) {
    const dir = path.dirname(inputPath);
    const name = path.basename(inputPath, '.mp4');
    const outputPath = path.join(dir, name + '_compressed.webm');
    const origSize = (fs.statSync(inputPath).size / 1024).toFixed(0);

    console.log(`\n=== Compressing: ${inputPath} (${origSize} KB) ===`);

    await ffmpeg.writeFile('input.mp4', await fetchFile(inputPath));

    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-c:v', 'libvpx-vp9',
      '-crf', '30',
      '-b:v', '0',
      '-an',
      '-deadline', 'realtime',
      '-cpu-used', '8',
      'output.webm'
    ]);

    const data = await ffmpeg.readFile('output.webm');
    fs.writeFileSync(outputPath, Buffer.from(data));

    const newSize = (data.length / 1024).toFixed(0);
    console.log(`  Done: ${origSize} KB -> ${newSize} KB (${(100 - newSize / origSize * 100).toFixed(0)}% smaller)`);
  }

  console.log('\n=== All done! ===');
}

main().catch(e => { console.error(e); process.exit(1); });
