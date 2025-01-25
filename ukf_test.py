import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from filterpy.kalman import UnscentedKalmanFilter as UKF
from filterpy.kalman import MerweScaledSigmaPoints

# Store previous position, orientation, and time to calculate changes
previous_x = None
previous_y = None
previous_roll = 0
previous_pitch = 0
previous_yaw = 0


def map_flight_data_to_state(row, current_time):
    """Maps a row of flight data to the state vector used by the UKF."""
    global previous_x, previous_y, previous_roll, previous_pitch, previous_yaw, previous_time

    # Current position
    current_x = row['Position East of launch (ft)']
    current_y = row['Position North of launch (ft)']

    # If this is the first entry, initialize previous values
    if previous_x is None:
        previous_x = current_x
        previous_y = current_y
        previous_time = current_time

    # Compute time step (dt) from the difference in time values
    dt = float(current_time) - float(previous_time)  # Convert time values to floats
    if dt == 0:
        dt = 1e-5  # Prevent division by zero, if times are identical for some reason

    # Compute lateral accelerations based on changes in position
    lateral_acc_x = (current_x - previous_x) / dt ** 2  # Change in velocity over time
    lateral_acc_y = (current_y - previous_y) / dt ** 2

    # Update previous position and time for the next step
    previous_x = current_x
    previous_y = current_y
    previous_time = current_time

    # Integrate roll, pitch, and yaw from their respective rates
    roll_rate = row['Roll rate (r/s)']
    pitch_rate = row['Pitch rate (r/s)']
    yaw_rate = row['Yaw rate (r/s)']

    # Compute the orientation (roll, pitch, yaw) by integrating the rates over time
    roll = previous_roll + roll_rate * dt
    pitch = previous_pitch + pitch_rate * dt
    yaw = previous_yaw + yaw_rate * dt

    # Update previous orientation for the next step
    previous_roll = roll
    previous_pitch = pitch
    previous_yaw = yaw

    # Construct the state vector
    return np.array([
        current_x,  # X position
        current_y,  # Y position
        row['Altitude (ft)'],  # Z position
        row['Lateral velocity (ft/s)'],  # X velocity
        row['Lateral velocity (ft/s)'],  # Y velocity
        row['Vertical velocity (ft/s)'],  # Z velocity
        roll,  # Roll (radians)
        pitch,  # Pitch (radians)
        yaw,  # Yaw (radians)
        row['Vertical acceleration (ft/s²)'],  # Z acceleration
        lateral_acc_x,  # X acceleration
        lateral_acc_y,  # Y acceleration
        roll_rate,  # Roll rate
        pitch_rate,  # Pitch rate
        yaw_rate  # Yaw rate
    ])


# Define sigma points for the UKF
state_dim = 15  # x, y, z, vx, vy, vz, roll, pitch, yaw, ax, ay, az, wx, wy, wz
measurement_dim = 10  # x, y, z, altitude, ax, ay, az, wx, wy, wz
sigma_points = MerweScaledSigmaPoints(n=state_dim, alpha=0.1, beta=2.0, kappa=1.0)


