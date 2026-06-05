#include "vroom/plc_hardware_adapter.hpp"

#include "vroom/logger.hpp"

#include <sstream>
#include <utility>

#ifndef _WIN32
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <cstring>
#include <sys/time.h>
#endif

namespace vroom {

PlcHardwareAdapter::PlcHardwareAdapter(std::string endpoint, bool dry_run)
    : endpoint_(std::move(endpoint)),
      dry_run_(dry_run),
      health_{HealthState::Degraded, "not initialized"} {}

void PlcHardwareAdapter::map_register(const std::string& signal_id, PlcRegister reg) {
    register_map_[signal_id] = reg;
}

bool PlcHardwareAdapter::initialize(std::string* error) {
    if (endpoint_.empty()) {
        if (error != nullptr) {
            *error = "PLC endpoint is empty";
        }
        health_ = {HealthState::Failed, "PLC endpoint is empty"};
        return false;
    }
    if (register_map_.empty()) {
        if (error != nullptr) {
            *error = "no PLC registers configured";
        }
        health_ = {HealthState::Failed, "no PLC registers configured"};
        return false;
    }

    initialized_ = true;
    health_ = {HealthState::Ok, dry_run_ ? "PLC dry-run initialized" : "PLC endpoint prepared"};
    Logger::instance().log(LogLevel::Info, health_.detail + " at " + endpoint_);
    return true;
}

bool PlcHardwareAdapter::apply(const SignalCommand& command, std::string* error) {
    if (!initialized_) {
        if (error != nullptr) {
            *error = "PLC adapter was not initialized";
        }
        return false;
    }

    const auto reg = register_map_.find(command.signal_id);
    if (reg == register_map_.end()) {
        if (error != nullptr) {
            *error = "no PLC register mapped for signal " + command.signal_id;
        }
        return false;
    }

    const std::uint16_t value = value_for(reg->second, command.color);
    std::ostringstream stream;
    stream << "PLC command " << endpoint_ << " register " << reg->second.address
           << " = " << value << " for " << command.signal_id;

    if (dry_run_) {
        Logger::instance().log(LogLevel::Info, "PLC dry-run: " + stream.str());
        return true;
    }

#ifdef _WIN32
    if (error != nullptr) {
        *error = "Real Modbus TCP write backend is not supported on Windows builds";
    }
    health_ = {HealthState::Failed, "Windows Modbus backend missing"};
    return false;
#else
    // Standard Modbus TCP (port 502) write operation
    std::string ip = "127.0.0.1";
    int port = 502;

    std::string clean_ep = endpoint_;
    if (clean_ep.rfind("tcp://", 0) == 0) {
        clean_ep = clean_ep.substr(6);
    }
    size_t colon = clean_ep.find(':');
    if (colon != std::string::npos) {
        ip = clean_ep.substr(0, colon);
        try {
            port = std::stoi(clean_ep.substr(colon + 1));
        } catch (...) {
            port = 502;
        }
    } else {
        ip = clean_ep;
    }

    int sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) {
        if (error != nullptr) {
            *error = "Failed to create socket for PLC communication";
        }
        health_ = {HealthState::Failed, "Socket creation failed"};
        return false;
    }

    // Set 1-second connect/receive timeouts
    struct timeval tv;
    tv.tv_sec = 1;
    tv.tv_usec = 0;
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, (const char*)&tv, sizeof(tv));
    setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, (const char*)&tv, sizeof(tv));

    struct sockaddr_in serv_addr;
    std::memset(&serv_addr, 0, sizeof(serv_addr));
    serv_addr.sin_family = AF_INET;
    serv_addr.sin_port = htons(port);

    if (inet_pton(AF_INET, ip.c_str(), &serv_addr.sin_addr) <= 0) {
        if (error != nullptr) {
            *error = "Invalid PLC IP address format: " + ip;
        }
        close(sock);
        return false;
    }

    if (connect(sock, (struct sockaddr*)&serv_addr, sizeof(serv_addr)) < 0) {
        if (error != nullptr) {
            *error = "Failed to connect to PLC at " + ip + ":" + std::to_string(port);
        }
        close(sock);
        return false;
    }

    // Build Modbus TCP Single Register Write Request (Function Code 0x06)
    std::uint8_t request[12];
    request[0] = 0x00; request[1] = 0x01; // Transaction ID
    request[2] = 0x00; request[3] = 0x00; // Protocol ID (Modbus TCP = 0)
    request[4] = 0x00; request[5] = 0x06; // Length
    request[6] = 0x01;                     // Unit ID
    request[7] = 0x06;                     // Function Code (6 = Write Single Register)
    request[8] = static_cast<std::uint8_t>((reg->second.address >> 8) & 0xFF);
    request[9] = static_cast<std::uint8_t>(reg->second.address & 0xFF);
    request[10] = static_cast<std::uint8_t>((value >> 8) & 0xFF);
    request[11] = static_cast<std::uint8_t>(value & 0xFF);

    if (send(sock, request, sizeof(request), 0) < 0) {
        if (error != nullptr) {
            *error = "Failed to send command packet to PLC";
        }
        close(sock);
        return false;
    }

    std::uint8_t response[12];
    int bytes_received = recv(sock, response, sizeof(response), 0);
    close(sock);

    if (bytes_received < 12) {
        if (error != nullptr) {
            *error = "PLC did not respond to command (connection closed or timeout)";
        }
        health_ = {HealthState::Failed, "PLC timeout"};
        return false;
    }

    // Verify correct FC and echo in Modbus TCP response
    if (response[7] != 0x06 || 
        response[8] != request[8] || response[9] != request[9] ||
        response[10] != request[10] || response[11] != request[11]) {
        if (error != nullptr) {
            *error = "PLC returned an error response or exception code";
        }
        health_ = {HealthState::Failed, "PLC exception response"};
        return false;
    }

    health_ = {HealthState::Ok, "PLC write succeeded"};
    return true;
#endif
}

HealthReport PlcHardwareAdapter::health() const {
    return health_;
}

void PlcHardwareAdapter::shutdown_safe() {
    initialized_ = false;
    health_ = {HealthState::Degraded, "PLC adapter disconnected during safe shutdown"};
    Logger::instance().log(LogLevel::Warning, "PLC adapter safe shutdown requested");
}

std::uint16_t PlcHardwareAdapter::value_for(const PlcRegister& reg, SignalColor color) const {
    switch (color) {
    case SignalColor::Red:
        return reg.red_value;
    case SignalColor::Amber:
        return reg.amber_value;
    case SignalColor::Green:
        return reg.green_value;
    case SignalColor::Off:
        return reg.off_value;
    }
    return reg.off_value;
}

} // namespace vroom
