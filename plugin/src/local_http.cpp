#include "local_http.h"

#include <windows.h>
// windows.h has to come first
#include <winhttp.h>

#include <condition_variable>
#include <deque>
#include <mutex>
#include <thread>
#include <utility>

namespace ArcaneTracker::LocalHttp {

namespace {

struct Job {
	Request  request;
	Callback callback;
};

std::mutex              g_mutex;
std::condition_variable g_wake;
std::deque<Job>         g_queue;
// On the heap and never destroyed by static destruction: when the process ends without
// D2RLoaderUnloadPlugin, a joinable std::thread destroyed with the DLL would terminate the process.
std::thread*            g_worker = nullptr;
bool                    g_stopping = false;

/** Closes a WinHTTP handle when it goes out of scope. */
class Handle {
public:
	explicit Handle(HINTERNET handle) : m_handle(handle) {}
	Handle(const Handle&)                    = delete;
	auto operator=(const Handle&) -> Handle& = delete;
	~Handle() {
		if (m_handle != nullptr) {
			WinHttpCloseHandle(m_handle);
		}
	}
	operator HINTERNET() const { return m_handle; }

private:
	HINTERNET m_handle;
};

/** The URL and the header value only hold ASCII: the tracker's address and a hex token. */
auto Widen(const std::string& text) -> std::wstring {
	return { text.begin(), text.end() };
}

auto FailureFromLastError() -> D2RL::Http::Result {
	return GetLastError() == ERROR_WINHTTP_TIMEOUT ? D2RL::Http::Result::Timeout : D2RL::Http::Result::NetworkError;
}

auto Perform(HINTERNET session, const Request& request) -> Response {
	Response response;
	if (session == nullptr) {
		return response;
	}

	const std::wstring url = Widen(request.url);
	URL_COMPONENTS     parts {};
	parts.dwStructSize      = sizeof(parts);
	parts.dwHostNameLength  = static_cast<DWORD>(-1);
	parts.dwUrlPathLength   = static_cast<DWORD>(-1);
	parts.dwExtraInfoLength = static_cast<DWORD>(-1);
	if (!WinHttpCrackUrl(url.c_str(), 0, 0, &parts) || parts.nScheme != INTERNET_SCHEME_HTTP) {
		return response;
	}
	const std::wstring host(parts.lpszHostName, parts.dwHostNameLength);
	const std::wstring path = std::wstring(parts.lpszUrlPath, parts.dwUrlPathLength) + std::wstring(parts.lpszExtraInfo, parts.dwExtraInfoLength);

	const Handle connection(WinHttpConnect(session, host.c_str(), parts.nPort, 0));
	if (connection == nullptr) {
		response.result = FailureFromLastError();
		return response;
	}
	const Handle http(WinHttpOpenRequest(connection, request.post ? L"POST" : L"GET", path.c_str(), nullptr, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, 0));
	if (http == nullptr) {
		response.result = FailureFromLastError();
		return response;
	}

	const int timeout = static_cast<int>(request.timeoutMs);
	WinHttpSetTimeouts(http, timeout, timeout, timeout, timeout);
	DWORD redirectPolicy = WINHTTP_OPTION_REDIRECT_POLICY_NEVER;
	WinHttpSetOption(http, WINHTTP_OPTION_REDIRECT_POLICY, &redirectPolicy, sizeof(redirectPolicy));

	std::wstring headers = L"Authorization: " + Widen(request.authorization) + L"\r\n";
	if (request.post) {
		headers += L"Content-Type: application/json\r\n";
	}
	const auto bodySize = static_cast<DWORD>(request.post ? request.body.size() : 0);
	void*      body     = request.post ? const_cast<char*>(request.body.data()) : WINHTTP_NO_REQUEST_DATA;
	if (!WinHttpSendRequest(http, headers.c_str(), static_cast<DWORD>(-1), body, bodySize, bodySize, 0) || !WinHttpReceiveResponse(http, nullptr)) {
		response.result = FailureFromLastError();
		return response;
	}

	DWORD statusCode = 0;
	DWORD size       = sizeof(statusCode);
	if (!WinHttpQueryHeaders(http, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_HEADER_NAME_BY_INDEX, &statusCode, &size, WINHTTP_NO_HEADER_INDEX)) {
		response.result = FailureFromLastError();
		return response;
	}

	for (;;) {
		DWORD available = 0;
		if (!WinHttpQueryDataAvailable(http, &available)) {
			response.result = FailureFromLastError();
			return response;
		}
		if (available == 0) {
			break;
		}
		if (response.body.size() + available > request.maxResponseSize) {
			response.result = D2RL::Http::Result::ResponseTooLarge;
			return response;
		}
		const size_t offset = response.body.size();
		response.body.resize(offset + available);
		DWORD read = 0;
		if (!WinHttpReadData(http, response.body.data() + offset, available, &read)) {
			response.result = FailureFromLastError();
			return response;
		}
		response.body.resize(offset + read);
	}

	response.result     = D2RL::Http::Result::Success;
	response.statusCode = statusCode;
	return response;
}

void RunWorker() {
	const Handle session(WinHttpOpen(L"D2R Arcane Tracker plugin", WINHTTP_ACCESS_TYPE_NO_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0));
	for (;;) {
		Job job;
		{
			std::unique_lock lock(g_mutex);
			g_wake.wait(lock, [] { return g_stopping || !g_queue.empty(); });
			if (g_stopping) {
				return;
			}
			job = std::move(g_queue.front());
			g_queue.pop_front();
		}
		try {
			job.callback(Perform(session, job.request));
		} catch (...) {
			// A failing callback must not end the worker
		}
	}
}

}

void Send(Request request, Callback callback) {
	{
		const std::lock_guard lock(g_mutex);
		if (g_stopping) {
			return;
		}
		if (g_worker == nullptr) {
			g_worker = new std::thread(RunWorker);
		}
		g_queue.push_back({ std::move(request), std::move(callback) });
	}
	g_wake.notify_one();
}

void Shutdown() {
	{
		const std::lock_guard lock(g_mutex);
		g_stopping = true;
		g_queue.clear();
	}
	g_wake.notify_one();
	if (g_worker != nullptr) {
		g_worker->join();
		delete g_worker;
		g_worker = nullptr;
	}
}

}
