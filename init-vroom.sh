# Laadt VROOM aliases in je Bash shell
# Run dit in je terminal met: source init-vroom.sh

alias setup="bash scripts/001_setup-dev.sh"
alias quality="bash scripts/002_check-quality.sh"
alias unittests="bash scripts/003_run-tests.sh"
alias test-docker="bash scripts/003b_run-tests-docker.sh"
alias test="bash scripts/004_check-ci.sh"
alias cd="bash scripts/005_test-cd.sh"
alias start="bash scripts/006_run-app.sh -d"
alias verify="bash scripts/007_verify-api.sh"
alias logs="bash scripts/008_inspect-logs.sh"
alias train="bash scripts/009_run-training.sh"
alias debug="bash scripts/010_debug-sumo.sh"
alias stop="bash scripts/011_stop-app.sh"
alias clean="bash scripts/012_clean-docker.sh"

echo -e "🚗 \033[32mVROOM commando's zijn geladen in Bash!\033[0m"
echo -e "Je kunt nu gewoon de volgende woorden typen (zonder bash of ./):"
echo -e "👉 \033[36msetup, start, stop, logs, test, train, verify, debug, clean\033[0m"
