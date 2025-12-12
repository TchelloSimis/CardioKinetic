"""Test variable length program interpolation"""
from monte_carlo_simulation import interpolate_weeks, resolve_week_position

# Test template with keyframes at 0%, 33.3333%, 66.6666%
weeks = [
    {'position': '0%', 'phaseName': 'Phase 1', 'powerMultiplier': 1.0, 'targetRPE': 5},
    {'position': '33.3333%', 'phaseName': 'Phase 2', 'powerMultiplier': 1.1, 'targetRPE': 6},
    {'position': '66.6666%', 'phaseName': 'Phase 3', 'powerMultiplier': 1.2, 'targetRPE': 7}
]

for total_weeks in [6, 9, 12, 15, 18]:
    print(f'\n=== {total_weeks} WEEKS ===')
    print('Keyframe positions:')
    for w in weeks:
        pos = resolve_week_position(w['position'], total_weeks)
        print(f'  {w["position"]:>10} -> Week {pos}')
    
    result = interpolate_weeks(weeks, total_weeks, 20)
    print(f'\nWeek | Phase   | Power')
    print('-' * 30)
    for wd in result:
        print(f'{wd.position:4} | {wd.phase_name:7} | {wd.power_multiplier:.1f}')
