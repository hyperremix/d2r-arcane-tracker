import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { types as d2sTypes } from '@dschu012/d2s';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';
import type { VaultLocationContext, VaultSourceFileType } from '../types/grail';

type StashConstants = {
  constants: d2sTypes.IConstantData;
  version: number;
};

function getStashConstants(ext: string): StashConstants {
  if (ext === '.d2i') {
    return { constants: constants99, version: 99 };
  }

  return { constants: constants96, version: 96 };
}

export async function removeItemFromSaveFile(
  filePath: string,
  fileType: VaultSourceFileType,
  itemId: number,
): Promise<void> {
  const buffer = await readFile(filePath);

  if (fileType === 'd2s') {
    const data = await d2s.read(buffer);
    data.items = data.items.filter((item) => item.id !== itemId);
    data.corpse_items = data.corpse_items.filter((item) => item.id !== itemId);
    data.merc_items = data.merc_items.filter((item) => item.id !== itemId);
    const result = await d2s.write(data);
    await writeFile(filePath, Buffer.from(result));
    return;
  }

  const ext = extname(filePath);
  const { constants, version } = getStashConstants(ext);
  const data = await d2stash.read(buffer, constants);

  for (const page of data.pages) {
    page.items = page.items.filter((item) => item.id !== itemId);
  }

  const result = await d2stash.write(data, constants, version);
  await writeFile(filePath, Buffer.from(result));
}

export async function addItemToSaveFile(
  filePath: string,
  fileType: VaultSourceFileType,
  item: d2sTypes.IItem,
  locationContext: VaultLocationContext,
  stashTab?: number,
  targetGridX?: number,
  targetGridY?: number,
): Promise<void> {
  const itemToWrite =
    targetGridX !== undefined && targetGridY !== undefined
      ? { ...item, position_x: targetGridX, position_y: targetGridY }
      : item;
  const buffer = await readFile(filePath);

  if (fileType === 'd2s') {
    const data = await d2s.read(buffer);

    if (locationContext === 'mercenary') {
      data.merc_items.push(itemToWrite);
    } else if (locationContext === 'corpse') {
      data.corpse_items.push(itemToWrite);
    } else {
      data.items.push(itemToWrite);
    }

    const result = await d2s.write(data);
    await writeFile(filePath, Buffer.from(result));
    return;
  }

  const ext = extname(filePath);
  const { constants, version } = getStashConstants(ext);
  const data = await d2stash.read(buffer, constants);

  const targetTab = stashTab ?? 0;

  while (data.pages.length <= targetTab) {
    data.pages.push({ name: '', type: 0, items: [] });
    data.pageCount = data.pages.length;
  }

  data.pages[targetTab].items.push(itemToWrite);

  const result = await d2stash.write(data, constants, version);
  await writeFile(filePath, Buffer.from(result));
}
