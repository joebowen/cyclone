import math
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D


def calculateRDoublePrime(r, r_prime, beta, r_p, gamma, e, z):
    """
    Calculate the second derivative of r with respect to z (r'') based on
    Equation 48 from the paper.

    Args:
        r (float): Current radius.
        r_prime (float): First derivative of the radius with respect to z.
        beta (float): Current winding angle beta.
        r_p (float): Polar radius (radius at the polar hole).
        gamma (float): Winding angle gamma.
        e (float): Eccentricity.
        z (float): Current axial position.

    Returns:
        float: The calculated second derivative of r with respect to z.
    """
    tan_gamma = math.tan(gamma)
    numerator = r * tan_gamma - r_prime * z * tan_gamma + e
    denominator = math.sqrt(1 + r_prime ** 2)

    sqrt_term = math.sqrt(r ** 2 - (z * tan_gamma) + e ** 2)
    denominator_2 = r ** 2 - r_p ** 2

    r_double_prime = (numerator / denominator) * (sqrt_term / denominator_2) ** 2

    return r_double_prime


def runge_kutta_step(r, r_prime, beta, step_size, r_p, gamma, e, z):
    def dr_double_prime(r, r_prime):
        return calculateRDoublePrime(r, r_prime, beta, r_p, gamma, e, z)

    # k1 values
    k1_r_prime = r_prime
    k1_r_double_prime = dr_double_prime(r, r_prime)

    # k2 values
    k2_r_prime = r_prime + 0.5 * step_size * k1_r_double_prime
    k2_r_double_prime = dr_double_prime(r + 0.5 * step_size * k1_r_prime, k2_r_prime)

    # k3 values
    k3_r_prime = r_prime + 0.5 * step_size * k2_r_double_prime
    k3_r_double_prime = dr_double_prime(r + 0.5 * step_size * k2_r_prime, k3_r_prime)

    # k4 values
    k4_r_prime = r_prime + step_size * k3_r_double_prime
    k4_r_double_prime = dr_double_prime(r + step_size * k3_r_prime, k4_r_prime)

    # Update r_prime and r using the RK4 method
    r_prime_new = r_prime + (step_size / 6.0) * (
                k1_r_double_prime + 2 * k2_r_double_prime + 2 * k3_r_double_prime + k4_r_double_prime)
    r_new = r - (step_size / 6.0) * (k1_r_prime + 2 * k2_r_prime + 2 * k3_r_prime + k4_r_prime)

    return r_new, r_prime_new


def solve_geodesic_dome_meridian_profile(params):
    r = params['r_initial']
    r_p = params['r_p']
    gamma = params['gamma']
    e = params['e']
    step_size = params['step_size']
    r_final = params['r_p']
    num_points = params['num_points']

    z_final = r - r_final
    z_values = np.linspace(0, z_final, num_points)

    r_prime = 0
    beta = gamma  # Using gamma as an initial approximation for beta
    theta = 0

    profile = [{'z': 0, 'r': r, 'beta': beta, 'theta': theta}]

    for z in z_values:
        r, r_prime = runge_kutta_step(r, r_prime, beta, step_size, r_p, gamma, e, z)
        dtheta_dz = calculate_dtheta_dz(r, r_prime, theta, gamma)
        theta += dtheta_dz * step_size

        profile.append({'z': z, 'r': r, 'beta': beta, 'theta': theta})

    # Validation: Check min and max radius in the profile
    r_values = [point['r'] for point in profile]
    max_radius = max(r_values)
    min_radius = min(r_values)

    print(f"Max radius in profile: {max_radius}, Expected: {params['r_initial']}")
    print(f"Min radius in profile: {min_radius}, Expected: {params['r_p']}")

    return profile


