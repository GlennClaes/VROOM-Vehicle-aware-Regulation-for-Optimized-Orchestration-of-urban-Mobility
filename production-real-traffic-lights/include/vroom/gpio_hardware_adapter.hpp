#pragma once

#include "vroom/hardware_adapter.hpp"

#include <map>

namespace vroom {

struct GpioPin {
    int pin = -1;
    bool active_high = true;
};

// C++ is used here because low-level controller code needs predictable latency,
// static typing, RAII cleanup, and direct access to platform GPIO/PLC SDKs.
class GpioHardwareAdapter final : public HardwareAdapter {
public:
    explicit GpioHardwareAdapter(bool dry_run = true);

    void map_pin(const std::string& signal_id, SignalColor color, GpioPin pin);

    bool initialize(std::string* error) override;
    bool apply(const SignalCommand& command, std::string* error) override;
    HealthReport health() const override;
    void shutdown_safe() override;

private:
    bool set_output(const GpioPin& pin, bool enabled, std::string* error);
    std::string key_for(const std::string& signal_id, SignalColor color) const;

    bool dry_run_ = true;
    bool initialized_ = false;
    std::map<std::string, GpioPin> pin_map_;
    HealthReport health_;
};

} // namespace vroom
