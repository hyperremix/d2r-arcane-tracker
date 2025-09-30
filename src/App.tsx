import type { JSX } from 'react';
import { RouterProvider } from 'react-router';
import { useTheme } from './hooks/useTheme';
import { router } from './router';

function App(): JSX.Element {
  // Apply theme based on user settings
  useTheme();

  return <RouterProvider router={router} />;
}

export default App;
