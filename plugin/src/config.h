#pragma once

#include <cstdint>
#include <string>
#include <string_view>

namespace D2RL {
struct PluginContext;
}

namespace ArcaneTracker {

/** Settings from the `[arcane-tracker]` table of the plugin's config file. */
struct Config {
	bool        enabled        = true;
	uint16_t    port           = 41733;
	std::string token;
	bool        overlay        = true;
	float       overlayX       = 0.01F;
	float       overlayY       = 0.15F;
	bool        tooltips       = true;
	uint32_t    scanIntervalMs = 500;
};

/**
 * Reads the `[arcane-tracker]` table of a TOML document. Only `key = value` lines with strings,
 * booleans and numbers are understood, which is all the plugin's own file uses. Missing or invalid
 * values keep their default, and numbers are clamped to their valid range.
 */
auto ParseConfig(std::string_view toml) -> Config;

/** Reads the plugin's config file through D2RLoader; the defaults when it can't be read. */
auto LoadConfig(const D2RL::PluginContext* context) -> Config;

}
