"""
Batch Chart Generator for CardioKinetic Program Templates

This script generates Monte Carlo simulation charts for all program templates
with all their duration variants.

Usage:
    python generate_all_charts.py [--simulations N]
"""

import os
import sys
import json
from pathlib import Path

# Import from the main simulation script
from monte_carlo_simulation import (
    parse_template, get_program_weeks, run_monte_carlo, 
    plot_results, print_summary, MATPLOTLIB_AVAILABLE
)


# ============================================================================
# TEMPLATE DEFINITIONS
# ============================================================================

# Preset templates defined inline (matching presets.ts)
PRESET_TEMPLATES = [
    {
        "templateVersion": "1.0",
        "id": "fixed-time-power-progression",
        "name": "Fixed-Time Power Progression",
        "description": "A steady-state endurance program where session time stays constant while power output increases progressively.",
        "weekConfig": {
            "type": "variable",
            "range": {"min": 4, "max": 16, "step": 4}
        },
        "defaultSessionStyle": "steady-state",
        "progressionMode": "power",
        "defaultSessionDurationMinutes": 20,
        "weeks": [
            {"position": "first", "phaseName": "Foundation", "focus": "Volume", "description": "Establish aerobic base", "powerMultiplier": 1.0, "workRestRatio": "steady", "targetRPE": 5},
            {"position": "33%", "phaseName": "Build I", "focus": "Volume", "description": "Begin gradual power increase", "powerMultiplier": 1.05, "workRestRatio": "steady", "targetRPE": 6},
            {"position": "66%", "phaseName": "Build II", "focus": "Intensity", "description": "Continue power progression", "powerMultiplier": 1.10, "workRestRatio": "steady", "targetRPE": 7},
            {"position": "last", "phaseName": "Peak", "focus": "Intensity", "description": "Maximum power output", "powerMultiplier": 1.15, "workRestRatio": "steady", "targetRPE": 8}
        ]
    },
    {
        "templateVersion": "1.0",
        "id": "double-intercalated-progression",
        "name": "Double Intercalated Progression",
        "description": "An advanced steady-state program using cyclical progression with wave-loading.",
        "weekConfig": {
            "type": "variable",
            "range": {"min": 6, "max": 15, "step": 3}
        },
        "defaultSessionStyle": "steady-state",
        "progressionMode": "double",
        "defaultSessionDurationMinutes": 25,
        "weeks": [
            {"position": "first", "phaseName": "Cycle 1: Base", "focus": "Volume", "powerMultiplier": 1.0, "workRestRatio": "steady", "targetRPE": 5},
            {"position": "17%", "phaseName": "Cycle 1: Compress", "focus": "Intensity", "powerMultiplier": 1.08, "workRestRatio": "steady", "targetRPE": 7},
            {"position": "33%", "phaseName": "Cycle 1: Expand", "focus": "Volume", "powerMultiplier": 1.10, "workRestRatio": "steady", "targetRPE": 6},
            {"position": "50%", "phaseName": "Cycle 2: Base", "focus": "Volume", "powerMultiplier": 1.10, "workRestRatio": "steady", "targetRPE": 6},
            {"position": "66%", "phaseName": "Cycle 2: Compress", "focus": "Intensity", "powerMultiplier": 1.18, "workRestRatio": "steady", "targetRPE": 8},
            {"position": "83%", "phaseName": "Cycle 2: Expand", "focus": "Intensity", "powerMultiplier": 1.20, "workRestRatio": "steady", "targetRPE": 7},
            {"position": "last", "phaseName": "Peak Performance", "focus": "Intensity", "powerMultiplier": 1.20, "workRestRatio": "steady", "targetRPE": 8}
        ]
    },
    {
        "templateVersion": "1.0",
        "id": "standard-hiit-protocol",
        "name": "Standard HIIT Protocol",
        "description": "A classic high-intensity interval training program.",
        "weekConfig": {
            "type": "variable",
            "range": {"min": 4, "max": 16, "step": 4}
        },
        "defaultSessionStyle": "interval",
        "progressionMode": "power",
        "defaultSessionDurationMinutes": 15,
        "weeks": [
            {"position": "first", "phaseName": "Activation", "focus": "Volume", "powerMultiplier": 0.95, "workRestRatio": "1:2", "targetRPE": 5},
            {"position": "20%", "phaseName": "Base Building", "focus": "Volume", "powerMultiplier": 1.0, "workRestRatio": "1:2", "targetRPE": 6},
            {"position": "40%", "phaseName": "Density I", "focus": "Density", "powerMultiplier": 1.0, "workRestRatio": "1:1", "targetRPE": 7},
            {"position": "55%", "phaseName": "Density II", "focus": "Density", "powerMultiplier": 1.05, "workRestRatio": "1:1", "targetRPE": 7},
            {"position": "70%", "phaseName": "Intensity I", "focus": "Intensity", "powerMultiplier": 1.10, "workRestRatio": "2:1", "targetRPE": 8},
            {"position": "85%", "phaseName": "Intensity II", "focus": "Intensity", "powerMultiplier": 1.15, "workRestRatio": "2:1", "targetRPE": 9},
            {"position": "last", "phaseName": "Peak/Taper", "focus": "Recovery", "powerMultiplier": 1.10, "workRestRatio": "1:1", "targetRPE": 7}
        ]
    }
]

