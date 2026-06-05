#include "vroom/intersection_controller.hpp"
#include "vroom/gpio_hardware_adapter.hpp"
#include "vroom/message_protocol.hpp"
#include "vroom/mock_hardware_adapter.hpp"
#include "vroom/plc_hardware_adapter.hpp"
#include "vroom/logger.hpp"

#include <algorithm>
#include <chrono>
#include <cctype>
#include <cstdlib>
#include <exception>
#include <iostream>
#include <memory>
#include <string>
#include <thread>
#include <mutex>
#include <queue>

#ifndef _WIN32
#include <fcntl.h>
#include <unistd.h>
#include <string.h>
#include <errno.h>
#endif

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
    config.min_green_duration_ms = env_u32("VROOM_MIN_GREEN_DURATION_MS", 6000);
    config.amber_duration_ms = env_u32("VROOM_AMBER_DURATION_MS", 3000);
    config.watchdog_path = env_string("VROOM_WATCHDOG_PATH", "");
    config.ca_cert_path = env_string("VROOM_NATS_CA_CERT_PATH", "");
    config.client_cert_path = env_string("VROOM_NATS_CLIENT_CERT_PATH", "");
    config.client_key_path = env_string("VROOM_NATS_CLIENT_KEY_PATH", "");
    config.conflict_monitor_enabled = env_bool("VROOM_CONFLICT_MONITOR_ENABLED", true);
    config.failed_bulb_id = env_string("VROOM_FAILED_BULB_ID", "");
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

// Thread-safe stdin queue system
std::mutex input_mutex;
std::queue<std::string> input_queue;
bool keep_reading = true;

void read_stdin_thread() {
    std::string line;
    while (keep_reading && std::getline(std::cin, line)) {
        std::lock_guard<std::mutex> lock(input_mutex);
        input_queue.push(line);
    }
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

    // Initialize physical watchdog if path is set
    int watchdog_fd = -1;
    if (!config.watchdog_path.empty()) {
#ifndef _WIN32
        watchdog_fd = open(config.watchdog_path.c_str(), O_WRONLY);
        if (watchdog_fd < 0) {
            std::cerr << "Warning: failed to open hardware watchdog at " << config.watchdog_path << ": " << strerror(errno) << '\n';
        } else {
            std::cout << "Successfully opened physical hardware watchdog at " << config.watchdog_path << '\n';
        }
#else
        std::cout << "Watchdog path configured: " << config.watchdog_path << " (Simulated on Windows)\n";
#endif
    }

    // Start stdin reader thread
    std::thread stdin_thread(read_stdin_thread);

    std::uint64_t sequence = 0;
    do {
        const auto tick_time = now_ms();

        // Process any messages from stdin
        std::queue<std::string> local_queue;
        {
            std::lock_guard<std::mutex> lock(input_mutex);
            std::swap(local_queue, input_queue);
        }

        while (!local_queue.empty()) {
            std::string line = local_queue.front();
            local_queue.pop();

            std::string decode_error;
            auto decoded = vroom::decode_message(line, &decode_error);
            if (decoded.has_value()) {
                if ((decoded->type == vroom::MessageType::Command || decoded->type == vroom::MessageType::Priority) && 
                    decoded->intersection_id == config.intersection_id) {
                    
                    const bool is_priority = (decoded->type == vroom::MessageType::Priority);
                    if (is_priority) {
                        vroom::Logger::instance().log(vroom::LogLevel::Warning, "EV/Transit preemption priority request received for phase " + decoded->phase);
                    }

                    std::string apply_error;
                    if (!controller.apply_phase(decoded->phase, tick_time, &apply_error, is_priority)) {
                        std::cerr << "Failed to apply phase " << decoded->phase << ": " << apply_error << '\n';
                    } else {
                        // Publish ACK on stdout
                        vroom::TrafficMessage ack;
                        ack.type = vroom::MessageType::Ack;
                        ack.intersection_id = config.intersection_id;
                        ack.sequence = decoded->sequence;
                        ack.timestamp_ms = tick_time;
                        ack.phase = controller.active_phase();
                        ack.health = controller.health_status();
                        ack.ttl_ms = 1000;
                        std::cout << vroom::encode_message(ack) << '\n';
                    }
                } else if (decoded->intersection_id != config.intersection_id) {
                    // Reset communication timeout on neighbor message
                    controller.on_neighbor_message(*decoded);
                }
            }
        }

        if (!controller.tick(tick_time, &error)) {
            std::cerr << "controller tick failed: " << error << '\n';
            keep_reading = false;
            if (stdin_thread.joinable()) {
                stdin_thread.detach(); // Stdin read is blocking, detach to allow exit
            }
            if (watchdog_fd >= 0) {
#ifndef _WIN32
                close(watchdog_fd);
#endif
            }
            return 2;
        }

        // Ping physical hardware watchdog if active
        if (watchdog_fd >= 0) {
#ifndef _WIN32
            if (write(watchdog_fd, "\0", 1) < 0) {
                std::cerr << "Warning: failed to ping hardware watchdog: " << strerror(errno) << '\n';
            }
#endif
        }

        vroom::TrafficMessage heartbeat;
        heartbeat.type = vroom::MessageType::Heartbeat;
        heartbeat.intersection_id = config.intersection_id;
        heartbeat.sequence = ++sequence;
        heartbeat.timestamp_ms = tick_time;
        heartbeat.phase = controller.active_phase();
        heartbeat.health = controller.health_status();
        heartbeat.ttl_ms = 1000;
        
        // Enrich with GLOSA dynamic advisory time remaining
        heartbeat.glosa_time_to_change_ms = controller.time_to_change_ms(tick_time);

        std::cout << vroom::encode_message(heartbeat) << '\n';

        if (once) {
            break;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(500));
    } while (true);

    keep_reading = false;
    if (stdin_thread.joinable()) {
        stdin_thread.detach();
    }
    if (watchdog_fd >= 0) {
#ifndef _WIN32
        // Write magic character 'V' to gracefully stop watchdog on clean shutdown if supported
        if (write(watchdog_fd, "V", 1) < 0) {
            std::cerr << "Warning: failed to write clean shutdown character to watchdog\n";
        }
        close(watchdog_fd);
#endif
    }
    return 0;
}
