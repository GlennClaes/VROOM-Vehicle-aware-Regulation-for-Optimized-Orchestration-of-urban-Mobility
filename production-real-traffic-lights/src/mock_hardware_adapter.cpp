#include "vroom/mock_hardware_adapter.hpp"

#include "vroom/logger.hpp"

namespace vroom {

bool MockHardwareAdapter::initialize(std::string* error) {
    (void)error;
    initialized_ = true;
    Logger::instance().log(LogLevel::Info, "Mock hardware adapter initialized");
    return true;
}

bool MockHardwareAdapter::apply(const SignalCommand& command, std::string* error) {
    if (!initialized_) {
        if (error != nullptr) {
            *error = "mock hardware adapter was not initialized";
        }
        return false;
    }
    if (fail_writes_) {
        if (error != nullptr) {
            *error = "mock hardware write failure";
        }
        return false;
    }

    commands_.push_back(command);
    Logger::instance().log(
        LogLevel::Info,
        "mock signal command: " + command.signal_id + " -> " + to_string(command.color)
    );
    return true;
}

HealthReport MockHardwareAdapter::health() const {
    if (!initialized_) {
        return {HealthState::Degraded, "mock adapter not initialized"};
    }
    if (fail_writes_) {
        return {HealthState::Failed, "mock adapter configured to fail writes"};
    }
    return {HealthState::Ok, "mock adapter healthy"};
}

void MockHardwareAdapter::shutdown_safe() {
    initialized_ = false;
    Logger::instance().log(LogLevel::Warning, "mock hardware adapter moved to safe shutdown");
}

void MockHardwareAdapter::set_fail_writes(bool should_fail) {
    fail_writes_ = should_fail;
}

const std::vector<SignalCommand>& MockHardwareAdapter::commands() const {
    return commands_;
}

} // namespace vroom
