import sys
import os
from unittest.mock import MagicMock, patch

# Ensure python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

@patch('traci.start')
@patch('traci.simulationStep')
@patch('traci.close')
@patch('traci.vehicle.getIDList')
@patch('traci.vehicle.getWaitingTime')
@patch('traci.lane.getIDList')
@patch('traci.lane.getLastStepHaltingNumber')
@patch('traci.trafficlight.getIDList')
@patch('traci.trafficlight.getPhase')
@patch('traci.trafficlight.getCompleteRedYellowGreenDefinition')
@patch('traci.trafficlight.setPhase')
def test_baseline_simulation(
    mock_set_phase, mock_get_definition, mock_get_phase, mock_tls_ids,
    mock_halting, mock_lanes, mock_waiting, mock_vehs,
    mock_close, mock_step, mock_start
):
    from baseline.fixed_time import run_simulation
    
    mock_vehs.return_value = ["veh_1"]
    mock_waiting.return_value = 10.0
    mock_lanes.return_value = ["lane_1"]
    mock_halting.return_value = 2
    mock_tls_ids.return_value = ["tls_1"]
    mock_get_phase.return_value = 0
    
    # Mock phases for setPhase logic
    mock_logic = MagicMock()
    mock_phase = MagicMock()
    # Need to match the structure of traci.trafficlight.getCompleteRedYellowGreenDefinition(tls)[0].phases
    # phases is a list of Phase objects
    class MockPhase:
        def __init__(self):
            self.state = "GrGr"
    mock_logic.phases = [MockPhase(), MockPhase()]
    mock_get_definition.return_value = [mock_logic]
    
    run_simulation()
    
    assert mock_start.called
    assert mock_step.call_count == 100
    assert mock_close.called
