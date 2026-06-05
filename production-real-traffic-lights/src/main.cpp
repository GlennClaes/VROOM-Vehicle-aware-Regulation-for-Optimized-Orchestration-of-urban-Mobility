#include "vroom/intersection_controller.hpp"
#include "vroom/gpio_hardware_adapter.hpp"
#include "vroom/message_protocol.hpp"
#include "vroom/mock_hardware_adapter.hpp"
#include "vroom/plc_hardware_adapter.hpp"

#include <algorithm>
#include <chrono>
#include <cctype>
#include <cstdlib>
#include <exception>
#include <iostream>
#include <memory>
#include <string>
#include <thread>

namespace {

std::uint64_t now_ms() {
    const auto now = std::chrono::system_clock::now().time_since_epoch();
    return static_cast<std::uint64_t>(
        std::chrono::duration_cast<std::chrono::milliseconds>(now).count()
    );
}

std::string env_string(const char* name, const std::string& fallback) {
    const char* value = std::getenv(name);
    if (value == nullptr || std::string(value).empty()) {
        return fallback;
    }
    return value;
}

std::uint32_t env_u32(const char* name, std::uint32_t fallback) {
    const char* value = std::getenv(name);
    if (value == nullptr) {
        return fallback;
    }
    try {
        return static_cast<std::uint32_t>(std::stoul(value));
    } catch (const std::exception&) {
        return fallback;
    }
}

bool env_bool(const char* name, bool fallback) {
    std::string value = env_string(name, fallback ? "true" : "false");
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char ch) {
        return static_cast<char>(std::tolower(ch));
    });
    return value == "1" || value == "true" || value == "yes";
}

vroom::ControllerConfig default_config() {
    vroom::ControllerConfig config;
    config.intersection_id = env_string("VROOM_INTERSECTION_ID", "hasselt-xl-a");
    config.communication_timeout_ms = env_u32("VROOM_COMMUNICATION_TIMEOUT_MS", 1500);
    config.all_red_duration_ms = env_u32("VROOM_ALL_RED_DURATION_MS", 1200);
    config.fixed_phase_duration_ms = env_u32("VROOM_FIXED_PHASE_DURATION_MS", 5000);
    config.signal_heads = {
        {"northbound", "north_south"},
        {"southbound", "north_south"},
        {"eastbound", "east_west"},
        {"westbound", "east_west"},
    };
    return config;
}

std::unique_ptr<vroom::HardwareAdapter> create_hardware_adapter() {
    std::string adapter = env_string("VROOM_HARDWARE_ADAPTER", "mock");
    std::transform(adapter.begin(), adapter.end(), adapter.begin(), [](unsigned char ch) {
        return static_cast<char>(std::tolower(ch));
    });

    if (adapter == "gpio") {
        auto gpio = std::make_unique<vroom::GpioHardwareAdapter>(env_bool("VROOM_GPIO_DRY_RUN", true));
        gpio->map_pin("northbound", vroom::SignalColor::Red, {17, true});
        gpio->map_pin("northbound", vroom::SignalColor::Amber, {27, true});
        gpio->map_pin("northbound", vroom::SignalColor::Green, {22, true});
        gpio->map_pin("southbound", vroom::SignalColor::Red, {5, true});
        gpio->map_pin("southbound", vroom::SignalColor::Amber, {6, true});
        gpio->map_pin("southbound", vroom::SignalColor::Green, {13, true});
        gpio->map_pin("eastbound", vroom::SignalColor::Red, {19, true});
        gpio->map_pin("eastbound", vroom::SignalColor::Amber, {26, true});
        gpio->map_pin("eastbound", vroom::SignalColor::Green, {21, true});
        gpio->map_pin("westbound", vroom::SignalColor::Red, {20, true});
        gpio->map_pin("westbound", vroom::SignalColor::Amber, {16, true});
        gpio->map_pin("westbound", vroom::SignalColor::Green, {12, true});
        return gpio;
    }

    if (adapter == "plc") {
        auto plc = std::make_unique<vroom::PlcHardwareAdapter>(
            env_string("VROOM_PLC_ENDPOINT", "tcp://127.0.0.1:502"),
            env_bool("VROOM_PLC_DRY_RUN", true)
        );
        plc->map_register("northbound", {1000, 0, 1, 2, 3});
        plc->map_register("southbound", {1001, 0, 1, 2, 3});
        plc->map_register("eastbound", {1002, 0, 1, 2, 3});
        plc->map_register("westbound", {1003, 0, 1, 2, 3});
        return plc;
    }

    return std::make_unique<vroom::MockHardwareAdapter>();
}

} // namespace

int main(int argc, char** argv) {
    const bool once = argc > 1 && std::string(argv[1]) == "--once";

    auto hardware = create_hardware_adapter();
    const auto config = default_config();
    vroom::IntersectionController controller(config, *hardware);

    std::string error;
    if (!controller.start(now_ms(), &error)) {
        std::cerr << "failed to start controller: " << error << '\n';
        return 1;
    }

    std::uint64_t sequence = 0;
    do {
        const auto tick_time = now_ms();
        if (!controller.tick(tick_time, &error)) {
            std::cerr << "controller tick failed: " << error << '\n';
            return 2;
        }

        vroom::TrafficMessage heartbeat;
        heartbeat.type = vroom::MessageType::Heartbeat;
        heartbeat.intersection_id = config.intersection_id;
        heartbeat.sequence = ++sequence;
        heartbeat.timestamp_ms = tick_time;
        heartbeat.phase = controller.active_phase();
        heartbeat.health = "ok";
        heartbeat.ttl_ms = 1000;

        std::cout << vroom::encode_message(heartbeat) << '\n';

        if (once) {
            break;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(500));
    } while (true);

    return 0;
}
