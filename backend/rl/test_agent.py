import os
import time
from sumo_env import SumoIntersectionEnv
from dqn_agent import DQNAgent

MODEL_PATH = "./models/dqn_20260403_153405_ep0050.pt"

def test():
    # SUMO environment opstarten
    env = SumoIntersectionEnv(use_gui=True)
    state_dim = env.observation_space.shape[0]
    action_dim = env.action_space.n
    agent = DQNAgent(state_dim, action_dim)

    # Laad model
    if os.path.exists(MODEL_PATH):
        agent.load(MODEL_PATH)
        agent.epsilon = 0.0  # volledig deterministisch
        print(f"Model {MODEL_PATH} succesvol geladen!")
    else:
        print("Model bestand niet gevonden!")
        return

    # Reset environment en wacht even zodat SUMO volledig laadt
    obs, _ = env.reset()
    time.sleep(1.0)  # laat SUMO opstarten

    total_reward = 0
    done = False

    print("Test gestart... Kijk in de SUMO-GUI.")

    while not done:
        # Selecteer actie via DQN
        action = agent.select_action(obs, training=False)
        # Print Q-waarden en geselecteerde actie
        q_values = agent.get_q_values(obs)
        print(f"Q-values: {q_values} -> Action: {action}")

        # Voer stap uit in SUMO
        obs, reward, terminated, truncated, info = env.step(action)
        total_reward += reward
        done = terminated or truncated

    print(f"Test voltooid. Totale reward: {total_reward:.2f}")
    env.close()

if __name__ == "__main__":
    test()