# Define a simple identity function for state transition
def state_transition_function(x, dt):
    """State transition function that estimates rocket dynamics with total impulse."""
    g = 9.81  # Gravity (m/s^2)
    total_impulse = 2702.0  # Total impulse of the motor in Newton-seconds (your rocket)
    burn_time = 2.72  # Burn duration (seconds)
    initial_mass = 3.345  # Initial mass of the rocket (kg)
    final_mass = 1.945  # Mass of the rocket after fuel burn (kg)
    drag_coefficient = 0.586  # Drag coefficient

    # Calculate the current mass based on fuel burn during the burn phase
    if dt <= burn_time:
        mass = initial_mass - (initial_mass - final_mass) * (dt / burn_time)
    else:
        mass = final_mass  # After burnout, mass remains constant

    # Thrust smoothing: ramp up thrust during the first 0.2 seconds of burn
    if dt <= burn_time:
        if dt < 0.2:
            thrust_factor = dt / 0.2  # Linearly ramp thrust up to 100% in 0.2 seconds
        else:
            thrust_factor = 1.0
        average_thrust = (total_impulse / burn_time) * thrust_factor
        thrust_acceleration = average_thrust / mass  # Thrust acceleration (F = ma)
    else:
        thrust_acceleration = 0.0  # No thrust after burnout

    # State vector x contains:
    # [x_pos, y_pos, z_pos, x_vel, y_vel, z_vel, roll, pitch, yaw, ax, ay, az, wx, wy, wz]

    # Extract velocities
    x_vel = x[3]
    y_vel = x[4]
    z_vel = x[5]

    # Compute drag force, proportional to velocity squared
    speed = np.sqrt(x_vel ** 2 + y_vel ** 2 + z_vel ** 2)  # Total velocity magnitude
    drag_force = drag_coefficient * speed ** 2 if speed > 0 else 0

    # Net acceleration in the vertical direction (Z)
    if dt <= burn_time:
        z_acceleration = thrust_acceleration - g - drag_force  # Thrust - gravity - drag
    else:
        z_acceleration = -g - drag_force  # Gravity and drag after burnout

    # Altitude-dependent wind effects (increase wind noise as altitude increases)
    wind_acceleration_x = np.random.normal(0, 0.005 + 0.00005 * x[2])  # Wind noise in x direction
    wind_acceleration_y = np.random.normal(0, 0.005 + 0.00005 * x[2])  # Wind noise in y direction

    # Update position using velocity
    x[0] += x_vel * dt  # x position
    x[1] += y_vel * dt  # y position
    x[2] += z_vel * dt  # z position (altitude)

    # Update velocity using acceleration
    x[3] += wind_acceleration_x * dt  # x velocity (affected by wind)
    x[4] += wind_acceleration_y * dt  # y velocity (affected by wind)
    x[5] += z_acceleration * dt  # z velocity (affected by thrust, gravity, and drag)

    # Orientation (Euler angles): roll, pitch, yaw
    x[6] += x[12] * dt  # roll
    x[7] += x[13] * dt  # pitch
    x[8] += x[14] * dt  # yaw

    # Accelerations (the forces acting on the rocket in the x, y, z directions)
    x[9] = wind_acceleration_x  # Lateral acceleration x
    x[10] = wind_acceleration_y  # Lateral acceleration y
    x[11] = z_acceleration  # Vertical acceleration z (thrust, drag, gravity)

    return x


# Define a measurement function that maps the state to the measurement space
def measurement_function(x):
    """Measurement function to extract GPS and IMU measurements from the state vector."""
    # Extract the GPS position and IMU measurements from the state
    gps_position = x[0:3]  # Extract x, y, z (GPS position)
    altitude = np.array([x[2]])  # Altitude (z)
    acceleration = x[9:12]  # Acceleration (IMU data)
    orientation_rates = x[12:15]  # Roll, pitch, yaw rates (IMU data)

    # Return all measurements concatenated into one array
    return np.concatenate([gps_position, altitude, acceleration, orientation_rates])


# Load the CSV file for flight data
def load_flight_data(filepath):
    """Loads rocket flight data from a CSV file and handles NaN or inf values."""
    data = pd.read_csv(filepath)
    data = data.replace([np.inf, -np.inf], np.nan).fillna(0)  # Replace NaN/inf with 0 or reasonable values
    return data


# Initialize the UKF
ukf = UKF(dim_x=state_dim, dim_z=measurement_dim, fx=state_transition_function, hx=measurement_function, dt=0.1,
          points=sigma_points)
ukf.Q = np.diag([
    0.01, 0.01, 0.01,  # Position noise (X, Y, Z)
    0.005, 0.005, 0.01,  # Velocity noise (X, Y, Z)
    0.01, 0.01, 0.01,  # Orientation noise (roll, pitch, yaw)
    0.01, 0.01, 0.01,  # Acceleration noise (ax, ay, az)
    0.001, 0.001, 0.001  # Angular velocity noise (wx, wy, wz)
])

