#pragma once

#include "vroom/types.hpp"

#include <string>

namespace vroom {

class HardwareAdapter {
public:
    virtual ~HardwareAdapter() = default;

    virtual bool initialize(std::string* error) = 0;
    virtual bool apply(const SignalCommand& command, std::string* error) = 0;
    virtual HealthReport health() const = 0;
    virtual void shutdown_safe() = 0;
};

} // namespace vroom
