import { readdirSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// 원본은 그대로 보관하고 런타임에서 사용할 WebP만 별도 생성한다.
const assets = fileURLToPath(new URL('../assets/', import.meta.url));
let before = 0;
let after = 0;
let count = 0;
function convert(directory, maxEdge) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const input = join(directory, entry.name);
    if (entry.isDirectory()) { convert(input, maxEdge); continue; }
    if (!/\.(png|jpe?g)$/i.test(entry.name)) continue;
    const output = join(assets, 'optimized', relative(assets, input).replace(/\.(png|jpe?g)$/i, '.webp'));
    mkdirSync(dirname(output), { recursive: true });
    // 장변 축소는 치수를 읽은 뒤 긴 축만 제한해 비율과 투명도를 보존한다.
    const info = spawnSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', input], { encoding: 'utf8' });
    if (info.status !== 0) throw new Error(info.stderr);
    const width = Number(info.stdout.match(/pixelWidth: (\d+)/)?.[1]);
    const height = Number(info.stdout.match(/pixelHeight: (\d+)/)?.[1]);
    if (!width || !height) throw new Error(`Invalid dimensions: ${input}`);
    const resize = Math.max(width, height) > maxEdge
      ? ['-resize', String(width >= height ? maxEdge : 0), String(height > width ? maxEdge : 0)] : [];
    const result = spawnSync('cwebp', ['-quiet', '-q', '82', '-alpha_q', '100', '-m', '6', ...resize, input, '-o', output], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || 'cwebp failed');
    before += statSync(input).size;
    after += statSync(output).size;
    count++;
  }
}
convert(join(assets, 'chat-stickers'), 512);
convert(join(assets, 'club-backgrounds'), 1536);
convert(join(assets, 'postcard-envelopes'), 768);
console.log(JSON.stringify({ count, before, after, reductionPercent: Math.round((1 - after / before) * 100) }));
