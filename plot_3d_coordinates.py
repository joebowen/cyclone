import json
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

# Load the coordinates from the JSON file
with open('coordinates.json') as f:
    data = json.load(f)

X = data['X']
Y = data['Y']
Z = data['Z']

# Create a 3D plot
fig = plt.figure()
ax = fig.add_subplot(111, projection='3d')

# Plot the points
ax.scatter(X, Y, Z, c='r', marker='o')

ax.set_xlabel('X Label')
ax.set_ylabel('Y Label')
ax.set_zlabel('Z Label')

# Save the plot as an image
plt.savefig('3d_plot.png')

# Show the plot
plt.show()
