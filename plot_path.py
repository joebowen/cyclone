import json
from ssl import ALERT_DESCRIPTION_BAD_CERTIFICATE_STATUS_RESPONSE
import matplotlib as mpl
mpl.use('Agg')  # Use Agg backend for non-interactive plots
mpl.rcParams['agg.path.chunksize'] = 10000
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from mpl_toolkits.mplot3d import Axes3D, art3d
import numpy as np
from stl import mesh
import click
import os
from scipy.interpolate import interp1d, CubicSpline
import pandas as pd
from concurrent.futures import ThreadPoolExecutor
import pyvista as pv

# Load the geodesic path from the JSON file
def load_json_file(input_file):
    with open(input_file) as f:
        geodesic_path = json.load(f)
    return geodesic_path

# Function to parse G-code
def parse_gcode(file_path):
    print(f"Parsing G-code file: {file_path}")  # Debugging output
    x_coords = []  # X-axis
    y_coords = []  # Y-axis
    z_coords = []  # Z-axis
    a_coords = []  # A-axis
    gcode_texts = []  # List to store G-code text for each data point
    current_x = current_y = current_z = current_a = 0.0
    with open(file_path, 'r') as file:
        for line in file:
            if line.startswith('G0') or line.startswith('G1'):
                parts = line.split()
                for part in parts:
                    if part.startswith('X'):
                        current_x = float(part[1:])
                    elif part.startswith('Y'):
                        current_y = float(part[1:])
                    elif part.startswith('Z'):
                        current_z = float(part[1:])
                    elif part.startswith('A'):
                        current_a = float(part[1:])
                        if current_a < a_coords[-1]:
                            current_a = a_coords[-1] + (current_a - (a_coords[-1] % 360))
                            print(f"Debug: Adjusted A angle: {current_a}")
                x_coords.append(current_x)
                y_coords.append(current_y)
                z_coords.append(current_z)
                a_coords.append(current_a)
                gcode_texts.append(line.strip())  # Store the G-code line text
            elif line.startswith('G92'):
                parts = line.split()
                for part in parts:
                    if part.startswith('X'):
                        current_x = float(part[1:])
                    elif part.startswith('Y'):
                        current_y = float(part[1:])
                    elif part.startswith('Z'):
                        current_z = float(part[1:])
                    elif part.startswith('A'):
                        current_a = float(part[1:])
                # Do not append these to the coordinate lists
                continue
    return np.array(x_coords), np.array(y_coords), np.array(z_coords), np.array(a_coords), gcode_texts

# Interpolate the parsed G-code path
# Use cubic splines for smoother interpolation
def interpolate_path(X, Y, Z, A, gcode_texts, point_multiplier=10):
    print(f"Debug: Lengths before interpolation - X: {len(X)}, Y: {len(Y)}, Z: {len(Z)}, G-code: {len(gcode_texts)}")
    # Create a linear space for interpolation
    t = np.linspace(0, 1, num=len(X))
    t_interp = np.linspace(0, 1, num=point_multiplier*len(X))

    # Use cubic splines to interpolate each axis
    cs_x = CubicSpline(t, X)
    cs_y = CubicSpline(t, Y)
    cs_z = CubicSpline(t, Z)
    # Ensure A is treated as a continuous increasing value
    A_continuous = np.unwrap(np.radians(A))  # Convert to radians and unwrap to handle discontinuities
    cs_a = CubicSpline(t, A_continuous)

    # Evaluate the splines on the interpolation space
    X_interp = cs_x(t_interp)
    Y_interp = cs_y(t_interp)
    Z_interp = cs_z(t_interp)
    A_interp = np.degrees(cs_a(t_interp))  # Convert back to degrees

    # Interpolate G-code texts
    gcode_texts_interp = []
    for i in range(len(t_interp)):
        idx = min(int(np.floor(t_interp[i] * (len(gcode_texts))) - 1), len(gcode_texts) - 1)
        gcode_texts_interp.append(gcode_texts[idx])

    print(f"Debug: Lengths after interpolation - X: {len(X_interp)}, Y: {len(Y_interp)}, Z: {len(Z_interp)}, G-code: {len(gcode_texts_interp)}")
    return X_interp, Y_interp, Z_interp, A_interp, gcode_texts_interp

