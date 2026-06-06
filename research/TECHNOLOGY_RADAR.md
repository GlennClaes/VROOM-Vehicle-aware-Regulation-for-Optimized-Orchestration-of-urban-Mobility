# VROOM Technology Radar

This radar captures technologies that could improve VROOM after the current production-ready baseline. It is intentionally conservative: physical traffic-light control must stay predictable, testable and reviewable.

## Adopt

| Technology | Why |
| --- | --- |
| C++17 for real-light control | Predictable runtime, low-level hardware access, small deployable binaries and mature tooling. |
| Docker Compose profiles/stacks | Reproducible development, production-style and real-light smoke environments. |
| NATS for controller messaging | Lightweight, low-latency pub/sub with simple edge deployment and monitoring. |
| JSON schema/config validation | Catches unsafe or incomplete cabinet mappings before deployment. |

## Trial

| Technology | Why |
| --- | --- |
| ONNX Runtime | Could make trained PyTorch models easier to deploy in a production inference service. |
| TensorRT/OpenVINO | Useful if AI inference becomes a bottleneck on edge hardware. |
| cppcheck/clang-tidy | Adds deeper static analysis for C++ controller code in CI. |
| Hardware-in-the-loop tests | Needed before real relay/PLC deployment. |

## Assess

| Technology | Why |
| --- | --- |
| Mojo | Promising for high-performance AI kernels with Python-like ergonomics. It could be useful for future training/inference acceleration experiments, feature preprocessing or simulation-heavy numeric code. It should not replace the C++ hardware controller yet because the safety-critical ecosystem, embedded tooling and industrial review path are less mature. |
| Rust | Strong memory-safety story for future low-level controller components, but adding it now would increase toolchain complexity. |
| Zenoh | Interesting alternative for edge communication in distributed mobility systems. NATS is simpler for the current project. |
| eBPF observability | Could help diagnose network and latency issues in a production edge deployment. |

## Hold

| Technology | Why |
| --- | --- |
| Direct AI-to-GPIO control | The AI should not write physical outputs directly. It must go through a safety controller and HAL. |
| Experimental hardware libraries in production | Cabinet integration should use certified PLC/GPIO SDKs and audited wiring. |
| One-off shell deployment scripts only | Deployment should stay reproducible through Docker, compose, CI and documented runbooks. |

## Mojo Note

Mojo is attractive because it aims to combine Python-like syntax with systems-level performance for AI workloads. For VROOM, the best future use would be:

- Fast reward and metric calculations during training.
- High-throughput feature preprocessing for large SUMO datasets.
- Experimental inference kernels if ONNX/TensorRT are not enough.

Mojo should be treated as an optimization research track, not as the primary controller language. The production real-light controller remains C++ because hardware control needs mature compilers, deterministic deployment, straightforward audits and reliable integration with GPIO/PLC SDKs.
