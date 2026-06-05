import {
  Activity,
  BadgeCheck,
  BookOpen,
  Boxes,
  BrainCircuit,
  ClipboardCheck,
  ClipboardList,
  Code2,
  Database,
  FileText,
  Gauge,
  GitBranch,
  Network,
  Presentation,
  Route,
  Server,
  Target,
  Terminal,
  Users,
  Workflow,
} from 'lucide-vue-next'

export const navigationSections = [
  { id: 'overview', label: 'Project overview', icon: BookOpen, keywords: 'problem product scope Hasselt SUMO VROOM' },
  { id: 'assignment', label: 'Assignment fit', icon: ClipboardList, keywords: 'requirements deliverables definition done mockups jira confluence' },
  { id: 'research', label: 'Research paper', icon: Target, keywords: 'question method literature KPI DQN D3QN conclusion paper' },
  { id: 'architecture', label: 'Architecture', icon: Network, keywords: 'docker containers backend frontend redis mysql gateway diagram' },
  { id: 'ai', label: 'SAM AI controller', icon: BrainCircuit, keywords: 'reinforcement learning reward state action DQN D3QN baseline' },
  { id: 'simulation', label: 'Simulation and UI', icon: Route, keywords: 'SUMO Web3D Vue dashboard scenarios mockups vision' },
  { id: 'process', label: 'Sprints and process', icon: Workflow, keywords: 'Jira Confluence scrum sprint review retrospective planning' },
  { id: 'devops', label: 'DevOps and runbook', icon: Terminal, keywords: 'GitHub Actions Docker test deploy commands ports future optimization' },
]

export const headerFacts = [
  {
    label: 'Team',
    value: 'AIN3',
    text: 'Glenn Claes, Muhammed Komurboga, Martijn Vanhengel',
  },
  {
    label: 'Academic context',
    value: 'Research Project 2025-2026',
    text: 'PXL-Digital, Applied Computer Science, Artificial Intelligence',
  },
  {
    label: 'Core comparison',
    value: 'SAM AI vs fixed-time control',
    text: 'Measured through queue length, waiting time, delay, reward, and throughput.',
  },
]

export const requirementFit = [
  {
    requirement: 'Running traffic simulation in SUMO',
    implementation: 'The Hasselt XL scenario is used as the main SUMO network, with SUMO-Web3D for live inspection.',
  },
  {
    requirement: 'Implement the SAM AI component',
    implementation: 'SAM is implemented as a DQN/D3QN reinforcement-learning traffic-light controller.',
  },
  {
    requirement: 'Decide from the current traffic state',
    implementation: 'The controller observes queue length, vehicle count, waiting time, speed, and active phase information.',
  },
  {
    requirement: 'Control traffic lights accordingly',
    implementation: 'The selected action is mapped back to a traffic-light phase and sent to the simulator.',
  },
  {
    requirement: 'At least one non-learning baseline',
    implementation: 'A fixed-time baseline is available for comparison and reporting.',
  },
  {
    requirement: 'At least one reinforcement-learning implementation',
    implementation: 'The codebase contains DQN/D3QN training, inference, evaluation, and checkpoint loading.',
  },
  {
    requirement: 'Backend integration between AI and SUMO',
    implementation: 'FastAPI exposes the RL, model, simulation, status, and data endpoints around the simulator.',
  },
  {
    requirement: 'Gather and analyze useful metrics',
    implementation: 'Evaluation uses reward, queue length, waiting time, delay, throughput, pressure, fairness, and baseline comparison.',
  },
  {
    requirement: 'Modern web user interface',
    implementation: 'Vue provides scenario selection, traffic map, KPI dashboard, logs, settings, and simulation controls.',
  },
  {
    requirement: 'Agile process documentation',
    implementation: 'Jira was used for backlog and sprint tracking; Confluence for analysis, reviews, retrospectives, and project notes.',
  },
]

export const deliverables = [
  {
    title: 'Working prototype',
    text: 'GitHub contains the frontend, backend, SUMO-Web3D service, Docker setup, training scripts, and evaluation tooling.',
    icon: Boxes,
  },
  {
    title: 'Research paper',
    text: 'The paper documents the problem statement, research question, subquestions, literature, method, conclusion, and AI-use disclosure.',
    icon: FileText,
  },
  {
    title: 'Jira and Confluence evidence',
    text: 'The agile process is traceable through user stories, sprint planning, reviews, retrospectives, and team agreements.',
    icon: Workflow,
  },
  {
    title: 'Sprint and final presentations',
    text: 'Sprint 1, Sprint 2, the interim research presentation, and the final Sprint 3 deck support review and assessment.',
    icon: Presentation,
  },
]

