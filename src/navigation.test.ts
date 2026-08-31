import { pathForPage } from './navigation';

describe('pathForPage', () => {
  test('opening a job overview uses that job id, not a leftover one', () => {
    expect(pathForPage('dashboard', 'job-kelly')).toBe('/jobs/job-kelly');
    expect(pathForPage('dashboard', 'job-78b8dcb3ea6bb3c0')).toBe('/jobs/job-78b8dcb3ea6bb3c0');
  });

  test('jobs home does not keep a job in the URL', () => {
    expect(pathForPage('jobs', 'job-78b8dcb3ea6bb3c0')).toBe('/');
  });
});
