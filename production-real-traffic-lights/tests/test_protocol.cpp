#include "vroom/message_protocol.hpp"

#include <cassert>
#include <iostream>

int main() {
    vroom::TrafficMessage message;
    message.type = vroom::MessageType::State;
    message.intersection_id = "junction-a";
    message.sequence = 42;
    message.timestamp_ms = 123456;
    message.phase = "NS_GREEN";
    message.health = "ok";
    message.ttl_ms = 1500;

    const auto encoded = vroom::encode_message(message);
    std::string error;
    const auto decoded = vroom::decode_message(encoded, &error);

    assert(decoded.has_value());
    assert(decoded->type == vroom::MessageType::State);
    assert(decoded->intersection_id == "junction-a");
    assert(decoded->sequence == 42);
    assert(decoded->timestamp_ms == 123456);
    assert(decoded->phase == "NS_GREEN");
    assert(decoded->health == "ok");
    assert(decoded->ttl_ms == 1500);

    const auto invalid = vroom::decode_message("BROKEN|1|STATE", &error);
    assert(!invalid.has_value());
    assert(!error.empty());

    std::cout << "message protocol tests passed\n";
    return 0;
}
