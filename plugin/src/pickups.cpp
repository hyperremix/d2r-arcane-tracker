#include "pickups.h"

#include <D2RLPlugin/context.h>
#include <D2RLPlugin/inventory.h>
#include <cstdint>
#include <unordered_set>

namespace ArcaneTracker::Pickups {

namespace {

bool                         g_baselined = false;
/** Items seen in this game, by runtime unit id and item seed (together they identify an item). */
std::unordered_set<uint64_t> g_knownItems;

auto ItemKey(const D2RL::Items::ItemInfo& info) -> uint64_t {
	return (static_cast<uint64_t>(info.runtimeId) << 32U) | info.itemSeed;
}

auto IsPickupContainer(D2RL::Items::ItemContainer container) -> bool {
	return container == D2RL::Items::ItemContainer::Inventory || container == D2RL::Items::ItemContainer::Belt || container == D2RL::Items::ItemContainer::Cursor;
}

auto __cdecl CollectItem(const D2RL::PluginContext*, const D2RL::Items::ItemInfo* item, void* userData) noexcept -> D2RL::Inventory::IterationAction {
	try {
		if (item != nullptr && item->structSize >= D2RL::Items::ItemInfoRequiredSize) {
			static_cast<std::vector<D2RL::Items::ItemInfo>*>(userData)->push_back(*item);
		}
	} catch (...) {
		return D2RL::Inventory::IterationAction::Stop;
	}
	return D2RL::Inventory::IterationAction::Continue;
}

/** Copies every item of the local player, in every container. False when the player isn't available. */
auto ReadItems(const D2RL::PluginContext* context, const D2RL::InventoryService* inventory, std::vector<D2RL::Items::ItemInfo>& items) -> bool {
	D2RL::PlayerHandle player = D2RL::InvalidPlayerHandle;
	if (inventory->getLocalPlayer(context, &player) != D2RL::Inventory::Result::Success || player == D2RL::InvalidPlayerHandle) {
		return false;
	}
	const D2RL::Inventory::ItemFilter filter {
		.structSize    = D2RL::Inventory::ItemFilterSize,
		.containerMask = D2RL::Items::AllItemContainers,
	};
	return inventory->forEachInventoryItem(context, player, &filter, CollectItem, &items) == D2RL::Inventory::Result::Success;
}

}

void Reset() {
	g_baselined = false;
	g_knownItems.clear();
}

void Baseline(const D2RL::PluginContext* context, const D2RL::InventoryService* inventory) {
	std::vector<D2RL::Items::ItemInfo> items;
	Reset();
	if (!ReadItems(context, inventory, items)) {
		context->LogWarn("Could not read the player's items; pickups are not detected in this game.");
		return;
	}
	for (const auto& item : items) {
		g_knownItems.insert(ItemKey(item));
	}
	g_baselined = true;
}

auto Scan(const D2RL::PluginContext* context, const D2RL::InventoryService* inventory) -> std::vector<GrailItem> {
	std::vector<GrailItem> pickedUp;
	std::vector<D2RL::Items::ItemInfo> items;
	if (!g_baselined || !ReadItems(context, inventory, items)) {
		return pickedUp;
	}
	for (const auto& item : items) {
		if (!g_knownItems.insert(ItemKey(item)).second || !IsPickupContainer(item.container)) {
			continue;
		}
		if (auto grailItem = DescribeGrailItem(item)) {
			pickedUp.push_back(std::move(*grailItem));
		}
	}
	return pickedUp;
}

}
