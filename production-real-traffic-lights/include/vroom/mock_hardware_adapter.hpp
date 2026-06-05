#pragma once

#include "vroom/hardware_adapter.hpp"

#include <vector>

namespace vroom {

class MockHardwareAdapter final : public HardwareAdapter {
public:
    bool initialize(std::string* error) override;
    bool apply(const SignalCommand& command, std::string* error) override;
    HealthReport health() const override;
    void shutdown_safe() override;

    void set_fail_writes(bool should_fail);
    const std::vector<SignalCommand>& commands() const;

private:
    bool initialized_ = false;
    bool fail_writes_ = false;
    std::vector<SignalCommand> commands_;
};

} // namespace vroom
