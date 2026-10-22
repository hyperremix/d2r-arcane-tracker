#include "ground_label.h"

#include "grail_item.h"
#include "tracker_state.h"

namespace ArcaneTracker {

namespace {

/**
 * What D2R turns a `ÿc` color marker into when it loads its strings: U+E07E, which is followed by
 * the color digit. Text added to an item name has to carry it in this form, because `ÿc4` in it
 * would be printed as it is.
 */
constexpr char ColorMarker[] = "\xEE\x81\xBE";

}

auto GroundLabelSuffix(D2RL::Items::Quality quality, int32_t qualityRecordId, uint32_t code, bool ethereal) -> std::optional<std::string> {
	const auto item = DescribeGrailItem(quality, qualityRecordId, code, ethereal);
	if (!item) {
		return std::nullopt;
	}
	const auto line = TrackerState::Tooltip(GrailKey(*item), item->ethereal);
	if (!line) {
		return std::nullopt;
	}
	// Gold (4) for an item the grail misses, gray (5) for one it has
	return std::string("\n") + ColorMarker + (line->status == GrailStatus::Missing ? '4' : '5') + line->text;
}

}
