import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../config/supabase', () => ({
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  SUPABASE_CONFIGURED: false,
  REST_URL: '/rest/v1',
  AUTH_URL: '/auth/v1',
  STORAGE_URL: '/storage/v1',
  CONFIG_HELP: 'Copy .env.example to .env.local.',
}));

import App from '../App';

describe('missing configuration', () => {
  it('explains what to set instead of failing with a blank page', () => {
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent('Configuration required');
    expect(screen.getByRole('alert')).toHaveTextContent('Copy .env.example to .env.local.');
  });
});