# Example templates (from templates/ folder)
EXAMPLE_TEMPLATES = [
    "templates/example-fixed-8week-hiit.json",
    "templates/example-variable-progressive.json",
    "templates/example-steady-state-endurance.json"
]


def get_week_variants(template):
    """Get all valid week durations for a template."""
    week_config = template.get('weekConfig', {})
    
    if week_config.get('type') == 'fixed':
        return [week_config.get('fixed', 8)]
    elif week_config.get('type') == 'variable':
        range_config = week_config.get('range', {})
        min_weeks = range_config.get('min', 4)
        max_weeks = range_config.get('max', 12)
        step = range_config.get('step', 1)
        return list(range(min_weeks, max_weeks + 1, step))
    
    return [8]  # Default


def sanitize_filename(name):
    """Convert template name to a safe filename."""
    return name.lower().replace(' ', '_').replace(':', '').replace('/', '-')


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate charts for all templates')
    parser.add_argument('--simulations', '-n', type=int, default=3000,
                        help='Number of simulations per chart (default: 3000)')
    parser.add_argument('--base-power', '-p', type=float, default=200,
                        help='Base power in watts (default: 200)')
    parser.add_argument('--output-dir', '-o', type=str, default='simulation_charts',
                        help='Output directory for charts (default: simulation_charts)')
    
    args = parser.parse_args()
    
    if not MATPLOTLIB_AVAILABLE:
        print("Error: matplotlib is required. Install with: pip install matplotlib")
        sys.exit(1)
    
    # Create output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True)
    
    print("=" * 70)
    print("BATCH CHART GENERATOR FOR CARDIOKINETIC")
    print("=" * 70)
    print(f"Simulations per chart: {args.simulations}")
    print(f"Base power: {args.base_power}W")
    print(f"Output directory: {output_dir}")
    print("=" * 70)
    
    charts_generated = 0
    total_charts = 0
    
    # Calculate total charts needed
    for template in PRESET_TEMPLATES:
        total_charts += len(get_week_variants(template))
    
    for template_path in EXAMPLE_TEMPLATES:
        if os.path.exists(template_path):
            template = parse_template(template_path)
            total_charts += len(get_week_variants(template))
    
    print(f"\nTotal charts to generate: {total_charts}")
    print("-" * 70)
    
    # Process preset templates
    print("\n[PRESET TEMPLATES]")
    for template in PRESET_TEMPLATES:
        variants = get_week_variants(template)
        template_name = template.get('name', 'Unknown')
        
        print(f"\n  {template_name}")
        print(f"    Variants: {variants} weeks")
        
        for num_weeks in variants:
            charts_generated += 1
            progress = f"[{charts_generated}/{total_charts}]"
            
            filename = f"{sanitize_filename(template_name)}_{num_weeks}w.png"
            output_path = output_dir / filename
            
            print(f"    {progress} Generating {num_weeks}-week chart...", end=" ", flush=True)
            
            try:
                results = run_monte_carlo(template, args.simulations, num_weeks, args.base_power)
                chart_title = f"{template_name} ({num_weeks} weeks)"
                plot_results(results, chart_title, str(output_path))
                print(f"✓ {filename}")
            except Exception as e:
                print(f"✗ Error: {e}")
    
    # Process example templates
    print("\n[EXAMPLE TEMPLATES]")
    for template_path in EXAMPLE_TEMPLATES:
        if not os.path.exists(template_path):
            print(f"\n  ⚠ Skipping {template_path} (not found)")
            continue
        
        template = parse_template(template_path)
        variants = get_week_variants(template)
        template_name = template.get('name', Path(template_path).stem)
        
        print(f"\n  {template_name}")
        print(f"    Source: {template_path}")
        print(f"    Variants: {variants} weeks")
        
        for num_weeks in variants:
            charts_generated += 1
            progress = f"[{charts_generated}/{total_charts}]"
            
            filename = f"{sanitize_filename(template_name)}_{num_weeks}w.png"
            output_path = output_dir / filename
            
            print(f"    {progress} Generating {num_weeks}-week chart...", end=" ", flush=True)
            
            try:
                results = run_monte_carlo(template, args.simulations, num_weeks, args.base_power)
                chart_title = f"{template_name} ({num_weeks} weeks)"
                plot_results(results, chart_title, str(output_path))
                print(f"✓ {filename}")
            except Exception as e:
                print(f"✗ Error: {e}")
    
    print("\n" + "=" * 70)
    print(f"COMPLETE! Generated {charts_generated} charts in '{output_dir}/'")
    print("=" * 70)
    
    # List all generated files
    print("\nGenerated files:")
    for f in sorted(output_dir.glob("*.png")):
        size_kb = f.stat().st_size / 1024
        print(f"  • {f.name} ({size_kb:.1f} KB)")


if __name__ == '__main__':
    main()
