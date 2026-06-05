#include "vroom/intersection_controller.hpp"

#include "vroom/logger.hpp"

#include <utility>

namespace vroom {

namespace {

constexpr const char* phase_all_red = "ALL_RED";
constexpr const char* phase_ns_green = "NS_GREEN";
constexpr const char* phase_ew_green = "EW_GREEN";
constexpr const char* group_north_south = "north_south";
constexpr const char* group_east_west = "east_west";

} // namespace

IntersectionController::IntersectionController(ControllerConfig config, HardwareAdapter& hardware)
    : config_(std::move(config)),
      hardware_(hardware) {}

bool IntersectionController::start(std::uint64_t now_ms, std::string* error) {
    if (config_.signal_heads.empty()) {
        if (error != nullptr) {
            *error = "controller requires at least one signal head";
        }
        return false;
    }
    if (!hardware_.initialize(error)) {
        return false;
    }

    started_ = true;
    last_neighbor_seen_ms_ = now_ms;
    Logger::instance().log(LogLevel::Info, "controller started for " + config_.intersection_id);
    return apply_all_red(now_ms, error);
}

bool IntersectionController::apply_phase(const std::string& phase, std::uint64_t now_ms, std::string* error) {
    if (!started_) {
        if (error != nullptr) {
            *error = "controller is not started";
        }
        return false;
    }

    if (phase == phase_all_red) {
        return apply_all_red(now_ms, error);
    }
    if (phase == phase_ns_green) {
        return apply_group_phase(group_north_south, phase_ns_green, now_ms, error);
    }
    if (phase == phase_ew_green) {
        return apply_group_phase(group_east_west, phase_ew_green, now_ms, error);
    }

    if (error != nullptr) {
        *error = "unknown phase " + phase;
    }
    return false;
}

bool IntersectionController::tick(std::uint64_t now_ms, std::string* error) {
    const auto state = communication_state(now_ms);
    if (state != CommunicationState::Lost) {
        fallback_active_ = false;
        return true;
    }

    if (!fallback_active_) {
        fallback_active_ = true;
        fallback_entered_ms_ = now_ms;
        Logger::instance().log(
            LogLevel::Warning,
            "communication lost for " + config_.intersection_id + "; entering all-red fallback"
        );
        return apply_all_red(now_ms, error);
    }

    if (now_ms - fallback_entered_ms_ < config_.all_red_duration_ms) {
        return true;
    }

    if (now_ms - last_phase_change_ms_ < config_.fixed_phase_duration_ms) {
        return true;
    }

    const std::string next_phase = active_phase_ == phase_ns_green ? phase_ew_green : phase_ns_green;
    Logger::instance().log(LogLevel::Warning, "fallback fixed-cycle phase " + next_phase);
    return apply_phase(next_phase, now_ms, error);
}

void IntersectionController::on_neighbor_message(const TrafficMessage& message) {
    last_neighbor_seen_ms_ = message.timestamp_ms;
    if (fallback_active_) {
        Logger::instance().log(LogLevel::Info, "neighbor communication restored from " + message.intersection_id);
    }
    fallback_active_ = false;
}

CommunicationState IntersectionController::communication_state(std::uint64_t now_ms) const {
    if (!started_) {
        return CommunicationState::Degraded;
    }

    const auto age_ms = now_ms >= last_neighbor_seen_ms_ ? now_ms - last_neighbor_seen_ms_ : 0;
    if (age_ms > config_.communication_timeout_ms) {
        return CommunicationState::Lost;
    }
    if (age_ms > config_.communication_timeout_ms / 2) {
        return CommunicationState::Degraded;
    }
    return CommunicationState::Healthy;
}

const std::string& IntersectionController::active_phase() const {
    return active_phase_;
}

bool IntersectionController::apply_all_red(std::uint64_t now_ms, std::string* error) {
    for (const auto& signal : config_.signal_heads) {
        if (!send_signal(signal, SignalColor::Red, now_ms, error)) {
            return false;
        }
    }

    active_phase_ = phase_all_red;
    last_phase_change_ms_ = now_ms;
    return true;
}

bool IntersectionController::apply_group_phase(
    const std::string& green_group,
    const std::string& phase,
    std::uint64_t now_ms,
    std::string* error
) {
    for (const auto& signal : config_.signal_heads) {
        const SignalColor color = signal.group == green_group ? SignalColor::Green : SignalColor::Red;
        if (!send_signal(signal, color, now_ms, error)) {
            return false;
        }
    }

    active_phase_ = phase;
    last_phase_change_ms_ = now_ms;
    return true;
}

bool IntersectionController::send_signal(
    const SignalHead& signal,
    SignalColor color,
    std::uint64_t now_ms,
    std::string* error
) {
    SignalCommand command;
    command.signal_id = signal.id;
    command.color = color;
    command.min_hold_ms = config_.all_red_duration_ms;
    command.issued_at_ms = now_ms;
    return hardware_.apply(command, error);
}

} // namespace vroom
