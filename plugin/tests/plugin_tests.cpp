// Tests of the plugin's pure logic: the config parser, the tracker state parser, the ground label
// text and the WinHTTP client. They need no game and no D2RLoader; see README.md for how to run them.
#include "config.h"
#include "ground_label.h"
#include "local_http.h"
#include "tracker_state.h"

#include <winsock2.h>
// winsock2.h has to come first
#include <ws2tcpip.h>

#include <cstdlib>
#include <future>
#include <iostream>
#include <string>
#include <thread>

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
		"[arcane-tracker]\nport = 70000\noverlay_x = 2.5\noverlay_y = -1\nscan_interval_ms = 5\nground_labels = maybe\nenabled = \"yes\"\n");
	CHECK(config.port == 41733);
	CHECK(config.overlayX == 1.0F);
	CHECK(config.overlayY == 0.0F);
	CHECK(config.scanIntervalMs == 100);
	CHECK(config.groundLabels);
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

/** An item code the way D2R stores it: up to four characters, padded with spaces. */
auto ItemCode(const char* text) -> uint32_t {
	uint32_t code = 0x20202020;
	for (int index = 0; index < 4 && text[index] != '\0'; ++index) {
		code = (code & ~(0xFFU << (index * 8))) | (static_cast<uint32_t>(static_cast<unsigned char>(text[index])) << (index * 8));
	}
	return code;
}

// The color marker D2R keeps in strings (U+E07E) in front of the color digit
constexpr const char* Marker = "\xEE\x81\xBE";

void GroundLabelHasTheColorMarkerAndTheStatusText() {
	ArcaneTracker::TrackerState::Clear();
	CHECK(ArcaneTracker::TrackerState::Apply(StateWithGrail));

	const auto missing = ArcaneTracker::GroundLabelSuffix(D2RL::Items::Quality::Unique, 123, ItemCode("uap"), false);
	const auto found   = ArcaneTracker::GroundLabelSuffix(D2RL::Items::Quality::Unique, 123, ItemCode("uap"), true);
	CHECK(missing == std::string("\n") + Marker + "4Holy Grail: not found yet");
	CHECK(found == std::string("\n") + Marker + "5Holy Grail: ethereal already found");
	ArcaneTracker::TrackerState::Clear();
}

void GroundLabelNeedsAGrailItemTheTrackerTracks() {
	ArcaneTracker::TrackerState::Clear();
	CHECK(ArcaneTracker::TrackerState::Apply(StateWithGrail));

	// A rare item, a unique row the tracker doesn't know, the same row with another base item, an
	// ethereal rune the tracker doesn't track, and a base item that isn't a rune
	CHECK(!ArcaneTracker::GroundLabelSuffix(D2RL::Items::Quality::Rare, 123, ItemCode("uap"), false));
	CHECK(!ArcaneTracker::GroundLabelSuffix(D2RL::Items::Quality::Unique, 999, ItemCode("uap"), false));
	CHECK(!ArcaneTracker::GroundLabelSuffix(D2RL::Items::Quality::Unique, 123, ItemCode("mgl"), false));
	CHECK(!ArcaneTracker::GroundLabelSuffix(D2RL::Items::Quality::Normal, -1, ItemCode("r08"), true));
	CHECK(!ArcaneTracker::GroundLabelSuffix(D2RL::Items::Quality::Normal, -1, ItemCode("mgl"), false));
	ArcaneTracker::TrackerState::Clear();
}

void GroundLabelOfARuneUsesItsCode() {
	ArcaneTracker::TrackerState::Clear();
	CHECK(ArcaneTracker::TrackerState::Apply(StateWithGrail));

	const auto label = ArcaneTracker::GroundLabelSuffix(D2RL::Items::Quality::Normal, -1, ItemCode("r08"), false);
	CHECK(label == std::string("\n") + Marker + "5Holy Grail: already found");
	ArcaneTracker::TrackerState::Clear();
}

/** Answers one connection on 127.0.0.1 with a fixed reply, and keeps the request it received. */
class OneShotServer {
public:
	explicit OneShotServer(std::string reply) : m_reply(std::move(reply)) {
		m_listener = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
		sockaddr_in address {};
		address.sin_family = AF_INET;
		inet_pton(AF_INET, "127.0.0.1", &address.sin_addr);
		bind(m_listener, reinterpret_cast<sockaddr*>(&address), sizeof(address));
		int length = sizeof(address);
		getsockname(m_listener, reinterpret_cast<sockaddr*>(&address), &length);
		m_port = ntohs(address.sin_port);
		listen(m_listener, 1);
		m_thread = std::thread([this] { Serve(); });
	}
	OneShotServer(const OneShotServer&)                    = delete;
	auto operator=(const OneShotServer&) -> OneShotServer& = delete;
	~OneShotServer() {
		closesocket(m_listener);
		m_thread.join();
	}

