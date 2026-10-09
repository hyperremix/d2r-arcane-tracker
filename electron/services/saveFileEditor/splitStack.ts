import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { types as d2sTypes } from '@dschu012/d2s';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import type { VaultLocationContext, VaultSourceFileType } from '../../types/grail';
import { normalizeItemCodeKey, resolveStackCount, SHARED_TAB_COUNT } from '../../utils/d2rFormat';
import { resolveModernJmSectors } from './d2iSectors';
import { resolveTargetCharacterClass } from './equipValidation';
import { findItemByCode } from './itemLocators';
import { addItemToSaveFileUnlocked } from './itemOperations';
import {
  assertCharacterGridCellsFree,
  assertTargetCellsFree,
  withD2SLocationContext,
  withTargetCoordinates,
} from './itemPlacement';
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
  assertWritableD2iBuffer,
  assertWritableStashMutationTarget,
  getStashConstants,
  isSameSaveFile,
  writeClassicStashFile,
  writeD2sSaveFile,
  writeSaveFile,
} from './saveFileWrites';

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
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This function coordinates d2s, classic stash, and multi-target file writes in a single operation. Splitting further would require passing complex partial state between helpers.
export async function splitStackInSaveFileUnlocked(options: SplitStackOptions): Promise<void> {
  const { sourceFilePath, sourceFileType, sourceStashTab, sourceItemCode } = options;
  const normalizedCode = normalizeItemCodeKey(sourceItemCode);
  if (!normalizedCode) {
    throw new Error('sourceItemCode is required');
  }

  if (options.splitCount <= 0) {
    throw new Error('splitCount must be positive');
  }

  // Modern stash resource tabs (d2i v105+) support stack splitting into shared tabs.
  // Prefer a single-buffer mutation path when source and targets are in the same modern stash file.
  if (sourceFileType === 'd2i' && options.sourceRawItemJson) {
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
      let workingBuffer = await readFile(sourceFilePath);
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
    const sourceBufferForCount = await readFile(sourceFilePath);
    const { metadata: countMetadata, jmSectors: countSectors } =
      resolveModernJmSectors(sourceBufferForCount);
    const countEntries = await readResourceSectorEntries(
      sourceBufferForCount,
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
        await assertWritableStashMutationTarget(target.targetFilePath, target.targetFileType);
      }

      const copy = withQuantityOne(
        withTargetCoordinates(sourceItem, target.targetGridX, target.targetGridY),
      );
      (copy as { id?: unknown }).id = undefined;
      await addItemToSaveFileUnlocked(
        target.targetFilePath,
        target.targetFileType,
        copy,
        target.targetLocationContext,
        target.targetStashTab,
        target.targetGridX,
        target.targetGridY,
      );
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

  // Validate all targets before touching any file.
  await assertWritableStashMutationTarget(sourceFilePath, sourceFileType);
  for (const target of options.targets) {
    await assertWritableStashMutationTarget(target.targetFilePath, target.targetFileType);
  }

  // Never take more units out of the source than there are placements for: every unit removed
  // from the stack must end up as a placed copy, otherwise it is lost.
  const placementLimit = Math.min(options.splitCount, options.targets.length);
  const isTargetInSourceFile = (target: SplitStackTarget): boolean =>
    isSameSaveFile(sourceFilePath, sourceFileType, target.targetFilePath, target.targetFileType);

  // Read and parse source file.
  const sourceBuffer = await readFile(sourceFilePath);

  if (sourceFileType === 'd2s') {
    const data = await d2s.read(sourceBuffer);
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

      if (target.targetLocationContext === 'mercenary') {
        data.merc_items.push(copy);
      } else if (target.targetLocationContext === 'corpse') {
        data.corpse_items.push(copy);
      } else {
        assertCharacterGridCellsFree(data.items, copy);
        data.items.push(copy);
      }
    }

    // Place copies in other files first: if anything fails from here on the source stack is still
    // intact, so the worst outcome is an extra copy instead of a missing one.
    for (const { target, copy } of copiesForOtherFiles) {
      await addItemToSaveFileUnlocked(
        target.targetFilePath,
        target.targetFileType,
        copy,
        target.targetLocationContext,
        target.targetStashTab,
        target.targetGridX,
        target.targetGridY,
      );
    }

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

    await writeD2sSaveFile(sourceFilePath, data);
    return;
  }

  // Classic stash (sss / d2x / non-modern d2i).
  const ext = extname(sourceFilePath);
  assertWritableD2iBuffer(ext, sourceBuffer);
  const { constants, version } = getStashConstants(ext);
  const data = await d2stash.read(sourceBuffer, constants);

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
    const targetTab = target.targetStashTab ?? 0;
    while (data.pages.length <= targetTab) {
      data.pages.push({ name: '', type: 0, items: [] });
      data.pageCount = data.pages.length;
    }
    assertTargetCellsFree(data.pages[targetTab].items, copy);
    data.pages[targetTab].items.push(copy);
  }

  for (const { target, copy } of copiesForOtherFiles) {
    await addItemToSaveFileUnlocked(
      target.targetFilePath,
      target.targetFileType,
      copy,
      target.targetLocationContext,
      target.targetStashTab,
      target.targetGridX,
      target.targetGridY,
    );
  }

  // Reduce or remove source item and write source file.
  const remaining = currentQty - actualSplitCount;
  if (remaining <= 0) {
    const idx = tabItems.indexOf(sourceItem);
    if (idx >= 0) tabItems.splice(idx, 1);
  } else {
    tabItems[tabItems.indexOf(sourceItem)] = withReducedQuantity(sourceItem, actualSplitCount);
  }

  await writeClassicStashFile(sourceFilePath, data, { constants, version });
}
