#include "vroom/gpio_hardware_adapter.hpp"

#include "vroom/logger.hpp"

#include <fstream>
#include <sstream>

namespace vroom {

GpioHardwareAdapter::GpioHardwareAdapter(bool dry_run)
    : dry_run_(dry_run),
      health_{HealthState::Degraded, "not initialized"} {}

void GpioHardwareAdapter::map_pin(const std::string& signal_id, SignalColor color, GpioPin pin) {
    pin_map_[key_for(signal_id, color)] = pin;
}

bool GpioHardwareAdapter::initialize(std::string* error) {
    if (pin_map_.empty()) {
        if (error != nullptr) {
            *error = "no GPIO pins configured";
        }
        health_ = {HealthState::Failed, "no GPIO pins configured"};
        return false;
    }

    initialized_ = true;
    health_ = {HealthState::Ok, dry_run_ ? "GPIO dry-run initialized" : "GPIO initialized"};
    Logger::instance().log(LogLevel::Info, health_.detail);
    return true;
}

bool GpioHardwareAdapter::apply(const SignalCommand& command, std::string* error) {
    if (!initialized_) {
        if (error != nullptr) {
            *error = "GPIO adapter was not initialized";
        }
        return false;
    }

    for (const SignalColor color : {SignalColor::Red, SignalColor::Amber, SignalColor::Green}) {
        const auto iter = pin_map_.find(key_for(command.signal_id, color));
        if (iter == pin_map_.end()) {
            continue;
        }

        if (!set_output(iter->second, color == command.color, error)) {
            health_ = {HealthState::Failed, error != nullptr ? *error : "GPIO write failed"};
            return false;
        }
    }

    Logger::instance().log(
        LogLevel::Info,
        "GPIO signal command: " + command.signal_id + " -> " + to_string(command.color)
    );
    return true;
}

HealthReport GpioHardwareAdapter::health() const {
    return health_;
}

void GpioHardwareAdapter::shutdown_safe() {
    for (const auto& entry : pin_map_) {
        std::string ignored_error;
        set_output(entry.second, false, &ignored_error);
    }
    initialized_ = false;
    health_ = {HealthState::Degraded, "GPIO outputs disabled during safe shutdown"};
}

bool GpioHardwareAdapter::set_output(const GpioPin& pin, bool enabled, std::string* error) {
    if (pin.pin < 0) {
        if (error != nullptr) {
            *error = "invalid GPIO pin";
        }
        return false;
    }

    const bool physical_value = pin.active_high ? enabled : !enabled;
    if (dry_run_) {
        std::ostringstream stream;
        stream << "GPIO dry-run pin " << pin.pin << " = " << (physical_value ? 1 : 0);
        Logger::instance().log(LogLevel::Info, stream.str());
        return true;
    }

    const std::string path = "/sys/class/gpio/gpio" + std::to_string(pin.pin) + "/value";
    std::ofstream value_file(path);
    if (!value_file) {
        if (error != nullptr) {
            *error = "cannot open " + path + " for GPIO output";
        }
        return false;
    }

    value_file << (physical_value ? "1" : "0");
    return static_cast<bool>(value_file);
}

std::string GpioHardwareAdapter::key_for(const std::string& signal_id, SignalColor color) const {
    return signal_id + ":" + to_string(color);
}

} // namespace vroom
