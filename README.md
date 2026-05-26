# CPCCU - Competitive Programming Camp City University

The official web portal for the Competitive Programming Camp at City University. This platform facilitates community engagement, member management, and certificate verification.

[Live View](https://cpccu.club/)

## 🚀 Features

*   **Member Management**: Profiles for club members with skill tracking and academic details.
*   **Authentication**: Secure login and registration with email OTP verification.
*   **Certificate System**: Robust verification system for club-issued certificates.
*   **Dynamic Content**: Blog posts, event galleries, and contributor recognition.
*   **Responsive UI**: Optimized for all devices using Tailwind CSS and Framer Motion.
*   **Modern Stack**: Built with Next.js 15, React 19, and Redux Toolkit.

## 🛠️ Tech Stack

*   **Frontend**: Next.js (App Router), React, Tailwind CSS
*   **State**: Redux Toolkit, RTK Query
*   **Animations**: Framer Motion
*   **Icons**: FontAwesome, Lucide React
*   **Package Manager**: npm / Bun

## 📂 Project Structure

For a detailed explanation of the architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## 🚦 Getting Started

### Prerequisites

*   Node.js (v18+)
*   npm or [Bun](https://bun.sh/)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/cpccu/cpccu-client.git
    cd cpccu-client
    ```

2.  Install dependencies:
    ```bash
    npm install
    # OR
    bun install
    ```

3.  Set up environment variables:
    Create a `.env` file in the root directory:
    ```env
    NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
    ```

### Running the Project

*   **Development Mode**:
    ```bash
    npm run dev
    # OR
    bun run dev
    ```
*   **Production Build**:
    ```bash
    npm run build
    npm run start
    ```

## 📖 Documentation

*   [Architecture Overview](./ARCHITECTURE.md) - Deep dive into folder structure and data flow.
*   [API Documentation](./API_DOCUMENTATION.md) - List of all integrated endpoints and data models.

## 🤝 Contributing

We welcome contributions! Please follow these steps:
1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

This project is licensed under the ISC License.

---
Developed with ❤️ by the **OSSCCU Team**.
