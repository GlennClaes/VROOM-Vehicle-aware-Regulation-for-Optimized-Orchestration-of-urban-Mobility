#include "vroom/plc_hardware_adapter.hpp"

#include "vroom/logger.hpp"

#include <sstream>
#include <utility>

namespace vroom {

PlcHardwareAdapter::PlcHardwareAdapter(std::string endpoint, bool dry_run)
    : endpoint_(std::move(endpoint)),
      dry_run_(dry_run),
      health_{HealthState::Degraded, "not initialized"} {}

void PlcHardwareAdapter::map_register(const std::string& signal_id, PlcRegister reg) {
    register_map_[signal_id] = reg;
}

bool PlcHardwareAdapter::initialize(std::string* error) {
    if (endpoint_.empty()) {
        if (error != nullptr) {
            *error = "PLC endpoint is empty";
        }
        health_ = {HealthState::Failed, "PLC endpoint is empty"};
        return false;
    }
    if (register_map_.empty()) {
        if (error != nullptr) {
            *error = "no PLC registers configured";
        }
        health_ = {HealthState::Failed, "no PLC registers configured"};
        return false;
    }

    initialized_ = true;
    health_ = {HealthState::Ok, dry_run_ ? "PLC dry-run initialized" : "PLC endpoint prepared"};
    Logger::instance().log(LogLevel::Info, health_.detail + " at " + endpoint_);
    return true;
}

bool PlcHardwareAdapter::apply(const SignalCommand& command, std::string* error) {
    if (!initialized_) {
        if (error != nullptr) {
            *error = "PLC adapter was not initialized";
        }
        return false;
    }

    const auto reg = register_map_.find(command.signal_id);
    if (reg == register_map_.end()) {
        if (error != nullptr) {
            *error = "no PLC register mapped for signal " + command.signal_id;
        }
        return false;
    }

    const std::uint16_t value = value_for(reg->second, command.color);
    std::ostringstream stream;
    stream << "PLC command " << endpoint_ << " register " << reg->second.address
           << " = " << value << " for " << command.signal_id;

    if (dry_run_) {
        Logger::instance().log(LogLevel::Info, "PLC dry-run: " + stream.str());
        return true;
    }

    // The production project keeps the PLC vendor/Modbus dependency outside the
    // core controller. A field deployment should implement this write through
    // the selected certified PLC SDK and keep this HAL contract unchanged.
    if (error != nullptr) {
        *error = "real PLC write backend is not linked in this build";
    }
    health_ = {HealthState::Failed, "real PLC write backend missing"};
    return false;
}

HealthReport PlcHardwareAdapter::health() const {
    return health_;
}

void PlcHardwareAdapter::shutdown_safe() {
    initialized_ = false;
    health_ = {HealthState::Degraded, "PLC adapter disconnected during safe shutdown"};
    Logger::instance().log(LogLevel::Warning, "PLC adapter safe shutdown requested");
}

std::uint16_t PlcHardwareAdapter::value_for(const PlcRegister& reg, SignalColor color) const {
    switch (color) {
    case SignalColor::Red:
        return reg.red_value;
    case SignalColor::Amber:
        return reg.amber_value;
    case SignalColor::Green:
        return reg.green_value;
    case SignalColor::Off:
        return reg.off_value;
    }
    return reg.off_value;
}

} // namespace vroom
