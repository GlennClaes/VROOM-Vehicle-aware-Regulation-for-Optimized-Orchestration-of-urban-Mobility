#include "vroom/intersection_controller.hpp"
#include "vroom/mock_hardware_adapter.hpp"

#include <cassert>
#include <iostream>

namespace {

vroom::ControllerConfig config() {
    vroom::ControllerConfig value;
    value.intersection_id = "test-junction";
    value.communication_timeout_ms = 1000;
    value.all_red_duration_ms = 500;
    value.fixed_phase_duration_ms = 1000;
    value.signal_heads = {
        {"north", "north_south"},
        {"south", "north_south"},
        {"east", "east_west"},
        {"west", "east_west"},
    };
    return value;
}

} // namespace

int main() {
    vroom::MockHardwareAdapter hardware;
    vroom::IntersectionController controller(config(), hardware);

    std::string error;
    assert(controller.start(0, &error));
    assert(controller.active_phase() == "ALL_RED");
    assert(hardware.commands().size() == 4);

    assert(controller.apply_phase("NS_GREEN", 100, &error));
    assert(controller.active_phase() == "NS_GREEN");
    assert(hardware.commands().size() == 8);

    assert(controller.communication_state(2000) == vroom::CommunicationState::Lost);
    assert(controller.tick(2000, &error));
    assert(controller.active_phase() == "ALL_RED");

    assert(controller.tick(3600, &error));
    assert(controller.active_phase() == "NS_GREEN");

    vroom::TrafficMessage neighbor;
    neighbor.intersection_id = "neighbor-b";
    neighbor.timestamp_ms = 3700;
    controller.on_neighbor_message(neighbor);
    assert(controller.communication_state(3700) == vroom::CommunicationState::Healthy);

    std::cout << "intersection controller tests passed\n";
    return 0;
}