export const mockups = [
  'Login page',
  'Registration page',
  'Simulation dashboard',
  'Logs dashboard',
  'KPI dashboard',
  'Settings page',
]

export const definitionOfDone = [
  {
    title: 'Functional correctness',
    checks: [
      'All acceptance criteria are implemented according to the agreed SMART-Fit principles.',
      'The feature works as described in the user story.',
    ],
  },
  {
    title: 'Code quality',
    checks: [
      'Code follows the agreed style conventions and linting rules.',
      'Names are clear and consistent; docstrings or comments are added where they help.',
      'Separation of concerns is respected; no monolithic files that hide unrelated logic.',
    ],
  },
  {
    title: 'Testing and validation',
    checks: [
      'Unit tests for business logic are present and passing.',
      'Coverage meets the agreed standard of at least 80 percent.',
      'Code is merged only when CI/CD pipeline checks pass.',
    ],
  },
  {
    title: 'Quality and non-functional requirements',
    checks: [
      'No critical or blocking bugs remain.',
      'Non-critical bugs are documented.',
      'Roles, access rules, and environment variables are handled correctly.',
    ],
  },
  {
    title: 'Review and documentation',
    checks: [
      'The pull request is documented and approved by at least one other team member.',
      'Open issues or dependencies are mentioned in PR comments.',
      'The linked Jira issue is moved to the correct status.',
      'Documentation and README files are updated when relevant.',
    ],
  },
  {
    title: 'Deploy-ready',
    checks: [
      'The branch can be merged into develop or main without breaking the pipeline.',
      'Docker or staging settings have been tested where relevant.',
    ],
  },
]

export const workingAgreements = [
  {
    title: 'Branching',
    text: 'main stays stable and production-ready. develop is the integration branch. Feature branches start from develop and preferably include the Jira key.',
  },
  {
    title: 'Pull requests',
    text: 'Every PR explains the change, mentions dependencies or issues, and is reviewed by at least one teammate before merge.',
  },
  {
    title: 'Project structure',
    text: 'Frontend, backend, data access, services, routes, tests, and configuration are kept separate to avoid hard-to-maintain code.',
  },
  {
    title: 'Communication',
    text: 'Daily standups cover progress, next steps, blockers, and shared learning around AI methods, model results, and test outcomes.',
  },
]

export const researchQuestions = [
  'Which reinforcement-learning technique is most suitable for the SAM controller in the selected SUMO scenario?',
  'Which metrics give reliable and relevant insight into traffic performance?',
  'How does SAM perform during high traffic intensity or peak-hour conditions?',
  'Can a trained SAM controller transfer to a new city without full retraining?',
  'How quickly can SAM adapt when traffic intensity changes abruptly during a simulation?',
]

export const researchInsights = [
  {
    title: 'DQN is a practical baseline for learning-based signal control',
    text: 'Deep Q-Networks connect traffic states to phase actions and are supported by traffic-control literature.',
  },
  {
    title: 'D3QN is the stronger choice for complex traffic networks',
    text: 'Dueling Double DQN reduces Q-value overestimation, separates state value from action advantage, and gives a more stable learning path.',
  },
  {
    title: 'The evaluation must use multiple KPIs',
    text: 'Waiting time, delay, queue length, pressure, fairness, throughput, travel time, and reward describe different parts of traffic quality.',
  },
  {
    title: 'Adaptive control is most valuable under pressure',
    text: 'The literature and sprint research point to the biggest gains in dynamic, busy, or uneven traffic conditions where fixed cycles fall short.',
  },
  {
    title: 'Transfer to new cities is possible but limited',
    text: 'A trained controller can provide a starting point, but new road topology and traffic patterns usually require retraining or fine-tuning.',
  },
]

export const literatureSources = [
  'Sutton and Barto: reinforcement-learning foundations.',
  'Watkins: Q-learning and delayed rewards.',
  'Mnih et al.: Deep Q-Networks.',
  'Li et al., Ma et al., Reza et al., and Wei et al.: RL and traffic-light control.',
  'Eclipse SUMO and Gymnasium: simulation and RL environment tooling.',
  'Recent D3QN and adaptive signal-control research used to motivate the final SAM approach.',
]

export const services = [
  { name: 'gateway-prod', tech: 'Nginx', role: 'Routes browser traffic to the frontend, API, map, and simulator websocket paths.' },
  { name: 'frontend', tech: 'Vue.js', role: 'Provides the dashboard for scenarios, simulation control, KPI analysis, logs, and settings.' },
  { name: 'backend', tech: 'FastAPI + Python', role: 'Hosts API routes, authentication, RL endpoints, model loading, and database access.' },
  { name: 'sumo-web3d', tech: 'SUMO + Web3D', role: 'Runs and visualizes the traffic simulation in a browser-friendly 3D environment.' },
  { name: 'redis-prod', tech: 'Redis', role: 'Stores fast runtime state and supports communication between services.' },
  { name: 'mysql-prod', tech: 'MySQL 8.4', role: 'Persists users, presets, results, and project data used by the backend.' },
]

