# Workflow Approval Management System

This project is designed to simplify the approval process for organizational workflows. The main focus is on a clean architecture, secure authentication, structured request handling, and clear separation between frontend and backend responsibilities.

## Architecture Decisions

### Backend Architecture
The backend follows a layered architecture:

```text
API Layer
↓
Service Layer
↓
Repository Layer
↓
Database Layer
```

#### Why this structure is used
- Separation of concerns
- Easier testing
- Better maintainability
- Scalability for future enhancements

#### Layers

##### API Layer
- Handles HTTP requests
- Validates incoming data
- Returns API responses

##### Service Layer
- Contains business logic
- Applies workflow rules
- Manages approval conditions

##### Repository Layer
- Handles database interactions
- Keeps query logic separate from business logic
- Supports cleaner data access patterns

##### Database Layer
- Uses PostgreSQL
- Stores application data through SQLAlchemy models
- Manages database sessions safely

---

## Authentication Design

### Google OAuth 2.0
The application uses Google OAuth as the primary authentication method.

### Authentication flow
1. User clicks "Login with Google"
2. User is redirected to Google consent screen
3. User grants permission
4. Google returns profile information
5. User record is created or updated
6. JWT token is generated for protected access
7. Protected API endpoints become available

### Reason for this design
- Secure authentication
- No password storage
- Better user experience
- Standard industry approach

---

## Database Design

### User Table
Stores authenticated users.

Fields:
- id
- name
- email
- google_id
- role
- created_at

### Design rationale
User information is stored to support OAuth-based authentication and role-based access.

### Approval Request Table
Stores workflow approval requests.

Fields:
- id
- title
- description
- status
- requester_id
- reviewer_id
- created_at
- updated_at

### Design rationale
This structure supports request ownership, reviewer assignment, and status tracking.

### Review Action Table
Stores reviewer decisions.

Fields:
- id
- request_id
- reviewer_id
- decision
- comment
- created_at

### Design rationale
This keeps a clear audit trail of review actions and reviewer accountability.

---

## Frontend Architecture
The frontend is built using React and follows a component-based structure:

```text
Pages
↓
Components
↓
Services
↓
API Layer
```

### Benefits
- Reusable components
- Easier maintenance
- Better scalability
- Clear separation of responsibilities

---

## State Management
React state is used for:
- Authentication state
- User information
- Request and review data

### Reason
The project is small to medium in size, so this approach keeps the frontend simple and maintainable.

---

## API Design Decisions
The API follows RESTful principles.

Examples:
- GET /requests
- POST /requests
- POST /reviews

### Benefits
- Predictable structure
- Easy frontend integration
- Standard API design

---

## Security Decisions

### JWT Authentication
JWT-based access control is used for private endpoints.

### Benefits
- Stateless authentication
- Secure access to protected routes
- Easy scaling for future growth

### Environment Variables
Sensitive data such as database credentials and OAuth secrets are stored in environment files.

### Benefits
- Better security
- Environment-specific configuration
- Cleaner deployment setup

---

## Testing Strategy

### Backend Testing
Framework: Pytest

Focus areas:
- API validation
- Request flow
- Review workflow
- Error handling

### Frontend Testing
Framework: React Testing Library

Focus areas:
- Form behavior
- Request display
- Review actions
- API error handling

---

## Conclusion
The application is designed around maintainability, security, and a clear workflow model. The chosen architecture supports the main goals of the project while keeping the codebase understandable and scalable.

---

## Running Locally
1. Copy [backend/.env.example](backend/.env.example) to [backend/.env](backend/.env).
2. Run `docker compose up --build`.
3. Open the frontend at http://localhost:5173 and the API at http://localhost:8000/docs.
