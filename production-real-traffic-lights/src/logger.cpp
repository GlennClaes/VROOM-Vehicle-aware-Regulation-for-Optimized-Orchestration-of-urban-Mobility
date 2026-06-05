#include "vroom/logger.hpp"

#include <chrono>
#include <iomanip>
#include <iostream>
#include <sstream>

namespace vroom {

namespace {

const char* level_name(LogLevel level) {
    switch (level) {
    case LogLevel::Info:
        return "INFO";
    case LogLevel::Warning:
        return "WARN";
    case LogLevel::Error:
        return "ERROR";
    }
    return "UNKNOWN";
}

std::string utc_timestamp() {
    const auto now = std::chrono::system_clock::now();
    const auto time = std::chrono::system_clock::to_time_t(now);

    std::tm tm{};
#if defined(_WIN32)
    gmtime_s(&tm, &time);
#else
    gmtime_r(&time, &tm);
#endif

    std::ostringstream stream;
    stream << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
    return stream.str();
}

} // namespace

Logger& Logger::instance() {
    static Logger logger;
    return logger;
}

void Logger::set_min_level(LogLevel level) {
    std::lock_guard<std::mutex> lock(mutex_);
    min_level_ = level;
}

void Logger::log(LogLevel level, const std::string& message) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (static_cast<int>(level) < static_cast<int>(min_level_)) {
        return;
    }

    std::clog << utc_timestamp() << " [" << level_name(level) << "] " << message << '\n';
}

} // namespace vroom
