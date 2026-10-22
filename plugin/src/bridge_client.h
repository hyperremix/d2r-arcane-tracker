#pragma once

#include <cstddef>
#include <string>

namespace D2RL {
struct HttpService;
struct PluginContext;
}

namespace ArcaneTracker {

struct Config;

/**
 * The HTTP client of the bridge protocol (PROTOCOL.md): says hello, sends the queued events and
 * polls the tracker's state. Requests start from Tick on the UI thread; their responses arrive on
 * a worker thread. They go through D2RLoader's HTTP service, or through WinHTTP (local_http.h) when
 * D2RLoader refuses plain-HTTP requests, as 1.3.1-beta does. The shared state is locked, so every
 * function may be called from any thread, but only the UI thread calls Configure and Tick.
 */
namespace BridgeClient {

/** Connection details for the console command. */
struct Status {
	bool        enabled;
	bool        connected;
	std::string lastError;
	size_t      queuedEvents;
	size_t      droppedEvents;
};

/** Sets the HTTP service the requests go through. Call once while the plugin loads. */
void Initialize(const D2RL::HttpService* http);

/**
 * Applies the connection settings. A changed port or token starts a new connection; a disabled
 * plugin or an empty token stops sending.
 */
void Configure(const Config& config);

/**
 * Queues one event (a JSON object). Events are kept while the tracker can't be reached, but only
 * sent when they are less than 30 seconds old; a new port or token drops the queue.
 */
void Enqueue(std::string eventJson);

/** Starts the requests that are due: hello, the next event batch and the state poll. */
void Tick(const D2RL::PluginContext* context);

/** Whether the tracker accepted the hello and answers. */
auto IsConnected() -> bool;

auto GetStatus() -> Status;

/** Cancels the open requests. Call while the plugin unloads. */
void Shutdown(const D2RL::PluginContext* context);

}

}