export const metrics = [
  { name: 'Average queue', description: 'Vehicles waiting across controlled lanes.' },
  { name: 'Waiting time', description: 'How long vehicles remain delayed at intersections.' },
  { name: 'Total delay / travel time', description: 'Network-level time lost compared with free-flow traffic.' },
  { name: 'Throughput', description: 'Vehicles that successfully pass through the simulated network.' },
  { name: 'Pressure', description: 'Difference between incoming and outgoing traffic pressure at a junction.' },
  { name: 'Fairness', description: 'Whether one direction is being favored while another starves.' },
]

export const simulationFlow = [
  {
    step: '01',
    title: 'Select scenario',
    text: 'The user chooses a configured SUMO scenario and traffic setup.',
  },
  {
    step: '02',
    title: 'Start simulation',
    text: 'SUMO-Web3D runs the scenario and exposes live traffic state to the rest of the stack.',
  },
  {
    step: '03',
    title: 'Choose strategy',
    text: 'The simulation can run with the fixed-time baseline or the SAM learning controller.',
  },
  {
    step: '04',
    title: 'Inspect and compare',
    text: 'The dashboard exposes metrics, logs, strategy status, and comparison data for analysis.',
  },
]

export const uiWorkflows = [
  {
    title: 'Authentication and profile',
    text: 'Sprint 1 delivered registration, login validation, logout, and profile management.',
    icon: Users,
  },
  {
    title: 'Scenario and traffic map',
    text: 'Users can select a scenario, inspect the traffic map, view vehicles, and use fullscreen or external map options.',
    icon: Route,
  },
  {
    title: 'KPI dashboard',
    text: 'KPI views show current values and changes over time for speed, waiting time, throughput, queues, and model performance.',
    icon: Gauge,
  },
  {
    title: 'Logs and analysis',
    text: 'Sprint 3 planning covers AI decisions per timestep, filtering, downloads, export, and reuse of saved simulations.',
    icon: Database,
  },
]

export const sprintTimeline = [
  {
    sprint: 'Sprint 0',
    title: 'Foundation, analysis, and planning',
    period: 'Week of 9 February to 23 February 2026',
    goal: 'Prepare the project so development could start with clear scope, research direction, backlog, architecture, and team agreements.',
    outcomes: [
      'Project description, problem statement, research question, and subquestions.',
      'Literature research, research method, stakeholder analysis, and project scope.',
      'Architecture diagrams, SUMO proof of concept, backlog, user stories, mockups, global planning, and Definition of Done.',
      'Daily standups, sprint goal, sprint review, sprint retrospective, and team agreements documented through Jira and Confluence.',
    ],
  },
  {
    sprint: 'Sprint 1',
    title: 'Core implementation and baseline',
    period: '2 March to 27 March 2026',
    goal: 'Deliver a working baseline application with frontend, backend, CI/CD and SUMO simulation, including account and profile functionality.',
    outcomes: [
      'Registration, login validation, profile updates, password change, logout, and account metadata.',
      'Scenario selection, traffic map baseline, frontend-backend integration, MySQL, Docker, GitHub Actions, and SUMO-Web3D.',
      'Sprint review reported 13 user stories, 69 story points, and a stable first application baseline.',
    ],
  },
  {
    sprint: 'Sprint 2',
    title: 'AI integration and advanced simulation features',
    period: '30 March to 1 May 2026',
    goal: 'Run AI-driven simulations with strategy selection, traffic map features, KPI dashboard, warnings, and SAM integration.',
    outcomes: [
      'Start/stop simulation, simulation status, simulation interval, Baseline/SAM strategy selection, and selected strategy display.',
      'Scenario loading, traffic-map visualization, fullscreen map, active-vehicle count, external location opening, and warning messages.',
      'Realtime KPI dashboard, automatic KPI updates, DQN/D3QN experimentation, RL training difficulties, and benchmark-oriented testing.',
      'Sprint review reported 16 user stories and about 80 story points.',
    ],
  },
  {
    sprint: 'Sprint 3',
    title: 'Final delivery, analysis, and polish',
    period: '4 May to 28 May 2026',
    goal: 'Finish the application with polish and bugfixes, complete the research paper, prepare the final presentation, and strengthen analysis workflows.',
    outcomes: [
      'KPI export, log menu, AI decision logging per timestep, log filtering, log download, and simulation completion notification.',
      'Scenario reuse, interval consistency, saved simulations, model comparison, simulation export/import, and final validation.',
      'Final deck concluded that D3QN adds value for adaptive signal control, especially in busy and dynamic traffic situations.',
      'Reflection highlighted good communication, clearer planning, helpful feedback, and extra research effort for the AI part.',
    ],
  },
]