# Interpolate changes in the A-axis greater than 10 degrees
def interpolate_large_angle_changes(X, Y, Z, A, gcode_texts, max_angle_change=1):
    new_X, new_Y, new_Z, new_A, new_gcode_texts = [X[0]], [Y[0]], [Z[0]], [A[0]], [gcode_texts[0]]
    print(f"Debug: Lengths before large angle interpolation - X: {len(X)}, Y: {len(Y)}, Z: {len(Z)}, G-code: {len(gcode_texts)}")
    for i in range(1, len(A)):
        if A[i] < A[i - 1]:
            A[i] = A[i - 1] + (A[i] - (A[i - 1] % 360))
            print(f"Debug: Adjusted A angle: {A[i]}")
        angle_change = abs(A[i] - A[i - 1])
        if angle_change > max_angle_change:
            num_points = int(angle_change // max_angle_change) + 1
            interp_angles = np.linspace(A[i - 1], A[i], num=num_points)
            interp_X = np.linspace(X[i - 1], X[i], num=num_points)
            interp_Y = np.linspace(Y[i - 1], Y[i], num=num_points)
            interp_Z = np.linspace(Z[i - 1], Z[i], num=num_points)
            interp_gcode_texts = [gcode_texts[i]] * (num_points - 1) + [gcode_texts[i]]
            new_X.extend(interp_X[1:])
            new_Y.extend(interp_Y[1:])
            new_Z.extend(interp_Z[1:])
            new_A.extend(interp_angles[1:])
            new_gcode_texts.extend(interp_gcode_texts[1:])
        else:
            new_X.append(X[i])
            new_Y.append(Y[i])
            new_Z.append(Z[i])
            new_A.append(A[i])
            new_gcode_texts.append(gcode_texts[i])
    print(f"Debug: Lengths after large angle interpolation - X: {len(new_X)}, Y: {len(new_Y)}, Z: {len(new_Z)}, G-code: {len(new_gcode_texts)}")
    return new_X, new_Y, new_Z, new_A, new_gcode_texts

# Reduce the number of data points by removing those with a distance less than 0.1
def reduce_data_points(HEAD, Y, Z, A, gcode_texts, linear_threshold=0.1, angular_threshold=0.1):
    reduced_HEAD, reduced_Y, reduced_Z, reduced_A = [HEAD[0]], [Y[0]], [Z[0]], [A[0]]
    reduced_gcode_texts = [gcode_texts[0]]
    
    for i in range(1, len(HEAD)):
        # Calculate the angular distance for HEAD and A
        angular_distance_HEAD = min(abs(HEAD[i] - reduced_HEAD[-1]), 360 - abs(HEAD[i] - reduced_HEAD[-1]))
        angular_distance_A = min(abs(A[i] - reduced_A[-1]), 360 - abs(A[i] - reduced_A[-1]))
        
        # Calculate the linear distance for Y and Z
        distance_Y = abs(Y[i] - reduced_Y[-1])
        distance_Z = abs(Z[i] - reduced_Z[-1])

        if gcode_texts[i] != reduced_gcode_texts[-1] or distance_Y >= linear_threshold or distance_Z >= linear_threshold or angular_distance_HEAD >= angular_threshold or angular_distance_A >= angular_threshold:
            reduced_HEAD.append(HEAD[i])
            reduced_Y.append(Y[i])
            reduced_Z.append(Z[i])
            reduced_A.append(A[i])
            reduced_gcode_texts.append(gcode_texts[i])
    
    print(f"Debug: Lengths after data point reduction - X: {len(reduced_HEAD)}, Y: {len(reduced_Y)}, Z: {len(reduced_Z)}, G-code: {len(reduced_gcode_texts)}")

    return reduced_HEAD, reduced_Y, reduced_Z, reduced_A, reduced_gcode_texts

# Calculate tangent vectors
def calculate_tangent_vector(path, i):
    if i == 0:
        tangent = [
            path[i + 1][0] - path[i][0],
            path[i + 1][1] - path[i][1],
            path[i + 1][2] - path[i][2]
        ]
    elif i == len(path) - 1:
        tangent = [
            path[i][0] - path[i - 1][0],
            path[i][1] - path[i - 1][1],
            path[i][2] - path[i - 1][2]
        ]
    else:
        tangent = [
            (path[i + 1][0] - path[i - 1][0]) / 2,
            (path[i + 1][1] - path[i - 1][1]) / 2,
            (path[i + 1][2] - path[i - 1][2]) / 2
        ]

    magnitude = np.sqrt(tangent[0] ** 2 + tangent[1] ** 2 + tangent[2] ** 2)
    return [tangent[0] / magnitude, tangent[1] / magnitude, tangent[2] / magnitude]

# Calculate normal vectors
def calculate_normal_vector(x, y, z, X, Y, Z):
    epsilon = 1e-5

    def interpolate_value(axis, y):
        if y <= Y[0]:
            return axis[0]
        if y >= Y[-1]:
            return axis[-1]

        for i in range(len(Y) - 1):
            if Y[i] <= y <= Y[i + 1]:
                t = (y - Y[i]) / (Y[i + 1] - Y[i])
                return axis[i] + t * (axis[i + 1] - axis[i])
        return np.nan

    def interpolate_derivative(axis, y):
        return (interpolate_value(axis, y + epsilon) - interpolate_value(axis, y - epsilon)) / (2 * epsilon)

    dx_dy = interpolate_derivative(X, y)
    dy_dy = interpolate_derivative(Y, y)
    dz_dy = interpolate_derivative(Z, y)

    normal_x = dx_dy
    normal_y = -dy_dy
    normal_z = dz_dy
    magnitude = np.sqrt(normal_x**2 + normal_y**2 + normal_z**2)

    return [normal_x / magnitude, normal_y / magnitude, normal_z / magnitude]

# Calculate wind angle vectors
def calculate_wind_angle_vector(tangent, normal):
    dot_product = np.dot(tangent, normal)
    magnitude_tangent = np.linalg.norm(tangent)
    magnitude_normal = np.linalg.norm(normal)
    cos_angle = dot_product / (magnitude_tangent * magnitude_normal)
    angle = np.arccos(cos_angle)
    wind_angle_vector = np.cross(tangent, normal)
    wind_angle_vector /= np.linalg.norm(wind_angle_vector)
    wind_angle_vector *= angle
    return wind_angle_vector

# Function to compute data for a single frame
def compute_frame_data(num, X, Y, Z, HEAD, step_size, gcode_texts, stl_mesh, total_frames_with_extra):
    frame_index = min(num * step_size, len(X) - 1)
    angle = np.arctan2(Z[frame_index], X[frame_index]) - np.pi / 2
    cos_angle = np.cos(angle)
    sin_angle = np.sin(angle)
    rotation_matrix = np.array([
        [cos_angle, 0, sin_angle],
        [0, 1, 0],
        [-sin_angle, 0, cos_angle]
    ])
    start_index = 0
    end_index = frame_index + 1
    rotated_points = np.dot(rotation_matrix, np.array([X[start_index:end_index], Y[start_index:end_index], Z[start_index:end_index]]))
    X_rotated, Y_rotated, Z_rotated = rotated_points

    # Apply rotation to STL mesh around the Y-axis
    stl_rotation_matrix = np.array([
        [np.cos(-angle), 0, np.sin(-angle)],
        [0, 1, 0],
        [-np.sin(-angle), 0, np.cos(-angle)]
    ])
    rotated_vectors = np.dot(stl_mesh.vectors.reshape(-1, 3), stl_rotation_matrix).reshape(stl_mesh.vectors.shape)

    return X_rotated, Y_rotated, Z_rotated, HEAD[frame_index], gcode_texts[frame_index], rotated_vectors

@click.command()
@click.argument('input_files', nargs=-1)
@click.option('--max-angle-change', default=1, help='Maximum angle change for interpolation.')
@click.option('--max-linear-change', default=0.1, help='Maximum linear change for data point reduction.')
@click.option('--fiber-width', default=1, help='Width of the fiber.')
@click.option('--output', default='output.mp4', help='Output video file name.')
@click.option('--fps', default=30, help='Frames per second for the output video.')
@click.option('--total-time', default=10, help='Total time for the video in seconds.')
@click.option('--stl-file', default='examples/nose_cone.stl', help='STL file for 3D rendering.')
def plot_path(input_files, max_angle_change, max_linear_change, fiber_width, output, fps, total_time, stl_file):
    fig = plt.figure(figsize=(18, 6))
    ax = fig.add_subplot(131, projection='3d')
    ax_top_down = fig.add_subplot(132, projection='3d')
    ax_front_view = fig.add_subplot(133, projection='3d')

    all_X, all_Y, all_Z = [], [], []

    # Load and simplify STL model
    pv_mesh = pv.read(stl_file)
    simplified_mesh = pv_mesh.decimate_pro(0.1)
    stl_mesh = mesh.Mesh(np.zeros(simplified_mesh.n_faces, dtype=mesh.Mesh.dtype))
    for i, face in enumerate(simplified_mesh.faces.reshape(-1, 4)[:, 1:]):
        for j in range(3):
            stl_mesh.vectors[i][j] = simplified_mesh.points[face[j]]

    print(f'Debug: Length after decimation: {len(stl_mesh.vectors)}')

    stl_collection_main = art3d.Poly3DCollection([], facecolors='grey', linewidth=0.005, edgecolors='grey', alpha=0.5)
    stl_collection_top_down = art3d.Poly3DCollection([], facecolors='grey', linewidth=0.005, edgecolors='grey', alpha=0.5)
    stl_collection_front_view = art3d.Poly3DCollection([], facecolors='grey', linewidth=0.005, edgecolors='grey', alpha=0.5)

    ax.add_collection3d(stl_collection_main)
    ax_top_down.add_collection3d(stl_collection_top_down)
    ax_front_view.add_collection3d(stl_collection_front_view)

    ax_top_down.view_init(elev=90, azim=0)
    ax_top_down.set_title('Top Down View')
    ax_front_view.view_init(elev=0, azim=90)
    ax_front_view.set_title('Front View')

    for input_file in input_files:
        file_extension = os.path.splitext(input_file)[1].lower()
        if file_extension == '.json':
            geodesic_path = load_json_file(input_file)
            X = [point[0] for point in geodesic_path]
            Y = [point[1] for point in geodesic_path]
            Z = [point[2] for point in geodesic_path]
        elif file_extension in ['.nc', '.gcode']:
            HEAD, Y, Z, A, gcode_texts = parse_gcode(input_file)
            HEAD, Y, Z, A, gcode_texts = interpolate_large_angle_changes(HEAD, Y, Z, A, gcode_texts, max_angle_change)
            # HEAD, Y, Z, A, gcode_texts = interpolate_path(HEAD, Y, Z, A, gcode_texts, point_multiplier=10)
            HEAD, Y, Z, A, gcode_texts = reduce_data_points(HEAD, Y, Z, A, gcode_texts, linear_threshold=max_linear_change, angular_threshold=max_angle_change)
            # Calculate X and Z for cylindrical representation using interpolated Z as radius
            X_transformed = Z * np.cos(np.radians(A))
            Z_transformed = Z * np.sin(np.radians(A))
            # Store transformed values
            X, Z = X_transformed, Z_transformed
            # Ensure all transformed Z values are appended
            all_Z.extend(Z_transformed)
            all_Y.extend(Y)
        else:
            raise ValueError('Unsupported file type. Please provide a JSON or G-code file.')

        print(f"Data for {input_file}: X range = {min(X)} to {max(X)}, Y range = {min(Y)} to {max(Y)}, Z range = {min(Z)} to {max(Z)}")

        all_X.extend(X)
        all_Y.extend(Y)
        all_Z.extend(Z)

        line, = ax.plot([], [], [], label=f'Path from {os.path.basename(input_file)}', linewidth=fiber_width)
        line_top_down, = ax_top_down.plot([], [], [], label=f'Top-Down Path from {os.path.basename(input_file)}', linewidth=fiber_width)
        line_front_view, = ax_front_view.plot([], [], [], label=f'Front View Path from {os.path.basename(input_file)}', linewidth=fiber_width)
        # Initialize the arrow for the newest point
        arrow = ax.quiver([], [], [], [], [], [], color='r', length=20, linewidth=100, normalize=False)
        arrow_top_down = ax_top_down.quiver([], [], [], [], [], [], color='r', length=20, linewidth=100, normalize=False)
        arrow_front_view = ax_front_view.quiver([], [], [], [], [], [], color='r', length=20, linewidth=100, normalize=False)

        # Add a separate axes for the G-code text at the bottom
        fig.subplots_adjust(bottom=0.15)  # Adjust the bottom to make space for the text
        text_ax = fig.add_axes([0.1, 0.02, 0.8, 0.05])
        text_ax.axis('off')  # Hide the axis
        text = text_ax.text(0.5, 0.5, '', ha='center', va='center', fontsize=10)

        total_frames = fps * total_time
        step_size = max(1, len(X) // total_frames)

        extra_frames = fps * 10  # 30 seconds of extra frames
        total_frames_with_extra = total_frames + extra_frames

        def update(num, line, arrow, line_top_down, arrow_top_down, line_front_view, arrow_front_view, text):
            X_rotated, Y_rotated, Z_rotated, angle, gcode_text, rotated_vectors = compute_frame_data(num, X, Y, Z, HEAD, step_size, gcode_texts, stl_mesh, total_frames_with_extra)
            
            # Update the STL mesh display for each axis
            stl_collection_main.set_verts(rotated_vectors)
            stl_collection_top_down.set_verts(rotated_vectors)
            stl_collection_front_view.set_verts(rotated_vectors)

            # Update other plot elements as needed
            line.set_data(X_rotated, Y_rotated)
            line.set_3d_properties(Z_rotated)
            line_top_down.set_data(X_rotated, Y_rotated)
            line_top_down.set_3d_properties(Z_rotated)
            line_front_view.set_data(X_rotated, Y_rotated)
            line_front_view.set_3d_properties(Z_rotated)
            dx = np.cos(np.deg2rad(angle))
            dy = np.sin(np.deg2rad(angle))
            dz = 0
            arrow.set_segments([[[X_rotated[-1], Y_rotated[-1], Z_rotated[-1]],
                                [X_rotated[-1] + dx, Y_rotated[-1] + dy, Z_rotated[-1] + dz]]])
            arrow_top_down.set_segments([[[X_rotated[-1], Y_rotated[-1], Z_rotated[-1]],
                                [X_rotated[-1] + dx, Y_rotated[-1] + dy, Z_rotated[-1] + dz]]])
            arrow_front_view.set_segments([[[X_rotated[-1], Y_rotated[-1], Z_rotated[-1]],
                                [X_rotated[-1] + dx, Y_rotated[-1] + dy, Z_rotated[-1] + dz]]])
            text.set_text(f'G-code: {gcode_text}')
            ax.view_init(elev=20., azim=num * 360 / total_frames_with_extra * 1)  # Rotate the camera around the plot
            ax_top_down.view_init(elev=90., azim=0)  # Top-down view
            ax_front_view.view_init(elev=0, azim=90)  # Front view
            print(f"Debug: Frame / Total Frames: {num} / {total_frames_with_extra} - % complete: {num / total_frames_with_extra * 100}")

            return line, arrow, line_top_down, arrow_top_down, line_front_view, arrow_front_view, text

        ani = animation.FuncAnimation(fig, update, frames=total_frames_with_extra, fargs=(line, arrow, line_top_down, arrow_top_down, line_front_view, arrow_front_view, text), blit=False)

    print(f"Overall X range = {min(all_X)} to {max(all_X)}, Y range = {min(all_Y)} to {max(all_Y)}, Z range = {min(all_Z)} to {max(all_Z)}")

    ax.set_xlim(min(all_X), max(all_X))
    ax.set_ylim(min(all_Y), max(all_Y))
    ax.set_zlim(min(all_Z), max(all_Z))

    ax.set_xlabel('X')
    ax.set_ylabel('Y')
    ax.set_zlabel('Z')
    ax.set_title('3D Path Plot')
    plt.legend()

    ax_top_down.set_xlim(min(all_X), max(all_X))
    ax_top_down.set_ylim(min(all_Y), max(all_Y))
    ax_top_down.set_zlim(min(all_Z), max(all_Z))

    ax_top_down.set_xlabel('X')
    ax_top_down.set_ylabel('Y')
    ax_top_down.set_zlabel('Z')
    ax_top_down.set_title('Top-Down View')

    ax_front_view.set_xlim(min(all_X), max(all_X))
    ax_front_view.set_ylim(min(all_Y), max(all_Y))
    ax_front_view.set_zlim(min(all_Z), max(all_Z))

    ax_front_view.set_xlabel('X')
    ax_front_view.set_ylabel('Y')
    ax_front_view.set_zlabel('Z')
    ax_front_view.set_title('Front View')

    try:
        ani.save(output, writer='ffmpeg', fps=fps)
        print(f"Animation saved successfully to {output}")  # Debugging output
    except Exception as e:
        print(f"Error saving animation: {e}")  # Debugging output

    # plt.show()    
    plt.close(fig)  # Close the plot to release resources

if __name__ == '__main__':
    plot_path()
