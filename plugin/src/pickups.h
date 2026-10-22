#pragma once

#include "grail_item.h"

#include <vector>

namespace D2RL {
struct InventoryService;
struct PluginContext;
}

namespace ArcaneTracker {

/**
 * Finds the items the player picks up, by comparing the player's items with the items they owned
 * when the game started. An item counts when it first shows up in the inventory, belt or cursor;
 * items that first show up in the cube or a stash were made or already owned. UI thread only.
 */
namespace Pickups {

/** Forgets the items of the previous game. Call when a game starts or ends. */
void Reset();

/** Records every item the player owns now as already owned. Call when the local player is ready. */
void Baseline(const D2RL::PluginContext* context, const D2RL::InventoryService* inventory);

/**
 * Returns the grail items (uniques, sets, runes) picked up since the last scan. Does nothing before
 * the baseline of the current game.
 */
auto Scan(const D2RL::PluginContext* context, const D2RL::InventoryService* inventory) -> std::vector<GrailItem>;

}

}
