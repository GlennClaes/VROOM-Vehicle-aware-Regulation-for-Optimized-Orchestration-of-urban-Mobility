import pytest
import os
import sys
import numpy as np

# Adjust python path for local imports during tests
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from rl.core.vroom_architecture import (
    TrafficNetwork,
    Intersection,
    TrafficLight,
    TrafficPredictionEngine,
    CommunicationManager,
    MetricsCollector,
    City
)

def test_prediction_engine():
    """Verify that TrafficPredictionEngine works (either C++ or Python fallback)."""
    engine = TrafficPredictionEngine()
    
    # Record some flow data
    engine.record_flow("lane_1", 10.0)
    engine.record_flow("lane_1", 20.0)
    
    # Test flow prediction
    predicted = engine.predict_flow("lane_1", 0.5)
    assert isinstance(predicted, float)
    assert 10.0 <= predicted <= 20.0
    
    # Test green wave offset calculation
    offset = engine.compute_green_wave_offset(100.0, 10.0)
    assert offset == 10.0
    
    # Test spillback probability calculation
    p_low = engine.calculate_queue_spillback_probability(5.0, 20.0)
    p_high = engine.calculate_queue_spillback_probability(19.0, 20.0)
    
    assert 0.0 <= p_low <= 1.0
    assert 0.0 <= p_high <= 1.0
    assert p_high > p_low
    
    engine.clear()

def test_communication_manager():
    """Verify communication manager P2P messaging and central registry."""
    cm = CommunicationManager()
    
    # P2P messages
    cm.post_message("tls_1", "tls_2", "priority_alert", {"vehicle_id": "bus_101"})
    msgs = cm.get_messages("tls_2")
    assert len(msgs) == 1
    assert msgs[0].sender_id == "tls_1"
    assert msgs[0].message_type == "priority_alert"
    assert msgs[0].data["vehicle_id"] == "bus_101"
    
    # Verify messages are cleared after retrieval
    assert len(cm.get_messages("tls_2")) == 0
    
    # Central registry broadcast
    cm.broadcast_status("tls_1", {
        "timestamp": 12,
        "queues": {"lane_1": 2.0},
        "current_phase": 3,
        "priority_vehicle": True
    })
    
    status = cm.query_central_registry("tls_1")
    assert status is not None
    assert status["current_phase"] == 3
    assert status["priority_vehicle"] is True

def test_domain_model():
    """Verify City, TrafficNetwork, Intersection, and TrafficLight relations."""
    city = City("TestCity")
    net = city.network
    
    # Create traffic light
    tl1 = TrafficLight("tls_1", [0, 2, 4], {0: ["lane_1"], 2: ["lane_2"], 4: ["lane_3"]})
    tl2 = TrafficLight("tls_2", [0, 2], {0: ["lane_a"], 2: ["lane_b"]})
    
    # Intersections
    # tls_1 has lane_a as outgoing which maps to tls_2's incoming lane_a
    node1 = Intersection("tls_1", tl1, ["lane_1"], ["lane_a"])
    node2 = Intersection("tls_2", tl2, ["lane_a"], ["lane_b"])
    
    net.add_intersection(node1)
    net.add_intersection(node2)
    
    # Build neighborhood connections
    net.build_neighborhood_graph()
    
    assert "tls_2" in node1.neighbor_ids
    assert "tls_1" not in node2.neighbor_ids

def test_metrics_collector():
    """Verify MetricsCollector aggregates metrics correctly."""
    mc = MetricsCollector()
    net = TrafficNetwork()
    
    # Add simple mock intersection to query
    tl = TrafficLight("tls_1", [0], {0: ["lane_1"]})
    node = Intersection("tls_1", tl, ["lane_1"], ["lane_2"])
    net.add_intersection(node)
    
    # Setup test traci connections and mock data
    class MockTraci:
        class simulation:
            @staticmethod
            def getTime(): return 100.0
        class lane:
            @staticmethod
            def getLength(lane_id): return 100.0
    
    traci_conn = MockTraci()
    
    active_vehicles = {
        "car_1": {"waiting_time": 10.0, "time_loss": 12.0, "speed": 12.0, "departure": 10.0},
        "car_2": {"waiting_time": 0.0, "time_loss": 5.0, "speed": 1.0, "departure": 20.0}
    }
    
    lane_subs = {
        "lane_1": {0x10: 2, 0x14: 1, 0x7a: 10.0},
        "lane_2": {0x10: 0, 0x14: 0, 0x7a: 0.0}
    }
    
    mc.update_metrics(traci_conn, active_vehicles, [], lane_subs, net)
    
    snapshot = mc.get_snapshot()
    assert snapshot["intersection_delay"] == 17.0
    assert snapshot["tawt"] == 10.0
    assert snapshot["ewpc"] == 5.0
    assert snapshot["aql"] == 1.0

def test_vehicle_filtering():
    """Verify that filter_vehicle_movement and remove_vehicle_from_cache work correctly."""
    engine = TrafficPredictionEngine()
    
    # First time a vehicle is added, it should return True (new/moved)
    assert engine.filter_vehicle_movement("veh_1", 10.0, 20.0, 45.0) is True
    
    # If the vehicle didn't move significantly, it should return False
    assert engine.filter_vehicle_movement("veh_1", 10.02, 20.02, 45.3) is False
    
    # If the vehicle moved significantly, it should return True
    assert engine.filter_vehicle_movement("veh_1", 10.5, 20.5, 47.0) is True
    
    # If the vehicle was removed, it should return True again when re-added
    engine.remove_vehicle_from_cache("veh_1")
    assert engine.filter_vehicle_movement("veh_1", 10.5, 20.5, 47.0) is True
    
    engine.clear()

