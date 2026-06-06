#include "vroom/message_protocol.hpp"

#include <cstdlib>
#include <iostream>

namespace {

void require(bool condition, const char* expression) {
    if (!condition) {
        std::cerr << "test failed: " << expression << '\n';
        std::exit(1);
    }
}

} // namespace

#define REQUIRE(expression) require((expression), #expression)

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

    REQUIRE(decoded.has_value());
    REQUIRE(decoded->type == vroom::MessageType::State);
    REQUIRE(decoded->intersection_id == "junction-a");
    REQUIRE(decoded->sequence == 42);
    REQUIRE(decoded->timestamp_ms == 123456);
    REQUIRE(decoded->phase == "NS_GREEN");
    REQUIRE(decoded->health == "ok");
    REQUIRE(decoded->ttl_ms == 1500);

    const auto invalid = vroom::decode_message("BROKEN|1|STATE", &error);
    REQUIRE(!invalid.has_value());
    REQUIRE(!error.empty());

    std::cout << "message protocol tests passed\n";
    return 0;
}
