#pragma once

#include <D2RLPlugin/item.h>
#include <cstdint>
#include <optional>
#include <string>

namespace ArcaneTracker {

/**
 * The line that goes into the name of a grail item lying on the ground: a new line, D2R's color
 * marker (gold while the grail misses the item, gray once it has it) and the tracker's text.
 * @returns Nothing when the item is no unique, set or rune, or the tracker doesn't track it
 * @param qualityRecordId - UniqueItems or SetItems row of the item
 * @param code - Four-byte item code, padded with spaces
 */
auto GroundLabelSuffix(D2RL::Items::Quality quality, int32_t qualityRecordId, uint32_t code, bool ethereal) -> std::optional<std::string>;

}
