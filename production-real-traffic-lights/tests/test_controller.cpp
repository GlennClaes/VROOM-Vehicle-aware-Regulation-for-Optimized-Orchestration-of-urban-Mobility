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
    value.min_green_duration_ms = 2000;
    value.amber_duration_ms = 1000;
    value.conflict_monitor_enabled = true;
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
    std::string error;

    // --- Test 1: Basic transitions & Min Green ---
    {
        vroom::MockHardwareAdapter hardware;
        vroom::IntersectionController controller(config(), hardware);

        assert(controller.start(0, &error));
        assert(controller.active_phase() == "ALL_RED");

        // Switch to NS_GREEN
        assert(controller.apply_phase("NS_GREEN", 100, &error));
        assert(controller.active_phase() == "NS_GREEN");

        // Normal change to EW_GREEN at t=500 should fail due to min_green_duration_ms (2000ms)
        assert(!controller.apply_phase("EW_GREEN", 500, &error));
        assert(controller.active_phase() == "NS_GREEN");

        // Force override (EV priority) at t=500 should succeed and bypass min green
        assert(controller.apply_phase("EW_GREEN", 500, &error, true));
        // It starts transitioning (NS_AMBER)
        assert(controller.active_phase() == "NS_AMBER");
    }

    // --- Test 2: Bulb Failure Sensing ---
    {
        vroom::MockHardwareAdapter hardware;
        vroom::ControllerConfig cfg = config();
        cfg.failed_bulb_id = "north"; // simulate failure on "north" signal head
        vroom::IntersectionController controller(cfg, hardware);

        assert(controller.start(0, &error));
        // Applying NS_GREEN turns "north" green, which should trigger bulb sensing failure immediately
        assert(!controller.apply_phase("NS_GREEN", 100, &error));
        assert(controller.health_status().rfind("failed: bulb burnout", 0) == 0);
        
        // Assert that hardware commands forced all signals to Off
        // Last 4 commands should be Off for north, south, east, west
        bool all_off = true;
        const auto& cmds = hardware.commands();
        assert(cmds.size() >= 4);
        for (size_t i = cmds.size() - 4; i < cmds.size(); ++i) {
            if (cmds[i].color != vroom::SignalColor::Off) {
                all_off = false;
            }
        }
        assert(all_off);
    }

    // --- Test 3: Conflict Monitor Interlock ---
    {
        // To test the conflict monitor, we can craft a config where a signal head is in both groups,
        // or configure signal heads such that applying a phase causes a conflict.
        // Wait, if we define one signal head with group "north_south" and another with group "east_west" but they share the same ID,
        // or if we have a signal head that belongs to both groups.
        // Let's create a custom config where a signal head is mapped to "north_south" and another with the same ID is mapped to "east_west".
        vroom::ControllerConfig cfg = config();
        cfg.signal_heads = {
            {"north", "north_south"},
            {"north", "east_west"} // conflicting configuration on same signal head
        };
        vroom::MockHardwareAdapter hardware;
        vroom::IntersectionController controller(cfg, hardware);

        assert(controller.start(0, &error));
        // When we apply NS_GREEN, it sets "north" to Green.
        // But "north" is also in the "east_west" group which is red.
        // Wait, apply_group_phase sets group "north_south" to Green and others to Red.
        // Let's see: if we have a custom test where we check conflict monitoring.
        // Let's instead have two different heads: "north" (north_south) and "east" (east_west).
        // If the conflict monitor detects NS and EW are both Green or Amber, it trips.
        // How can we make them both Green/Amber?
        // Let's configure the heads such that:
        // {"north", "north_south"}, {"east", "north_south"} (normally NS_GREEN makes both green).
        // What if we configure:
        // {"north", "north_south"}, {"east", "north_south"}
        // and we change their groups in a way that triggers a conflict.
        // Actually, if we configure:
        // {"north", "north_south"}, {"south", "east_west"} - wait, these are opposing groups.
        // If we configure one head as: {"north", "north_south"} and another as {"north", "east_west"}.
        // Wait! In IntersectionController::check_conflicts():
        // It checks if any head in "north_south" is Green/Amber, and any head in "east_west" is Green/Amber.
        // If we configure:
        // {"north", "north_south"} (which will be Green in NS_GREEN)
        // {"south", "east_west"} (which will be Green in EW_GREEN)
        // If they are both Green/Amber at the same time.
        // How can they be green at the same time in normal code? They can't, because apply_phase ensures only one group is Green.
        // But what if we define a signal head with group "north_south" and another signal head with group "east_west" and they are the same head or they both get activated?
        // Wait, what if we configure:
        // {"north", "north_south"},
        // {"south", "north_south"},
        // {"east", "east_west"},
        // {"west", "east_west"},
        // {"conflict_head", "north_south"},
        // {"conflict_head", "east_west"}
        // If "conflict_head" is in both groups, then when we apply NS_GREEN, it sets "conflict_head" to Green (NS group).
        // Since "conflict_head" is also in "east_west" group, does it check conflicts?
        // In check_conflicts():
        // It iterates over all signal heads.
        // If "conflict_head" (which has group "north_south") is Green, ns_active = true.
        // The other definition of "conflict_head" (which has group "east_west") will be set to Red.
        // But wait! active_colors_ maps signal ID ("conflict_head") to color.
        // So `active_colors_["conflict_head"]` is Green.
        // When check_conflicts() runs:
        // For the first signal head {"conflict_head", "north_south"}, color is Green, so ns_active = true.
        // For the second signal head {"conflict_head", "east_west"}, color is Green, so ew_active = true.
        // Since both ns_active and ew_active are true, a conflict is detected and the monitor trips!
        // This is a perfect, elegant way to test the conflict monitor interlock check!
    }

    {
        vroom::ControllerConfig cfg = config();
        cfg.signal_heads = {
            {"north", "north_south"},
            {"east", "east_west"},
            {"conflict_head", "north_south"},
            {"conflict_head", "east_west"}
        };
        vroom::MockHardwareAdapter hardware;
        vroom::IntersectionController controller(cfg, hardware);

        assert(controller.start(0, &error));
        // Applying NS_GREEN should trip conflict monitor because "conflict_head" is in both groups.
        assert(!controller.apply_phase("NS_GREEN", 100, &error));
        assert(controller.health_status().rfind("failed: conflict detected", 0) == 0);
        
        // Assert that hardware commands forced all signals to Red
        const auto& cmds = hardware.commands();
        assert(cmds.size() >= 4);
        bool all_red = true;
        for (size_t i = cmds.size() - 4; i < cmds.size(); ++i) {
            if (cmds[i].color != vroom::SignalColor::Red) {
                all_red = false;
            }
        }
        assert(all_red);
    }

    std::cout << "all intersection controller tests passed including safety checks\n";
    return 0;
}
