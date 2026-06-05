#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace vroom {

enum class SignalColor {
    Red,
    Amber,
    Green,
    Off
};

enum class HealthState {
    Ok,
    Degraded,
    Failed
};

enum class CommunicationState {
    Healthy,
    Degraded,
    Lost
};

struct SignalHead {
    std::string id;
    std::string group;
};

struct SignalCommand {
    std::string signal_id;
    SignalColor color = SignalColor::Red;
    std::uint32_t min_hold_ms = 0;
    std::uint64_t issued_at_ms = 0;
};

struct HealthReport {
    HealthState state = HealthState::Ok;
    std::string detail = "ok";
};

struct ControllerConfig {
    std::string intersection_id = "intersection-unknown";
    std::uint32_t communication_timeout_ms = 1500;
    std::uint32_t all_red_duration_ms = 1500;
    std::uint32_t fixed_phase_duration_ms = 12000;
    std::vector<SignalHead> signal_heads;
};

std::string to_string(SignalColor color);
std::string to_string(HealthState state);
std::string to_string(CommunicationState state);

bool signal_color_from_string(const std::string& value, SignalColor* color);

} // namespace vroom
