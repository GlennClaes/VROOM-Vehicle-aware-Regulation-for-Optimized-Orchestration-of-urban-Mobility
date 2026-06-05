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

    // Initialize all signal heads to Red in active_colors_
    for (const auto& signal : config_.signal_heads) {
        active_colors_[signal.id] = SignalColor::Red;
    }

    started_ = true;
    last_neighbor_seen_ms_ = now_ms;
    Logger::instance().log(LogLevel::Info, "controller started for " + config_.intersection_id);
    return apply_all_red(now_ms, error);
}

bool IntersectionController::apply_phase(const std::string& phase, std::uint64_t now_ms, std::string* error, bool force) {
    if (failed_) {
        if (error != nullptr) {
            *error = "controller is in a Failed state due to hardware/safety interlock fault: " + health_status_;
        }
        return false;
    }

    if (phase == active_phase_ || (in_transition_ && phase == transition_target_phase_)) {
        return true;
    }

    if (!started_) {
        if (error != nullptr) {
            *error = "controller is not started";
        }
        return false;
    }

    if (in_transition_) {
        if (error != nullptr) {
            *error = "controller is currently in safety clearance transition";
        }
        return false;
    }

    // Minimum Green Enforcer (bypassed if force is true)
    if (!force && (active_phase_ == phase_ns_green || active_phase_ == phase_ew_green)) {
        const auto elapsed_green = now_ms >= last_phase_change_ms_ ? now_ms - last_phase_change_ms_ : 0;
        if (elapsed_green < config_.min_green_duration_ms) {
            if (error != nullptr) {
                *error = "minimum green duration of " + std::to_string(config_.min_green_duration_ms) + "ms not met (elapsed: " + std::to_string(elapsed_green) + "ms)";
            }
            return false;
        }
    }

    if (phase != phase_all_red && phase != phase_ns_green && phase != phase_ew_green) {
        if (error != nullptr) {
            *error = "unknown phase " + phase;
        }
        return false;
    }

    // Yellow/Amber Clearance Enforcer logic
    if (active_phase_ == phase_ns_green && (phase == phase_ew_green || phase == phase_all_red)) {
        // Transition North-South Green -> North-South Amber
        in_transition_ = true;
        transition_start_ms_ = now_ms;
        transition_state_ = 0; // Amber stage
        transition_target_phase_ = phase;
        active_phase_ = "NS_AMBER";
        last_phase_change_ms_ = now_ms;

        for (const auto& signal : config_.signal_heads) {
            SignalColor color = SignalColor::Red;
            if (signal.group == group_north_south) {
                color = SignalColor::Amber;
            }
            if (!send_signal(signal, color, now_ms, error)) {
                return false;
            }
        }
        Logger::instance().log(LogLevel::Info, "safety transition started: North-South Green -> Amber");
        return true;
    }
    
    if (active_phase_ == phase_ew_green && (phase == phase_ns_green || phase == phase_all_red)) {
        // Transition East-West Green -> East-West Amber
        in_transition_ = true;
        transition_start_ms_ = now_ms;
        transition_state_ = 0; // Amber stage
        transition_target_phase_ = phase;
        active_phase_ = "EW_AMBER";
        last_phase_change_ms_ = now_ms;

        for (const auto& signal : config_.signal_heads) {
            SignalColor color = SignalColor::Red;
            if (signal.group == group_east_west) {
                color = SignalColor::Amber;
            }
            if (!send_signal(signal, color, now_ms, error)) {
                return false;
            }
        }
        Logger::instance().log(LogLevel::Info, "safety transition started: East-West Green -> Amber");
        return true;
    }

    // Direct transition from ALL_RED to Green is safe
    if (phase == phase_ns_green) {
        return apply_group_phase(group_north_south, phase_ns_green, now_ms, error);
    }
    if (phase == phase_ew_green) {
        return apply_group_phase(group_east_west, phase_ew_green, now_ms, error);
    }
    if (phase == phase_all_red) {
        return apply_all_red(now_ms, error);
    }

    return false;
}

