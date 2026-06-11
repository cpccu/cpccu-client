# CPCCU - Competitive Programming Camp City University

The official web portal for the Competitive Programming Camp at City University. This platform supports community engagement, member management, public content publishing, and certificate verification.

[Live View](https://cpccu.club/)

## 🚀 Features

*   **Member Management**: Profiles for club members with skill tracking, academic details, and admin-managed records.
*   **Authentication**: Login, registration, OTP verification, password reset, and persistent session hydration with email OTP verification.
*   **Certificate System**: Public and authenticated certificate verification flows.
*   **Dynamic Content**: Blog posts, event pages, galleries, contributors, donators, and public site content.
*   **Admin Dashboard**: Content, members, certificates, statistics, settings, and audit-focused management views.
*   **Responsive UI**: Optimized for desktop and mobile using Tailwind CSS, Framer Motion, and Radix UI primitives.
*   **Modern Stack**: Built with Next.js 16, React 19, Redux Toolkit, RTK Query, and Tailwind CSS 4.

## 🛠️ Tech Stack

*   **Frontend**: Next.js App Router, React 19, Tailwind CSS 4
*   **State**: Redux Toolkit, RTK Query
*   **UI Primitives**: Radix UI
*   **Animations**: Framer Motion
*   **Icons**: FontAwesome, Lucide React, React Icons
*   **Validation**: Zod
*   **Package Manager**: npm / Bun


## 📂 Project Structure

For a detailed explanation of the architecture, see [ARCHITECTURE.md](./DOCUMENTATION\ARCHITECTURE.md).

## 🚦 Getting Started

### Prerequisites

*   Node.js (v18+ recommended)
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
    # OR
    bun run build
    bun run start
    ```

## 📖 Documentation

*   [Architecture Overview](./DOCUMENTATION/ARCHITECTURE.md) - Deep dive into folder structure, routing, and data flow.
*   [API Documentation](./DOCUMENTATION/API_DOCUMENTATION.md) - List of integrated endpoints and request contracts.

## 🤝 Contributing

We welcome contributions! Please follow these steps:
1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## Preview

# Desktop
![image](https://res.cloudinary.com/dfspekq6u/image/upload/v1781070746/desktop_ss_fosk3x.png)

# Laptop
![image](https://res.cloudinary.com/dfspekq6u/image/upload/v1781070746/laptop_ss_vilzut.png)

# Mobile
![image](https://res.cloudinary.com/dfspekq6u/image/upload/v1781070745/mobile_ss_od0z5y.png)


# Logos
https://i.ibb.co.com/Nm3q6c0/Artboard-1.png

## 📌 Notes

*   The app uses a shared public layout for main site pages and a separate admin area under `/admin`.
*   API requests are driven through RTK Query with a shared base API and a separate public certificate verifier.
*   Public content is split between static JSON data in `data/` and API-backed managed content.

## 📄 License

This project is licensed under the ISC License.

---
Collaborated & Developed with ❤️ by the [**Open Source Software Community City University**](https://ossccu.pro.bd/)
