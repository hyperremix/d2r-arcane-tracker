#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace ArcaneTracker {

/** Grail status of one version of an item, as the tracker sends it. */
enum class GrailStatus : char {
	Untracked = '0',
	Missing   = '1',
	Found     = '2',
};

/** A tooltip line for an item: its status and the translated text. */
struct TooltipLine {
	GrailStatus status;
	std::string text;
};

/**
 * What the plugin last received from `GET /v1/state`: the grail status table with its tooltip texts,
 * and the overlay lines. Written by the HTTP worker thread, read by the UI thread (tooltips) and
 * the overlay thread; every function locks.
 */
namespace TrackerState {

/**
 * Applies a `GET /v1/state` response body (see PROTOCOL.md). The grail status is replaced only when
 * the body has `text` or `item` records; the overlay lines are always replaced.
 * @returns False when the body doesn't start with a `revision` record; nothing is changed then
 */
auto Apply(std::string_view body) -> bool;

/** The grail revision the plugin has, empty before the first state arrived. */
auto Revision() -> std::string;

/** Number of items in the grail status table. */
auto ItemCount() -> size_t;

/** The overlay lines, top to bottom. */
auto OverlayLines() -> std::vector<std::string>;

/**
 * The tooltip line for an item, if the tracker tracks it.
 * @param key - Grail key of the item (see GrailKey)
 * @param ethereal - Whether the item is ethereal; selects the ethereal status and texts
 */
auto Tooltip(std::string_view key, bool ethereal) -> std::optional<TooltipLine>;

/** Forgets everything, so a reconnect downloads the grail status again. */
void Clear();

}

}
