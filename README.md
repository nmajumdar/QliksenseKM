# QliksenseKM
This is a Kaplan-Meier Chart for Qliksense. It includes censor marks and a tooltip that gives an overall summary of the status of each line, the amount of censors, and current state of each line.

# Usage
This KM curve relies on daily data. Input days as the dimension, censor data for each line consecutively, then line data consecutively in the same order as their censors. 

As an example, your dimensions/measures might look like this:
1. Dimension: Days
1. Measure: Censor1
2. Measure: Censor2
3. Measure: Censor3
4. Measure: Line1
5. Measure: Line2
6. Measure: Line3

You can modify how often the tooltip ticks will occur in the extensions settings. You can choose from a dropdown to have ticks be either daily, weekly, monthly or yearly.
