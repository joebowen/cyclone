import json
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import numpy as np

# Load the geodesic path from the JSON file
with open('geodesic_path.json') as f:
    geodesic_path = json.load(f)

X = [point[0] for point in geodesic_path]
Y = [point[1] for point in geodesic_path]
Z = [point[2] for point in geodesic_path]

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

# Create a 3D plot
fig = plt.figure()
ax = fig.add_subplot(111, projection='3d')

# Plot the points
ax.plot(X, Y, Z, c='r')

# Add arrows for tangent, normal, and wind angle vectors
for i in range(len(geodesic_path)):
    tangent = calculate_tangent_vector(geodesic_path, i)
    normal = calculate_normal_vector(X[i], Y[i], Z[i], X, Y, Z)
    wind_angle_vector = calculate_wind_angle_vector(tangent, normal)

    print(wind_angle_vector)

    ax.quiver(X[i], Y[i], Z[i], tangent[0], tangent[1], tangent[2], color='b', length=5, normalize=True)
    ax.quiver(X[i], Y[i], Z[i], normal[0], normal[1], normal[2], color='g', length=5, normalize=True)
    ax.quiver(X[i], Y[i], Z[i], wind_angle_vector[0], wind_angle_vector[1], wind_angle_vector[2], color='m', length=5, normalize=True)

ax.set_xlabel('X Label')
ax.set_ylabel('Y Label')
ax.set_zlabel('Z Label')

# Save the plot as an image
plt.savefig('geodesic_plot_with_vectors.png')

# Show the plot
plt.show()
