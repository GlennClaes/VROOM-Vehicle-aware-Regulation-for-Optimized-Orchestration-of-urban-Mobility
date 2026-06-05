#include "vroom/message_protocol.hpp"

#include <sstream>
#include <stdexcept>
#include <limits>
#include <vector>

namespace vroom {

namespace {

constexpr const char* protocol_name = "VROOM";
constexpr const char* protocol_version = "1";

std::vector<std::string> split(const std::string& value, char delimiter) {
    std::vector<std::string> parts;
    std::string item;
    std::istringstream stream(value);
    while (std::getline(stream, item, delimiter)) {
        parts.push_back(item);
    }
    return parts;
}

std::optional<std::uint64_t> parse_u64(const std::string& value) {
    try {
        std::size_t consumed = 0;
        const auto parsed = std::stoull(value, &consumed);
        if (consumed != value.size()) {
            return std::nullopt;
        }
        return parsed;
    } catch (const std::exception&) {
        return std::nullopt;
    }
}

std::optional<std::uint32_t> parse_u32(const std::string& value) {
    const auto parsed = parse_u64(value);
    if (!parsed.has_value() || *parsed > std::numeric_limits<std::uint32_t>::max()) {
        return std::nullopt;
    }
    return static_cast<std::uint32_t>(*parsed);
}

} // namespace

std::string to_string(MessageType type) {
    switch (type) {
    case MessageType::Heartbeat:
        return "HEARTBEAT";
    case MessageType::State:
        return "STATE";
    case MessageType::Intent:
        return "INTENT";
    case MessageType::Command:
        return "COMMAND";
    case MessageType::Ack:
        return "ACK";
    case MessageType::Priority:
        return "PRIORITY";
    }
    return "UNKNOWN";
}

std::optional<MessageType> message_type_from_string(const std::string& value) {
    if (value == "HEARTBEAT") {
        return MessageType::Heartbeat;
    }
    if (value == "STATE") {
        return MessageType::State;
    }
    if (value == "INTENT") {
        return MessageType::Intent;
    }
    if (value == "COMMAND") {
        return MessageType::Command;
    }
    if (value == "ACK") {
        return MessageType::Ack;
    }
    if (value == "PRIORITY") {
        return MessageType::Priority;
    }
    return std::nullopt;
}

std::string encode_message(const TrafficMessage& message) {
    std::ostringstream stream;
    stream << protocol_name << '|'
           << protocol_version << '|'
           << to_string(message.type) << '|'
           << message.intersection_id << '|'
           << message.sequence << '|'
           << message.timestamp_ms << '|'
           << message.phase << '|'
           << message.health << '|'
           << message.ttl_ms;
    if (message.glosa_time_to_change_ms.has_value()) {
        stream << '|' << *message.glosa_time_to_change_ms;
    }
    return stream.str();
}

std::optional<TrafficMessage> decode_message(const std::string& line, std::string* error) {
    const auto parts = split(line, '|');
    if (parts.size() != 9 && parts.size() != 10) {
        if (error != nullptr) {
            *error = "expected 9 or 10 protocol fields";
        }
        return std::nullopt;
    }
    if (parts[0] != protocol_name) {
        if (error != nullptr) {
            *error = "invalid protocol name";
        }
        return std::nullopt;
    }
    if (parts[1] != protocol_version) {
        if (error != nullptr) {
            *error = "unsupported protocol version";
        }
        return std::nullopt;
    }

    const auto type = message_type_from_string(parts[2]);
    if (!type.has_value()) {
        if (error != nullptr) {
            *error = "unknown message type";
        }
        return std::nullopt;
    }
    if (parts[3].empty()) {
        if (error != nullptr) {
            *error = "intersection id is required";
        }
        return std::nullopt;
    }

    const auto sequence = parse_u64(parts[4]);
    const auto timestamp_ms = parse_u64(parts[5]);
    const auto ttl_ms = parse_u32(parts[8]);
    if (!sequence.has_value() || !timestamp_ms.has_value() || !ttl_ms.has_value()) {
        if (error != nullptr) {
            *error = "sequence, timestamp, and ttl must be unsigned integers";
        }
        return std::nullopt;
    }

    TrafficMessage message;
    message.type = *type;
    message.intersection_id = parts[3];
    message.sequence = *sequence;
    message.timestamp_ms = *timestamp_ms;
    message.phase = parts[6];
    message.health = parts[7];
    message.ttl_ms = *ttl_ms;

    if (parts.size() == 10) {
        const auto glosa = parse_u32(parts[9]);
        if (glosa.has_value()) {
            message.glosa_time_to_change_ms = *glosa;
        }
    }
    return message;
}

} // namespace vroom
