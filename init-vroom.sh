# Laadt VROOM aliases in je Bash shell
# Run dit in je terminal met: source init-vroom.sh

alias setup="bash 01_setup-dev.sh"
alias quality="bash 02_check-quality.sh"
alias unittests="bash 03_run-tests.sh"
alias test-docker="bash 03b_run-tests-docker.sh"
alias test="bash 04_check-ci.sh"
alias cd="bash 05_test-cd.sh"
alias start="bash 06_run-app.sh -d"
alias verify="bash 07_verify-api.sh"
alias logs="bash 08_inspect-logs.sh"
alias train="bash 09_run-training.sh"
alias debug="bash 10_debug-sumo.sh"
alias stop="bash 11_stop-app.sh"
alias clean="bash 12_clean-docker.sh"

echo -e "🚗 \033[32mVROOM commando's zijn geladen in Bash!\033[0m"
echo -e "Je kunt nu gewoon de volgende woorden typen (zonder bash of ./):"
echo -e "👉 \033[36msetup, start, stop, logs, test, train, verify, debug, clean\033[0m"
