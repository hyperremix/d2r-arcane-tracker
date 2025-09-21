import type { JSX } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './router';

function App(): JSX.Element {
  return (
    <div className="min-h-screen bg-background">
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
