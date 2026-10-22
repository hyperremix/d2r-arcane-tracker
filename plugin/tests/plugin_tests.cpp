// Tests of the plugin's pure logic: the config parser and the tracker state parser. They need no
// game and no D2RLoader; see README.md for how to run them.
#include "config.h"
#include "tracker_state.h"

#include <cstdlib>
#include <iostream>
#include <string>

namespace {

int g_failures = 0;

void Check(bool condition, const char* expression, int line) {
	if (!condition) {
		std::cerr << "plugin_tests.cpp:" << line << ": check failed: " << expression << '\n';
		++g_failures;
	}
}

#define CHECK(condition) Check((condition), #condition, __LINE__)

using ArcaneTracker::GrailStatus;

void ConfigDefaultsApplyWithoutATable() {
	const auto config = ArcaneTracker::ParseConfig("port = 1\n[other]\nport = 2\n");
	CHECK(config.enabled);
	CHECK(config.port == 41733);
	CHECK(config.token.empty());
	CHECK(config.scanIntervalMs == 500);
}

// The file the tracker writes when the plugin has none yet (installer, PROTOCOL.md)
void ConfigReadsWhatTheTrackerWrites() {
	const auto lf   = ArcaneTracker::ParseConfig("[arcane-tracker]\nport = 41734\ntoken = \"abc123\"\n");
	const auto crlf = ArcaneTracker::ParseConfig("[arcane-tracker]\r\nport = 41734\r\ntoken = \"abc123\"\r\n");
	CHECK(lf.port == 41734 && lf.token == "abc123");
	CHECK(crlf.port == 41734 && crlf.token == "abc123");
}

void ConfigKeepsOtherTablesAndCommentsOut() {
	const auto config = ArcaneTracker::ParseConfig(
		"# comment\n[arcane-tracker]\nport = 5000 # comment\ntoken = \"a#b\" # \"x\"\noverlay = false\n[d2rl]\nport = 9\n");
	CHECK(config.port == 5000);
	CHECK(config.token == "a#b");
	CHECK(!config.overlay);
}

void ConfigClampsAndIgnoresInvalidValues() {
	const auto config = ArcaneTracker::ParseConfig(
		"[arcane-tracker]\nport = 70000\noverlay_x = 2.5\noverlay_y = -1\nscan_interval_ms = 5\ntooltips = maybe\nenabled = \"yes\"\n");
	CHECK(config.port == 41733);
	CHECK(config.overlayX == 1.0F);
	CHECK(config.overlayY == 0.0F);
	CHECK(config.scanIntervalMs == 100);
	CHECK(config.tooltips);
	CHECK(config.enabled);
}

constexpr const char* StateWithGrail =
	"revision\tr1\n"
	"text\tmissing\tHoly Grail: not found yet\n"
	"text\tfound\tHoly Grail: already found\n"
	"text\tmissing-ethereal\tHoly Grail: ethereal not found yet\n"
	"text\tfound-ethereal\tHoly Grail: ethereal already found\n"
	"item\tu:123:uap\t1\t2\n"
	"item\tr:r08\t2\t0\n"
	"overlay\tRun 12\n"
	"unknown\tfuture record\n";

void StateAppliesTheGrailStatusAndOverlay() {
	ArcaneTracker::TrackerState::Clear();
	CHECK(ArcaneTracker::TrackerState::Apply(StateWithGrail));
	CHECK(ArcaneTracker::TrackerState::Revision() == "r1");
	CHECK(ArcaneTracker::TrackerState::ItemCount() == 2);
	CHECK(ArcaneTracker::TrackerState::OverlayLines().size() == 1);

	const auto missing = ArcaneTracker::TrackerState::Tooltip("u:123:uap", false);
	CHECK(missing && missing->status == GrailStatus::Missing && missing->text == "Holy Grail: not found yet");
	const auto foundEthereal = ArcaneTracker::TrackerState::Tooltip("u:123:uap", true);
	CHECK(foundEthereal && foundEthereal->status == GrailStatus::Found && foundEthereal->text == "Holy Grail: ethereal already found");
	// Untracked versions and unknown keys get no line
	CHECK(!ArcaneTracker::TrackerState::Tooltip("r:r08", true));
	CHECK(!ArcaneTracker::TrackerState::Tooltip("u:999:xyz", false));
	ArcaneTracker::TrackerState::Clear();
}

void StateKeepsTheGrailStatusWithoutNewRecords() {
	ArcaneTracker::TrackerState::Clear();
	CHECK(ArcaneTracker::TrackerState::Apply(StateWithGrail));
	CHECK(ArcaneTracker::TrackerState::Apply("revision\tr1\noverlay\tRun 13\noverlay\tGrail 1/2\n"));
	CHECK(ArcaneTracker::TrackerState::ItemCount() == 2);
	CHECK(ArcaneTracker::TrackerState::OverlayLines().size() == 2);
	CHECK(ArcaneTracker::TrackerState::Apply("revision\tr1\n"));
	CHECK(ArcaneTracker::TrackerState::OverlayLines().empty());
	ArcaneTracker::TrackerState::Clear();
}

void StateRejectsABodyWithoutARevisionFirst() {
	ArcaneTracker::TrackerState::Clear();
	CHECK(!ArcaneTracker::TrackerState::Apply(""));
	CHECK(!ArcaneTracker::TrackerState::Apply("overlay\tRun 1\nrevision\tr1\n"));
	CHECK(ArcaneTracker::TrackerState::Revision().empty());
	CHECK(ArcaneTracker::TrackerState::OverlayLines().empty());
}

}

int main() {
	ConfigDefaultsApplyWithoutATable();
	ConfigReadsWhatTheTrackerWrites();
	ConfigKeepsOtherTablesAndCommentsOut();
	ConfigClampsAndIgnoresInvalidValues();
	StateAppliesTheGrailStatusAndOverlay();
	StateKeepsTheGrailStatusWithoutNewRecords();
	StateRejectsABodyWithoutARevisionFirst();
	if (g_failures > 0) {
		std::cerr << g_failures << " check(s) failed\n";
		return EXIT_FAILURE;
	}
	std::cout << "All plugin tests passed\n";
	return EXIT_SUCCESS;
}
