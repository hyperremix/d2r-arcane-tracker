#pragma once

#include <D2RLPlugin/http.h>
#include <cstdint>
#include <functional>
#include <string>

namespace ArcaneTracker {

/**
 * A small HTTP client for the tracker on 127.0.0.1, built on Windows' WinHTTP. The bridge uses it
 * when D2RLoader's own HTTP service refuses plain-HTTP requests, which D2RLoader 1.3.1-beta does.
 * Requests run one at a time on a worker thread that starts with the first request; the callback
 * runs on that thread.
 */
namespace LocalHttp {

struct Request {
	bool        post = false;
	/** An ASCII `http://` URL without redirects or proxy. */
	std::string url;
	/** The value of the Authorization header. */
	std::string authorization;
	/** The JSON body of a POST. */
	std::string body;
	/** Applies to every step of the request: connect, send and receive. */
	uint32_t    timeoutMs       = 5'000;
	uint32_t    maxResponseSize = 4U * 1'024U * 1'024U;
};

struct Response {
	/** Success when the tracker answered, whatever the HTTP status; else why it didn't. */
	D2RL::Http::Result result = D2RL::Http::Result::NetworkError;
	uint32_t           statusCode = 0;
	std::string        body;
};

using Callback = std::function<void(Response)>;

/** Queues a request. Nothing is sent after Shutdown. */
void Send(Request request, Callback callback);

/** Drops the queued requests and stops the worker thread. Call while the plugin unloads. */
void Shutdown();

}

}
