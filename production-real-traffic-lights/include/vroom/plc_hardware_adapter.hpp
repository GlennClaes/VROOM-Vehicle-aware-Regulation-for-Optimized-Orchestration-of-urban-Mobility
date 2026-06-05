#pragma once

#include "vroom/hardware_adapter.hpp"

#include <map>

namespace vroom {

struct PlcRegister {
    std::uint16_t address = 0;
    std::uint16_t red_value = 0;
    std::uint16_t amber_value = 1;
    std::uint16_t green_value = 2;
    std::uint16_t off_value = 3;
};

class PlcHardwareAdapter final : public HardwareAdapter {
public:
    PlcHardwareAdapter(std::string endpoint, bool dry_run = true);

    void map_register(const std::string& signal_id, PlcRegister reg);

    bool initialize(std::string* error) override;
    bool apply(const SignalCommand& command, std::string* error) override;
    HealthReport health() const override;
    void shutdown_safe() override;

private:
    std::uint16_t value_for(const PlcRegister& reg, SignalColor color) const;

    std::string endpoint_;
    bool dry_run_ = true;
    bool initialized_ = false;
    std::map<std::string, PlcRegister> register_map_;
    HealthReport health_;
};

} // namespace vroom
