#include "tracker_state.h"

#include <mutex>
#include <unordered_map>
#include <utility>

namespace ArcaneTracker::TrackerState {

namespace {

/** Statuses of the normal and the ethereal version of an item. */
struct ItemStatus {
	GrailStatus normal;
	GrailStatus ethereal;
};

/** Hash that lets the table be searched with a string_view, without building a string. */
struct KeyHash {
	using is_transparent = void;
	auto operator()(std::string_view key) const noexcept -> size_t { return std::hash<std::string_view> {}(key); }
};

using ItemTable = std::unordered_map<std::string, ItemStatus, KeyHash, std::equal_to<>>;
using TextTable = std::unordered_map<std::string, std::string, KeyHash, std::equal_to<>>;

std::mutex               g_mutex;
std::string              g_revision;
ItemTable                g_items;
TextTable                g_texts;
std::vector<std::string> g_overlayLines;

/** Splits a line into its tab-separated fields. */
auto SplitFields(std::string_view line) -> std::vector<std::string_view> {
	std::vector<std::string_view> fields;
	while (true) {
		const auto tab = line.find('\t');
		fields.push_back(line.substr(0, tab));
		if (tab == std::string_view::npos) {
			return fields;
		}
		line.remove_prefix(tab + 1);
	}
}

auto ParseStatus(std::string_view field) -> std::optional<GrailStatus> {
	if (field.size() != 1 || field[0] < '0' || field[0] > '2') {
		return std::nullopt;
	}
	return static_cast<GrailStatus>(field[0]);
}

}

auto Apply(std::string_view body) -> bool {
	std::string              revision;
	bool                     hasGrailStatus = false;
	ItemTable                items;
	TextTable                texts;
	std::vector<std::string> overlayLines;

	bool firstLine = true;
	while (!body.empty()) {
		const auto lineEnd = body.find('\n');
		auto       line    = body.substr(0, lineEnd);
		body               = lineEnd == std::string_view::npos ? std::string_view {} : body.substr(lineEnd + 1);
		if (!line.empty() && line.back() == '\r') {
			line.remove_suffix(1);
		}

		const auto fields = SplitFields(line);
		if (firstLine) {
			if (fields.size() != 2 || fields[0] != "revision") {
				return false;
			}
			revision  = fields[1];
			firstLine = false;
		} else if (fields[0] == "text" && fields.size() == 3) {
			hasGrailStatus = true;
			texts.insert_or_assign(std::string(fields[1]), std::string(fields[2]));
		} else if (fields[0] == "item" && fields.size() == 4) {
			hasGrailStatus      = true;
			const auto normal   = ParseStatus(fields[2]);
			const auto ethereal = ParseStatus(fields[3]);
			if (normal && ethereal) {
				items.insert_or_assign(std::string(fields[1]), ItemStatus { *normal, *ethereal });
			}
		} else if (fields[0] == "overlay" && fields.size() == 2) {
			overlayLines.emplace_back(fields[1]);
		}
		// Unknown records are skipped, so newer trackers can add some
	}
	if (firstLine) {
		return false;
	}

	const std::lock_guard lock(g_mutex);
	if (hasGrailStatus) {
		g_revision = std::move(revision);
		g_items    = std::move(items);
		g_texts    = std::move(texts);
	}
	g_overlayLines = std::move(overlayLines);
	return true;
}

auto Revision() -> std::string {
	const std::lock_guard lock(g_mutex);
	return g_revision;
}

auto ItemCount() -> size_t {
	const std::lock_guard lock(g_mutex);
	return g_items.size();
}

auto OverlayLines() -> std::vector<std::string> {
	const std::lock_guard lock(g_mutex);
	return g_overlayLines;
}

auto Tooltip(std::string_view key, bool ethereal) -> std::optional<TooltipLine> {
	const std::lock_guard lock(g_mutex);
	const auto            item = g_items.find(key);
	if (item == g_items.end()) {
		return std::nullopt;
	}
	const GrailStatus status = ethereal ? item->second.ethereal : item->second.normal;
	if (status == GrailStatus::Untracked) {
		return std::nullopt;
	}

	std::string_view textId;
	if (status == GrailStatus::Missing) {
		textId = ethereal ? "missing-ethereal" : "missing";
	} else {
		textId = ethereal ? "found-ethereal" : "found";
	}
	const auto text = g_texts.find(textId);
	if (text == g_texts.end()) {
		return std::nullopt;
	}
	return TooltipLine { status, text->second };
}

void Clear() {
	const std::lock_guard lock(g_mutex);
	g_revision.clear();
	g_items.clear();
	g_texts.clear();
	g_overlayLines.clear();
}

}
