// D2RLoader plugin of D2R Arcane Tracker: reports games, areas and pickups to the tracker, and shows
// the tracker's Holy Grail status on ground items and its run overlay in game. PROTOCOL.md
// describes how it talks to the tracker.
//
// Threads: gameplay events, input actions and the pump (pickup scans and HTTP requests) run on D2R's
// UI thread. HTTP responses arrive on a worker thread and overlay frames on the render thread; they
// only touch the locked BridgeClient and TrackerState and the atomics below. The ground item labels
// are built on whatever thread D2R names items on, and only read TrackerState (see ground_hooks.cpp).

#include "bridge_client.h"
#include "config.h"
#include "grail_item.h"
#include "ground_hooks.h"
#include "pickups.h"
#include "tracker_state.h"

#include <D2RLPlugin/api.h>
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <string>

namespace {

using namespace ArcaneTracker;
using Clock = std::chrono::steady_clock;
using std::chrono::milliseconds;

constexpr D2RL::PluginInfo PluginInfo {
	.infoSize    = D2RL::PluginInfoSize,
	.abiVersion  = D2RL_PLUGIN_ABI_VERSION,
	.id          = "arcane-tracker",
	.name        = "D2R Arcane Tracker",
	.version     = ARCANE_TRACKER_PLUGIN_VERSION,
	.author      = "hyperremix",
	.description = "Connects D2RLoader to D2R Arcane Tracker: Holy Grail status on ground items, a run overlay and instant pickup alerts.",
	.flags       = D2RL::PluginFlags::Client | D2RL::PluginFlags::NativeHooks,
};

/** How often the config file is read again, so changes apply while the game runs. */
constexpr milliseconds ConfigReloadInterval { 5'000 };
/** A pump that hasn't run for this long is started again by the next gameplay event or frame. */
constexpr milliseconds PumpRestartAfter { 2'000 };

constexpr uint32_t LifecycleGameplayFieldEnd = static_cast<uint32_t>(offsetof(D2RL::LifecycleService, unregisterGameplayEventListener) + sizeof(D2RL::Lifecycle::UnregisterGameplayEventListenerFn));

const D2RL::PluginContext*      g_context   = nullptr;
const D2RL::ThreadService*      g_threads   = nullptr;
const D2RL::InventoryService*   g_inventory = nullptr;
const D2RL::OverlayService*     g_overlay   = nullptr;

// UI thread only
Config            g_config;
Clock::time_point g_nextConfigReloadAt {};
Clock::time_point g_nextScanAt {};

// Read by the overlay thread
std::atomic<bool>  g_inGame { false };
std::atomic<bool>  g_overlayEnabled { true };
std::atomic<bool>  g_overlayToggledOn { true };
std::atomic<float> g_overlayX { 0.01F };
std::atomic<float> g_overlayY { 0.15F };
std::atomic<bool>  g_unloading { false };

// The pump: a UI-thread task that queues itself again. Starting a pump takes a new ticket, so an
// older pump that is still queued stops when it runs.
std::atomic<uint64_t> g_pumpTicket { 0 };
std::atomic<int64_t>  g_pumpLastRunMs { 0 };
std::atomic<bool>     g_pumpStartWarned { false };

auto NowMs() -> int64_t {
	return std::chrono::duration_cast<milliseconds>(Clock::now().time_since_epoch()).count();
}

void ApplyConfig(Config config) {
	g_overlayEnabled  = config.overlay;
	g_overlayX        = config.overlayX;
	g_overlayY        = config.overlayY;
	GroundHooks::SetEnabled(config.groundLabels);
	BridgeClient::Configure(config);
	g_config = std::move(config);
}

/** The pump's work: reload the config, send what is due and look for pickups. */
void RunPeriodicWork(const D2RL::PluginContext* context) {
	const auto now = Clock::now();
	if (now >= g_nextConfigReloadAt) {
		g_nextConfigReloadAt = now + ConfigReloadInterval;
		ApplyConfig(LoadConfig(context));
	}

	if (g_inventory != nullptr && g_inGame && now >= g_nextScanAt) {
		g_nextScanAt = now + milliseconds(g_config.scanIntervalMs);
		for (const auto& item : Pickups::Scan(context, g_inventory)) {
			BridgeClient::Enqueue(PickupEventJson(item));
		}
	}

	BridgeClient::Tick(context);
}

void __cdecl RunPump(const D2RL::PluginContext* context, void* userData) noexcept {
	const auto ticket = static_cast<uint64_t>(reinterpret_cast<uintptr_t>(userData));
	if (g_unloading || ticket != g_pumpTicket) {
		return;
	}
	g_pumpLastRunMs = NowMs();
	try {
		RunPeriodicWork(context);
	} catch (...) {
		// Never let an exception reach the game's UI thread; the next run tries again
	}
	if (g_threads->runOnUiThread(context, RunPump, userData) != D2RL::Threads::Result::Success) {
		g_pumpLastRunMs = 0;
	}
}

/** Starts the pump unless it ran recently. A failure is logged once, until the pump starts. */
void EnsurePump(const D2RL::PluginContext* context) {
	const int64_t lastRun = g_pumpLastRunMs;
	if (lastRun != 0 && NowMs() - lastRun < PumpRestartAfter.count()) {
		return;
	}
	const uint64_t ticket = ++g_pumpTicket;
	g_pumpLastRunMs       = NowMs();
	if (g_threads->runOnUiThread(context, RunPump, reinterpret_cast<void*>(static_cast<uintptr_t>(ticket))) != D2RL::Threads::Result::Success) {
		g_pumpLastRunMs = 0;
		if (!g_pumpStartWarned.exchange(true)) {
			context->LogWarn("Could not start the plugin's update task yet; it is tried again on every frame.");
		}
	} else {
		g_pumpStartWarned = false;
	}
}

void __cdecl OnGameplayEvent(const D2RL::PluginContext* context, const D2RL::Lifecycle::GameplayEvent* event, void*) noexcept {
	if (context == nullptr || !D2RL::Lifecycle::HasGameplayEventField(event, D2RL::Lifecycle::GameplayEventRequiredSize)) {
		return;
	}
	try {
		switch (event->kind) {
			case D2RL::Lifecycle::GameplayEventKind::GameJoined:
				Pickups::Reset();
				g_inGame = true;
				BridgeClient::Enqueue(R"({"type":"game-joined"})");
				break;
			case D2RL::Lifecycle::GameplayEventKind::GameLeft:
				Pickups::Reset();
				g_inGame = false;
				BridgeClient::Enqueue(R"({"type":"game-left"})");
				break;
			case D2RL::Lifecycle::GameplayEventKind::LocalPlayerReady:
				if (g_inventory != nullptr) {
					Pickups::Baseline(context, g_inventory);
				}
				break;
			case D2RL::Lifecycle::GameplayEventKind::LevelChanged:
				BridgeClient::Enqueue(R"({"type":"level-changed","levelId":)" + std::to_string(event->currentValue) + R"(,"previousLevelId":)" + std::to_string(event->previousValue) + "}");
				break;
			default: break;
		}
		EnsurePump(context);
	} catch (...) {
		// Never let an exception reach the game's UI thread
	}
}

void __cdecl DrawOverlay(const D2RL::PluginContext* context, const D2RL::Overlay::Frame* frame, void*) noexcept {
	if (context != nullptr && !g_unloading) {
		// The update task can't start while D2R loads, and a game event may be minutes away (the main
		// menu), so every frame is a chance to start it. Queueing from the render thread is allowed.
		EnsurePump(context);
	}
	if (context == nullptr || frame == nullptr || frame->structSize < D2RL::Overlay::FrameRequiredSize || !g_inGame || !g_overlayEnabled || !g_overlayToggledOn) {
		return;
	}
	try {
		const auto lines = TrackerState::OverlayLines();
		if (lines.empty()) {
			return;
		}
		const float textSize   = frame->defaultTextSize > 0.0F ? frame->defaultTextSize : 18.0F;
		const float lineHeight = textSize * 1.25F;
		float       x          = g_overlayX * frame->screenWidth;
		float       y          = g_overlayY * frame->screenHeight;
		for (const auto& line : lines) {
			const auto length = static_cast<uint32_t>(std::min<size_t>(line.size(), D2RL::Overlay::MaxTextBytes));
			// A dark copy one pixel down and right keeps the text readable on bright ground
			D2RL::Overlay::TextRequest request {
				.structSize = D2RL::Overlay::TextRequestSize,
				.canvas     = frame->canvas,
				.position   = { x + 1.0F, y + 1.0F },
				.color      = { 0.0F, 0.0F, 0.0F, 0.85F },
				.textSize   = textSize,
				.text       = line.data(),
				.textLength = length,
			};
			(void)g_overlay->drawText(context, &request);
			request.position = { x, y };
			request.color    = { 0.93F, 0.84F, 0.6F, 1.0F };
			(void)g_overlay->drawText(context, &request);
			y += lineHeight;
		}
	} catch (...) {
		// Never let an exception reach the render thread
	}
}

auto __cdecl OnToggleOverlay(const D2RL::PluginContext*, const D2RL::Input::ActionEvent* event, void*) noexcept -> D2RL::Input::ActionResult {
	if (event == nullptr || event->structSize < D2RL::Input::ActionEventRequiredSize || event->kind != D2RL::Input::ActionEventKind::Pressed) {
		return D2RL::Input::ActionResult::Ignored;
	}
	g_overlayToggledOn = !g_overlayToggledOn;
	return D2RL::Input::ActionResult::Handled;
}

auto __cdecl OnToggleSession(const D2RL::PluginContext*, const D2RL::Input::ActionEvent* event, void*) noexcept -> D2RL::Input::ActionResult {
	if (event == nullptr || event->structSize < D2RL::Input::ActionEventRequiredSize || event->kind != D2RL::Input::ActionEventKind::Pressed) {
		return D2RL::Input::ActionResult::Ignored;
	}
	try {
		BridgeClient::Enqueue(R"({"type":"command","action":"toggle-session"})");
	} catch (...) {
		return D2RL::Input::ActionResult::Ignored;
	}
	return D2RL::Input::ActionResult::Handled;
}

auto __cdecl OnStatusCommand(D2R::Game::Client*, const D2RL::ConsoleCommandContext* command, void*) noexcept -> D2RL::ConsoleCommandResult {
	if (command == nullptr || command->plugin == nullptr) {
		return D2RL::ConsoleCommandResult::Failed;
	}
	try {
		const auto        status = BridgeClient::GetStatus();
		const std::string connection =
		    !status.enabled ? "not connected: connect the plugin in D2R Arcane Tracker's settings" : (status.connected ? "connected" : "connecting");
		std::string message = "Arcane Tracker " ARCANE_TRACKER_PLUGIN_VERSION ": " + connection;
		if (!status.lastError.empty()) {
			message += " (last error: " + status.lastError + ")";
		}
		message += ". Grail items: " + std::to_string(TrackerState::ItemCount()) + ", revision '" + TrackerState::Revision() + "'. Queued events: " + std::to_string(status.queuedEvents);
		if (status.droppedEvents > 0) {
			message += ", " + std::to_string(status.droppedEvents) + " dropped while the tracker was away";
		}
		message += ".";
		command->plugin->WriteConsoleMessage(message.c_str());
	} catch (...) {
		return D2RL::ConsoleCommandResult::Failed;
	}
	return D2RL::ConsoleCommandResult::Handled;
}

/**
 * Queries a service and checks that it has the fields the plugin uses.
 * @returns The service, or nullptr when D2RLoader doesn't provide it
 */
template <typename Service, typename HasField>
auto QueryService(const D2RL::PluginContext* context, uint32_t fieldEnd, HasField hasField) -> const Service* {
	const Service* service = nullptr;
	if (context->QueryService(&service) != D2RL::ServiceQueryResult::Success || !hasField(service, fieldEnd)) {
		return nullptr;
	}
	return service;
}

auto RegisterGameplayListeners(const D2RL::PluginContext* context, const D2RL::LifecycleService* lifecycle) -> bool {
	constexpr D2RL::Lifecycle::GameplayEventKind Kinds[] {
		D2RL::Lifecycle::GameplayEventKind::GameJoined,
		D2RL::Lifecycle::GameplayEventKind::GameLeft,
		D2RL::Lifecycle::GameplayEventKind::LocalPlayerReady,
		D2RL::Lifecycle::GameplayEventKind::LevelChanged,
	};
	for (const auto kind : Kinds) {
		const D2RL::Lifecycle::GameplayEventListener listener {
			.structSize = D2RL::Lifecycle::GameplayEventListenerSize,
			.kind       = kind,
			.callback   = OnGameplayEvent,
		};
		D2RL::Lifecycle::ListenerHandle handle = D2RL::Lifecycle::InvalidHandle;
		if (lifecycle->registerGameplayEventListener(context, &listener, &handle) != D2RL::Lifecycle::Result::Success) {
			return false;
		}
	}
	return true;
}

void RegisterOverlay(const D2RL::PluginContext* context) {
	g_overlay = QueryService<D2RL::OverlayService>(context, D2RL::OverlayServiceRequiredSize, D2RL::HasOverlayServiceField);
	if (g_overlay == nullptr) {
		context->LogWarn("The overlay is not available in this D2RLoader version.");
		return;
	}
	const D2RL::Overlay::CallbackRegistration registration {
		.structSize = D2RL::Overlay::CallbackRegistrationSize,
		.phase      = D2RL::Overlay::Phase::AfterGameUi,
		.callback   = DrawOverlay,
	};
	D2RL::Overlay::CallbackHandle handle = D2RL::Overlay::InvalidCallbackHandle;
	if (g_overlay->registerFrameCallback(context, &registration, &handle) != D2RL::Overlay::Result::Success) {
		context->LogWarn("Could not register the overlay.");
	}
}

/** Adds the plugin's actions to D2R's Controls menu, without a default key. */
void RegisterActions(const D2RL::PluginContext* context) {
	const auto input = QueryService<D2RL::InputService>(context, D2RL::InputServiceRequiredSize, D2RL::HasInputServiceField);
	if (input == nullptr) {
		context->LogWarn("Key bindings are not available in this D2RLoader version.");
		return;
	}
	const D2RL::Input::ActionRegistration actions[] {
		{
		    .structSize  = D2RL::Input::ActionRegistrationSize,
		    .logicalId   = "toggle-overlay",
		    .displayName = "Show/Hide Arcane Tracker overlay",
		    .category    = "Arcane Tracker",
		    .callback    = OnToggleOverlay,
		},
		{
		    .structSize  = D2RL::Input::ActionRegistrationSize,
		    .logicalId   = "toggle-session",
		    .displayName = "Start/End Arcane Tracker session",
		    .category    = "Arcane Tracker",
		    .callback    = OnToggleSession,
		},
	};
	for (const auto& action : actions) {
		D2RL::Input::ActionHandle handle = D2RL::Input::InvalidHandle;
		if (input->registerAction(context, &action, &handle) != D2RL::Input::Result::Success) {
			context->LogWarn("Could not register a key binding.");
		}
	}
}

}

D2RL_PLUGIN_EXPORT auto D2RLoaderGetPluginInfo() noexcept -> const D2RL::PluginInfo* {
	return &PluginInfo;
}

D2RL_PLUGIN_EXPORT auto D2RLoaderLoadPlugin(const D2RL::PluginContext* context) noexcept -> bool {
	if (context == nullptr) {
		return false;
	}
	try {
		g_context        = context;
		g_threads        = QueryService<D2RL::ThreadService>(context, D2RL::ThreadServiceRequiredSize, D2RL::HasThreadServiceField);
		const auto http  = QueryService<D2RL::HttpService>(context, D2RL::HttpServiceRequiredSize, D2RL::HasHttpServiceField);
		const auto cycle = QueryService<D2RL::LifecycleService>(context, LifecycleGameplayFieldEnd, D2RL::HasLifecycleServiceField);
		if (g_threads == nullptr || http == nullptr || cycle == nullptr) {
			context->LogError("This D2RLoader version lacks the thread, HTTP or lifecycle service the plugin needs. Update D2RLoader.");
			return false;
		}
		if (!RegisterGameplayListeners(context, cycle)) {
			context->LogError("Could not listen for game events.");
			return false;
		}

		BridgeClient::Initialize(http);
		ApplyConfig(LoadConfig(context));
		g_nextConfigReloadAt = Clock::now() + ConfigReloadInterval;
		if (!g_config.enabled) {
			context->LogInfo("The plugin is turned off in its config file.");
		} else if (g_config.token.empty()) {
			context->LogInfo("Not connected yet: connect the plugin in D2R Arcane Tracker's settings.");
		}

		g_inventory = QueryService<D2RL::InventoryService>(context, D2RL::InventoryServiceRequiredSize, D2RL::HasInventoryServiceField);
		if (g_inventory == nullptr) {
			context->LogWarn("Pickups can't be detected in this D2RLoader version.");
		}
		GroundHooks::Install(context);
		RegisterOverlay(context);
		RegisterActions(context);
		if (!context->RegisterConsoleCommand("arcane-tracker", OnStatusCommand, "Show the connection to D2R Arcane Tracker.")) {
			context->LogWarn("Could not register the arcane-tracker console command.");
		}

		EnsurePump(context);
		context->LogInfo("D2R Arcane Tracker plugin " ARCANE_TRACKER_PLUGIN_VERSION " loaded.");
		return true;
	} catch (...) {
		context->LogError("The plugin failed to load.");
		return false;
	}
}

D2RL_PLUGIN_EXPORT void D2RLoaderUnloadPlugin() noexcept {
	g_unloading = true;
	if (g_context != nullptr) {
		BridgeClient::Shutdown(g_context);
	}
}
