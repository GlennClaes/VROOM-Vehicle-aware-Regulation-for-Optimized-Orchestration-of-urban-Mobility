#include <iostream>
#include <unordered_map>
#include <vector>
#include <string>
#include <mutex>
#include <algorithm>
#include <cmath>

struct Position {
    double x;
    double y;
    double angle;
};

class TrafficPredictionEnginePrivate {
private:
    std::unordered_map<std::string, std::vector<double>> flow_history;
    std::unordered_map<std::string, double> smoothed_estimates;
    std::unordered_map<std::string, Position> last_positions;
    std::mutex engine_mutex;

public:
    TrafficPredictionEnginePrivate() = default;
    ~TrafficPredictionEnginePrivate() = default;

    // Disable copy constructors for efficiency (use move semantics instead)
    TrafficPredictionEnginePrivate(const TrafficPredictionEnginePrivate&) = delete;
    TrafficPredictionEnginePrivate& operator=(const TrafficPredictionEnginePrivate&) = delete;
    
    TrafficPredictionEnginePrivate(TrafficPredictionEnginePrivate&& other) noexcept {
        std::lock_guard<std::mutex> lock(other.engine_mutex);
        flow_history = std::move(other.flow_history);
        smoothed_estimates = std::move(other.smoothed_estimates);
        last_positions = std::move(other.last_positions);
    }

    TrafficPredictionEnginePrivate& operator=(TrafficPredictionEnginePrivate&& other) noexcept {
        if (this != &other) {
            std::lock(engine_mutex, other.engine_mutex);
            std::lock_guard<std::mutex> lock_this(engine_mutex, std::adopt_lock);
            std::lock_guard<std::mutex> lock_other(other.engine_mutex, std::adopt_lock);
            flow_history = std::move(other.flow_history);
            smoothed_estimates = std::move(other.smoothed_estimates);
            last_positions = std::move(other.last_positions);
        }
        return *this;
    }

    void record_flow(const std::string& lane_id, double count) {
        std::lock_guard<std::mutex> lock(engine_mutex);
        auto& history = flow_history[lane_id];
        history.push_back(count);
        
        // Keep history bounded to last 100 observations to optimize memory
        if (history.size() > 100) {
            history.erase(history.begin());
        }
    }

    double predict_flow(const std::string& lane_id, double alpha) {
        std::lock_guard<std::mutex> lock(engine_mutex);
        auto it = flow_history.find(lane_id);
        if (it == flow_history.end() || it->second.empty()) {
            return 0.0;
        }

        const auto& history = it->second;
        double current_val = history.back();
        
        // Apply Exponential Smoothing: S_t = alpha * Y_t + (1 - alpha) * S_{t-1}
        auto smooth_it = smoothed_estimates.find(lane_id);
        double prev_smooth = (smooth_it != smoothed_estimates.end()) ? smooth_it->second : current_val;
        
        double new_smooth = alpha * current_val + (1.0 - alpha) * prev_smooth;
        smoothed_estimates[lane_id] = new_smooth;
        
        return new_smooth;
    }

    bool filter_vehicle_movement(const std::string& vid, double x, double y, double angle) {
        std::lock_guard<std::mutex> lock(engine_mutex);
        auto it = last_positions.find(vid);
        if (it == last_positions.end()) {
            last_positions[vid] = {x, y, angle};
            return true;
        }
        auto& prev = it->second;
        double dx = x - prev.x;
        double dy = y - prev.y;
        double d_angle = std::abs(angle - prev.angle);
        
        // Return true if vehicle moved significantly (thresholds: 0.1m or 1.0 degree)
        if ((dx*dx + dy*dy) < 0.01 && d_angle < 1.0) {
            return false;
        }
        prev = {x, y, angle};
        return true;
    }

    void remove_vehicle_from_cache(const std::string& vid) {
        std::lock_guard<std::mutex> lock(engine_mutex);
        last_positions.erase(vid);
    }

    void clear_history() {
        std::lock_guard<std::mutex> lock(engine_mutex);
        flow_history.clear();
        smoothed_estimates.clear();
        last_positions.clear();
    }
};

// C-compatible interface for Python ctypes binding
extern "C" {
    #ifdef _WIN32
        #define VROOM_EXPORT __declspec(dllexport)
    #else
        #define VROOM_EXPORT
    #endif

    VROOM_EXPORT void* create_engine() {
        return new TrafficPredictionEnginePrivate();
    }

    VROOM_EXPORT void destroy_engine(void* engine) {
        delete static_cast<TrafficPredictionEnginePrivate*>(engine);
    }

    VROOM_EXPORT void record_flow(void* engine, const char* lane_id, double count) {
        if (engine && lane_id) {
            static_cast<TrafficPredictionEnginePrivate*>(engine)->record_flow(std::string(lane_id), count);
        }
    }

    VROOM_EXPORT double predict_flow(void* engine, const char* lane_id, double alpha) {
        if (engine && lane_id) {
            return static_cast<TrafficPredictionEnginePrivate*>(engine)->predict_flow(std::string(lane_id), alpha);
        }
        return 0.0;
    }

    VROOM_EXPORT bool filter_vehicle_movement(void* engine, const char* vid, double x, double y, double angle) {
        if (engine && vid) {
            return static_cast<TrafficPredictionEnginePrivate*>(engine)->filter_vehicle_movement(std::string(vid), x, y, angle);
        }
        return true;
    }

    VROOM_EXPORT void remove_vehicle_from_cache(void* engine, const char* vid) {
        if (engine && vid) {
            static_cast<TrafficPredictionEnginePrivate*>(engine)->remove_vehicle_from_cache(std::string(vid));
        }
    }

    VROOM_EXPORT void clear_history(void* engine) {
        if (engine) {
            static_cast<TrafficPredictionEnginePrivate*>(engine)->clear_history();
        }
    }

    VROOM_EXPORT double compute_green_wave_offset(double distance_meters, double speed_limit_mps) {
        if (speed_limit_mps <= 0.1) return 0.0;
        double travel_time = distance_meters / speed_limit_mps;
        return std::round(travel_time);
    }

    VROOM_EXPORT double calculate_queue_spillback_probability(double current_queue, double lane_capacity) {
        if (lane_capacity <= 0.0) return 1.0;
        double ratio = current_queue / lane_capacity;
        if (ratio >= 1.0) return 1.0;
        if (ratio <= 0.0) return 0.0;
        return 1.0 / (1.0 + std::exp(-10.0 * (ratio - 0.75)));
    }
}
