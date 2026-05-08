# DEVELOPMENT GUIDELINES

## Code Style & Standards

### Frontend (React/JavaScript)
- **Language**: JavaScript/React 18
- **Linter**: ESLint (optional)
- **Formatter**: Prettier (optional)
- **Style**: 2-space indentation
- **Naming**: camelCase for variables/functions, PascalCase for components

```javascript
// ✅ Good
const patientName = "John Doe";
const getDoctorInfo = () => {};
export default function PatientCard() {}

// ❌ Bad
const patient_name = "John Doe";
const get_doctor_info = () => {};
export default function patient_card() {}
```

### Backend (Python)
- **Style**: PEP 8
- **Type Hints**: Use for function parameters
- **Docstrings**: Google-style docstrings
- **Indentation**: 4 spaces

```python
# ✅ Good
def get_patient_records(patient_id: str) -> dict:
    """
    Retrieve patient records from database.
    
    Args:
        patient_id: Unique patient identifier
        
    Returns:
        Dictionary containing patient data
    """
    pass

# ❌ Bad
def getPatientRecords(id):
    pass
```

## Component Structure

### React Components
```javascript
import React, { useState, useEffect } from 'react';

// Props interface (optional, using JSDoc)
/**
 * Patient card component
 * @param {string} name - Patient name
 * @param {string} status - Clinical status
 */
export default function PatientCard({ name, status }) {
  // Hooks
  const [data, setData] = useState(null);
  
  // Effects
  useEffect(() => {
    // Logic
  }, []);
  
  // Handlers
  const handleClick = () => {};
  
  // Render
  return (
    <div>
      <h2>{name}</h2>
      <p>{status}</p>
    </div>
  );
}
```

## Commit Message Format

Follow conventional commits:

```
type(scope): subject

body (optional)
footer (optional)
```

**Types**: feat, fix, docs, style, refactor, test, chore

**Examples**:
```
feat(scan): add real-time thermal stream display
fix(auth): resolve Firebase token expiration issue
docs(api): update inference endpoint documentation
chore(deps): upgrade React to 18.3
```

## Testing

### Frontend
```bash
npm test  # Run tests
npm test -- --coverage  # Coverage report
```

### Backend
```bash
pytest  # Run tests
pytest --cov  # Coverage report
```

## Documentation

- Use clear, concise language
- Include code examples
- Add type annotations
- Update README for API changes
- Keep ARCHITECTURE.md current

## Git Workflow

```bash
# Feature branch
git checkout -b feat/patient-search

# Make changes, commit
git commit -m "feat(patients): add search functionality"

# Push
git push origin feat/patient-search

# Create Pull Request on GitHub
# → Review + Merge to main
```

## Common Tasks

### Adding a New Page

1. Create `frontend/src/pages/NewPage.jsx`
2. Add route in `frontend/src/App.jsx`
3. Protect route if needed with `<ProtectedRoute>`
4. Create corresponding Firestore collection if needed

### Adding a New Component

1. Create `frontend/src/components/NewComponent.jsx`
2. Export as default
3. Add JSDoc comments
4. Import in pages that use it

### Adding Backend Endpoint

1. Create route in `backend/inference_server.py`
2. Add error handling
3. Return JSON response
4. Update API documentation

### Adding Firebase Collection

1. Create rules in `firestore.rules`
2. Add indexes in `firestore.indexes.json`
3. Deploy: `firebase deploy --only firestore:rules`

## Performance Checklist

- [ ] Lazy-load components when possible
- [ ] Use React.memo for expensive components
- [ ] Optimize images (WebP format)
- [ ] Minimize bundle size
- [ ] Cache API responses
- [ ] Use database indexes
- [ ] Monitor Firestore usage

## Security Checklist

- [ ] Never commit secrets to git
- [ ] Validate all user inputs
- [ ] Use HTTPS in production
- [ ] Follow Firebase security rules
- [ ] Sanitize user output
- [ ] Use environment variables
- [ ] Review security rules quarterly

## Debugging Tips

### Frontend
```javascript
// Console logging
console.log('Value:', value);
console.table(data);
console.error('Error:', error);

// React DevTools
// Install React DevTools browser extension

// Network tab
// Check API calls, responses, headers
```

### Backend
```python
# Print debugging
print(f'Variable: {var}')

# Logging
import logging
logging.info('Debug message')

# Flask debugger
app.run(debug=True)
```

### Firebase
- Use Firebase Console to inspect data
- Check Firestore activity logs
- Monitor Storage uploads/downloads
- Review Auth activity

## Performance Profiling

### Frontend
```javascript
// React Profiler
import { Profiler } from 'react';

// Or use DevTools Profiler tab
```

### Backend
```python
# cProfile
python -m cProfile -s cumtime inference_server.py
```

## Maintenance Tasks

### Monthly
- Review security rules
- Check for deprecated dependencies
- Update analytics
- Clean up old scans

### Quarterly
- Security audit
- Performance review
- Update documentation
- Plan feature releases

### Annually
- Full security review
- Infrastructure assessment
- Disaster recovery test
- Team training

---

**Keep code clean, tests green, and docs current!** ✨