bool IntersectionController::tick(std::uint64_t now_ms, std::string* error) {
    if (in_transition_) {
        const auto elapsed_transition = now_ms >= transition_start_ms_ ? now_ms - transition_start_ms_ : 0;
        if (transition_state_ == 0) { // Amber stage
            if (elapsed_transition >= config_.amber_duration_ms) {
                if (transition_target_phase_ == phase_all_red) {
                    in_transition_ = false;
                    Logger::instance().log(LogLevel::Info, "safety transition finished to ALL_RED");
                    return apply_all_red(now_ms, error);
                } else {
                    // Transition to all-red clearing phase first
                    transition_state_ = 1; // All-Red stage
                    transition_start_ms_ = now_ms;
                    active_phase_ = phase_all_red;
                    last_phase_change_ms_ = now_ms;
                    for (const auto& signal : config_.signal_heads) {
                        if (!send_signal(signal, SignalColor::Red, now_ms, error)) {
                            return false;
                        }
                    }
                    Logger::instance().log(LogLevel::Info, "safety transition: Amber cleared; entering all-red clearing clearance");
                }
            }
        } else if (transition_state_ == 1) { // All-Red clearing stage
            if (elapsed_transition >= config_.all_red_duration_ms) {
                in_transition_ = false;
                Logger::instance().log(LogLevel::Info, "safety transition finished to " + transition_target_phase_);
                if (transition_target_phase_ == phase_ns_green) {
                    return apply_group_phase(group_north_south, phase_ns_green, now_ms, error);
                } else if (transition_target_phase_ == phase_ew_green) {
                    return apply_group_phase(group_east_west, phase_ew_green, now_ms, error);
                }
            }
        }
        return true;
    }

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

std::uint32_t IntersectionController::time_to_change_ms(std::uint64_t now_ms) const {
    const auto elapsed = now_ms >= last_phase_change_ms_ ? now_ms - last_phase_change_ms_ : 0;
    if (in_transition_) {
        if (transition_state_ == 0) {
            return elapsed < config_.amber_duration_ms ? static_cast<std::uint32_t>(config_.amber_duration_ms - elapsed) : 0;
        } else {
            return elapsed < config_.all_red_duration_ms ? static_cast<std::uint32_t>(config_.all_red_duration_ms - elapsed) : 0;
        }
    }
    if (active_phase_ == phase_all_red) {
        return elapsed < config_.all_red_duration_ms ? static_cast<std::uint32_t>(config_.all_red_duration_ms - elapsed) : 0;
    } else {
        return elapsed < config_.fixed_phase_duration_ms ? static_cast<std::uint32_t>(config_.fixed_phase_duration_ms - elapsed) : 0;
    }
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

const std::string& IntersectionController::health_status() const {
    return health_status_;
}

bool IntersectionController::check_conflicts(std::string* error) const {
    bool ns_active = false;
    bool ew_active = false;
    for (const auto& signal : config_.signal_heads) {
        auto it = active_colors_.find(signal.id);
        if (it != active_colors_.end()) {
            const SignalColor color = it->second;
            if (color == SignalColor::Green || color == SignalColor::Amber) {
                if (signal.group == "north_south") {
                    ns_active = true;
                } else if (signal.group == "east_west") {
                    ew_active = true;
                }
            }
        }
    }
    if (ns_active && ew_active) {
        if (error != nullptr) {
            *error = "conflict detected: north_south and east_west groups both active (Green/Amber) simultaneously!";
        }
        return false;
    }
    return true;
}

bool IntersectionController::send_signal(
    const SignalHead& signal,
    SignalColor color,
    std::uint64_t now_ms,
    std::string* error
) {
    if (failed_) {
        if (error != nullptr) {
            *error = "controller is in a Failed state: " + health_status_;
        }
        return false;
    }

    // 1. Bulb Sensing Simulation
    if (!config_.failed_bulb_id.empty() && signal.id == config_.failed_bulb_id && color != SignalColor::Off) {
        failed_ = true;
        health_status_ = "failed: bulb burnout on " + signal.id;
        Logger::instance().log(LogLevel::Warning, "BULB SENSING FAULT: detected burnout on bulb " + signal.id + "; triggering fail-safe shutdown (all dark)");
        if (error != nullptr) {
            *error = "hardware fault: bulb burnout detected on " + signal.id;
        }
        // Force all signals off
        for (const auto& sig : config_.signal_heads) {
            SignalCommand off_cmd;
            off_cmd.signal_id = sig.id;
            off_cmd.color = SignalColor::Off;
            off_cmd.issued_at_ms = now_ms;
            hardware_.apply(off_cmd, nullptr);
            active_colors_[sig.id] = SignalColor::Off;
        }
        return false;
    }

    // 2. Conflict Monitor Interlock Check
    SignalColor old_color = active_colors_[signal.id];
    active_colors_[signal.id] = color;
    
    std::string conflict_error;
    if (config_.conflict_monitor_enabled && !check_conflicts(&conflict_error)) {
        failed_ = true;
        health_status_ = "failed: conflict detected (" + conflict_error + ")";
        Logger::instance().log(LogLevel::Warning, "CONFLICT MONITOR INTERLOCK TRIPPED: " + conflict_error + "; entering safety shutdown (all red)");
        if (error != nullptr) {
            *error = "safety interlock: conflict monitor tripped - " + conflict_error;
        }
        // Reset active state to Red and force all signals to Red
        for (const auto& sig : config_.signal_heads) {
            SignalCommand red_cmd;
            red_cmd.signal_id = sig.id;
            red_cmd.color = SignalColor::Red;
            red_cmd.issued_at_ms = now_ms;
            hardware_.apply(red_cmd, nullptr);
            active_colors_[sig.id] = SignalColor::Red;
        }
        return false;
    }

    SignalCommand command;
    command.signal_id = signal.id;
    command.color = color;
    command.min_hold_ms = config_.all_red_duration_ms;
    command.issued_at_ms = now_ms;

    if (!hardware_.apply(command, error)) {
        active_colors_[signal.id] = old_color;
        return false;
    }
    return true;
}

} // namespace vroom
