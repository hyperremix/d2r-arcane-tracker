#include "grail_item.h"

namespace ArcaneTracker {

namespace {

/** Converts a four-byte item code (padded with spaces) to text, without the padding. */
auto CodeText(uint32_t code) -> std::string {
	std::string text;
	for (int index = 0; index < 4; ++index) {
		const char character = static_cast<char>((code >> (index * 8)) & 0xFFU);
		if (character == ' ' || character == '\0') {
			break;
		}
		text.push_back(character);
	}
	return text;
}

/** Rune codes are `r01` (El) to `r33` (Zod). */
auto IsRuneCode(const std::string& code) -> bool {
	return code.size() == 3 && code[0] == 'r' && code[1] >= '0' && code[1] <= '9' && code[2] >= '0' && code[2] <= '9';
}

auto KindName(GrailItemKind kind) -> const char* {
	switch (kind) {
		case GrailItemKind::Unique: return "unique";
		case GrailItemKind::Set:    return "set";
		case GrailItemKind::Rune:   return "rune";
	}
	return "";
}

}

auto DescribeGrailItem(D2RL::Items::Quality quality, int32_t qualityRecordId, uint32_t itemCode, bool ethereal) -> std::optional<GrailItem> {
	std::string code = CodeText(itemCode);

	if (quality == D2RL::Items::Quality::Unique && qualityRecordId >= 0) {
		return GrailItem { GrailItemKind::Unique, qualityRecordId, std::move(code), ethereal };
	}
	if (quality == D2RL::Items::Quality::Set && qualityRecordId >= 0) {
		return GrailItem { GrailItemKind::Set, qualityRecordId, std::move(code), ethereal };
	}
	if (IsRuneCode(code)) {
		return GrailItem { GrailItemKind::Rune, -1, std::move(code), ethereal };
	}
	return std::nullopt;
}

auto DescribeGrailItem(const D2RL::Items::ItemInfo& info) -> std::optional<GrailItem> {
	return DescribeGrailItem(info.quality, info.qualityRecordId, info.code, (info.stateFlags & D2RL::Items::ItemStateEthereal) != 0);
}

auto GrailKey(const GrailItem& item) -> std::string {
	switch (item.kind) {
		case GrailItemKind::Unique: return "u:" + std::to_string(item.recordId) + ":" + item.code;
		case GrailItemKind::Set:    return "s:" + std::to_string(item.recordId) + ":" + item.code;
		case GrailItemKind::Rune:   return "r:" + item.code;
	}
	return {};
}

auto PickupEventJson(const GrailItem& item) -> std::string {
	// Item codes are ASCII letters and digits from the item tables, so they need no escaping. A
	// code with anything else (a broken mod table) is sent as an empty string, which the tracker
	// rejects, instead of as invalid JSON.
	std::string code = item.code;
	for (const char character : code) {
		if (!((character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z') || (character >= '0' && character <= '9'))) {
			code.clear();
			break;
		}
	}
	return std::string(R"({"type":"item-picked-up","item":{"kind":")") + KindName(item.kind) + R"(","recordId":)" + std::to_string(item.recordId) + R"(,"code":")" + code
	     + R"(","ethereal":)" + (item.ethereal ? "true" : "false") + "}}";
}

}