export const processRituals = [
  {
    title: 'Daily stand-up',
    text: 'The team aligned on what was done, what came next, and which blockers needed help.',
  },
  {
    title: 'Sprint planning',
    text: 'Jira stories were selected and split into frontend, backend, AI, DevOps, research, and documentation work.',
  },
  {
    title: 'Sprint review',
    text: 'Finished functionality was demonstrated and checked against the sprint goal and assignment requirements.',
  },
  {
    title: 'Sprint retrospective',
    text: 'Confluence captured what went well, what went less well, and which improvement actions were carried forward.',
  },
]

export const commands = [
  { cmd: './vroom.sh', text: 'Open the interactive project menu.' },
  { cmd: 'make dev', text: 'Start the development stack with Docker Compose.' },
  { cmd: 'make dev-build', text: 'Rebuild and start the development stack.' },
  { cmd: 'make prod', text: 'Start the production-style stack with the Nginx gateway.' },
  { cmd: 'make test', text: 'Run backend and frontend tests.' },
  { cmd: 'make train', text: 'Start the local AI training workflow.' },
  { cmd: 'make eval', text: 'Evaluate a trained model against stored or generated results.' },
  { cmd: 'make status', text: 'Inspect containers and check the backend health endpoint.' },
]

export const pipelines = [
  {
    title: 'Continuous Integration',
    text: 'Runs backend pytest coverage, frontend unit tests, and production Docker build checks.',
    icon: GitBranch,
  },
  {
    title: 'Continuous Deployment',
    text: 'Builds production images and supports the container lifecycle shown in the architecture diagram.',
    icon: Server,
  },
  {
    title: 'Security and quality',
    text: 'Separate workflows cover security scanning, quality checks, tagging, and PR reporting.',
    icon: BadgeCheck,
  },
  {
    title: 'GitHub Pages',
    text: 'Publishes this documentation site from the docs-site build artifact.',
    icon: FileText,
  },
]

export const ports = [
  { service: 'Frontend dashboard', url: 'http://localhost:5173' },
  { service: 'Backend API', url: 'http://localhost:8000' },
  { service: 'FastAPI docs', url: 'http://localhost:8000/docs' },
  { service: 'SUMO-Web3D', url: 'http://localhost:5000' },
  { service: 'SUMO-Web3D Vite client', url: 'http://localhost:3000' },
  { service: 'Simulator websocket', url: 'ws://localhost:5678' },
  { service: 'MySQL', url: 'localhost:3310 -> 3306' },
  { service: 'Redis', url: 'localhost:6379' },
]

export const futureOptimization = [
  {
    title: 'Model optimization',
    text: 'Continue tuning DQN/D3QN training, scenario diversity, reward weights, and evaluation runs.',
    icon: BrainCircuit,
  },
  {
    title: 'Performance optimization',
    text: 'Keep reducing simulator latency, payload size, rendering load, and backend bottlenecks.',
    icon: Activity,
  },
  {
    title: 'Documentation optimization',
    text: 'Keep improving the documentation with more screenshots, sprint evidence, results, and assessment-ready links.',
    icon: FileText,
  },
  {
    title: 'Codebase optimization',
    text: 'Continue refactoring into smaller components and strengthening tests, coverage, CI, and deployment reliability.',
    icon: Code2,
  },
]

export const sourceNotes = [
  'RP Assignment 2026 brief',
  'AIN3 research paper',
  'Sprint 0 agreements, mockups, Definition of Done, and global planning',
  'Sprint 1 review deck',
  'Sprint 2 review and interim research decks',
  'Sprint 3 final presentation',
  'Architecture diagram',
  'Repository implementation',
]

export const assetCards = [
  {
    title: 'Project management',
    text: 'Jira tracks user stories, sprint work, PR-linked branches, and status changes.',
    icon: ClipboardCheck,
  },
  {
    title: 'Knowledge base',
    text: 'Confluence captures analysis, planning, sprint reviews, retrospectives, and technical decisions.',
    icon: BookOpen,
  },
  {
    title: 'Repository and CI',
    text: 'GitHub, GitHub Actions, Docker, and Docker Hub support code review, tests, builds, and deployment.',
    icon: GitBranch,
  },
]
