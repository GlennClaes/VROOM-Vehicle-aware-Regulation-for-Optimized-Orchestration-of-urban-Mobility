# VROOM Sources

This register lists the material used in the project, documentation site, research paper, architecture and final presentation.

## Internal Project Material

| Source | Location | Used for |
| --- | --- | --- |
| Research Project assignment | `research/assignment/RP_Assignment_2026.docx` | Assignment fit, required deliverables, project scope and evaluation expectations. |
| VROOM research paper | `research/papers/AIN3_researchpaper_2TIN_2526.docx` | Problem statement, research question, subquestions, method, literature review, conclusion and AI-use disclosure. |
| Production architecture diagram | `research/assets/architecture-diagram.png` | Docker/service architecture, DevOps flow, dashboard documentation and final overview. |
| Team agreements and guidelines | `research/sprint-0/team-agreements-guidelines.docx` | Git workflow, PR rules, standups, Jira/Confluence usage and quality agreements. |
| Mockups | `research/sprint-0/mockups.docx` | Login, registration, simulation dashboard, logs dashboard, KPI dashboard and settings page. |
| Definition of Done | `research/sprint-0/definition-of-done.docx` | Done criteria for functionality, code quality, tests, coverage, CI/CD, review, documentation and deploy readiness. |
| Global planning | `research/sprint-0/global-planning.docx` | Sprint goals from foundation to final delivery. |
| Sprint 1 presentation | `research/sprint-1/VROOM_Sprint1_AIN3.pptx` | Baseline app, Docker/CI setup, SUMO-Web3D and first AI integration evidence. |
| Sprint 2 implementation presentation | `research/sprint-2/VROOM_Sprint2_AIN3.pptx` | Scenario loading, baseline/SAM strategy selection, KPI dashboard and frontend/backend/SUMO integration. |
| Sprint 2 research presentation | `research/sprint-2/VROOM_Sprint2-Research_AIN3.pptx` | DQN/D3QN comparison, metrics, scenarios and research method. |
| Sprint 3 final presentation | `research/sprint-3/VROOM_AIN3.pptx` | Final architecture, problem statement, tech stack, conclusion and reflection. |
| Technology radar | `research/TECHNOLOGY_RADAR.md` | Future optimization options, including Mojo as an AI-performance research track. |

## Technologies and Frameworks

| Technology | Role |
| --- | --- |
| Eclipse SUMO | Traffic simulation for the Hasselt XL road network. |
| Gymnasium | Reinforcement-learning environment interface. |
| PyTorch | DQN/D3QN model implementation and training. |
| FastAPI | Backend API, simulation control and RL endpoints. |
| Vue.js | Dashboard, simulation controls, KPI views and documentation site. |
| Three.js / SUMO-Web3D | Browser-based 3D inspection of SUMO state. |
| MySQL 8.4 | Persistent project data. |
| Redis | Runtime state/cache between services. |
| Docker and Docker Compose | Reproducible development and production-style deployment. |
| GitHub Actions | CI/CD, tests, builds and GitHub Pages deployment. |
| Jira | Backlog, user stories, sprint planning and issue state tracking. |
| Confluence | Meeting notes, research notes, sprint review material and team process documentation. |
| NATS | Proposed low-latency communication bus for production real-light controllers. |

## Literature Used in the Research Paper

- Sutton and Barto: reinforcement-learning foundations.
- Watkins: Q-learning and delayed rewards.
- Mnih et al.: Deep Q-Networks.
- Li et al., Ma et al., Reza et al. and Wei et al.: reinforcement learning for adaptive traffic-light control.
- Dueling Double DQN and adaptive traffic-signal-control studies used to motivate the final SAM AI direction.
- Eclipse SUMO and Gymnasium documentation for simulation and environment design.

## Notes

- The repository contains the project-owned paper and sprint artifacts so reviewers can verify the work without relying on private local folders.
- External papers should be cited by title, author and link in the paper itself. When a paper cannot be redistributed, keep only a citation/link here and do not copy the PDF into the repository.
- Jira and Confluence exports are not committed here because they may contain account or workspace metadata. The documentation site describes how they were used and what evidence they contain.
