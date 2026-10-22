#pragma once

#include <D2RLPlugin/item.h>
#include <cstdint>
#include <optional>
#include <string>
#include <utility>

namespace ArcaneTracker {

/** The kinds of grail items the plugin recognizes. Runewords are made, not found, so they're left out. */
enum class GrailItemKind {
	Unique,
	Set,
	Rune,
};

/** A grail-relevant item, as PROTOCOL.md describes it. */
struct GrailItem {
	GrailItemKind kind;
	/** UniqueItems or SetItems row; -1 for runes. */
	int32_t       recordId;
	/** Item code without padding spaces. */
	std::string   code;
	bool          ethereal;
};

/**
 * Describes an item for the grail, or nothing when it is no unique, set or rune.
 * @param qualityRecordId - UniqueItems or SetItems row of the item
 * @param itemCode - Four-byte item code, padded with spaces
 */
auto DescribeGrailItem(D2RL::Items::Quality quality, int32_t qualityRecordId, uint32_t itemCode, bool ethereal) -> std::optional<GrailItem>;

/** Describes an item for the grail, or nothing when it is no unique, set or rune. */
auto DescribeGrailItem(const D2RL::Items::ItemInfo& info) -> std::optional<GrailItem>;

/** The key of the item in the tracker's grail status table (`u:<row>:<code>`, `s:...`, `r:<code>`). */
auto GrailKey(const GrailItem& item) -> std::string;

/** The `item-picked-up` event of the item, as JSON. */
auto PickupEventJson(const GrailItem& item) -> std::string;

}
