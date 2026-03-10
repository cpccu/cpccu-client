# Authentication Flow

## Current Implementation
The current authentication system is a **UI-based simulation**. Users can access the Login and Signup pages, enter credentials, and navigate through the flows.

### Flows
- **Login**: `src/components/LOGINSIGNUP/Login.jsx`
- **Signup**: `src/components/LOGINSIGNUP/Signup.jsx`

## Security Practices (Frontend-Only)
- **Controlled Components**: All form inputs are managed via React state.
- **Validation**: Basic frontend validation for required fields (simulated).
- **Navigation Protection**: Currently, routes are open for demonstration. Future implementation will include `ProtectedRoutes` based on auth state.

## Planned Features
- Integration with JWT-based backend.
- Local Storage / Session Storage for persistence.
- Role-based access control (RBAC) based on user roles (Admin, Student, etc.).
