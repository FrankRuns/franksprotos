"""Rebuild condition inputs from bundled daily weather and sourced monthly evidence."""
import datetime
import json
from pathlib import Path

root = Path(__file__).parent / 'dist'
data = json.loads((root / 'data.json').read_text())
for m in data['mountains']:
    daily = json.loads((root / 'weather-raw' / f"{m['id']}.json").read_text())['daily']
    bins = {}
    for k, date in enumerate(daily['time']):
        dt = datetime.date.fromisoformat(date)
        if dt.month not in (12, 1, 2, 3, 4) or k < 7 or daily['temperature_2m_max'][k] is None:
            continue
        snow = sum(v or 0 for v in daily['snowfall_sum'][k-6:k+1])
        rain = sum(v or 0 for v in daily['rain_sum'][k-2:k+1])
        surface = max(.05, min(1, .65 + .25*min(snow/25, 1) - .30*min(rain/15, 1)))
        bins.setdefault(f'{dt.month:02d}-{(dt.day-1)//7}', []).append(surface)
    for key, values in bins.items():
        record = data['weather'][str(m['id'])][key]
        record['surfaceScore'] = sum(values)/len(values)
        record['surfaceBad'] = sum(v < .45 for v in values)/len(values)
data['snowHistory'] = json.loads((root / 'snow-history.json').read_text())
data['terrainHistory'] = json.loads((root / 'terrain-history.json').read_text())
data['conditionSources'] = {'retrieved': '2026-10-03', 'depth': 'OnTheSnow monthly historical aggregates; period/sample size undisclosed', 'terrain': 'NewEnglandSkiHistory volunteer reports; sparse nonrandom sample, counts supplied', 'weights': 'User-editable planning assumptions, not a calibrated forecast'}
(root / 'data.json').write_text(json.dumps(data))
print('Condition snapshot rebuilt.')