	auto Port() const -> unsigned short { return m_port; }
	/** The request as received; only valid once the client got its response. */
	auto Request() const -> const std::string& { return m_request; }

private:
	void Serve() {
		const SOCKET client = accept(m_listener, nullptr, nullptr);
		if (client == INVALID_SOCKET) {
			return;
		}
		// WinHTTP may send the headers and the body separately, so read the announced body too
		char   buffer[4096];
		size_t bodyEnd = std::string::npos;
		while (bodyEnd == std::string::npos || m_request.size() < bodyEnd) {
			const int received = recv(client, buffer, sizeof(buffer), 0);
			if (received <= 0) {
				break;
			}
			m_request.append(buffer, static_cast<size_t>(received));
			const auto headersEnd = m_request.find("\r\n\r\n");
			if (bodyEnd == std::string::npos && headersEnd != std::string::npos) {
				const auto lengthAt = m_request.find("Content-Length: ");
				bodyEnd             = headersEnd + 4 + (lengthAt == std::string::npos ? 0 : std::stoul(m_request.substr(lengthAt + 16)));
			}
		}
		send(client, m_reply.data(), static_cast<int>(m_reply.size()), 0);
		closesocket(client);
	}

	std::string    m_reply;
	std::string    m_request;
	SOCKET         m_listener = INVALID_SOCKET;
	unsigned short m_port     = 0;
	std::thread    m_thread;
};

auto SendLocally(ArcaneTracker::LocalHttp::Request request) -> ArcaneTracker::LocalHttp::Response {
	std::promise<ArcaneTracker::LocalHttp::Response> promise;
	auto                                             future = promise.get_future();
	ArcaneTracker::LocalHttp::Send(std::move(request), [&promise](ArcaneTracker::LocalHttp::Response response) { promise.set_value(std::move(response)); });
	return future.get();
}

void LocalHttpSendsThePostAndReturnsTheStatusAndBody() {
	OneShotServer server("HTTP/1.1 401 Unauthorized\r\nContent-Length: 4\r\nConnection: close\r\n\r\nnope");

	const auto response = SendLocally({ true, "http://127.0.0.1:" + std::to_string(server.Port()) + "/v1/events?revision=r1", "Bearer secret", R"({"a":1})" });

	CHECK(response.result == D2RL::Http::Result::Success);
	CHECK(response.statusCode == 401);
	CHECK(response.body == "nope");
	CHECK(server.Request().starts_with("POST /v1/events?revision=r1 HTTP/1.1\r\n"));
	CHECK(server.Request().find("Authorization: Bearer secret\r\n") != std::string::npos);
	CHECK(server.Request().find("Content-Type: application/json\r\n") != std::string::npos);
	CHECK(server.Request().ends_with(R"({"a":1})"));
}

void LocalHttpSendsAGetWithoutABody() {
	OneShotServer server("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok");

	const auto response = SendLocally({ false, "http://127.0.0.1:" + std::to_string(server.Port()) + "/v1/state", "Bearer secret" });

	CHECK(response.result == D2RL::Http::Result::Success);
	CHECK(response.statusCode == 200);
	CHECK(response.body == "ok");
	CHECK(server.Request().starts_with("GET /v1/state HTTP/1.1\r\n"));
	CHECK(server.Request().find("Content-Type") == std::string::npos);
}

void LocalHttpReportsAResponseThatIsTooLarge() {
	OneShotServer server("HTTP/1.1 200 OK\r\nContent-Length: 10\r\nConnection: close\r\n\r\n0123456789");

	const auto response = SendLocally({ false, "http://127.0.0.1:" + std::to_string(server.Port()) + "/v1/state", "Bearer secret", {}, 5'000, 4 });

	CHECK(response.result == D2RL::Http::Result::ResponseTooLarge);
}

void LocalHttpReportsATrackerThatIsNotListening() {
	unsigned short closedPort = 0;
	{
		const OneShotServer server("");
		closedPort = server.Port();
	}

	const auto response = SendLocally({ false, "http://127.0.0.1:" + std::to_string(closedPort) + "/v1/state", "Bearer secret", {}, 2'000 });

	CHECK(response.result != D2RL::Http::Result::Success);
	CHECK(response.statusCode == 0);
}

}

int main() {
	WSADATA wsaData {};
	WSAStartup(MAKEWORD(2, 2), &wsaData);
	ConfigDefaultsApplyWithoutATable();
	ConfigReadsWhatTheTrackerWrites();
	ConfigKeepsOtherTablesAndCommentsOut();
	ConfigClampsAndIgnoresInvalidValues();
	StateAppliesTheGrailStatusAndOverlay();
	StateKeepsTheGrailStatusWithoutNewRecords();
	StateRejectsABodyWithoutARevisionFirst();
	GroundLabelHasTheColorMarkerAndTheStatusText();
	GroundLabelNeedsAGrailItemTheTrackerTracks();
	GroundLabelOfARuneUsesItsCode();
	LocalHttpSendsThePostAndReturnsTheStatusAndBody();
	LocalHttpSendsAGetWithoutABody();
	LocalHttpReportsAResponseThatIsTooLarge();
	LocalHttpReportsATrackerThatIsNotListening();
	ArcaneTracker::LocalHttp::Shutdown();
	WSACleanup();
	if (g_failures > 0) {
		std::cerr << g_failures << " check(s) failed\n";
		return EXIT_FAILURE;
	}
	std::cout << "All plugin tests passed\n";
	return EXIT_SUCCESS;
}
