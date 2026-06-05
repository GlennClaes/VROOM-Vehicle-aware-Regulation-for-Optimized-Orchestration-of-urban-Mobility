#pragma once

#include <cstdint>
#include <optional>
#include <string>

namespace vroom {

enum class MessageType {
    Heartbeat,
    State,
    Intent,
    Command,
    Ack
};

struct TrafficMessage {
    MessageType type = MessageType::Heartbeat;
    std::string intersection_id;
    std::uint64_t sequence = 0;
    std::uint64_t timestamp_ms = 0;
    std::string phase = "ALL_RED";
    std::string health = "ok";
    std::uint32_t ttl_ms = 1000;
};

std::string to_string(MessageType type);
std::optional<MessageType> message_type_from_string(const std::string& value);

std::string encode_message(const TrafficMessage& message);
std::optional<TrafficMessage> decode_message(const std::string& line, std::string* error);

} // namespace vroom
