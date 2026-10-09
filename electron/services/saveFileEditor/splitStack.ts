import type { types as d2sTypes } from '@dschu012/d2s';
import type { VaultLocationContext, VaultSourceFileType } from '../../types/grail';
import { normalizeItemCodeKey, resolveStackCount, SHARED_TAB_COUNT } from '../../utils/d2rFormat';
import { resolveModernJmSectors } from './d2iSectors';
import { resolveTargetCharacterClass } from './equipValidation';
import { findItemByCode } from './itemLocators';
import { addItemToSaveFileUnlocked } from './itemOperations';
import { withD2SLocationContext, withTargetCoordinates } from './itemPlacement';
import {
  type ResourceStackMatchHint,
  readResourceSectorEntries,
  reduceItemInModernStashResourceSector,
  reduceResourceStackEntryInModernStashBuffer,
  selectResourceStackEntry,
} from './modernStashResourceSectors';
import { addItemToModernStashSharedPageBuffer } from './modernStashSharedTabs';
import { getItemQuantity, withQuantityOne, withReducedQuantity } from './resourceStacks';
import {
  assertWholeFileWritable,
  assertWritableSaveFile,
  type CharacterSaveFile,
  type ClassicStashFile,
  decodeSaveFile,
  openSaveFile,
} from './saveFileAdapters';
import { isSameSaveFile, writeSaveFile } from './saveFileWrites';

/**
 * Splits units off a stack into separate items.
 */

export interface SplitStackTarget {
  targetFilePath: string;
  targetFileType: VaultSourceFileType;
  targetLocationContext: VaultLocationContext;
  targetStashTab?: number;
  targetGridX: number;
  targetGridY: number;
}

export interface SplitStackOptions {
  sourceFilePath: string;
  sourceFileType: VaultSourceFileType;
  sourceStashTab: number;
  sourceItemCode: string;
  /** Raw JSON of the source IItem. Required when sourceFileType is 'd2i' (modern stash). */
  sourceRawItemJson?: string;
  splitCount: number;
  targets: SplitStackTarget[];
}

