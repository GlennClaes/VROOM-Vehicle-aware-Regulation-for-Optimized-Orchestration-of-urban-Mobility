#pragma once

#include <mutex>
#include <string>

namespace vroom {

enum class LogLevel {
    Info = 0,
    Warning = 1,
    Error = 2
};

class Logger {
public:
    static Logger& instance();

    void set_min_level(LogLevel level);
    void log(LogLevel level, const std::string& message);

private:
    Logger() = default;

    std::mutex mutex_;
    LogLevel min_level_ = LogLevel::Info;
};

} // namespace vroom
