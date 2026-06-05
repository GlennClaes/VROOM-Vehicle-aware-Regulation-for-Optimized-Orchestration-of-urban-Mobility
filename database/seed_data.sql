-- Seed data for VROOM Traffic AI Database
USE vroomdb;

-- 1. Insert default admin and test user accounts
-- Passwords are bcrypt-hashed versions of 'adminpassword' and 'userpassword'
INSERT INTO users (username, email, hashed_password, disabled)
VALUES 
('vroomadmin', 'admin@vroom.municipal.gov', '$2b$12$R9h/lIPzMRt5m.1K0BvJkO3Z.aP7GZ.vO9V5t0C6kQ0r7lZ5l4gKG', FALSE),
('traffic_engineer', 'engineer@vroom.municipal.gov', '$2b$12$K8d2sB8s/H.mF4VwF9o1J.wK8U3W.tT9V6t1C6kQ0r7lZ5l4gKG', FALSE)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- 2. Insert default Simulation Presets for Hasselt XL Scenario
INSERT INTO simulation_presets (user_id, name, scenario, strategy, update_interval, sam_model, delay_ms)
SELECT id, 'Hasselt Peak Hours (DQN)', 'hasselt_xl', 'learned', 1, 'dqn_universal_best_rush_hour.pt', 30
FROM users WHERE username = 'vroomadmin'
LIMIT 1;

INSERT INTO simulation_presets (user_id, name, scenario, strategy, update_interval, sam_model, delay_ms)
SELECT id, 'Hasselt Baseline (Static)', 'hasselt_xl', 'baseline', 1, NULL, 30
FROM users WHERE username = 'vroomadmin'
LIMIT 1;

-- 3. Insert mock historical Simulation Results for model comparison / charts
INSERT INTO simulation_results (strategy, model_name, scenario, network, avg_queue, avg_speed, avg_wait_time, teleports, throughput, total_vehicles, total_steps, data_points)
VALUES
('baseline', 'N/A', 'hasselt_xl', 'Hasselt XL', 12.4, 8.2, 45.2, 5, 2340, 2450, 3600, '{"queue_history": [10.2, 12.1, 14.5], "speed_history": [8.5, 8.1, 8.0]}'),
('learned', 'dqn_universal_best_rush_hour.pt', 'hasselt_xl', 'Hasselt XL', 4.8, 12.6, 18.5, 0, 2780, 2800, 3600, '{"queue_history": [5.1, 4.5, 4.2], "speed_history": [12.1, 12.5, 12.8]}');