/**
 * Splits `splitCount` items off a stack and places one item at each target.
 *
 * Character saves (.d2s) and classic stashes (.sss/.d2x and pre-v105 .d2i) are edited through the
 * d2s library. A modern stash (.d2i v105+) source needs `sourceRawItemJson`: its resource-tab stack
 * (runes/gems/materials) is reduced and the copies go to the writable shared tabs (0–4) or to other
 * save files. A modern stash source without `sourceRawItemJson`, or a modern stash target outside
 * the shared tabs, throws MODERN_STASH_READ_ONLY.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Coordinates the single-file and multi-file modern stash splits in one operation; character saves and classic stashes are split by the helpers below.
export async function splitStackInSaveFileUnlocked(options: SplitStackOptions): Promise<void> {
  const { sourceFilePath, sourceFileType, sourceItemCode } = options;
  const normalizedCode = normalizeItemCodeKey(sourceItemCode);
  if (!normalizedCode) {
    throw new Error('sourceItemCode is required');
  }

  if (options.splitCount <= 0) {
    throw new Error('splitCount must be positive');
  }

  const source = await openSaveFile(sourceFilePath, sourceFileType);

  // Modern stash resource tabs (d2i v105+) support stack splitting into shared tabs.
  // Prefer a single-buffer mutation path when source and targets are in the same modern stash file.
  if (source.format.kind === 'modernStash' && options.sourceRawItemJson) {
    if (typeof options.sourceRawItemJson !== 'string' || !options.sourceRawItemJson.trim()) {
      throw new Error('sourceRawItemJson is required for modern stash sources');
    }
    let sourceItem: d2sTypes.IItem;
    try {
      sourceItem = JSON.parse(options.sourceRawItemJson) as d2sTypes.IItem;
    } catch {
      throw new Error('sourceRawItemJson must be valid JSON');
    }

    const requestedSplitCount = Math.min(options.splitCount, options.targets.length);
    if (requestedSplitCount <= 0) {
      return;
    }

    const sourceHint: ResourceStackMatchHint = {
      positionX:
        typeof sourceItem.position_x === 'number' && Number.isFinite(sourceItem.position_x)
          ? sourceItem.position_x
          : undefined,
      positionY:
        typeof sourceItem.position_y === 'number' && Number.isFinite(sourceItem.position_y)
          ? sourceItem.position_y
          : undefined,
      stackCount:
        typeof sourceItem.quantity === 'number' && Number.isInteger(sourceItem.quantity)
          ? sourceItem.quantity
          : undefined,
    };

    const splitTargets = options.targets.slice(0, requestedSplitCount);
    const isSingleModernFileSplit = splitTargets.every(
      (target) =>
        isSameSaveFile(
          sourceFilePath,
          sourceFileType,
          target.targetFilePath,
          target.targetFileType,
        ) &&
        target.targetFileType === 'd2i' &&
        target.targetLocationContext === 'stash' &&
        typeof target.targetStashTab === 'number' &&
        target.targetStashTab < SHARED_TAB_COUNT,
    );

    if (isSingleModernFileSplit) {
      let workingBuffer = source.buffer;
      const { metadata, jmSectors } = resolveModernJmSectors(workingBuffer);
      const entries = await readResourceSectorEntries(workingBuffer, jmSectors, metadata.version);
      const sourceEntry = selectResourceStackEntry(entries, normalizedCode, sourceHint);
      if (!sourceEntry) {
        throw new Error(`Stack item '${sourceItemCode}' not found in modern resource sectors`);
      }

      const sourceAvailable = resolveStackCount(sourceEntry.item);
      const actualSplitCount = Math.min(requestedSplitCount, sourceAvailable);
      if (actualSplitCount <= 0) {
        return;
      }

      // First reduce source in memory, then add placed copies; persist only once.
      workingBuffer = await reduceResourceStackEntryInModernStashBuffer(
        workingBuffer,
        sourceEntry,
        actualSplitCount,
      );

      for (let i = 0; i < actualSplitCount; i += 1) {
        const target = splitTargets[i];
        const copy = withQuantityOne(
          withTargetCoordinates(sourceEntry.item, target.targetGridX, target.targetGridY),
        );
        (copy as { id?: unknown }).id = undefined;
        workingBuffer = await addItemToModernStashSharedPageBuffer(
          workingBuffer,
          copy,
          target.targetStashTab as number,
          target.targetGridX,
          target.targetGridY,
        );
      }

      await writeSaveFile(sourceFilePath, workingBuffer);
      return;
    }

    // Only place as many copies as the source stack really holds; otherwise the extra copies
    // would be created out of thin air once the source entry is reduced to zero.
    const { metadata: countMetadata, jmSectors: countSectors } = resolveModernJmSectors(
      source.buffer,
    );
    const countEntries = await readResourceSectorEntries(
      source.buffer,
      countSectors,
      countMetadata.version,
    );
    const countEntry = selectResourceStackEntry(countEntries, normalizedCode, sourceHint);
    if (!countEntry) {
      throw new Error(`Stack item '${sourceItemCode}' not found in modern resource sectors`);
    }
    const placeableTargets = splitTargets.slice(
      0,
      Math.min(splitTargets.length, resolveStackCount(countEntry.item)),
    );

    for (const target of placeableTargets) {
      // Modern .d2i shared stash pages (tabs 0–4) are writable via sector patching.
      const isModernSharedStash =
        target.targetFileType === 'd2i' &&
        target.targetLocationContext === 'stash' &&
        typeof target.targetStashTab === 'number' &&
        target.targetStashTab < SHARED_TAB_COUNT;
      if (!isModernSharedStash) {
        await assertWritableSaveFile(target.targetFilePath, target.targetFileType);
      }

      const copy = withQuantityOne(
        withTargetCoordinates(sourceItem, target.targetGridX, target.targetGridY),
      );
      (copy as { id?: unknown }).id = undefined;
      await addItemToSaveFileUnlocked({
        filePath: target.targetFilePath,
        fileType: target.targetFileType,
        item: copy,
        locationContext: target.targetLocationContext,
        stashTab: target.targetStashTab,
        targetGridX: target.targetGridX,
        targetGridY: target.targetGridY,
      });
    }

    // Reduce the source resource-stack quantity after placements in multi-file flows.
    await reduceItemInModernStashResourceSector(
      sourceFilePath,
      normalizedCode,
      placeableTargets.length,
      sourceHint,
    );
    return;
  }

  // Validate the source and all targets before touching any file. A modern stash source without
  // raw item JSON cannot be split.
  assertWholeFileWritable(source);
  for (const target of options.targets) {
    await assertWritableSaveFile(target.targetFilePath, target.targetFileType);
  }
  const decoded = await decodeSaveFile(source);

  // Never take more units out of the source than there are placements for: every unit removed
  // from the stack must end up as a placed copy, otherwise it is lost.
  const placementLimit = Math.min(options.splitCount, options.targets.length);
  const isTargetInSourceFile = (target: SplitStackTarget): boolean =>
    isSameSaveFile(sourceFilePath, sourceFileType, target.targetFilePath, target.targetFileType);

  if (decoded.kind === 'character') {
    await splitCharacterStack(
      decoded,
      options,
      normalizedCode,
      placementLimit,
      isTargetInSourceFile,
    );
    return;
  }

  await splitClassicStashStack(
    decoded,
    options,
    normalizedCode,
    placementLimit,
    isTargetInSourceFile,
  );
}

async function placeCopiesInOtherFiles(
  copies: Array<{ target: SplitStackTarget; copy: d2sTypes.IItem }>,
): Promise<void> {
  for (const { target, copy } of copies) {
    await addItemToSaveFileUnlocked({
      filePath: target.targetFilePath,
      fileType: target.targetFileType,
      item: copy,
      locationContext: target.targetLocationContext,
      stashTab: target.targetStashTab,
      targetGridX: target.targetGridX,
      targetGridY: target.targetGridY,
    });
  }
}

async function splitCharacterStack(
  decoded: CharacterSaveFile,
  options: SplitStackOptions,
  normalizedCode: string,
  placementLimit: number,
  isTargetInSourceFile: (target: SplitStackTarget) => boolean,
): Promise<void> {
  const { sourceItemCode } = options;
  const data = decoded.data;
  const sourceItems = data.items;
  const sourceItem = findItemByCode(sourceItems, normalizedCode);
  if (!sourceItem) {
    throw new Error(`Stack item '${sourceItemCode}' not found in save file`);
  }

  const currentQty = getItemQuantity(sourceItem);
  const actualSplitCount = Math.min(placementLimit, currentQty);
  const copiesForOtherFiles: Array<{ target: SplitStackTarget; copy: d2sTypes.IItem }> = [];

  for (let i = 0; i < actualSplitCount; i += 1) {
    const target = options.targets[i];

    if (!isTargetInSourceFile(target)) {
      // Remove ID so the library assigns a new one on write.
      const copy = { ...withQuantityOne(sourceItem), id: undefined } as d2sTypes.IItem;
      copiesForOtherFiles.push({ target, copy });
      continue;
    }

    const copy = withQuantityOne(
      withTargetCoordinates(
        withD2SLocationContext(
          sourceItem,
          target.targetLocationContext,
          data.items,
          resolveTargetCharacterClass(data),
          undefined,
        ),
        target.targetGridX,
        target.targetGridY,
      ),
    );
    // Remove ID so the library assigns a new one on write.
    (copy as { id?: unknown }).id = undefined;

    decoded.pushItem(copy, target.targetLocationContext);
  }

  // Place copies in other files first: if anything fails from here on the source stack is still
  // intact, so the worst outcome is an extra copy instead of a missing one.
  await placeCopiesInOtherFiles(copiesForOtherFiles);

  // Reduce or remove source item.
  const remaining = currentQty - actualSplitCount;
  if (remaining <= 0) {
    const idx = sourceItems.indexOf(sourceItem);
    if (idx >= 0) sourceItems.splice(idx, 1);
  } else {
    sourceItems[sourceItems.indexOf(sourceItem)] = withReducedQuantity(
      sourceItem,
      actualSplitCount,
    );
  }

  await decoded.write();
}

/** Classic stash (sss / d2x / pre-105 d2i). */
async function splitClassicStashStack(
  decoded: ClassicStashFile,
  options: SplitStackOptions,
  normalizedCode: string,
  placementLimit: number,
  isTargetInSourceFile: (target: SplitStackTarget) => boolean,
): Promise<void> {
  const { sourceStashTab, sourceItemCode } = options;
  const data = decoded.data;

  const tabIndex = sourceStashTab;
  if (!data.pages[tabIndex]) {
    throw new Error(`Stash tab ${tabIndex} not found in source file`);
  }

  const tabItems = data.pages[tabIndex].items;
  const sourceItem = findItemByCode(tabItems, normalizedCode);
  if (!sourceItem) {
    throw new Error(`Stack item '${sourceItemCode}' not found in stash tab ${tabIndex}`);
  }

  const currentQty = getItemQuantity(sourceItem);
  const actualSplitCount = Math.min(placementLimit, currentQty);
  const copiesForOtherFiles: Array<{ target: SplitStackTarget; copy: d2sTypes.IItem }> = [];

  for (let i = 0; i < actualSplitCount; i += 1) {
    const target = options.targets[i];
    // Remove ID so the library can assign a new one.
    const copy = {
      ...withQuantityOne(withTargetCoordinates(sourceItem, target.targetGridX, target.targetGridY)),
      id: undefined,
    } as d2sTypes.IItem;

    if (!isTargetInSourceFile(target)) {
      copiesForOtherFiles.push({ target, copy });
      continue;
    }

    // Same file: place the copy in the in-memory stash that is written once below. Writing it
    // through the file here would be overwritten by the final write of this stale copy.
    decoded.placeItem(copy, {
      locationContext: target.targetLocationContext,
      stashTab: target.targetStashTab,
    });
  }

  await placeCopiesInOtherFiles(copiesForOtherFiles);

  // Reduce or remove source item and write source file.
  const remaining = currentQty - actualSplitCount;
  if (remaining <= 0) {
    const idx = tabItems.indexOf(sourceItem);
    if (idx >= 0) tabItems.splice(idx, 1);
  } else {
    tabItems[tabItems.indexOf(sourceItem)] = withReducedQuantity(sourceItem, actualSplitCount);
  }

  await decoded.write();
}
