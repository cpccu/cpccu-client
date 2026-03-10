# Request & Data Flow

## Data Flow Overview
Since the current version of the project uses static JSON files, the "request" flow is primarily internal within the frontend.

### 1. Data Loading
Components import JSON data directly using ES Modules syntax:
```javascript
import data from "./../../../../data/upcomingEvent.json";
```

### 2. State Initialization
The imported data is often used to initialize local component state:
```javascript
const [events, setEvents] = useState(data);
```

### 3. Rendering
The component maps over the data to render specialized sub-components:
```javascript
{data.map((item, index) => (
  <UpComingEventCard key={index} data={item} />
))}
```

### 4. User Interaction (Scroll & Navigation)
- **Navigation**: Managed by `react-router-dom`. URL changes trigger component swaps.
- **Scroll Context**: Using custom Context (e.g., `BlogScrollProvider`) to manage target scrolling between disparate components.

## Future Transitions
This flow is designed to be easily replaced by `fetch` or `axios` calls to a backend API without changing the component rendering logic.
