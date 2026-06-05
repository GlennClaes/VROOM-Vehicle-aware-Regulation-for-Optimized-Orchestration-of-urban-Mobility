#pragma once

#include "vroom/hardware_adapter.hpp"
#include "vroom/message_protocol.hpp"
#include "vroom/types.hpp"

#include <cstdint>
#include <string>

namespace vroom {

class IntersectionController {
public:
    IntersectionController(ControllerConfig config, HardwareAdapter& hardware);

    bool start(std::uint64_t now_ms, std::string* error);
    bool apply_phase(const std::string& phase, std::uint64_t now_ms, std::string* error);
    bool tick(std::uint64_t now_ms, std::string* error);
    void on_neighbor_message(const TrafficMessage& message);

    CommunicationState communication_state(std::uint64_t now_ms) const;
    const std::string& active_phase() const;

private:
    bool apply_all_red(std::uint64_t now_ms, std::string* error);
    bool apply_group_phase(
        const std::string& green_group,
        const std::string& phase,
        std::uint64_t now_ms,
        std::string* error
    );
    bool send_signal(const SignalHead& signal, SignalColor color, std::uint64_t now_ms, std::string* error);

    ControllerConfig config_;
    HardwareAdapter& hardware_;
    std::uint64_t last_neighbor_seen_ms_ = 0;
    std::uint64_t fallback_entered_ms_ = 0;
    std::uint64_t last_phase_change_ms_ = 0;
    std::string active_phase_ = "STOPPED";
    bool started_ = false;
    bool fallback_active_ = false;
};

} // namespace vroom