def calculate_dtheta_dz(r, r_prime, theta, gamma):
    """
    Calculate the derivative of theta with respect to z (dtheta/dz).

    Args:
        r (float): Current radius.
        r_prime (float): First derivative of the radius with respect to z.
        theta (float): Current angle theta.
        gamma (float): Winding angle gamma.

    Returns:
        float: The calculated dtheta/dz value.
    """
    numerator = math.tan(gamma) * math.cos(theta) - r_prime * math.sin(theta)
    denominator = r * math.cos(theta)
    return numerator / denominator


def create_3d_hemispherical_dome_surface(r_initial, r_final, num_points):
    # Height of the dome (z_final)
    z_final = r_initial - r_final

    # Generate z values from 0 (flat top) to z_final (flat bottom)
    z = np.linspace(0, z_final, num_points)

    # Adjust r as a function of z to create a dome shape
    r = r_final + (r_initial - r_final) * np.sqrt(1 - (z / z_final) ** 2)

    # Generate theta values from 0 to 2*pi
    theta = np.linspace(0, 2 * np.pi, num_points)

    # Create a meshgrid for r and theta
    z, theta = np.meshgrid(z, theta)

    # Compute x and y using the parametric equations
    x = r * np.cos(theta)
    y = r * np.sin(theta)

    return x, y, z

def set_axes_equal(ax):
    """Set 3D plot axes to equal scale.

    This makes the aspect ratio of the 3D plot equal along all three axes.
    """
    x_limits = ax.get_xlim3d()
    y_limits = ax.get_ylim3d()
    z_limits = ax.get_zlim3d()

    x_range = abs(x_limits[1] - x_limits[0])
    y_range = abs(y_limits[1] - y_limits[0])
    z_range = abs(z_limits[1] - z_limits[0])

    x_middle = np.mean(x_limits)
    y_middle = np.mean(y_limits)
    z_middle = np.mean(z_limits)

    # The plot range for each axis
    plot_radius = 0.5 * max([x_range, y_range, z_range])

    ax.set_xlim3d([x_middle - plot_radius, x_middle + plot_radius])
    ax.set_ylim3d([y_middle - plot_radius, y_middle + plot_radius])
    ax.set_zlim3d([z_middle - plot_radius, z_middle + plot_radius])

def plot_3d_dome_with_winding(profile, r_initial, r_final, num_points):
    fig = plt.figure(figsize=(10, 8))
    ax = fig.add_subplot(111, projection='3d')

    z_values = np.array([point['z'] for point in profile])
    theta_values = np.array([point['theta'] for point in profile])
    r_values = np.array([point['r'] for point in profile])
    x_values = r_values * np.cos(theta_values)
    y_values = r_values * np.sin(theta_values)

    ax.plot(z_values, x_values, y_values, marker='o', color='red', label='Winding Path')

    x_dome, y_dome, z_dome = create_3d_hemispherical_dome_surface(r_initial, r_final, num_points)
    ax.plot_surface(z_dome, x_dome, y_dome, color='blue', alpha=0.3, rstride=5, cstride=5)

    ax.set_title('3D Dome with Winding Path')
    ax.set_xlabel('Axial Coordinate (z)')
    ax.set_ylabel('X Coordinate')
    ax.set_zlabel('Y Coordinate')
    ax.legend()

    # Set the aspect ratio of the plot to be equal
    set_axes_equal(ax)

    plt.show()


def design_geodesic_composite_vessel(params):
    try:
        profile = solve_geodesic_dome_meridian_profile(params)
        plot_3d_dome_with_winding(profile, params['r_initial'], params['r_p'],  params['num_dome_points'])
        return {'profile': profile, 'success': True}
    except ValueError as error:
        return {'error': str(error), 'success': False}

# Example parameters (adjust these as needed for testing)
params = {
    'r_initial': 1.0,
    'r_p': 0.4,  # Polar radius
    'gamma': math.pi / 10,  # Winding angle
    'e': 0.2,  # Eccentricity
    'step_size': 0.001,
    'num_points': 1000,
    'num_dome_points': 100
}

result = design_geodesic_composite_vessel(params)
print(result)