ukf.R = np.diag([1.0, 1.0, 1.0, 0.5, 0.1, 0.1, 0.1, 0.01, 0.01, 0.01])  # Measurement noise covariance matrix

# Load flight data from the CSV file
flight_data = load_flight_data('/home/jbbowen/test.csv')

# Extract initial state from the first row of the flight data
previous_time = flight_data.iloc[0]['Time (s)']  # Initialize the first time value
ukf.x = map_flight_data_to_state(flight_data.iloc[0], previous_time)
ukf.P *= 1  # Lowered the multiplication factor to avoid excessive values

# Store the true and estimated states for plotting
true_states = []
estimated_states = []

# Run the UKF with real flight data
for i, row in flight_data.iterrows():
    current_time = row['Time (s)']
    true_state = map_flight_data_to_state(row, current_time)  # True state from the CSV
    true_states.append(true_state)

    # Synthesize sensor measurements (GPS position and IMU data)
    z = np.array([row['Position East of launch (ft)'], row['Position North of launch (ft)'], row['Altitude (ft)'],
                  row['Altitude (ft)'], row['Vertical acceleration (ft/s²)'], 0, 0,
                  row['Roll rate (r/s)'], row['Pitch rate (r/s)'], row['Yaw rate (r/s)']])

    # UKF prediction and update step (now based on real flight data)
    ukf.predict()  # Using the identity state transition function
    ukf.update(z)

    # Update the roll, pitch, and yaw based on the integrated rates
    ukf.x[6] += row['Roll rate (r/s)'] * ukf._dt  # Integrate roll rate to get roll
    ukf.x[7] += row['Pitch rate (r/s)'] * ukf._dt  # Integrate pitch rate to get pitch
    ukf.x[8] += row['Yaw rate (r/s)'] * ukf._dt  # Integrate yaw rate to get yaw

    # Print true and estimated states for comparison
    print(f"Time: {current_time}s")
    print(f"True Position (X, Y, Z): {true_state[0]:.2f}, {true_state[1]:.2f}, {true_state[2]:.2f}")
    print(f"Estimated Position (X, Y, Z): {ukf.x[0]:.2f}, {ukf.x[1]:.2f}, {ukf.x[2]:.2f}")
    print(f"True Vertical Velocity: {true_state[5]:.2f}")
    print(f"Estimated Vertical Velocity: {ukf.x[5]:.2f}")
    print("-" * 40)

    estimated_states.append(ukf.x.copy())  # Store the estimated state

# Convert results to arrays for easy plotting
true_states = np.array(true_states)
estimated_states = np.array(estimated_states)

# Determine axis limits based on min and max values of X and Y
x_min, x_max = np.min(true_states[:, 0]), np.max(true_states[:, 0])
y_min, y_max = np.min(true_states[:, 1]), np.max(true_states[:, 1])

# Set limits such that both axes have the same range
xy_min = min(x_min, y_min)
xy_max = max(x_max, y_max)

# 3D Plot of the rocket's true and estimated positions
fig = plt.figure(figsize=(10, 7))
ax = fig.add_subplot(111, projection='3d')

# Plot the true positions (X, Y, Z)
ax.plot(true_states[:, 0], true_states[:, 1], true_states[:, 2], label='True position', color='b')

# Plot the estimated positions (X, Y, Z)
ax.plot(estimated_states[:, 0], estimated_states[:, 1], estimated_states[:, 2], label='UKF estimated position',
        color='r', linestyle='--')

# Set labels and title
ax.set_xlabel('X position (feet)')
ax.set_ylabel('Y position (feet)')
ax.set_zlabel('Z position (feet)')
ax.set_title('Rocket Position: True vs UKF Estimated (3D View)')

# Set equal limits for X and Y axes
ax.set_xlim(xy_min, xy_max)
ax.set_ylim(xy_min, xy_max)

# Show the plot
ax.legend()
plt.show()
