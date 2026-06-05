#include "vroom/types.hpp"

#include <algorithm>
#include <cctype>

namespace vroom {

std::string to_string(SignalColor color) {
    switch (color) {
    case SignalColor::Red:
        return "red";
    case SignalColor::Amber:
        return "amber";
    case SignalColor::Green:
        return "green";
    case SignalColor::Off:
        return "off";
    }
    return "unknown";
}

std::string to_string(HealthState state) {
    switch (state) {
    case HealthState::Ok:
        return "ok";
    case HealthState::Degraded:
        return "degraded";
    case HealthState::Failed:
        return "failed";
    }
    return "unknown";
}

std::string to_string(CommunicationState state) {
    switch (state) {
    case CommunicationState::Healthy:
        return "healthy";
    case CommunicationState::Degraded:
        return "degraded";
    case CommunicationState::Lost:
        return "lost";
    }
    return "unknown";
}

bool signal_color_from_string(const std::string& value, SignalColor* color) {
    std::string normalized = value;
    std::transform(normalized.begin(), normalized.end(), normalized.begin(), [](unsigned char ch) {
        return static_cast<char>(std::tolower(ch));
    });

    if (normalized == "red") {
        *color = SignalColor::Red;
        return true;
    }
    if (normalized == "amber" || normalized == "yellow") {
        *color = SignalColor::Amber;
        return true;
    }
    if (normalized == "green") {
        *color = SignalColor::Green;
        return true;
    }
    if (normalized == "off") {
        *color = SignalColor::Off;
        return true;
    }
    return false;
}

} // namespace vroom
