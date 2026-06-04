# voor een model te trainen:
### stap 1)
python trainer.py --episodes 500 (train eerst met trainer.py. zorg ook dat ge in backend/rl zit.)

### stap 2)
python train_local.py --load models/dqn_mock_final.pt --episodes 100 (train model daarna model met train_local.py. het kan na 50 ook al gestopt worden als 100 te lang is.)

### stap 3)
python evaluate.py --model models/[naam van model] --episodes 5 (de 5 kan nog aangepast worden maar dit is goed zo)

### stap 4)
python fixed_time_baseline.py --green 30 --runs 3 (vergelijk met baseline)
