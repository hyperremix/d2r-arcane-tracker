#include "bridge_client.h"

#include "config.h"
#include "tracker_state.h"

#include <D2RLPlugin/context.h>
#include <D2RLPlugin/http.h>
#include <algorithm>
#include <array>
#include <atomic>
#include <chrono>
#include <cstdint>
#include <deque>
#include <mutex>
#include <string_view>

namespace ArcaneTracker::BridgeClient {

namespace {

using Clock = std::chrono::steady_clock;
using std::chrono::milliseconds;

constexpr int         ProtocolVersion   = 1;
constexpr size_t      MaxBatchSize      = 50;
constexpr size_t      MaxQueuedEvents   = 200;
constexpr uint32_t    RequestTimeoutMs  = 5'000;
constexpr uint32_t    MaxStateBytes     = 4U * 1'024U * 1'024U;
constexpr milliseconds StatePollInterval { 1'000 };
constexpr milliseconds FirstRetryDelay { 2'000 };
constexpr milliseconds MaxRetryDelay { 30'000 };

enum class RequestKind : uintptr_t {
	Hello  = 0,
	Events = 1,
	State  = 2,
};

struct QueuedEvent {
	uint64_t    sequence;
	std::string json;
};

const D2RL::HttpService* g_http = nullptr;
std::atomic<bool>        g_shuttingDown { false };

// Everything below is guarded by g_mutex
std::mutex                                g_mutex;
bool                                      g_enabled = false;
std::string                               g_baseUrl;
std::string                               g_authorization;
bool                                      g_connected        = false;
bool                                      g_protocolMismatch = false;
/** Whether "can't reach the tracker" was logged since the last connection, to log it only once. */
bool                                      g_unreachableLogged = false;
std::string                               g_lastError;
std::deque<QueuedEvent>                   g_queue;
uint64_t                                  g_nextSequence      = 1;
/** Sequence number of the last event in the batch being sent. */
uint64_t                                  g_sentUpToSequence  = 0;
size_t                                    g_droppedEvents     = 0;
std::array<bool, 3>                       g_inFlight {};
std::array<D2RL::Http::RequestHandle, 3>  g_handles {};
Clock::time_point                         g_nextHelloAt {};
Clock::time_point                         g_nextStatePollAt {};
milliseconds                              g_retryDelay = FirstRetryDelay;

auto Index(RequestKind kind) -> size_t {
	return static_cast<size_t>(kind);
}

/** Percent-encodes a query value. Revisions are plain tokens; this only guards against surprises. */
auto EncodeQueryValue(std::string_view value) -> std::string {
	constexpr char Hex[] = "0123456789ABCDEF";
	std::string    encoded;
	for (const char character : value) {
		const auto byte = static_cast<unsigned char>(character);
		if ((byte >= 'a' && byte <= 'z') || (byte >= 'A' && byte <= 'Z') || (byte >= '0' && byte <= '9') || byte == '-' || byte == '_' || byte == '.' || byte == '~') {
			encoded.push_back(character);
		} else {
			encoded.push_back('%');
			encoded.push_back(Hex[byte >> 4U]);
			encoded.push_back(Hex[byte & 0x0FU]);
		}
	}
	return encoded;
}

/**
 * Drops the connection after a failed request: the next hello waits for the retry delay, which
 * doubles up to MaxRetryDelay. The grail status and overlay are cleared, so nothing stale shows
 * while the tracker is closed. Must be called with g_mutex held.
 * @returns Whether the plugin was connected, so the caller logs the loss once
 */
auto DisconnectLocked(std::string error) -> bool {
	const bool wasConnected = g_connected;
	g_connected             = false;
	g_lastError             = std::move(error);
	g_nextHelloAt           = Clock::now() + g_retryDelay;
	g_retryDelay            = std::min(g_retryDelay * 2, MaxRetryDelay);
	TrackerState::Clear();
	return wasConnected;
}

auto DescribeFailure(const D2RL::Http::Response* response) -> std::string {
	if (!D2RL::Http::HasResponseField(response, D2RL::Http::ResponseRequiredSize)) {
		return "invalid response";
	}
	if (response->result != D2RL::Http::Result::Success) {
		return "request failed (result " + std::to_string(static_cast<uint32_t>(response->result)) + ")";
	}
	return "HTTP " + std::to_string(response->statusCode);
}

void __cdecl OnResponse(const D2RL::PluginContext* context, const D2RL::Http::Response* response, void* userData) noexcept;

/**
 * Sends one request; the response arrives in OnResponse. Must be called without g_mutex held, as
 * the response may arrive before send returns.
 */
void Send(const D2RL::PluginContext* context, RequestKind kind, D2RL::Http::Method method, const std::string& url, const std::string& authorization, const std::string& body) {
	const bool                hasBody = method == D2RL::Http::Method::Post;
	const D2RL::Http::Header  headers[] {
        { .name = "Authorization", .value = authorization.c_str() },
        { .name = "Content-Type", .value = "application/json" },
    };
	const D2RL::Http::Request request {
		.structSize      = D2RL::Http::RequestSize,
		.method          = method,
		.timeoutMs       = RequestTimeoutMs,
		.url             = url.c_str(),
		.headerCount     = hasBody ? 2U : 1U,
		.bodySize        = static_cast<uint32_t>(body.size()),
		.headers         = headers,
		.body            = hasBody ? body.data() : nullptr,
		.maxResponseSize = MaxStateBytes,
	};

	D2RL::Http::RequestHandle handle = D2RL::Http::InvalidRequestHandle;
	const auto result = g_http->send(context, &request, OnResponse, reinterpret_cast<void*>(static_cast<uintptr_t>(kind)), &handle);

	const std::lock_guard lock(g_mutex);
	if (result != D2RL::Http::Result::Success) {
		g_inFlight[Index(kind)] = false;
		DisconnectLocked("could not send a request (result " + std::to_string(static_cast<uint32_t>(result)) + ")");
	} else if (g_inFlight[Index(kind)]) {
		g_handles[Index(kind)] = handle;
	}
}

auto BuildEventBatchLocked() -> std::string {
	std::string body = R"({"events":[)";
	const auto  count = std::min(g_queue.size(), MaxBatchSize);
	for (size_t index = 0; index < count; ++index) {
		if (index > 0) {
			body.push_back(',');
		}
		body += g_queue[index].json;
	}
	g_sentUpToSequence = g_queue[count - 1].sequence;
	return body + "]}";
}

void EraseSentEventsLocked() {
	while (!g_queue.empty() && g_queue.front().sequence <= g_sentUpToSequence) {
		g_queue.pop_front();
	}
}

void __cdecl OnResponse(const D2RL::PluginContext* context, const D2RL::Http::Response* response, void* userData) noexcept {
	try {
		if (g_shuttingDown || context == nullptr) {
			return;
		}
		const auto kind      = static_cast<RequestKind>(reinterpret_cast<uintptr_t>(userData));
		const bool delivered = D2RL::Http::HasResponseField(response, D2RL::Http::ResponseRequiredSize) && response->result == D2RL::Http::Result::Success;
		const auto status    = delivered ? response->statusCode : 0U;

		// Applied outside the lock: TrackerState has its own, and parsing a large table takes a moment
		if (kind == RequestKind::State && status == 200) {
			const std::string_view body(static_cast<const char*>(response->body), response->bodySize);
			if (!TrackerState::Apply(body)) {
				context->LogWarn("The tracker sent a state the plugin doesn't understand.");
			}
		}

		const char* logInfo  = nullptr;
		const char* logWarn  = nullptr;
		const char* logError = nullptr;
		{
			const std::lock_guard lock(g_mutex);
			g_inFlight[Index(kind)] = false;
			g_handles[Index(kind)]  = D2RL::Http::InvalidRequestHandle;

			switch (kind) {
				case RequestKind::Hello:
					if (status == 200) {
						g_connected         = true;
						g_unreachableLogged = false;
						g_lastError.clear();
						g_retryDelay      = FirstRetryDelay;
						g_nextStatePollAt = Clock::now();
						logInfo           = "Connected to D2R Arcane Tracker.";
					} else if (status == 409) {
						g_protocolMismatch = true;
						g_lastError        = "the tracker speaks another protocol version";
						logError           = "D2R Arcane Tracker speaks another protocol version. Update the tracker and this plugin.";
					} else if (status == 401) {
						DisconnectLocked("the tracker rejected the token");
						if (!g_unreachableLogged) {
							g_unreachableLogged = true;
							logWarn             = "D2R Arcane Tracker rejected the token. Connect the plugin again in the tracker's settings.";
						}
					} else {
						DisconnectLocked("the tracker can't be reached: " + DescribeFailure(response));
						if (!g_unreachableLogged) {
							g_unreachableLogged = true;
							logInfo             = "D2R Arcane Tracker can't be reached. The plugin keeps trying while it runs.";
						}
					}
					break;
				case RequestKind::Events:
					if (status >= 200 && status < 300) {
						EraseSentEventsLocked();
					} else if (status == 400) {
						// The tracker won't accept this batch however often it is sent
						EraseSentEventsLocked();
						logWarn = "D2R Arcane Tracker rejected some events.";
					} else if (DisconnectLocked("sending events failed: " + DescribeFailure(response))) {
						logInfo = "Lost the connection to D2R Arcane Tracker.";
					}
					break;
				case RequestKind::State:
					if (status == 200) {
						g_nextStatePollAt = Clock::now() + StatePollInterval;
					} else if (DisconnectLocked("reading the state failed: " + DescribeFailure(response))) {
						logInfo = "Lost the connection to D2R Arcane Tracker.";
					}
					break;
			}
		}

		if (logInfo != nullptr) {
			context->LogInfo(logInfo);
		}
		if (logWarn != nullptr) {
			context->LogWarn(logWarn);
		}
		if (logError != nullptr) {
			context->LogError(logError);
		}
	} catch (...) {
		// Never let an exception reach the HTTP worker of the game process
	}
}

}

void Initialize(const D2RL::HttpService* http) {
	g_http = http;
}

void Configure(const Config& config) {
	const std::lock_guard lock(g_mutex);
	const bool            enabled       = config.enabled && !config.token.empty();
	std::string           baseUrl       = "http://127.0.0.1:" + std::to_string(config.port);
	std::string           authorization = "Bearer " + config.token;
	if (enabled == g_enabled && baseUrl == g_baseUrl && authorization == g_authorization) {
		return;
	}

	g_enabled       = enabled;
	g_baseUrl       = std::move(baseUrl);
	g_authorization = std::move(authorization);
	// A new tracker address or token starts over with a hello
	g_connected         = false;
	g_unreachableLogged = false;
	g_retryDelay        = FirstRetryDelay;
	g_nextHelloAt       = Clock::now();
	g_lastError.clear();
	TrackerState::Clear();
}

void Enqueue(std::string eventJson) {
	const std::lock_guard lock(g_mutex);
	if (g_queue.size() >= MaxQueuedEvents) {
		g_queue.pop_front();
		++g_droppedEvents;
	}
	g_queue.push_back({ g_nextSequence++, std::move(eventJson) });
}

void Tick(const D2RL::PluginContext* context) {
	if (g_http == nullptr || g_shuttingDown) {
		return;
	}

	struct PendingRequest {
		RequestKind        kind;
		D2RL::Http::Method method;
		std::string        url;
		std::string        body;
	};
	std::array<PendingRequest, 3> pending {};
	size_t                        pendingCount = 0;
	std::string                   authorization;
	{
		const std::lock_guard lock(g_mutex);
		if (!g_enabled || g_protocolMismatch) {
			return;
		}
		authorization  = g_authorization;
		const auto now = Clock::now();
		if (!g_connected) {
			if (!g_inFlight[Index(RequestKind::Hello)] && now >= g_nextHelloAt) {
				g_inFlight[Index(RequestKind::Hello)] = true;
				pending[pendingCount++]                = { RequestKind::Hello, D2RL::Http::Method::Post, g_baseUrl + "/v1/hello",
                    R"({"protocol":)" + std::to_string(ProtocolVersion) + R"(,"pluginVersion":")" ARCANE_TRACKER_PLUGIN_VERSION R"("})" };
			}
		} else {
			if (!g_inFlight[Index(RequestKind::Events)] && !g_queue.empty()) {
				g_inFlight[Index(RequestKind::Events)] = true;
				pending[pendingCount++]                 = { RequestKind::Events, D2RL::Http::Method::Post, g_baseUrl + "/v1/events", BuildEventBatchLocked() };
			}
			if (!g_inFlight[Index(RequestKind::State)] && now >= g_nextStatePollAt) {
				g_inFlight[Index(RequestKind::State)] = true;
				pending[pendingCount++]                = { RequestKind::State, D2RL::Http::Method::Get, g_baseUrl + "/v1/state?revision=" + EncodeQueryValue(TrackerState::Revision()), {} };
			}
		}
	}

	for (size_t index = 0; index < pendingCount; ++index) {
		Send(context, pending[index].kind, pending[index].method, pending[index].url, authorization, pending[index].body);
	}
}

auto IsConnected() -> bool {
	const std::lock_guard lock(g_mutex);
	return g_connected;
}

auto GetStatus() -> Status {
	const std::lock_guard lock(g_mutex);
	return { g_enabled, g_connected, g_lastError, g_queue.size(), g_droppedEvents };
}

void Shutdown(const D2RL::PluginContext* context) {
	g_shuttingDown = true;
	if (g_http == nullptr) {
		return;
	}
	std::array<D2RL::Http::RequestHandle, 3> handles {};
	{
		const std::lock_guard lock(g_mutex);
		handles = g_handles;
	}
	for (const auto handle : handles) {
		if (handle != D2RL::Http::InvalidRequestHandle) {
			(void)g_http->cancel(context, handle);
		}
	}
}

}
