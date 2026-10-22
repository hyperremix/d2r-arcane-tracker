#include "config.h"

#include <D2RLPlugin/context.h>
#include <algorithm>
#include <charconv>
#include <optional>
#include <vector>

namespace ArcaneTracker {

namespace {

constexpr std::string_view TableName = "arcane-tracker";

auto Trim(std::string_view text) -> std::string_view {
	const auto first = text.find_first_not_of(" \t\r");
	if (first == std::string_view::npos) {
		return {};
	}
	const auto last = text.find_last_not_of(" \t\r");
	return text.substr(first, last - first + 1);
}

/** Cuts a `#` comment off a value, unless the `#` is inside a quoted string. */
auto StripComment(std::string_view value) -> std::string_view {
	bool inString = false;
	for (size_t index = 0; index < value.size(); ++index) {
		const char character = value[index];
		if (character == '\\' && inString) {
			++index;
		} else if (character == '"') {
			inString = !inString;
		} else if (character == '#' && !inString) {
			return value.substr(0, index);
		}
	}
	return value;
}

/** Parses a basic TOML string (`"..."` with `\"` and `\\` escapes). */
auto ParseString(std::string_view value) -> std::optional<std::string> {
	if (value.size() < 2 || value.front() != '"' || value.back() != '"') {
		return std::nullopt;
	}
	std::string result;
	for (size_t index = 1; index + 1 < value.size(); ++index) {
		char character = value[index];
		if (character == '\\' && index + 2 < value.size()) {
			character = value[++index];
		}
		result.push_back(character);
	}
	return result;
}

auto ParseBool(std::string_view value) -> std::optional<bool> {
	if (value == "true") {
		return true;
	}
	if (value == "false") {
		return false;
	}
	return std::nullopt;
}

auto ParseInteger(std::string_view value) -> std::optional<int64_t> {
	int64_t result = 0;
	const auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), result);
	if (error != std::errc {} || end != value.data() + value.size()) {
		return std::nullopt;
	}
	return result;
}

auto ParseFloat(std::string_view value) -> std::optional<float> {
	// from_chars ignores the process locale, which the game may have changed
	float      result = 0.0F;
	const auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), result);
	if (error != std::errc {} || end != value.data() + value.size()) {
		return std::nullopt;
	}
	return result;
}

void ApplyValue(Config& config, std::string_view key, std::string_view value) {
	if (key == "enabled") {
		config.enabled = ParseBool(value).value_or(config.enabled);
	} else if (key == "port") {
		const auto port = ParseInteger(value);
		if (port && *port > 0 && *port <= 65535) {
			config.port = static_cast<uint16_t>(*port);
		}
	} else if (key == "token") {
		config.token = ParseString(value).value_or(config.token);
	} else if (key == "overlay") {
		config.overlay = ParseBool(value).value_or(config.overlay);
	} else if (key == "overlay_x") {
		config.overlayX = std::clamp(ParseFloat(value).value_or(config.overlayX), 0.0F, 1.0F);
	} else if (key == "overlay_y") {
		config.overlayY = std::clamp(ParseFloat(value).value_or(config.overlayY), 0.0F, 1.0F);
	} else if (key == "tooltips") {
		config.tooltips = ParseBool(value).value_or(config.tooltips);
	} else if (key == "scan_interval_ms") {
		const auto interval = ParseInteger(value);
		if (interval) {
			config.scanIntervalMs = static_cast<uint32_t>(std::clamp<int64_t>(*interval, 100, 5000));
		}
	}
}

}

auto ParseConfig(std::string_view toml) -> Config {
	Config config;
	bool   inTable = false;
	while (!toml.empty()) {
		const auto lineEnd = toml.find('\n');
		const auto line    = Trim(toml.substr(0, lineEnd));
		toml               = lineEnd == std::string_view::npos ? std::string_view {} : toml.substr(lineEnd + 1);

		if (line.empty() || line.front() == '#') {
			continue;
		}
		if (line.front() == '[') {
			const auto close = line.find(']');
			inTable          = close != std::string_view::npos && Trim(line.substr(1, close - 1)) == TableName;
			continue;
		}
		const auto equals = line.find('=');
		if (!inTable || equals == std::string_view::npos) {
			continue;
		}
		ApplyValue(config, Trim(line.substr(0, equals)), Trim(StripComment(line.substr(equals + 1))));
	}
	return config;
}

auto LoadConfig(const D2RL::PluginContext* context) -> Config {
	// The file is small; a second read with the reported size covers a user who added a lot to it
	std::vector<char> buffer(16 * 1024);
	uint32_t          requiredSize = 0;
	bool              read         = context->ReadConfig(buffer.data(), static_cast<uint32_t>(buffer.size()), &requiredSize);
	if (!read && requiredSize > buffer.size()) {
		buffer.resize(requiredSize);
		read = context->ReadConfig(buffer.data(), static_cast<uint32_t>(buffer.size()), &requiredSize);
	}
	if (!read) {
		return {};
	}
	return ParseConfig(std::string_view(buffer.data(), std::find(buffer.begin(), buffer.end(), '\0') - buffer.begin()));
}

}
