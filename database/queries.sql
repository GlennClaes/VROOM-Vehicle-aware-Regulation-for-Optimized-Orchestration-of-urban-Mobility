-- Useful SQL Queries for VROOM Traffic AI Analytics
USE vroomdb;

-- 1. Compare Average Performance (Queue, Wait Time, Speed) by Control Strategy
SELECT 
    strategy,
    COUNT(*) AS total_simulations,
    ROUND(AVG(avg_queue), 2) AS average_queue_length,
    ROUND(AVG(avg_speed), 2) AS average_speed_kmh,
    ROUND(AVG(avg_wait_time), 2) AS average_wait_time_sec,
    SUM(throughput) AS cumulative_throughput,
    SUM(teleports) AS total_gridlocks_teleports
FROM simulation_results
GROUP BY strategy;

-- 2. Compare Performance Improvements of AI Models over Baseline
SELECT 
    sr_learned.model_name AS ai_model,
    sr_learned.scenario,
    ROUND(sr_baseline.avg_wait_time - sr_learned.avg_wait_time, 2) AS wait_time_reduction_sec,
    ROUND(((sr_baseline.avg_wait_time - sr_learned.avg_wait_time) / sr_baseline.avg_wait_time) * 100, 1) AS wait_time_improvement_percent,
    ROUND(sr_learned.avg_speed - sr_baseline.avg_speed, 2) AS speed_increase_kmh,
    sr_learned.throughput - sr_baseline.throughput AS throughput_increase_vehicles
FROM simulation_results sr_learned
JOIN simulation_results sr_baseline 
  ON sr_learned.scenario = sr_baseline.scenario 
  AND sr_baseline.strategy = 'baseline'
WHERE sr_learned.strategy = 'learned';

-- 3. Retrieve all User-specific Presets with User Info
SELECT 
    u.username,
    u.email,
    p.name AS preset_name,
    p.scenario,
    p.strategy,
    p.sam_model,
    p.created_at
FROM simulation_presets p
JOIN users u ON p.user_id = u.id
ORDER BY u.username, p.created_at DESC;

-- 4. Audit Last Logins of System Users
SELECT 
    username, 
    email, 
    last_login_at, 
    created_at,
    IF(disabled, 'Disabled', 'Active') AS status
FROM users
ORDER BY last_login_at DESC;
