import type { PostImage } from '@/api/types';

/**
 * 독후감 본문 안의 사진 자리.
 *
 * 사진은 글을 쓰다 올린 자리에 그대로 선다 — 본문 마크다운에 제 줄 하나로 `![사진](image:123)` 를 남긴다.
 * 표준 이미지 문법이라 서버 발췌(PostExcerpt)가 통째로 걷어 내고, 본문을 다른 곳에서 읽어도 깨지지 않는다.
 * 올라가는 중인 사진은 아직 id 가 없어 `upload:<타일 키>` 로 적어 두고, 올리기 직전에 id 로 바꾼다(finalizePhotoLines).
 * 본문에 자리가 없는 사진(사진을 따로 붙이던 옛 글)은 상세가 본문 앞에 모아 그린다.
 */
export type PhotoRef = { kind: 'image'; id: number } | { kind: 'upload'; key: string };

/** 사진 줄 — 줄 하나가 통째로 사진 표시일 때만. 앞뒤 빈칸은 봐준다. 타일 키는 영문·숫자·`_`·`-` 뿐이다. */
const PHOTO_LINE = /^\s*!\[[^\]\n]*\]\((image|upload):([A-Za-z0-9_-]+)\)\s*$/;

/** 사진 줄이면 무엇을 가리키는지, 아니면 null. */
export function parsePhotoLine(line: string): PhotoRef | null {
  const match = PHOTO_LINE.exec(line);
  if (!match) return null;
  if (match[1] === 'upload') return { kind: 'upload', key: match[2] };
  const id = Number(match[2]);
  return Number.isSafeInteger(id) ? { kind: 'image', id } : null;
}

/** 본문에 넣을 사진 줄. */
export function photoMarker(ref: PhotoRef): string {
  return `![사진](${ref.kind === 'image' ? `image:${ref.id}` : `upload:${ref.key}`})`;
}

/** 본문에 자리를 잡은 사진 id — 나온 차례대로, 겹치면 처음 것만. */
export function photoIdsIn(md: string): number[] {
  const ids: number[] = [];
  for (const line of md.split('\n')) {
    const ref = parsePhotoLine(line);
    if (ref?.kind === 'image' && !ids.includes(ref.id)) ids.push(ref.id);
  }
  return ids;
}

/** 조건에 맞는 사진 줄을 걷어 낸다 — 그 줄 뒤의 빈 줄 하나도 함께 걷어 문단 사이가 벌어지지 않게. */
export function removePhotoLines(md: string, match: (ref: PhotoRef) => boolean): string {
  const out: string[] = [];
  let dropBlank = false;
  for (const line of md.split('\n')) {
    const ref = parsePhotoLine(line);
    if (ref && match(ref)) {
      dropBlank = out.length === 0 || out[out.length - 1].trim() === '';
      continue;
    }
    if (dropBlank && line.trim() === '') {
      dropBlank = false;
      continue;
    }
    dropBlank = false;
    out.push(line);
  }
  return out.join('\n');
}

/**
 * 고치기를 시작할 때 — 본문에 자리가 없는 사진을 글 맨 앞에 한 줄씩 넣는다.
 * 옛 글은 사진을 본문 앞에 모아 보여 줬으니 같은 자리에서 시작한다. 넣은 장수를 돌려줘 화면이 한 줄로 알린다.
 */
export function placeLoosePhotos(md: string, images: readonly PostImage[]): { text: string; placed: number } {
  const used = new Set(photoIdsIn(md));
  const loose = images.filter((image) => !used.has(image.id));
  if (loose.length === 0) return { text: md, placed: 0 };
  const head = loose.map((image) => photoMarker({ kind: 'image', id: image.id })).join('\n\n');
  return { text: md.trim() ? `${head}\n\n${md}` : head, placed: loose.length };
}

/**
 * 올리기 직전 — 다 올라간 사진의 `upload:` 줄을 `image:` 로 바꾸고, 올라가지 못했거나 뗀 사진의 줄은 걷어 낸다.
 * imageIds 는 본문에 나온 차례가 먼저, 본문에 자리가 없는 사진이 그 뒤다 — 서버가 이 차례대로 붙이므로
 * 카드 포스터(첫 사진)가 글의 첫 사진이 된다.
 */
export function finalizePhotoLines(
  md: string,
  photos: readonly { key: string; status: string; image?: PostImage }[],
): { bodyMd: string; imageIds: number[] } {
  const uploaded = new Map<string, number>();
  const doneIds: number[] = [];
  for (const photo of photos) {
    if (photo.status !== 'done' || !photo.image) continue;
    uploaded.set(photo.key, photo.image.id);
    doneIds.push(photo.image.id);
  }
  const swapped = md.split('\n').map((line) => {
    const ref = parsePhotoLine(line);
    const id = ref?.kind === 'upload' ? uploaded.get(ref.key) : undefined;
    return id != null ? photoMarker({ kind: 'image', id }) : line;
  }).join('\n');
  const bodyMd = removePhotoLines(swapped, (ref) => ref.kind === 'upload' || !doneIds.includes(ref.id));
  const placed = photoIdsIn(bodyMd);
  return { bodyMd, imageIds: [...placed, ...doneIds.filter((id) => !placed.includes(id))] };
}
